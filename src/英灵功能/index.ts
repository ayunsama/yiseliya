// Pinia CDN 构建依赖这些 Vue 编译时常量，酒馆全局 Vue 未注入，需手动补齐
(globalThis as any).__VUE_PROD_DEVTOOLS__ = false;
(globalThis as any).__VUE_OPTIONS_API__ = false;
(globalThis as any).__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;

import { createPinia, setActivePinia } from 'pinia';
import { createApp, reactive } from 'vue';
import App from './App.vue';
import { useHeroSpiritStore } from './store';

// ---- 共享响应式面板状态 ----
const panelState = reactive({
  expanded: false,
  collapsed: false,
});

// ---- Pointer Events 拖拽（瞬发无延迟，setPointerCapture 保证跟手） ----

let hostEl: HTMLElement | null = null;

let dragStartX = 0;
let dragStartY = 0;
let dragBaseLeft = 0;
let dragBaseTop = 0;
let isDragging = false;
/** pointerdown 是否落在手柄上，用于 pointerup 判断 toggle */
let pointerDownOnHandle = false;

const DRAG_HANDLE_SELECTOR = '[data-drag-handle="1"]';

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

/** 安全获取宿主窗口（iframe 内指向 parent） */
function heroOwnerWindow(): Window {
  try { return window.parent || window; } catch { return window; }
}

/** 安全获取宿主文档 */
function heroOwnerDocument(): Document {
  try { return heroOwnerWindow().document || document; } catch { return document; }
}

function getViewportSize() {
  const w = heroOwnerWindow();
  return { w: w.innerWidth || window.innerWidth || 1280, h: w.innerHeight || window.innerHeight || 720 };
}

function isHandleTarget(el: EventTarget | null): boolean {
  return !!(el && (el as HTMLElement).closest?.(DRAG_HANDLE_SELECTOR));
}

let lastToggleTime = 0;

function togglePanel() {
  const now = Date.now();
  if (now - lastToggleTime < 200) return;
  lastToggleTime = now;
  panelState.expanded = !panelState.expanded;
  panelState.collapsed = panelState.expanded ? false : true;
  if (!hostEl) return;
  if (panelState.expanded) {
    const vp = getViewportSize();
    const panelW = Math.min(340, Math.max(280, vp.w - 40));
    const panelH = Math.min(480, vp.h - 60);
    hostEl.style.width = `${panelW}px`;
    hostEl.style.height = `${panelH}px`;
  } else {
    hostEl.style.width = '56px';
    hostEl.style.height = '56px';
  }
}

