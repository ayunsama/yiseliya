<template>
  <FloatingPanelDemo
    :expanded="panelState.expanded"
    :collapsed="panelState.collapsed"
    icon-type="music"
    color-theme="brown"
    shape="square"
    :animate="store.playing"
  >
    <div class="mbx-shell">
      <!-- Tab 头 -->
      <div class="mbx-tabs">
        <button
          v-for="t in tabs"
          :key="t.id"
          class="mbx-tab"
          :class="{ active: tab === t.id }"
          @click="tab = t.id"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- ============ 播放页 ============ -->
      <div v-if="tab === 'play'" class="mbx-pane">
        <div class="mbx-now" :class="{ muted: !store.currentTrackTitle }">
          🎵 {{ store.currentTrackTitle || '未播放' }}
        </div>
        <div v-if="store.currentScene" class="mbx-scene">📍 场景：{{ store.currentScene }}</div>
        <div v-else-if="store.settings.autoSwitch && !store.autoDisabled" class="mbx-scene muted">
          🎧 等待场景变化…
        </div>

        <div class="mbx-btns">
          <button class="mbx-btn" title="上一首" @click="store.playNext(-1)">⏮</button>
          <button class="mbx-btn mbx-btn-main" title="播放/暂停" @click="store.togglePlay()">
            {{ store.playing ? '⏸' : '▶' }}
          </button>
          <button class="mbx-btn" title="下一首" @click="store.playNext(1)">⏭</button>
        </div>

        <div class="mbx-progress">
          <div class="mbx-progress-fill" :style="{ width: store.progress + '%' }"></div>
        </div>

        <div class="mbx-row">
          <span class="mbx-icon">🔉</span>
          <input
            class="mbx-range"
            type="range"
            min="0"
            max="100"
            :value="store.volume"
            @input="onVolume($event)"
          >
          <span class="mbx-val">{{ store.volume }}</span>
        </div>

        <div class="mbx-row mbx-switch-row">
          <label class="mbx-label">
            <input type="checkbox" :checked="store.settings.autoSwitch && !store.autoDisabled" @change="toggleAuto">
            场景自动切歌
          </label>
          <button class="mbx-mini-btn" @click="store.detectAndApplyScene()">🔄 立即检测</button>
        </div>
      </div>

      <!-- ============ 列表页 ============ -->
      <div v-if="tab === 'list'" class="mbx-pane">
        <div class="mbx-add">
          <input
            v-model="newUrl"
            class="mbx-input"
            placeholder="音乐直链 / 网易云歌曲链接"
            @keyup.enter="addByUrl"
          >
          <button class="mbx-addbtn" @click="addByUrl">添加</button>
        </div>
        <div class="mbx-hint">🎵 支持：音频直链 或 网易云歌曲链接（music.163.com/song?id=…，含 #/ 格式）自动解析（VIP 曲目会失败）</div>
        <div class="mbx-add">
          <label class="mbx-file">
            📁 选择本地音频文件
            <input type="file" accept="audio/*" style="display:none" @change="onFile">
          </label>
          <span class="mbx-hint">建议 ≤ 5MB</span>
        </div>
        <div class="mbx-tracks">
          <div v-for="(t, i) in store.tracks" :key="i" class="mbx-track">
            <span
              class="mbx-track-title"
              :class="{ active: t.title === store.currentTrackTitle }"
              title="点击播放"
              @click="store.playTrack(t)"
            >
              {{ t.source === 'file' ? '📁' : (t.source === 'netease' ? '🎵' : '🔗') }} {{ t.title }}
            </span>
            <button class="mbx-del" title="删除" @click="store.removeTrack(i)">✕</button>
          </div>
          <div v-if="!store.tracks.length" class="mbx-empty">
            暂无音乐。添加网络链接、网易云链接，或上传本地音频文件。
          </div>
        </div>
      </div>

      <!-- ============ 场景页 ============ -->
      <div v-if="tab === 'scene'" class="mbx-pane">
        <div class="mbx-hint">
          检测源：角色变量（{{ store.settings.varPaths.join('、') }}）＋ 最近消息关键词。
          命中关键词 → 自动播放绑定曲目。
        </div>
        <div v-for="(r, i) in store.sceneRules" :key="i" class="mbx-rule">
          <input v-model="r.name" class="mbx-input" placeholder="场景名（如：酒馆）" @change="store.saveToVariables()">
          <input v-model="r.keywordsText" class="mbx-input" placeholder="关键词，逗号分隔（如：酒馆、吧台）" @change="store.saveToVariables()">
          <select v-model="r.trackTitle" class="mbx-input" @change="store.saveToVariables()">
            <option value="">— 绑定曲目 —</option>
            <option v-for="t in store.tracks" :key="t.title" :value="t.title">{{ t.title }}</option>
          </select>
          <button class="mbx-del" title="删除规则" @click="store.removeSceneRule(i)">✕</button>
        </div>
        <button class="mbx-addbtn mbx-addbtn-wide" @click="addRule">＋ 添加场景规则</button>
        <div class="mbx-settings">
          <label class="mbx-label">
            <input type="checkbox" v-model="store.settings.checkVariables" @change="store.saveToVariables()">
            变量通道
          </label>
          <label class="mbx-label">
            <input type="checkbox" v-model="store.settings.checkMessages" @change="store.saveToVariables()">
            消息通道
          </label>
        </div>
      </div>
    </div>
  </FloatingPanelDemo>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import FloatingPanelDemo from '../悬浮按钮/FloatingPanelDemo.vue';
