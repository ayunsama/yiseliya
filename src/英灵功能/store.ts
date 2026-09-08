import { defineStore } from 'pinia';

/** 英灵条目信息 */
export interface HeroEntry {
  name: string;        // 完整条目名，如 "英灵/初代勇者雷恩"
  displayName: string; // 显示名，如 "初代勇者雷恩"
  shortName: string;   // 简称，如 "雷恩"
  content: string;     // 条目内容（人设提示词）
  enabled: boolean;    // 世界书中是否启用
  uid: number;         // 世界书条目 uid
  log: string;         // LOG 图标
}

/** 聊天消息 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  /** 态度/情绪（从 <标签|态度> 中解析） */
  mood?: string;
}

/** 是否来自 stat_data.同伴 */
export interface HeroEntry {
  name: string;
  displayName: string;
  shortName: string;
  content: string;
  enabled: boolean;
  uid: number;
  log: string;
  /** NPC 同伴标记 */
  isCompanion?: boolean;
}

/** 英灵列表 */
const HERO_SPIRIT_NAMES = [
  '英灵/初代勇者雷恩',
  '英灵/第四代魔女莎提拉',
  '英灵/小魔王伊莉丝',
  '英灵/小圣女索菲亚',
  '英灵/指引妖精莉耶芙',
  '英灵/断钢的勇者·艾莉卡',
  '英灵/燃尽的贤者·伊利亚',
  '英灵/末代的神龙·科里维坦',
  '英灵/被夺的魔女·莉莉丝',
  '英灵/盲目的莉莉娅',
  '英灵/圣光神索利昂',
  '英灵/深渊的魅魔·阿丝茉德',
] as const;

/** LOG 图标映射（短名 → 图标） */
const HERO_LOG_MAP: Record<string, string> = {
  '雷恩': '⚔',
  '莎提拉': '😈',
  '伊莉丝': '👑',
  '索菲亚': '👻',
  '指引': '🧚',
  '断钢': '🗡️',
  '燃尽': '🔮',
  '末代': '🐉',
  '被夺': '🌑',
  '盲目': '⌛',
  '回溯': '⌛',
  '圣光': '☀',
  '索利': '☀',
  '索利昂': '☀',
  '深渊': '💋',
};

/** NPC 同伴默认图标 */
const NPC_DEFAULT_LOG = '🧑';

const WORLD_BOOK_NAME = '伊瑟利亚';

function parseDisplayName(fullName: string): { displayName: string; shortName: string } {
  const parts = fullName.split('/');
  const last = parts[parts.length - 1] || fullName;
  // 提取简称：尝试取第一个有意义的词
  const shortMatch = last.match(/^(.+?)(?:[的])/);
  const shortName = shortMatch ? shortMatch[1] : last.slice(0, 2);
  return { displayName: last, shortName };
}

/** 通用标签解析：自动检测任意 <标签|态度>内容</标签> 格式
 * 例如 <小圣女索菲亚|平静>你好</小圣女索菲亚>
 * 返回 { content: 剥离标签后的内容, mood: 态度文字或空 }
 * 如果没有任何标签匹配，原样返回
 */
function parseAnyTaggedContent(text: string): { content: string; mood: string } {
  // 匹配 <任意标签名|态度>内容</同名标签>
  const regex = /<([^>|]+)\|([^>]+)>([\s\S]*?)<\/\1>/;
  const match = text.match(regex);
  if (match) {
    return { content: match[3].trim(), mood: match[2].trim() };
  }
  // 回退：不带|的标签 <标签>内容</标签>
  const fallbackRegex = /<([^>|]+)>([\s\S]*?)<\/\1>/;
  const fallbackMatch = text.match(fallbackRegex);
  if (fallbackMatch) {
    return { content: fallbackMatch[2].trim(), mood: '' };
  }
  // 没有标签包裹则原样返回
  return { content: text, mood: '' };
}

/** 聊天记录存储键 */
const CHAT_STORAGE_KEY = 'hero_spirit_chats';
/** 自动总结的概要存储键（每英灵/同伴一段累积概要） */
const CHAT_SUMMARY_KEY = 'hero_spirit_summaries';
/** 私聊记录超过该条数时触发自动总结 */
const SUMMARY_THRESHOLD = 50;
/** 自动总结后保留的最近消息条数 */
const KEEP_RECENT = 20;

/** 保存指定英灵的聊天记录到脚本变量 */
function saveMessages(heroKey: string, msgs: ChatMessage[]) {
  try {
    const existing = getVariables({ type: 'script' });
    const all = existing[CHAT_STORAGE_KEY] || {};
    all[heroKey] = msgs;
    insertOrAssignVariables({ [CHAT_STORAGE_KEY]: all }, { type: 'script' });
  } catch { /* 静默失败 */ }
}

