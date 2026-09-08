<template>
  <!-- 折叠态：统一悬浮球 -->
  <div v-if="!panelState.expanded" class="hub-ball" data-fab-ball="1">
    <div class="hub-ball__glow"></div>
    <div class="hub-ball__core">
      <svg class="hub-ball__icon" viewBox="0 0 28 28" width="26" height="26" fill="none" aria-hidden="true">
        <g stroke="currentColor" stroke-width="1.1" opacity="0.7" stroke-linecap="round">
          <line x1="14" y1="1.6" x2="14" y2="4.4"/>
          <line x1="14" y1="23.6" x2="14" y2="26.4"/>
          <line x1="1.6" y1="14" x2="4.4" y2="14"/>
          <line x1="23.6" y1="14" x2="26.4" y2="14"/>
          <line x1="5.3" y1="5.3" x2="7.5" y2="7.5"/>
          <line x1="20.5" y1="20.5" x2="22.7" y2="22.7"/>
          <line x1="22.7" y1="5.3" x2="20.5" y2="7.5"/>
          <line x1="7.5" y1="20.5" x2="5.3" y2="22.7"/>
        </g>
        <circle cx="14" cy="14" r="9.6" stroke="currentColor" stroke-width="1" opacity="0.45"/>
        <path d="M14 3.8 L15.4 11 L15.4 12.6 L12.6 12.6 L12.6 11 Z" fill="currentColor"/>
        <path d="M10 13.4 L18 13.4 L18 14.4 L16.4 15.2 L11.6 15.2 L10 14.4 Z" fill="currentColor"/>
        <path d="M12.8 15.2 L15.2 15.2 L15.2 17.6 L12.8 17.6 Z" fill="currentColor"/>
        <path d="M14 17.4 L15.4 19.4 L14 21.4 L12.6 19.4 Z" fill="currentColor"/>
      </svg>
    </div>
  </div>

  <!-- 展开态：羊皮纸工作台（侧栏模块 + 内容区 + 缩放手柄） -->
  <div v-else class="hub-shell">
    <header class="hub-header" data-drag-handle="1">
      <span class="hub-header__orn">✦</span>
      <span class="hub-header__title">{{ currentTab.label }}</span>
      <span class="hub-header__orn">✦</span>
      <div class="hub-header__actions">
        <button class="hub-icon-btn" type="button" :title="maximized ? '还原窗口' : '铺满窗口'" @click.stop="requestToggleMaximize()">{{ maximized ? '❐' : '⛶' }}</button>
        <button class="hub-icon-btn" type="button" title="收起" @click.stop="requestCollapse">─</button>
      </div>
    </header>

    <div class="hub-body">
      <!-- 左侧模块栏 -->
      <nav class="hub-rail">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          class="hub-rail__item"
          :class="{ 'hub-rail__item--active': t.id === activeTab }"
          @click="activeTab = t.id"
        >
          <span class="hub-rail__icon">{{ t.icon }}</span>
          <span class="hub-rail__label">{{ t.label }}</span>
        </button>
        <div class="hub-rail__spacer"></div>
        <div class="hub-rail__foot">伊瑟利亚<br/>工作台</div>
      </nav>

      <!-- 内容区 -->
      <main class="hub-content" :class="{ 'hub-content--flush': activeTab === 'hero' }">
        <PlotPanel v-if="activeTab === 'plot'" />
        <HeroPanel v-else-if="activeTab === 'hero'" :panel-state="heroPanelState" />
        <SummaryPanel v-else />
      </main>
    </div>

    <!-- 右下角缩放手柄 -->
    <div
      v-if="!maximized"
      class="hub-resize"
      title="拖拽调整窗口大小"
      @pointerdown.stop.prevent="onResizeStart"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import PlotPanel from '../剧情规划大师/App.vue';
import SummaryPanel from '../总结助手/App.vue';
import HeroPanel from '../英灵功能/App.vue';

