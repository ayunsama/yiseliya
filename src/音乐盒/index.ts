// Pinia CDN 构建依赖这些 Vue 编译时常量，酒馆全局 Vue 未注入，需手动补齐
(globalThis as any).__VUE_PROD_DEVTOOLS__ = false;
(globalThis as any).__VUE_OPTIONS_API__ = false;
(globalThis as any).__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;

import { createPinia, setActivePinia } from 'pinia';
import { createApp, reactive } from 'vue';
import App from './App.vue';
import { useMusicBoxStore } from './store';

// ============================================================
// 音乐盒 —— 悬浮窗 + 场景自动切歌 BGM
// 实现方式：仿照「功能整合悬浮窗」（三合一）的 div 方案
//   - 直接在外层酒馆页面创建 <div> 宿主，Vue 直接 mount（无 iframe）
//   - 单例机制：同一页面只保留一个宿主，重复加载自动去重
//   - 拖拽手柄忽略按钮/输入框，避免点击控件误触发收起
// ============================================================

// ---- 宿主窗口工具（脚本在 iframe 中运行，指向酒馆外层页面） ----
const OUTER: Window = window.parent || window;

function outerDoc(): Document {
  return (OUTER as any)?.document ?? document;
}
function outerBody(): HTMLElement {
  return outerDoc().body;
}
function getViewport() {
  return { w: (OUTER as any).innerWidth || 1280, h: (OUTER as any).innerHeight || 720 };
}
function isMobile(): boolean {
  return getViewport().w < 640;
}
function getBallSize(): number {
  return isMobile() ? 52 : 68;
}
function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

// ---- 全局错误可见化：崩溃时 toastr 显示原因，便于排查 ----
function showFatal(msg: string): void {
  try {
    console.error('[音乐盒]', msg);
    if (typeof toastr !== 'undefined') toastr.error(String(msg), '音乐盒');
  } catch { /* ignore */ }
}
try {
  window.addEventListener('error', (e) => {
    showFatal('运行时错误：' + (e?.message || '未知错误'));
  });
  window.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
    showFatal('异步错误：' + (e?.reason?.message || String(e?.reason || '未知错误')));
  });
} catch { /* ignore */ }

// ---- 共享响应式面板状态 ----
const panelState = reactive({
  expanded: false,
  collapsed: false,
});

// ============================================================
// 单例宿主（仿三合一：同一页面只保留一个悬浮窗实例）
// ============================================================
const SINGLETON_KEY = '__MBX_FLOATING_WINDOW_SINGLETON__';
const HOST_ATTR = 'data-mbx-float-root';
const HOST_SELECTOR = `[${HOST_ATTR}="1"]`;

type SingletonState = {
  hostEl: HTMLElement | null;
  mounted: boolean;
};

function getSingletonState(): SingletonState {
  const outerWin = OUTER as Window & Record<string, any>;
  if (!outerWin[SINGLETON_KEY]) {
    outerWin[SINGLETON_KEY] = { hostEl: null, mounted: false } as SingletonState;
  }
  return outerWin[SINGLETON_KEY] as SingletonState;
}

function getExistingHostEl(): HTMLElement | null {
  const existingHosts = Array.from(outerDoc().querySelectorAll(HOST_SELECTOR)) as HTMLElement[];
  if (!existingHosts.length) return null;
  const [primaryHost, ...duplicates] = existingHosts;
  duplicates.forEach((node) => node.remove());
  return primaryHost;
}

function ensureHostEl(): HTMLElement {
  const singletonState = getSingletonState();
  const existingHost = getExistingHostEl();
  if (existingHost) {
    singletonState.hostEl = existingHost;
    return existingHost;
  }

  const host = outerDoc().createElement('div');
  host.setAttribute(HOST_ATTR, '1');
  host.setAttribute('script_id', getScriptId());
  host.style.position = 'fixed';
  host.style.left = '0px';
  host.style.top = '0px';
  host.style.width = '68px';
  host.style.height = '68px';
  host.style.zIndex = '2147483647';
  host.style.overflow = 'visible';
  host.style.background = 'transparent';
  host.style.transition = 'width 0.25s ease, height 0.25s ease';
  outerBody().appendChild(host);
  singletonState.hostEl = host;
  return host;
}