/** 加载指定英灵的聊天记录 */
function loadMessages(heroKey: string): ChatMessage[] {
  try {
    const existing = getVariables({ type: 'script' });
    const all = existing[CHAT_STORAGE_KEY] || {};
    return (all[heroKey] as ChatMessage[]) || [];
  } catch {
    return [];
  }
}

/** 保存指定英灵的自动总结概要到脚本变量 */
function saveSummary(heroKey: string, summary: string) {
  try {
    const existing = getVariables({ type: 'script' });
    const all = existing[CHAT_SUMMARY_KEY] || {};
    all[heroKey] = summary;
    insertOrAssignVariables({ [CHAT_SUMMARY_KEY]: all }, { type: 'script' });
  } catch { /* 静默失败 */ }
}

/** 加载指定英灵的自动总结概要 */
function loadSummary(heroKey: string): string {
  try {
    const existing = getVariables({ type: 'script' });
    const all = existing[CHAT_SUMMARY_KEY] || {};
    return (all[heroKey] as string) || '';
  } catch {
    return '';
  }
}

/** 过滤主线上下文中的状态/档案类数据块（角色档案、HTML注释、记忆宏等），避免泄漏进私聊 */
function sanitizeMainContext(raw: string): string {
  if (!raw) return '';
  let text = raw
    // 1. 整体删除记忆表格 <Memory>...</Memory> 块（yuzuki-Memory / 记忆类插件的实时追溯块，含注释包裹与无注释两种变体）
    .replace(/<Memory[\s\S]*?<\/Memory>/gi, '')
    // 2. 删除残留的 <Memory> / </Memory> 标签
    .replace(/<\/?Memory\b[^>]*>/gi, '')
    // 3. 去掉 HTML 注释块（如 <!-- #角色档案 ... --> ）
    .replace(/<!--[\s\S]*?-->/g, '')
    // 4. 去掉形如「[角色名]|当前位置：...|周围角色：...」的状态档案行（含不在行首的变体）
    .replace(/\[[^\]]*\]\|[^\n]*/g, '')
    // 5. 去掉记忆表格章节标题（#角色档案 / #物品 / #世界设定 / #主线摘要 ...，含不在行首的变体）
    .replace(/#+(角色档案|物品追踪|世界设定|主线摘要|支线摘要|物品|人物档案|约定|待办事项)[^\n]*/g, '')
    // 6. 去掉记忆注入 marker 标题（【当前世界状态参考 - ...】【前情提要 - ...】【记忆只读数据库 - ...】【剧情摘要 ...】等）
    .replace(/【(?:当前世界状态参考|前情提要|记忆只读数据库|剧情摘要)[^\n]*】?/g, '')
    // 7. 去掉酒馆/记忆宏 {{...}}（如 {{MEMORY}} {{MEMORY_SUMMARY}} {{角色名}} {{VECTOR_MEMORY}} 等）
    .replace(/\{\{[^}]*\}\}/g, '')
    // 8. 去掉 # 标题行
    .replace(/^#+.*$/gm, '')
    // 9. 去掉被清空后残留的空发言行（如仅有注释的 [AI]: ）
    .replace(/^\[[^\]]+\]:\s*$/gm, '');
  // 合并多余空行
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

/** 读取 yuzuki-Memory 插件的记忆总结（剧情摘要/前情提要，非角色档案表格），供私聊感知外界；插件未启用时返回空串 */
function getYuzukiMemorySummary(): string {
  try {
    const Y = (globalThis as any).YuzukiMemory;
    const state = Y?.Storage?.loadState?.() ?? Y?.Storage?.getCurrentState?.();
    if (!state) return '';
    const summary = Y?.VariableInjector?.buildSummaryText?.(state);
    return String(summary || '').trim();
  } catch {
    return '';
  }
}

/** 读取最近的主聊天消息作为上下文 */
function getMainChatContext(maxCount: number = 10): string {
  try {
    const lastId = getLastMessageId();
    if (lastId < 0) return '';
    const startId = Math.max(0, lastId - maxCount + 1);
    const messages = getChatMessages(`${startId}-${lastId}`, { role: 'all', hide_state: 'unhidden' });
    if (!messages || messages.length === 0) return '';
    return sanitizeMainContext(
      messages
        .map(m => `[${m.role === 'user' ? '你' : m.name || 'AI'}]: ${m.message}`)
        .join('\n\n'),
    );
  } catch {
    return '';
  }
}