const props = defineProps<{
  panelState: { expanded: boolean; collapsed: boolean };
  requestCollapse: () => void;
  requestResize: (w: number, h: number) => void;
  requestToggleMaximize: () => void;
  winLayout?: { maximized: boolean };
}>();

const maximized = computed(() => props.winLayout?.maximized === true);

// 英灵殿面板内嵌时始终保持展开态（只显示羊皮卷面板，不显示它自己的悬浮球）
const heroPanelState = { expanded: true, collapsed: false };

const tabs = [
  { id: 'plot', icon: '📖', label: '剧情规划' },
  { id: 'hero', icon: '✦', label: '英灵殿' },
  { id: 'summary', icon: '📜', label: '总结档案' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const activeTab = ref<TabId>('plot');

const currentTab = computed(() => tabs.find(t => t.id === activeTab.value) || tabs[0]);

// 右下角手柄拖拽缩放：实时改壳尺寸，松手时上报持久化。
// 用 buttons 位与 pointerId 双重校验，防止拖拽中断后监听泄漏导致窗口跟鼠标漂移。
function onResizeStart(e: PointerEvent) {
  const target = e.currentTarget as HTMLElement;
  const host = target.closest('.hub-shell') as HTMLElement | null;
  if (!host) return;
  const startW = host.offsetWidth;
  const startH = host.offsetHeight;
  const startX = e.clientX;
  const startY = e.clientY;
  const pid = e.pointerId;
  let lastW = startW;
  let lastH = startH;
  let done = false;
  try { target.setPointerCapture(pid); } catch { /* 已释放则自然结束 */ }
  const onMove = (ev: PointerEvent) => {
    if (done || ev.pointerId !== pid || !(ev.buttons & 1)) { finish(); return; }
    lastW = Math.max(380, startW + (ev.clientX - startX));
    lastH = Math.max(460, startH + (ev.clientY - startY));
    host.style.width = `${lastW}px`;
    host.style.height = `${lastH}px`;
  };
  const finish = () => {
    if (done) return;
    done = true;
    target.removeEventListener('pointermove', onMove);
    target.removeEventListener('pointerup', finish);
    target.removeEventListener('pointercancel', finish);
    target.removeEventListener('lostpointercapture', finish);
    if (lastW !== startW || lastH !== startH) props.requestResize(lastW, lastH);
  };
  target.addEventListener('pointermove', onMove);
  target.addEventListener('pointerup', finish);
  target.addEventListener('pointercancel', finish);
  target.addEventListener('lostpointercapture', finish);
}
</script>

<style scoped>
/* ============================================================
   折叠悬浮球（保留品牌紫金）
   ============================================================ */
.hub-ball {
  width: 56px;
  height: 56px;
  position: relative;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  border: 2px solid rgba(255, 217, 122, 0.6);
  box-shadow:
    0 8px 28px rgba(124, 58, 237, 0.55),
    0 0 0 4px rgba(168, 85, 247, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.28);
  display: grid;
  place-items: center;
  cursor: grab;
  touch-action: none;
  transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 180ms ease;
  user-select: none;
  -webkit-user-select: none;
}
.hub-ball:active {
  cursor: grabbing;
  transform: scale(0.92);
}
.hub-ball__glow {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.25) 0%, transparent 60%);
  pointer-events: none;
}
.hub-ball__core {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.3);
  pointer-events: none;
}
.hub-ball__icon {
  display: block;
  color: #ffd97a;
  filter: drop-shadow(0 0 4px rgba(255, 217, 122, 0.85)) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
}

/* ============================================================
   羊皮纸工作台（展开态）
   ============================================================ */
.hub-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  border-radius: 14px;
  overflow: hidden;
  background:
    radial-gradient(1200px 400px at 20% -10%, rgba(255, 236, 190, 0.55), transparent 60%),
    linear-gradient(160deg, #f8f3e6 0%, #f3ecda 55%, #efe6cf 100%);
  border: 1px solid rgba(122, 90, 44, 0.45);
  box-shadow:
    0 24px 56px rgba(30, 20, 5, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.65);
  color: #3a2c15;
  font-family: 'Source Han Serif SC', 'Noto Serif SC', 'STSong', serif;
}