// ============================================================
// 拖拽（Pointer Events；手柄=悬浮球/面板头部，忽略输入控件）
// ============================================================
let hostEl: HTMLElement | null = null;
let dragStartX = 0;
let dragStartY = 0;
let dragBaseLeft = 0;
let dragBaseTop = 0;
let isDragging = false;
let pointerDownOnHandle = false;
let activePointerId: number | null = null;

const HANDLE_SELECTOR = '[data-fab-ball="1"], [data-drag-handle="1"]';

function isHandleTarget(el: EventTarget | null): boolean {
  if (!el) return false;
  const t = el as HTMLElement;
  // 忽略按钮/输入框等可交互元素：避免点击它们时误触发拖拽切换（如输入音乐链接时面板收起）
  if (t.closest?.('button, input, select, textarea, a, label')) return false;
  return !!t.closest?.(HANDLE_SELECTOR);
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
    const vp = getViewport();
    const panelW = Math.min(420, Math.max(320, vp.w - 24));
    const panelH = Math.min(560, vp.h - 40);
    hostEl.style.width = `${panelW}px`;
    hostEl.style.height = `${panelH}px`;
  } else {
    const size = `${getBallSize()}px`;
    hostEl.style.width = size;
    hostEl.style.height = size;
  }
}

// ============================================================
// 主入口
// ============================================================
$(() => {
  try {
    console.log('[音乐盒] 脚本开始加载...');

    const pinia = createPinia();
    setActivePinia(pinia);
    const store = useMusicBoxStore();
    store.loadFromVariables();

    // ---- 单例：已存在实例则跳过重复挂载 ----
    const singletonState = getSingletonState();
    if (singletonState.mounted && singletonState.hostEl?.isConnected) {
      hostEl = singletonState.hostEl;
      console.log('[音乐盒] 检测到已存在实例，跳过重复挂载');
      return;
    }

    // ---- 在外层页面创建宿主元素（右下角） ----
    const vp = getViewport();
    const ballSize = getBallSize();
    hostEl = ensureHostEl();
    hostEl.style.left = `${Math.max(8, vp.w - ballSize - 8)}px`;
    hostEl.style.top = `${Math.max(8, vp.h - ballSize - 8)}px`;
    hostEl.style.width = `${ballSize}px`;
    hostEl.style.height = `${ballSize}px`;
    hostEl.style.zIndex = '2147483647';
    hostEl.style.overflow = 'visible';
    hostEl.style.background = 'transparent';
    hostEl.style.transition = 'width 0.25s ease, height 0.25s ease';

    // ---- 克隆脚本样式到外层页面 head（组件 mount 时样式直接注入外层页面，这里补漏） ----
    const { destroy: destroyStyle } = (() => {
      const doc = outerDoc();
      const $styleDiv = $(doc.createElement('div'))
        .attr('script_id', getScriptId())
        .append($('head > style', document).clone());
      doc.head.appendChild($styleDiv[0]);
      return { destroy: () => $styleDiv.remove() };
    })();

    // ---- 挂载统一面板 ----
    let app: ReturnType<typeof createApp> | null = null;
    try {
      app = createApp(App as any, { panelState }).use(pinia);
      app.mount(hostEl);
      singletonState.mounted = true;
      console.log('[音乐盒] Vue 已挂载到宿主元素');
    } catch (e: any) {
      singletonState.mounted = false;
      console.error('[音乐盒] 挂载失败，显示兜底球', e);
      showFatal('挂载失败：' + (e?.message || e));
      // 兜底球：至少能看到悬浮窗入口
      hostEl.innerHTML = '';
      hostEl.style.display = 'flex';
      hostEl.style.alignItems = 'center';
      hostEl.style.justifyContent = 'center';
      hostEl.style.borderRadius = '14px';
      hostEl.style.background = 'linear-gradient(135deg, #8b5cf6, #a855f7)';
      hostEl.style.color = '#fff';
      hostEl.style.fontSize = '22px';
      hostEl.style.visibility = 'visible';
      hostEl.style.opacity = '1';
      hostEl.textContent = '🎵';
    }

    // ---- Pointer Events 拖拽（绑定在宿主元素上） ----
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
      outerBody().style.cursor = 'grabbing';
      e.preventDefault();
    });

    hostEl.addEventListener('pointermove', (e) => {
      if (!hostEl || activePointerId === null || e.pointerId !== activePointerId) return;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging = true;
      if (!isDragging) return;

      const vpNow = getViewport();
      const pw = hostEl.offsetWidth;
      const ph = hostEl.offsetHeight;
      const newLeft = clamp(dragBaseLeft + dx, 0, Math.max(0, vpNow.w - pw));
      const newTop = clamp(dragBaseTop + dy, 0, Math.max(0, vpNow.h - ph));

      hostEl.style.left = `${newLeft}px`;
      hostEl.style.top = `${newTop}px`;
      e.preventDefault();
    });

    hostEl.addEventListener('pointerup', (e) => {
      if (!hostEl || activePointerId === null || e.pointerId !== activePointerId) return;
      activePointerId = null;
      hostEl.releasePointerCapture(e.pointerId);
      outerBody().style.cursor = '';

      if (isDragging) {
        const vpNow = getViewport();
        const pw = hostEl.offsetWidth;
        const ph = hostEl.offsetHeight;
        const finalLeft = clamp(parseFloat(hostEl.style.left) || 0, 0, Math.max(0, vpNow.w - pw));
        const finalTop = clamp(parseFloat(hostEl.style.top) || 0, 0, Math.max(0, vpNow.h - ph));
        hostEl.style.left = `${finalLeft}px`;
        hostEl.style.top = `${finalTop}px`;
      } else if (pointerDownOnHandle) {
        togglePanel();
      }
      isDragging = false;
      pointerDownOnHandle = false;
    });

    // ---- resize 时确保不超出边界 ----
    const repositionOnResize = () => {
      if (!hostEl) return;
      const vpNow = getViewport();
      const pw = hostEl.offsetWidth;
      const ph = hostEl.offsetHeight;
      const left = clamp(parseFloat(hostEl.style.left) || 0, 0, Math.max(0, vpNow.w - pw));
      const top = clamp(parseFloat(hostEl.style.top) || 0, 0, Math.max(0, vpNow.h - ph));
      hostEl.style.left = `${left}px`;
      hostEl.style.top = `${top}px`;
    };
    (OUTER as any).addEventListener('resize', repositionOnResize);

    // ============================================================
    // 场景检测
    // ============================================================
    let lastDetect = 0;
    let detectTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleDetect(delay = 600): void {
      if (detectTimer) clearTimeout(detectTimer);
      detectTimer = setTimeout(() => {
        detectTimer = null;
        const now = Date.now();
        if (now - lastDetect < 1500) return; // 检测防抖
        lastDetect = now;
        store.detectAndApplyScene();
      }, delay);
    }

    // 变量通道：MVU 变量更新（MVU 不存在时跳过；5 秒超时防永久等待）
    try {
      Promise.race([
        waitGlobalInitialized('Mvu'),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Mvu 等待超时')), 5000)),
      ])
        .then(() => {
          try {
            eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => scheduleDetect());
          } catch { /* ignore */ }
        })
        .catch(() => { /* MVU 不可用，跳过变量通道 */ });
    } catch { /* ignore */ }

    // 消息通道：新消息/生成结束
    try {
      const events = (window as any).tavern_events;
      const msgEvent = events?.MESSAGE_RECEIVED || events?.GENERATION_ENDED;
      if (msgEvent) {
        eventOn(msgEvent, () => scheduleDetect());
      }
    } catch { /* ignore */ }

    // 定时刷新播放状态（UI 显示播放中/进度/音量）
    const stateTimer = setInterval(() => {
      try { store.refreshPlayState(); } catch { /* ignore */ }
    }, 1000);

    // 初始检测
    setTimeout(() => {
      store.refreshPlayState();
      scheduleDetect(300);
    }, 1500);

    // ============================================================
    // 自愈：宿主被移除/隐藏/移出屏幕时自动恢复
    // ============================================================
    const healTimer = setInterval(() => {
      try {
        if (!hostEl || !hostEl.isConnected) {
          console.warn('[音乐盒] 检测到宿主被外部移除，正在重建…');
          singletonState.mounted = false;
          hostEl = ensureHostEl();
          const vpNow = getViewport();
          const sz = getBallSize();
          hostEl.style.left = `${Math.max(8, vpNow.w - sz - 8)}px`;
          hostEl.style.top = `${Math.max(8, vpNow.h - sz - 8)}px`;
          hostEl.style.width = `${sz}px`;
          hostEl.style.height = `${sz}px`;
          hostEl.style.display = 'block';
          hostEl.style.visibility = 'visible';
          hostEl.style.opacity = '1';
          try {
            app = createApp(App as any, { panelState }).use(pinia);
            app.mount(hostEl);
            singletonState.mounted = true;
            console.log('[音乐盒] 重建完成');
          } catch (e: any) {
            showFatal('重建挂载失败：' + (e?.message || e));
          }
          return;
        }
        // 可见性自愈：在 DOM 中但被隐藏/尺寸为 0/移出屏幕
        const rect = hostEl.getBoundingClientRect();
        const vpNow = getViewport();
        const hidden = rect.width === 0 || rect.height === 0;
        const offscreen = rect.left > vpNow.w || rect.top > vpNow.h || rect.right < 0 || rect.bottom < 0;
        if (hidden || offscreen) {
          console.warn(`[音乐盒] 检测到悬浮窗不可见（hidden=${hidden} offscreen=${offscreen} rect=${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)}x${Math.round(rect.height)}），重置位置与样式`);
          hostEl.style.display = 'block';
          hostEl.style.visibility = 'visible';
          hostEl.style.opacity = '1';
          const sz = getBallSize();
          hostEl.style.width = `${sz}px`;
          hostEl.style.height = `${sz}px`;
          hostEl.style.left = `${Math.max(8, vpNow.w - sz - 8)}px`;
          hostEl.style.top = `${Math.max(8, vpNow.h - sz - 8)}px`;
        }
      } catch { /* ignore */ }
    }, 3000);

    // ============================================================
    // 卸载清理
    // ============================================================
    $(window).on('pagehide', () => {
      console.warn('[音乐盒] pagehide 触发（脚本卸载），清理悬浮窗');
      if (detectTimer) clearTimeout(detectTimer);
      clearInterval(stateTimer);
      clearInterval(healTimer);
      (OUTER as any).removeEventListener('resize', repositionOnResize);
      if (app) {
        try { app.unmount(); } catch { /* ignore */ }
      }
      singletonState.hostEl = null;
      singletonState.mounted = false;
      const hosts = outerDoc().querySelectorAll(HOST_SELECTOR);
      hosts.forEach((node) => node.remove());
      destroyStyle();
    });

    if (typeof toastr !== 'undefined') {
      toastr.success('音乐盒已就绪', '加载成功');
    }
    console.log('[音乐盒] 已加载');
  } catch (e: any) {
    showFatal('加载失败：' + (e?.message || e));
  }
});