import { useMusicBoxStore } from './store';

defineProps<{
  panelState: { expanded: boolean; collapsed: boolean };
}>();

const store = useMusicBoxStore();

const tabs = [
  { id: 'play', label: '播放' },
  { id: 'list', label: '列表' },
  { id: 'scene', label: '场景' },
];
const tab = ref('play');

const newUrl = ref('');
const resolvingNetease = ref(false);

async function addByUrl(): Promise<void> {
  const url = newUrl.value.trim();
  if (!url) return;
  newUrl.value = '';

  // 网易云链接识别：https://music.163.com/song?id=xxx 或 /#/song?id=xxx
  const m = url.match(/music\.163\.com\/(?:#\/)?song\?id=(\d+)/);
  if (m) {
    const songId = m[1];
    if (resolvingNetease.value) return;
    resolvingNetease.value = true;
    if (typeof toastr !== 'undefined') toastr.info('正在解析网易云链接…', '音乐盒');
    const track = await store.resolveNeteaseTrack(songId);
    resolvingNetease.value = false;
    if (track) {
      if (typeof toastr !== 'undefined') toastr.success(`已添加「${track.title}」`, '音乐盒');
    } else {
      if (typeof toastr !== 'undefined') {
        toastr.error('网易云解析失败：可能是 VIP 曲目/无版权，或解析服务暂时不可用。请换一首免费歌曲试试，或直接提供音频直链', '音乐盒');
      }
    }
    return;
  }

  store.addTrack({ url });
  if (typeof toastr !== 'undefined') toastr.success('已添加音乐', '音乐盒');
}

function onFile(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) {
    if (typeof toastr !== 'undefined') toastr.error('文件过大（>8MB），请使用网络链接', '音乐盒');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    store.addTrack({
      title: file.name.replace(/\.[a-z0-9]+$/i, ''),
      url: String(reader.result || ''),
      source: 'file',
    });
    if (typeof toastr !== 'undefined') toastr.success(`已添加「${file.name}」`, '音乐盒');
  };
  reader.onerror = () => {
    if (typeof toastr !== 'undefined') toastr.error('文件读取失败', '音乐盒');
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function addRule(): void {
  store.addSceneRule({ name: `场景${store.sceneRules.length + 1}` });
}

function onVolume(e: Event): void {
  const v = Number((e.target as HTMLInputElement).value);
  store.setVolume(v);
}

function toggleAuto(e: Event): void {
  const checked = (e.target as HTMLInputElement).checked;
  store.settings.autoSwitch = checked;
  store.autoDisabled = !checked;
  store.saveToVariables();
}
</script>

<style scoped>
.mbx-shell {
  width: 100%;
  max-height: 460px;
  overflow-y: auto;
  font-size: 13px;
  color: #eadfc8;
}

/* Tab */
.mbx-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.28);
  padding-bottom: 6px;
}
.mbx-tab {
  background: transparent;
  border: none;
  color: #b8a88f;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 12px;
  border-radius: 999px;
  transition: all 0.15s;
}
.mbx-tab:hover {
  color: #f0d48a;
}
.mbx-tab.active {
  background: rgba(212, 175, 55, 0.2);
  color: #f0d48a;
  font-weight: bold;
}

.mbx-pane {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.mbx-now {
  font-size: 14px;
  font-weight: bold;
  color: #f0d48a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mbx-now.muted {
  color: #9c8e76;
  font-weight: normal;
}
.mbx-scene {
  font-size: 12px;
  color: #d9b96a;
}
.mbx-scene.muted {
  color: #9c8e76;
}

.mbx-btns {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}
.mbx-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 1px solid rgba(212, 175, 55, 0.4);
  background: rgba(212, 175, 55, 0.12);
  color: #f0d48a;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}
.mbx-btn:hover {
  background: rgba(212, 175, 55, 0.25);
}
.mbx-btn-main {
  width: 52px;
  height: 52px;
  font-size: 20px;
  background: linear-gradient(135deg, #c9a35a, #8a6a52);
  border-color: rgba(240, 212, 138, 0.6);
}

.mbx-progress {
  height: 5px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}
.mbx-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #c9a35a, #f0d48a);
  transition: width 0.4s;
}

.mbx-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mbx-icon {
  font-size: 13px;
}
.mbx-range {
  flex: 1;
  accent-color: #c9a35a;
}
.mbx-val {
  font-size: 12px;
  width: 26px;
  text-align: right;
  color: #d9b96a;
}

.mbx-switch-row {
  justify-content: space-between;
}
.mbx-label {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #d9b96a;
  cursor: pointer;
}
.mbx-label input {
  accent-color: #c9a35a;
}
.mbx-mini-btn {
  background: rgba(212, 175, 55, 0.12);
  border: 1px solid rgba(212, 175, 55, 0.35);
  color: #f0d48a;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 11px;
  cursor: pointer;
}
.mbx-mini-btn:hover {
  background: rgba(212, 175, 55, 0.25);
}

/* 列表 */
.mbx-add {
  display: flex;
  align-items: center;
  gap: 6px;
}
.mbx-input {
  flex: 1;
  min-width: 0;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(212, 175, 55, 0.3);
  border-radius: 6px;
  padding: 5px 8px;
  font-size: 12px;
  color: #f0e6d2;
  outline: none;
}
.mbx-input:focus {
  border-color: #c9a35a;
}
.mbx-input::placeholder {
  color: #9c8e76;
}
.mbx-addbtn {
  background: linear-gradient(135deg, #c9a35a, #8a6a52);
  border: none;
  color: #fff;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
}
.mbx-addbtn:hover {
  filter: brightness(1.1);
}
.mbx-addbtn-wide {
  width: 100%;
  padding: 7px;
}
.mbx-file {
  display: inline-flex;
  align-items: center;
  background: rgba(212, 175, 55, 0.12);
  border: 1px dashed rgba(212, 175, 55, 0.4);
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  color: #f0d48a;
  cursor: pointer;
}
.mbx-file:hover {
  background: rgba(212, 175, 55, 0.22);
}
.mbx-hint {
  font-size: 11px;
  color: #9c8e76;
  line-height: 1.5;
}

.mbx-tracks {
  max-height: 200px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
}
.mbx-track {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(212, 175, 55, 0.15);
  border-radius: 6px;
  padding: 5px 8px;
}
.mbx-track-title {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  color: #d9cbb0;
}
.mbx-track-title:hover {
  color: #f0e6d2;
}
.mbx-track-title.active {
  color: #f0d48a;
  font-weight: bold;
}
.mbx-del {
  background: transparent;
  border: none;
  color: #a2947c;
  cursor: pointer;
  font-size: 13px;
  padding: 2px 5px;
  border-radius: 4px;
}
.mbx-del:hover {
  color: #fca5a5;
  background: rgba(248, 113, 113, 0.15);
}
.mbx-empty {
  font-size: 12px;
  color: #9c8e76;
  text-align: center;
  padding: 14px 0;
}

/* 场景 */
.mbx-rule {
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(212, 175, 55, 0.15);
  border-radius: 8px;
  padding: 8px;
}
.mbx-rule .mbx-del {
  align-self: flex-end;
}
.mbx-settings {
  display: flex;
  gap: 14px;
  margin-top: 4px;
}
</style>