/* ── 头部 ── */
.hub-header {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  cursor: grab;
  user-select: none;
  background: linear-gradient(180deg, #4a3418, #3a2910);
  color: #f3e2b3;
  border-bottom: 2px solid #b8860b;
}
.hub-header:active { cursor: grabbing; }
.hub-header__orn { color: #d9a83c; font-size: 12px; }
.hub-header__title {
  flex: 1;
  text-align: center;
  font-weight: 700;
  letter-spacing: 2px;
  font-size: 14px;
  text-shadow: 0 1px 0 rgba(0, 0, 0, 0.4);
}
.hub-header__actions { display: flex; gap: 6px; }
.hub-icon-btn {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(217, 168, 60, 0.5);
  background: rgba(255, 226, 150, 0.1);
  color: #f3e2b3;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}
.hub-icon-btn:hover { background: rgba(217, 168, 60, 0.3); }

/* ── 主体：左模块栏 + 内容 ── */
.hub-body {
  flex: 1;
  min-height: 0;
  display: flex;
}
.hub-rail {
  flex: 0 0 76px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 8px;
  background: linear-gradient(180deg, rgba(122, 90, 44, 0.14), rgba(122, 90, 44, 0.05));
  border-right: 1px solid rgba(122, 90, 44, 0.28);
}
.hub-rail__item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 2px 7px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: #6d5836;
  cursor: pointer;
  transition: all 0.16s ease;
}
.hub-rail__item:hover { background: rgba(184, 134, 11, 0.12); color: #4a3418; }
.hub-rail__item--active {
  background: linear-gradient(160deg, #5d4322, #7a5a2c);
  color: #ffe9b8;
  border-color: rgba(184, 134, 11, 0.55);
  box-shadow: 0 3px 8px rgba(90, 62, 20, 0.35), inset 0 1px 0 rgba(255, 235, 180, 0.25);
}
.hub-rail__icon { font-size: 17px; line-height: 1; }
.hub-rail__label { font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
.hub-rail__spacer { flex: 1; }
.hub-rail__foot {
  text-align: center;
  font-size: 10px;
  line-height: 1.5;
  letter-spacing: 2px;
  color: rgba(109, 88, 54, 0.55);
  writing-mode: horizontal-tb;
}

/* ── 内容区 ── */
.hub-content {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 10px;
}
.hub-content--flush { padding: 0; }
.hub-content::-webkit-scrollbar { width: 8px; }
.hub-content::-webkit-scrollbar-thumb {
  background: rgba(122, 90, 44, 0.35);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}
.hub-content::-webkit-scrollbar-track { background: transparent; }

/* ── 缩放手柄 ── */
.hub-resize {
  position: absolute;
  right: 0;
  bottom: 0;
  width: 18px;
  height: 18px;
  cursor: nwse-resize;
  touch-action: none;
  z-index: 10;
}
.hub-resize::after {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 9px;
  height: 9px;
  border-right: 2px solid rgba(122, 90, 44, 0.65);
  border-bottom: 2px solid rgba(122, 90, 44, 0.65);
  border-radius: 0 0 3px 0;
}
.hub-resize:hover::after {
  border-color: #b8860b;
}
</style>

<!-- 非 scoped：适配子面板（剧情规划/总结/英灵）在新壳内的宽度表现 -->
<style>
  .hub-content > div,
  .hub-content .panel-card,
  .hub-content .field-input,
  .hub-content .menu_button {
    width: 100% !important;
    box-sizing: border-box !important;
    min-width: 0 !important;
  }
  .hub-content .toggle-row,
  .hub-content .auto-row,
  .hub-content .field-head,
  .hub-content .model-select-row {
    flex-wrap: wrap !important;
  }
  .hub-content [class*="archive"],
  .hub-content [class*="entry"] button {
    width: 100% !important;
    box-sizing: border-box !important;
    min-width: 0 !important;
    white-space: normal !important;
  }
</style>
