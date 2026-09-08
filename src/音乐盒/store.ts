import { klona } from 'klona';
import { defineStore } from 'pinia';
import { ref } from 'vue';

// ============================================================
// 音乐盒 Store
// - 播放列表（链接 / 本地文件 base64）
// - 场景映射（场景名 + 关键词 + 绑定曲目）
// - 持久化到酒馆脚本变量 {type:'script'}
// ============================================================

export interface Track {
  /** 曲目标题（播放列表内唯一键） */
  title: string;
  /** 音乐地址：网络链接 或 data:audio/*;base64 文件 */
  url: string;
  /** 来源：url=网络链接 / file=本地文件 / netease=网易云解析 */
  source: 'url' | 'file' | 'netease';
}

export interface SceneRule {
  /** 场景名（显示用，唯一） */
  name: string;
  /** 触发关键词，逗号分隔（变量文本 / 消息文本包含任一关键词即命中） */
  keywordsText: string;
  /** 绑定的曲目标题（空 = 未绑定） */
  trackTitle: string;
}

export interface Settings {
  /** 场景自动切歌总开关 */
  autoSwitch: boolean;
  /** 变量通道（读 stat_data 下 varPaths） */
  checkVariables: boolean;
  /** 消息通道（扫最近 recentMessageCount 条消息） */
  checkMessages: boolean;
  /** 变量读取路径（相对 stat_data，如 世界.当前位置） */
  varPaths: string[];
  /** 消息通道扫描的最近消息条数 */
  recentMessageCount: number;
  /** 场景切换最小间隔（毫秒，防切歌风暴） */
  switchCooldown: number;
}

const STORAGE_KEY = 'music_box_data';

function defaultSettings(): Settings {
  return {
    autoSwitch: true,
    checkVariables: true,
    checkMessages: true,
    varPaths: ['世界.当前位置', '世界.当前地点', '世界.时间', '世界.天气'],
    recentMessageCount: 6,
    switchCooldown: 5000,
  };
}