// ---- 加载入口 ----
$(async () => {
  console.log('[英灵功能] 脚本开始加载...');

  try {
    const pinia = createPinia();
    setActivePinia(pinia);

    const store = useHeroSpiritStore();

    // 1. 创建宿主元素 — 在宿主窗口（parent）的 document 中
    const vp = getViewportSize();
    const leftPos = Math.max(12, vp.w - 78);
    const topPos = Math.max(12, vp.h - 78);
    const ownerDoc = heroOwnerDocument();
    const $host = $(ownerDoc.createElement('div'))
      .attr('script_id', getScriptId())
      .css({
        position: 'fixed',
        left: `${Math.min(leftPos, Math.max(0, vp.w - 64))}px`,
        top: `${Math.min(topPos, Math.max(0, vp.h - 64))}px`,
        width: '56px',
        height: '56px',
        zIndex: '2147483647',
        overflow: 'visible',
        background: 'transparent',
        transition: 'width 0.25s ease, height 0.25s ease',
      });
    ownerDoc.body.appendChild($host[0]);
    hostEl = $host[0];

    // 2. 注入样式到宿主文档
    const { destroy: destroyStyle } = (() => {
      const doc = heroOwnerDocument();
      const $styleDiv = $(doc.createElement('div'))
        .attr('script_id', getScriptId())
        .append($('head > style', document).clone());
      doc.head.appendChild($styleDiv[0]);
      return { destroy: () => $styleDiv.remove() };
    })();
    const app = createApp(App as any, { panelState }).use(pinia);
    app.mount(hostEl);

    // 3. ──── Pointer Events 拖拽（瞬发无延迟，setPointerCapture 保证跟手）────
    let activePointerId: number | null = null;

    hostEl.addEventListener('pointerdown', (e) => {
      if (!hostEl || e.button !== 0) return;
      pointerDownOnHandle = isHandleTarget(e.target);
      if (!pointerDownOnHandle) return;

      const rect = hostEl.getBoundingClientRect();
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragBaseLeft = rect.left;
      dragBaseTop = rect.top;
      isDragging = false;
      activePointerId = e.pointerId;

      hostEl.setPointerCapture(e.pointerId);
      heroOwnerDocument().body.style.cursor = 'grabbing';
      e.preventDefault();
    });

    hostEl.addEventListener('pointermove', (e) => {
      if (!hostEl || activePointerId === null || e.pointerId !== activePointerId) return;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging = true;
      if (!isDragging) return;

      const vp = getViewportSize();
      const pw = hostEl.offsetWidth;
      const ph = hostEl.offsetHeight;
      const newLeft = clamp(dragBaseLeft + dx, 0, Math.max(0, vp.w - pw));
      const newTop = clamp(dragBaseTop + dy, 0, Math.max(0, vp.h - ph));

      hostEl.style.left = `${newLeft}px`;
      hostEl.style.top = `${newTop}px`;
      e.preventDefault();
    });

    hostEl.addEventListener('pointerup', (e) => {
      if (!hostEl || activePointerId === null || e.pointerId !== activePointerId) return;
      activePointerId = null;
      hostEl.releasePointerCapture(e.pointerId);
      heroOwnerDocument().body.style.cursor = '';

      if (isDragging) {
        const vp = getViewportSize();
        const pw = hostEl.offsetWidth;
        const ph = hostEl.offsetHeight;
        const finalLeft = clamp(parseFloat(hostEl.style.left) || 0, 0, Math.max(0, vp.w - pw));
        const finalTop = clamp(parseFloat(hostEl.style.top) || 0, 0, Math.max(0, vp.h - ph));
        hostEl.style.left = `${finalLeft}px`;
        hostEl.style.top = `${finalTop}px`;
      } else if (pointerDownOnHandle) {
        togglePanel();
      }
      isDragging = false;
      pointerDownOnHandle = false;
    });

    // 5. resize 时确保不超出边界
    const repositionOnResize = () => {
      if (!hostEl) return;
      const vp = getViewportSize();
      const pw = hostEl.offsetWidth;
      const ph = hostEl.offsetHeight;
      const left = clamp(parseFloat(hostEl.style.left) || 0, 0, Math.max(0, vp.w - pw));
      const top = clamp(parseFloat(hostEl.style.top) || 0, 0, Math.max(0, vp.h - ph));
      hostEl.style.left = `${left}px`;
      hostEl.style.top = `${top}px`;
    };
    heroOwnerWindow().addEventListener('resize', repositionOnResize);

    // 6. 监听世界书变更
    const refreshListener = eventOn(tavern_events.WORLDINFO_UPDATED, () => {
      setTimeout(() => store.loadHeroesFromWorldbook(), 500);
    });

    // 6. 卸载清理
    $(window).on('pagehide', () => {      heroOwnerWindow().removeEventListener('resize', repositionOnResize);      if (refreshListener) refreshListener.stop();
      app.unmount();
      $host.remove();
      destroyStyle();
    });

    toastr.success('英灵功能已就绪', '加载成功');
  } catch (e: any) {
    console.error('[英灵功能] 加载失败:', e?.message || e);
    toastr.error(e?.message || '未知错误', '英灵功能加载失败');
  }
});