/** 将英灵/同伴聊天记录精简为概要（避免完整记录淹没主线上下文） */
function condenseChatSummary(msgs: ChatMessage[], displayName: string): string {
  const total = msgs.length;
  const last = msgs[total - 1];
  const timeStr = last?.timestamp
    ? new Date(last.timestamp).toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    : '';

  const fmt = (m: ChatMessage, who: string, max: number) => {
    const text = String(m?.content || '').replace(/\s+/g, ' ').trim();
    return `${who}：${text.length > max ? text.slice(0, max) + '…' : text}`;
  };

  const head = `（共 ${total} 条${timeStr ? `，最近 ${timeStr}` : ''}）`;

  // 消息很少时全列（单条截断）；较多时只保留最后一轮对话作为近况
  if (total <= 4) {
    const parts = msgs.map(m => fmt(m, m.role === 'user' ? '你' : displayName, 50));
    return `${head}\n${parts.join('\n')}`;
  }
  const recent = msgs.slice(-2).map(m => fmt(m, m.role === 'user' ? '你' : displayName, 50));
  return `${head}\n最近：${recent.join(' / ')}`;
}

export const useHeroSpiritStore = defineStore('heroSpirit', () => {
  // ---- 状态 ----
  const heroes = ref<HeroEntry[]>([]);
  const companions = ref<HeroEntry[]>([]);
  const selectedHero = ref<HeroEntry | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const loading = ref(false);
  const panelExpanded = ref(false);
  const viewMode = ref<'list' | 'chat' | 'detail'>('list');
  /** 当前标签页：'heroes' = 英灵殿，'companions' = 同伴 */
  const activeTab = ref<'heroes' | 'companions'>('heroes');
  /** 英灵共鸣运行时数据（stat_data.英灵，含残响/羁绊/被动/执念/英灵技） */
  const spiritRuntime = ref<any>(null);
  /** 英灵殿档案（stat_data.英灵.英灵殿：{英灵名: {残响, 羁绊, 状态, 执念完成}}） */
  const hall = ref<Record<string, any>>({});

  // ---- 读取 stat_data.英灵（MVU 快照，与状态栏一致） ----
  function readSpiritRuntime(): any {
    try {
      const mvu = (window as any).Mvu;
      if (!mvu?.getMvuData) return null;
      const d = mvu.getMvuData({ type: 'message', message_id: 'latest' });
      return d?.stat_data?.英灵 || null;
    } catch {
      return null;
    }
  }

  /** 刷新英灵共鸣数据（残响/羁绊/被动/执念/英灵技/英灵殿） */
  function refreshSpiritRuntime() {
    const s = readSpiritRuntime();
    spiritRuntime.value = s;
    hall.value = (s && s.英灵殿) || {};
  }

  /** 查询某英灵的英灵殿档案（按名称互相包含匹配） */
  function hallInfo(heroName: string): any | null {
    const h = hall.value || {};
    for (const k of Object.keys(h)) {
      if ((heroName && heroName.includes(k)) || k.includes(heroName || '')) return h[k];
    }
    return null;
  }

  /** 释放英灵技（硬校验 + 变量写入；与 /英灵技 指令逻辑一致，面板按钮直接调用） */
  async function releaseSpiritSkill(): Promise<{ ok: boolean; msg: string }> {
    try {
      const s = readSpiritRuntime();
      if (!s) return { ok: false, msg: '未找到契主英灵（stat_data.英灵 为空）' };
      const name = String(s.名称 || '无名英灵');
      const power = Number(s.残响之力 || 0);
      const status = String(s.状态 || '苏醒');
      const cooldown = Number(s.英灵技?.冷却 || 0);
      const skillName = String(s.英灵技?.名称 || '');

      if (power < 100) return { ok: false, msg: `残响之力不足（${power}/100），无法释放` };
      if (status !== '苏醒') return { ok: false, msg: `英灵正处于「${status}」状态，无法释放` };
      if (cooldown > 0) return { ok: false, msg: `英灵技冷却中（剩余 ${cooldown}）` };
      if (!skillName) return { ok: false, msg: '未登记英灵技名称（英灵.英灵技.名称 为空）' };

      const mvu = (window as any).Mvu;
      if (!mvu?.replaceMvuData) return { ok: false, msg: 'MVU 框架未初始化' };
      const mvuData = mvu.getMvuData({ type: 'message', message_id: 'latest' });
      if (!mvuData.stat_data) mvuData.stat_data = {};
      const sp = mvuData.stat_data.英灵 || (mvuData.stat_data.英灵 = { 名称: name, 残响之力: 0, 状态: '苏醒' });

      // 沉睡冷却：莉莉丝系按已释放次数翻倍（1/3/7/15…），其余固定 1
      let newCool = 1;
      if (name.includes('莉莉丝')) {
        newCool = Math.min(30, Math.pow(2, Number(sp.英灵技?.已释放 || 0) + 1) - 1);
      }
      sp.残响之力 = 0;
      sp.状态 = '沉睡';
      sp.英灵技 = sp.英灵技 || {};
      sp.英灵技.冷却 = newCool;
      sp.英灵技.已释放 = Number(sp.英灵技.已释放 || 0) + 1;
      // 同步英灵殿档案
      const h = sp.英灵殿 || {};
      for (const k of Object.keys(h)) {
        if (name.includes(k) || k.includes(name)) {
          h[k].残响 = 0;
          h[k].状态 = '沉睡';
        }
      }
      await mvu.replaceMvuData(mvuData, { type: 'message', message_id: 'latest' });
      refreshSpiritRuntime();
      return { ok: true, msg: `「${skillName}」已释放！${name}陷入沉睡（${newCool}日后苏醒），请在正文输出 <英灵技·${skillName}>` };
    } catch (e: any) {
      console.warn('[英灵功能] 释放英灵技失败:', e);
      return { ok: false, msg: String(e?.message || e) };
    }
  }

  // ---- 从 stat_data.同伴 读取 NPC ----
  function loadCompanions(): HeroEntry[] {
    const log = (...a: any[]) => console.log('[英灵功能·同伴]', ...a);
    try {
      // 尝试多个来源读取 stat_data.同伴
      let raw: any;
      let source = '';

      // 来源1：Mvu.getMvuData({ type: 'chat' })
      try {
        const mvu = (window as any).Mvu;
        if (mvu?.getMvuData) {
          const d = mvu.getMvuData({ type: 'chat' });
          if (d?.stat_data?.同伴) { raw = d.stat_data.同伴; source = 'Mvu.chat'; }
        }
      } catch {}

      // 来源2：Mvu.getMvuData({ type: 'message', message_id: 'latest' })
      if (!raw) try {
        const mvu = (window as any).Mvu;
        if (mvu?.getMvuData) {
          const d = mvu.getMvuData({ type: 'message', message_id: 'latest' });
          if (d?.stat_data?.同伴) { raw = d.stat_data.同伴; source = 'Mvu.message'; }
        }
      } catch {}

      // 来源3：getVariables({ type: 'chat' })
      if (!raw) try {
        const d = getVariables({ type: 'chat' });
        if (d?.stat_data?.同伴) { raw = d.stat_data.同伴; source = 'getVars.chat'; }
      } catch {}

      // 来源4：getVariables({ type: 'message', message_id: -1 })
      if (!raw) try {
        const d = getVariables({ type: 'message', message_id: -1 });
        // MVU 数据可能用 lodash 路径嵌套
        if (d?.stat_data?.同伴) { raw = d.stat_data.同伴; source = 'getVars.message'; }
      } catch {}

      if (!raw) {
        log('所有来源均未找到 stat_data.同伴');
        // 打印当前 chat 变量结构前 3 个 key 用于诊断
        try {
          const test = getVariables({ type: 'chat' });
          log('chat 变量顶层 keys:', Object.keys(test || {}).slice(0, 10));
          const hasStat = test?.stat_data;
          log('stat_data 存在:', !!hasStat, typeof hasStat);
          if (hasStat) log('stat_data keys:', Object.keys(hasStat).slice(0, 10));
        } catch {}
        return [];
      }

      log(`从 ${source} 读取到同伴数据`);

      const names = Object.keys(raw).filter(k => k.trim());
      log('同伴名单:', names);

      if (names.length === 0) {
        log('同伴对象存在但无 key');
        return [];
      }

      return names.map((name, idx) => {
        const info = raw[name] || {};
        const parts: string[] = [];
        if (info.外貌) parts.push(`外貌：${info.外貌}`);
        if (info.性格) parts.push(`性格：${info.性格}`);
        if (info.背景故事) parts.push(`背景：${info.背景故事}`);
        if (info.身份) parts.push(`身份：${info.身份}`);
        if (info.种族) parts.push(`种族：${info.种族}`);
        if (info.所属势力) parts.push(`所属势力：${info.所属势力}`);
        const flavor = parts.length > 0 ? parts.join('\n') : '';
        const content = `你是一位名叫${name}的角色${flavor ? `。\n${flavor}` : ''}。\n\n请完全以${name}的身份与我对话，语气自然亲切，符合你的人设。`;

        return {
          name: `同伴/${name}`,
          displayName: name,
          shortName: name.slice(0, 2),
          content,
          enabled: true,
          uid: 9000 + idx,
          log: NPC_DEFAULT_LOG,
          isCompanion: true,
        };
      });
    } catch (e) {
      console.warn('[英灵功能] 读取同伴失败:', e);
      return [];
    }
  }

  // ---- 切换标签页 ----
  function switchTab(tab: 'heroes' | 'companions') {
    activeTab.value = tab;
  }

  // ---- 世界书操作 + 同伴 ----
  async function loadHeroesFromWorldbook() {
    try {
      // 1. 从世界书读取英灵
      const entries = await getWorldbook(WORLD_BOOK_NAME);
      const heroEntries = entries.filter(e =>
        HERO_SPIRIT_NAMES.some(name => e.name.includes(name)),
      );
      heroes.value = heroEntries.map(e => {
        const { displayName, shortName } = parseDisplayName(e.name);
        return {
          name: e.name,
          displayName,
          shortName,
          content: e.content || '(空)',
          enabled: e.enabled,
          uid: e.uid,
          log: HERO_LOG_MAP[shortName] || '✦',
        };
      });

      // 2. 从 stat_data.同伴 读取 NPC（独立列表）
      companions.value = loadCompanions();
    } catch (e: any) {
      console.warn('[英灵功能] 读取列表失败:', e?.message || e);
      heroes.value = [];
      companions.value = [];
    }
  }

  // ---- 选择英灵/同伴 ----
  function selectHero(hero: HeroEntry) {
    selectedHero.value = hero;
    messages.value = loadMessages(hero.shortName);
    viewMode.value = 'chat';
  }

  // ---- 聊天 ---- */
  async function sendMessage(text: string): Promise<void> {
    if (!selectedHero.value || loading.value || !text.trim()) return;
    loading.value = true;

    const userText = text.trim();
    const userMsg: ChatMessage = { role: 'user', content: userText, timestamp: Date.now() };
    messages.value.push(userMsg);
    saveMessages(selectedHero.value.shortName, messages.value);

    try {
      const hero = selectedHero.value;

      // 构建历史（不含当前最新消息，因为后面作为 user_input 单独传入）
      const historyWithoutLast = messages.value.slice(0, -1)
        .map(m => `${m.role === 'user' ? '你' : hero.displayName}：${m.content}`)
        .join('\n\n');

      // 读取主聊天上下文（最近 10 条）
      const mainContext = getMainChatContext(10);

      const systemDef = hero.isCompanion
        ? hero.content
        : `你是${hero.displayName}。${hero.content}\n\n请完全以${hero.displayName}的身份与我对话，保持角色设定，使用符合你身份的语气和口吻。每次回复控制在200字以内，用自然的口语对话风格，像真正的面对面聊天一样。`;

      const ordered_prompts: any[] = [
        { role: 'system', content: systemDef },
        { role: 'system', content: '对话规则：\n1. 用第一人称回复\n2. 每次回复简洁自然，像日常对话\n3. 不要刻意输出长段落\n4. 保留角色特色的语气词和口头禅\n5. 可以主动提问推进对话' },
      ];

      // 注入外界上下文（已过滤角色档案/状态数据块）
      if (mainContext) {
        ordered_prompts.push({
          role: 'system',
          content: `以下是你所感知到的外界正在发生的事情（仅供背景参考，绝不直接复述）。
特别注意：若其中出现 <Memory>、<!-- -->、#角色档案、[角色名]|字段 等记忆/状态/元数据格式，属于系统内部数据，严禁模仿、引用或输出任何类似格式，只当作普通背景信息即可。
${mainContext}`,
        });
      }

      // 注入 yuzuki-Memory 记忆总结（剧情进展/前情提要；非角色档案表格，插件未启用时自动跳过）
      const yuzukiSummary = getYuzukiMemorySummary();
      if (yuzukiSummary) {
        ordered_prompts.push({
          role: 'system',
          content: `以下是你记忆中的主线剧情摘要（帮助你知道主线最近发生了什么；仅供背景参考，用自然语言理解即可，严禁直接复述或输出任何表格/档案/状态格式）：
${yuzukiSummary}`,
        });
      }

      // 注入对话历史（作为上下文）
      if (historyWithoutLast) {
        ordered_prompts.push({
          role: 'system',
          content: `以下是你们之间的对话历史：\n${historyWithoutLast}`,
        });
      }

      // 当前用户输入作为 user 角色
      ordered_prompts.push({ role: 'user', content: userText });

      // 使用 generateRaw 完全隔离酒馆预设
      const result = await generateRaw({
        user_input: userText,
        should_silence: true,
        ordered_prompts,
      });

      let reply = typeof result === 'string' ? result : String(result);

      // ---- 通用标签解析：<任意标签|态度>内容</任意标签> ----
      const parsed = parseAnyTaggedContent(reply);
      reply = parsed.content;
      const mood = parsed.mood;

      const assistantMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now(), mood };
      messages.value.push(assistantMsg);
      saveMessages(hero.shortName, messages.value);

      // ---- 私聊记录超过阈值时，自动把旧消息压缩成概要（保留最近若干条） ----
      if (messages.value.length > SUMMARY_THRESHOLD) {
        await maybeSummarizeChat(hero);
      }

      // ---- 将聊天记录注入到主聊天上下文（英灵 + 同伴都注入） ----
      injectSpiritInfluence(hero, reply, userText);

    } catch (e: any) {
      console.warn('[英灵功能] 生成回复失败:', e?.message || e);
      const name = selectedHero.value?.displayName || '英灵';
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `（${name}似乎陷入了沉默……）`,
        timestamp: Date.now(),
      };
      messages.value.push(errMsg);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 当私聊记录超过阈值时，自动调用 LLM 把旧消息总结成概要，并只保留最近若干条原文。
   * 生成失败时不折叠、保留全部消息，等下一次发送时重试。
   */
  async function maybeSummarizeChat(hero: HeroEntry): Promise<void> {
    try {
      const msgs = messages.value;
      if (msgs.length <= SUMMARY_THRESHOLD) return;

      const keepCount = KEEP_RECENT;
      const oldMsgs = msgs.slice(0, msgs.length - keepCount);
      const recentMsgs = msgs.slice(msgs.length - keepCount);
      if (oldMsgs.length === 0) return;

      const prevSummary = loadSummary(hero.shortName);
      const chatText = oldMsgs
        .map(m => `${m.role === 'user' ? '你' : hero.displayName}：${m.content}`)
        .join('\n');

      // 用 generateRaw 完全隔离酒馆预设，仅做记忆压缩
      const ordered_prompts: any[] = [
        {
          role: 'system',
          content:
            '你是一位记忆整理员。你的任务是把一份私聊记录压缩成精简的中文概要。\n' +
            '要求：\n' +
            '- 只输出概要本身，禁止输出任何解释、寒暄或前言\n' +
            '- 用要点式短句，保留：重要事件、约定承诺、未了结的话题、关系变化、关键信息\n' +
            '- 去除寒暄、无关细节和重复内容\n' +
            '- 全文控制在 200 字以内\n' +
            '- 若提供【已有概要】，需把旧概要的核心信息与新对话合并，避免丢失',
        },
        {
          role: 'system',
          content:
            `${prevSummary ? '【已有概要】\n' + prevSummary + '\n\n' : ''}` +
            `【本次需整理的对话】\n${chatText}`,
        },
        { role: 'user', content: '请把以上内容压缩为一份 200 字以内的要点式概要。' },
      ];

      const result = await generateRaw({
        user_input: '请压缩以上对话为概要',
        should_silence: true,
        ordered_prompts,
      });

      const summaryText = (typeof result === 'string' ? result : String(result)).trim();
      // 生成失败/为空时不折叠，保留原文，等下次再试
      if (!summaryText) return;

      const merged = prevSummary ? `${prevSummary}\n${summaryText}` : summaryText;
      saveSummary(hero.shortName, merged);
      messages.value = recentMsgs;
      saveMessages(hero.shortName, recentMsgs);

      toastr.success(`已自动总结与「${hero.displayName}」的 ${oldMsgs.length} 条旧对话`, '英灵殿');
    } catch (e: any) {
      console.warn('[英灵功能] 自动总结失败（保留原文，下次再试）:', e?.message || e);
    }
  }

  /** 注入英灵聊天影响：将英灵的显示名和图标记录到变量中，供 CHAT_COMPLETION_PROMPT_READY 使用 */
  function injectSpiritInfluence(hero: HeroEntry, _reply: string, _userInput: string) {
    try {
      const existing = getVariables({ type: 'script' });
      const key = 'hero_spirit_influence';
      const influence = existing[key] || {};

      // 仅记录英灵的名片信息（显示名、图标），供后续完整聊天记录注入时使用
      influence[hero.shortName] = {
        lastInteraction: Date.now(),
        log: hero.log,
        displayName: hero.displayName,
      };

      // 检查是否已注册过监听器
      const injectKey = 'hero_spirit_injection';
      const existingInjects = existing[injectKey];
      if (existingInjects?.listener) {
        insertOrAssignVariables({
          [key]: influence,
        }, { type: 'script' });
        return;
      }

      // 首次：注册监听器 + 保存数据
      insertOrAssignVariables({
        [injectKey]: { listener: true },
        [key]: influence,
      }, { type: 'script' });

      // 监听生成前事件，将英灵/同伴聊天记录（自动总结概要 + 最近对话）注入主聊天上下文
      eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }: any) => {
        // 非 RP 工具生成（技能树/总结/装备定制等）不注入英灵互动与共鸣状态，避免污染工具任务
        if ((window as any).__ISURIA_NON_RP__) return;
        try {
          const stored = getVariables({ type: 'script' });
          const allChats = stored[CHAT_STORAGE_KEY] as Record<string, ChatMessage[]> | undefined;
          const heroInfoMap = stored[key] as Record<string, any> | undefined;
          const summaryMap = stored[CHAT_SUMMARY_KEY] as Record<string, string> | undefined;
          if (!allChats || Object.keys(allChats).length === 0) return;

          // ---- 英灵共鸣状态注入（英灵共鸣系统 v2：让 AI 感知残响/被动/执念并结算） ----
          try {
            const resoMarker = '【英灵共鸣状态】';
            const resoInjected = (chat || []).some((m: any) => String(m?.content || '').includes(resoMarker));
            const s = readSpiritRuntime();
            if (!resoInjected && s) {
              const resoLines: string[] = [];
              const name = String(s.名称 || '');
              const power = Number(s.残响之力 || 0);
              const status = String(s.状态 || '苏醒');
              const bond = Number(s.羁绊值 || 0);
              const skillName = String(s.英灵技?.名称 || '');
              const cooldown = Number(s.英灵技?.冷却 || 0);
              const passives = Object.entries(s.被动效果 || {}).map(([k, v]) => `${k}（${v}）`).join('、');
              const obsession = s.执念 || {};
              resoLines.push(`契主英灵：${name || '无'}｜状态：${status}｜残响之力：${power}/100｜羁绊值：${bond}`);
              if (skillName) resoLines.push(`英灵技：${skillName}（释放条件：残响=100 且 苏醒 且 冷却=0；当前冷却 ${cooldown}）`);
              if (passives) resoLines.push(`生效被动：${passives}`);
              if (obsession?.内容) resoLines.push(`执念：${obsession.内容}（进度 ${obsession.进度 || 0}%）${obsession.是否完成 ? '【已完成】' : ''}`);
              if (name) {
                chat.unshift({
                  role: 'system',
                  content: `${resoMarker}\n以下为当前契主英灵的运行时状态（战斗/检定结算必须遵守被动加成与英灵技释放规则，不要复述本段）：\n${resoLines.join('\n')}`,
                });
              }
            }
          } catch { /* ignore resonance inject */ }

          const marker = '【英灵/同伴互动概要】';
          const alreadyInjected = (chat || []).some((m: any) => String(m?.content || '').includes(marker));
          if (alreadyInjected) return;

          const lines: string[] = [];
          // 遍历所有英灵/同伴：注入「自动总结概要 + 最近对话」
          for (const [shortName, msgs] of Object.entries(allChats)) {
            if (!msgs || msgs.length === 0) continue;
            const heroInfo = heroInfoMap?.[shortName] as any;
            const displayName = heroInfo?.displayName || shortName;
            const logIcon = heroInfo?.log || '✦';
            const summary = summaryMap?.[shortName] || '';

            const block: string[] = [];
            if (summary) block.push(`【概要】${summary}`);
            if (msgs.length > 0) block.push(`【最近对话】\n${condenseChatSummary(msgs, displayName)}`);

            lines.push(`${logIcon} === 与 ${displayName} 的互动概要 ===`);
            lines.push(block.join('\n'));
            lines.push(''); // 空行分隔
          }

          if (lines.length > 0) {
            chat.unshift({
              role: 'system',
              content: `以下是你与英灵和同伴们的互动概要（旧对话已自动总结，作为外界互动参考，不要直接复述，也不要让私聊细节喧宾夺主地影响主线叙事）：\n${lines.join('\n')}`,
            });
          }
        } catch { /* ignore inject errors */ }
      });

    } catch { /* ignore */ }
  }

  function clearChat() {
    messages.value = [];
    // 同时清除存储与自动总结概要
    const hero = selectedHero.value;
    if (hero) {
      saveMessages(hero.shortName, []);
      saveSummary(hero.shortName, '');
    }
  }

  // ---- 消息操作：编辑 ----
  function editMessage(index: number, newContent: string) {
    if (index < 0 || index >= messages.value.length) return;
    messages.value[index].content = newContent;
    const hero = selectedHero.value;
    if (hero) saveMessages(hero.shortName, messages.value);
  }

  // ---- 消息操作：删除 ----
  function deleteMessage(index: number) {
    if (index < 0 || index >= messages.value.length) return;
    messages.value.splice(index, 1);
    const hero = selectedHero.value;
    if (hero) saveMessages(hero.shortName, messages.value);
  }

  // ---- 消息操作：撤回（移除最后一组对话） ----
  function recallLast() {
    if (messages.value.length === 0) return;
    // 移除最后的 assistant 消息
    if (messages.value[messages.value.length - 1].role === 'assistant') {
      messages.value.pop();
    }
    // 移除最后的 user 消息
    if (messages.value.length > 0 && messages.value[messages.value.length - 1].role === 'user') {
      messages.value.pop();
    }
    const hero = selectedHero.value;
    if (hero) saveMessages(hero.shortName, messages.value);
  }

  // ---- 消息操作：重新生成 AI 回复 ----
  async function regenerateMessage(index: number): Promise<void> {
    if (index < 0 || index >= messages.value.length || loading.value) return;
    const msg = messages.value[index];
    if (msg.role !== 'assistant') return;

    const hero = selectedHero.value;
    if (!hero) return;

    // 移除这条 AI 消息
    messages.value.splice(index, 1);
    saveMessages(hero.shortName, messages.value);

    // 找到它前面的 user 消息
    let userIdx = -1;
    for (let i = index - 1; i >= 0; i--) {
      if (messages.value[i].role === 'user') {
        userIdx = i;
        break;
      }
    }
    if (userIdx < 0) return;

    const userText = messages.value[userIdx].content;
    loading.value = true;

    try {
      // 构建历史（不含这条 user 消息，因为后面作为 user_input 传入）
      const historyWithoutLast = messages.value.slice(0, userIdx)
        .map(m => `${m.role === 'user' ? '你' : hero.displayName}：${m.content}`)
        .join('\n\n');

      const mainContext = getMainChatContext(10);

      const systemDef = hero.isCompanion
        ? hero.content
        : `你是${hero.displayName}。${hero.content}\n\n请完全以${hero.displayName}的身份与我对话，保持角色设定，使用符合你身份的语气和口吻。每次回复控制在200字以内，用自然的口语对话风格，像真正的面对面聊天一样。`;

      const ordered_prompts: any[] = [
        { role: 'system', content: systemDef },
        { role: 'system', content: '对话规则：\n1. 用第一人称回复\n2. 每次回复简洁自然，像日常对话\n3. 不要刻意输出长段落\n4. 保留角色特色的语气词和口头禅\n5. 可以主动提问推进对话' },
      ];

      if (mainContext) {
        ordered_prompts.push({
          role: 'system',
          content: `以下是你所感知到的外界正在发生的事情（仅供背景参考，绝不直接复述）。
特别注意：若其中出现 <Memory>、<!-- -->、#角色档案、[角色名]|字段 等记忆/状态/元数据格式，属于系统内部数据，严禁模仿、引用或输出任何类似格式，只当作普通背景信息即可。
${mainContext}`,
        });
      }

      // 注入 yuzuki-Memory 记忆总结（剧情进展/前情提要；非角色档案表格，插件未启用时自动跳过）
      const yuzukiSummary = getYuzukiMemorySummary();
      if (yuzukiSummary) {
        ordered_prompts.push({
          role: 'system',
          content: `以下是你记忆中的主线剧情摘要（帮助你知道主线最近发生了什么；仅供背景参考，用自然语言理解即可，严禁直接复述或输出任何表格/档案/状态格式）：
${yuzukiSummary}`,
        });
      }

      if (historyWithoutLast) {
        ordered_prompts.push({
          role: 'system',
          content: `以下是你们之间的对话历史：\n${historyWithoutLast}`,
        });
      }

      ordered_prompts.push({ role: 'user', content: userText });

      const result = await generateRaw({
        user_input: userText,
        should_silence: true,
        ordered_prompts,
      });

      let reply = typeof result === 'string' ? result : String(result);
      const parsed = parseAnyTaggedContent(reply);
      reply = parsed.content;
      const mood = parsed.mood;

      const assistantMsg: ChatMessage = { role: 'assistant', content: reply, timestamp: Date.now(), mood };
      messages.value.push(assistantMsg);
      saveMessages(hero.shortName, messages.value);

      injectSpiritInfluence(hero, reply, userText);
    } catch (e: any) {
      console.warn('[英灵功能] 重新生成失败:', e?.message || e);
      const errMsg: ChatMessage = {
        role: 'assistant',
        content: `（${hero.displayName}似乎陷入了沉默……）`,
        timestamp: Date.now(),
      };
      messages.value.push(errMsg);
    } finally {
      loading.value = false;
    }
  }

  function goBack() {
    // 回去前保存当前聊天记录
    const hero = selectedHero.value;
    if (hero) saveMessages(hero.shortName, messages.value);
    // 不清空 messages，保留在内存中，再次进入时恢复
    selectedHero.value = null;
    viewMode.value = 'list';
  }

  // ---- 初始化 ----
  loadHeroesFromWorldbook();
  refreshSpiritRuntime();
  // 变量更新结束后自动刷新英灵共鸣数据（残响/羁绊/被动/执念变化实时反映到面板）
  try {
    const mvu = (window as any).Mvu;
    if (mvu?.events?.VARIABLE_UPDATE_ENDED && typeof eventOn === 'function') {
      eventOn(mvu.events.VARIABLE_UPDATE_ENDED, () => refreshSpiritRuntime());
    }
  } catch { /* ignore */ }

  return {
    heroes,
    companions,
    selectedHero,
    messages,
    loading,
    panelExpanded,
    viewMode,
    activeTab,
    spiritRuntime,
    hall,
    refreshSpiritRuntime,
    hallInfo,
    releaseSpiritSkill,
    switchTab,
    loadHeroesFromWorldbook,
    selectHero,
    sendMessage,
    clearChat,
    editMessage,
    deleteMessage,
    recallLast,
    regenerateMessage,
    goBack,
  };
});