export const useMusicBoxStore = defineStore('musicbox', () => {
  const tracks = ref<Track[]>([]);
  const sceneRules = ref<SceneRule[]>([]);
  const settings = ref<Settings>(defaultSettings());

  // ---- 播放状态（轮询刷新，供 UI 显示） ----
  const playing = ref(false);
  const progress = ref(0);
  const volume = ref(40);

  // ---- 场景状态 ----
  const currentScene = ref('');
  const currentTrackTitle = ref('');
  const lastSwitchAt = ref(0);
  /** 临时禁用自动切换（点了暂停自动切歌按钮） */
  const autoDisabled = ref(false);

  // ================= 持久化 =================

  function saveToVariables(): void {
    try {
      insertOrAssignVariables({
        [STORAGE_KEY]: klona({
          tracks: tracks.value,
          sceneRules: sceneRules.value,
          settings: settings.value,
        }),
      }, { type: 'script' });
    } catch (e) {
      console.warn('[音乐盒] 保存变量失败:', e?.message || e);
    }
  }

  function loadFromVariables(): void {
    try {
      const stored = getVariables({ type: 'script' })[STORAGE_KEY];
      if (!stored || typeof stored !== 'object') return;
      if (Array.isArray(stored.tracks)) {
        tracks.value = stored.tracks
          .filter((t: any) => t && typeof t.url === 'string' && t.url)
          .map((t: any) => ({
            title: String(t.title || ''),
            url: t.url,
            source: t.source === 'file' ? 'file' as const : (t.source === 'netease' ? 'netease' as const : 'url' as const),
          }));
      }
      if (Array.isArray(stored.sceneRules)) {
        sceneRules.value = stored.sceneRules
          .filter((r: any) => r && typeof r.name === 'string' && r.name)
          .map((r: any) => ({
            name: r.name,
            keywordsText: String(r.keywordsText ?? (Array.isArray(r.keywords) ? r.keywords.join('、') : '')),
            trackTitle: String(r.trackTitle || ''),
          }));
      }
      if (stored.settings && typeof stored.settings === 'object') {
        settings.value = { ...defaultSettings(), ...stored.settings };
        // 防御：旧档/异常数据导致关键字段类型不对时，回退默认值，避免渲染崩溃
        if (!Array.isArray(settings.value.varPaths)) settings.value.varPaths = defaultSettings().varPaths;
        settings.value.switchCooldown = Math.max(1000, Number(settings.value.switchCooldown) || 5000);
        settings.value.recentMessageCount = Math.max(1, Math.min(50, Number(settings.value.recentMessageCount) || 6));
      }
    } catch (e) {
      console.warn('[音乐盒] 加载变量失败:', e?.message || e);
    }
  }

  // ================= 播放列表 =================

  function extractTitleFromUrl(url: string): string {
    try {
      const u = new URL(url);
      const name = u.pathname.split('/').pop() || '';
      return decodeURIComponent(name).replace(/\.[a-z0-9]+$/i, '') || u.hostname;
    } catch {
      return '未命名曲目';
    }
  }

  function addTrack(track: { title?: string; url: string; source?: 'url' | 'file' | 'netease' }): void {
    const title = String(track.title || '').trim() || extractTitleFromUrl(track.url);
    if (!title || !track.url) return;
    if (tracks.value.some(t => t.url === track.url || t.title === title)) return; // 不重复
    tracks.value.push({ title, url: track.url, source: track.source === 'file' ? 'file' : (track.source === 'netease' ? 'netease' : 'url') });
    saveToVariables();
  }

  // ================= 网易云链接解析 =================
  /**
   * 解析网易云歌曲链接（https://music.163.com/song?id=xxx 或 #/song?id=xxx）→ 可播放链接。
   * 网易云原生 API 无 CORS 头（浏览器直接 fetch 会被拦截），改用 Meting 解析服务
   * （返回 CORS:* 的 JSON：歌名/作者/播放链接），多镜像依次尝试。
   * 注意：VIP 会员曲目 / 无版权曲目仍会解析失败。
   */
  const METING_SERVERS = [
    'https://api.i-meto.com/meting/api',
    'https://meting.qjqq.cn/api/meting/api',
  ];

  async function resolveNeteaseTrack(songId: string): Promise<Track | null> {
    const id = String(songId || '').replace(/\D/g, '');
    if (!id) return null;
    for (const server of METING_SERVERS) {
      try {
        const res = await fetch(`${server}?server=netease&type=song&id=${id}`, { mode: 'cors' });
        if (!res.ok) continue;
        const arr = await res.json();
        const song = Array.isArray(arr) ? arr[0] : null;
        if (song && typeof song.url === 'string' && song.url) {
          const title = [song.title, song.author].filter(Boolean).join(' - ') || `网易云歌曲 ${id}`;
          const track: Track = { title, url: song.url, source: 'netease' };
          addTrack(track);
          return track;
        }
      } catch { /* 该镜像失败，尝试下一个 */ }
    }
    return null;
  }

  function removeTrack(index: number): void {
    const t = tracks.value[index];
    if (!t) return;
    tracks.value.splice(index, 1);
    // 解除场景规则对该曲目的绑定
    sceneRules.value.forEach(r => { if (r.trackTitle === t.title) r.trackTitle = ''; });
    // 若当前正播放它，停止
    if (currentTrackTitle.value === t.title) {
      currentTrackTitle.value = '';
      currentScene.value = '';
      try { pauseAudio('bgm'); } catch { /* ignore */ }
    }
    saveToVariables();
  }

  // ================= 场景规则 =================

  function addSceneRule(rule: Partial<SceneRule>): void {
    const name = String(rule.name || '').trim();
    if (!name) return;
    if (sceneRules.value.some(r => r.name === name)) return;
    sceneRules.value.push({
      name,
      keywordsText: String(rule.keywordsText || ''),
      trackTitle: String(rule.trackTitle || ''),
    });
    saveToVariables();
  }

  function removeSceneRule(index: number): void {
    const rule = sceneRules.value[index];
    if (!rule) return;
    sceneRules.value.splice(index, 1);
    if (currentScene.value === rule.name) currentScene.value = '';
    saveToVariables();
  }

  function ruleKeywords(rule: SceneRule): string[] {
    return String(rule.keywordsText || '')
      .split(/[,，、\s]+/)
      .map(k => k.trim())
      .filter(Boolean);
  }

  // ================= 播放控制 =================

  function playTrack(track: Track): void {
    if (!track || !track.url) return;
    try {
      playAudio('bgm', { title: track.title || undefined, url: track.url });
      currentTrackTitle.value = track.title;
      lastSwitchAt.value = Date.now();
    } catch (e) {
      console.warn('[音乐盒] 播放失败:', e?.message || e);
      if (typeof toastr !== 'undefined') toastr.error(`播放「${track.title}」失败：${e?.message || e}`, '音乐盒');
    }
  }

  function togglePlay(): void {
    try {
      const cur = getCurrentAudio('bgm');
      if (!cur.src) {
        const t = tracks.value.find(x => x.title === currentTrackTitle.value) || tracks.value[0];
        if (t) playTrack(t);
        return;
      }
      if (cur.playing) pauseAudio('bgm');
      else playAudio('bgm', { url: cur.src });
    } catch (e) {
      console.warn('[音乐盒] 播放切换失败:', e?.message || e);
    }
  }

  function playNext(delta: 1 | -1): void {
    if (!tracks.value.length) return;
    const idx = tracks.value.findIndex(t => t.title === currentTrackTitle.value);
    const next = tracks.value[(idx === -1 ? 0 : (idx + delta + tracks.value.length) % tracks.value.length)];
    playTrack(next);
  }

  function setVolume(v: number): void {
    volume.value = Math.max(0, Math.min(100, Math.round(v)));
    try { setAudioSettings('bgm', { volume: volume.value }); } catch { /* ignore */ }
  }

  /** 轮询刷新播放状态（供 UI 显示） */
  function refreshPlayState(): void {
    try {
      const cur = getCurrentAudio('bgm');
      playing.value = !!cur.playing;
      progress.value = cur.progress || 0;
      if (cur.title) currentTrackTitle.value = cur.title;
    } catch { /* ignore */ }
    try {
      volume.value = getAudioSettings('bgm').volume;
    } catch { /* ignore */ }
  }

  // ================= 场景检测 =================

  /** 在给定文本列表中匹配场景规则（第一个命中返回） */
  function matchScene(texts: string[]): SceneRule | null {
    if (!settings.value.autoSwitch || autoDisabled.value) return null;
    if (!texts.some(t => t && String(t).trim())) return null;
    for (const rule of sceneRules.value) {
      if (!rule.trackTitle) continue;
      if (!tracks.value.some(t => t.title === rule.trackTitle)) continue;
      const keywords = ruleKeywords(rule);
      if (!keywords.length) continue;
      const hit = texts.some(text => {
        const t = String(text || '');
        return keywords.some(k => k && t.includes(k));
      });
      if (hit) return rule;
    }
    return null;
  }

  /** 应用场景：切换到绑定曲目（同场景不重复切 + 冷却防抖） */
  function applyScene(rule: SceneRule): void {
    const now = Date.now();
    if (rule.name === currentScene.value) return;
    if (now - lastSwitchAt.value < settings.value.switchCooldown) return;
    const track = tracks.value.find(t => t.title === rule.trackTitle);
    if (!track) return;
    currentScene.value = rule.name;
    lastSwitchAt.value = now;
    try {
      playAudio('bgm', { title: track.title || undefined, url: track.url });
      currentTrackTitle.value = track.title;
      console.log(`[音乐盒] 场景「${rule.name}」→ 播放「${track.title}」`);
      if (typeof toastr !== 'undefined') toastr.info(`🎵 场景「${rule.name}」→ ${track.title}`, '音乐盒');
    } catch (e) {
      console.warn('[音乐盒] 场景切歌失败:', e?.message || e);
    }
  }

  /** 一键收集场景检测文本（变量 + 最近消息） */
  function collectSceneTexts(): string[] {
    const texts: string[] = [];
    if (settings.value.checkVariables) {
      try {
        const all = typeof getAllVariables === 'function' ? getAllVariables() : {};
        const stat = all.stat_data || {};
        settings.value.varPaths.forEach(p => {
          try {
            const v = _.get(stat, p);
            if (typeof v === 'string' && v.trim()) texts.push(v);
          } catch { /* ignore */ }
        });
      } catch { /* ignore */ }
    }
    if (settings.value.checkMessages) {
      try {
        const lastId = getLastMessageId();
        if (lastId > 0) {
          const from = Math.max(1, lastId - Math.max(1, settings.value.recentMessageCount) + 1);
          const msgs = getChatMessages(`${from}-${lastId}`, { role: 'all', hide_state: 'unhidden' });
          msgs.forEach(m => { if (m && m.message) texts.push(m.message); });
        }
      } catch { /* ignore */ }
    }
    return texts;
  }

  /** 收集文本并检测、应用场景（供事件回调调用） */
  function detectAndApplyScene(): void {
    try {
      const rule = matchScene(collectSceneTexts());
      if (rule) applyScene(rule);
    } catch (e) {
      console.warn('[音乐盒] 场景检测失败:', e?.message || e);
    }
  }

  return {
    tracks, sceneRules, settings,
    playing, progress, volume,
    currentScene, currentTrackTitle, lastSwitchAt, autoDisabled,
    saveToVariables, loadFromVariables,
    addTrack, removeTrack, addSceneRule, removeSceneRule, ruleKeywords,
    resolveNeteaseTrack,
    playTrack, togglePlay, playNext, setVolume, refreshPlayState,
    matchScene, applyScene, collectSceneTexts, detectAndApplyScene,
  };
});
