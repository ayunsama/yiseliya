import { createPinia } from 'pinia';
import { createApp, reactive } from 'vue';
import { createScriptIdIframe, teleportStyle } from '../../util/script';
import FloatingBallPanel from './FloatingBallPanel.vue';
import { useSummaryStore } from './store';

// ============================================================
// 全局配置
// ============================================================
globalThis.__VUE_PROD_DEVTOOLS__ = false;
globalThis.__VUE_OPTIONS_API__ = false;
globalThis.__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;

// ============================================================
// 悬浮球状态
// ============================================================
const panelState = reactive({
  expanded: false,
  collapsed: false,
});

// ============================================================
// 拖拽相关变量（Pointer Events API）
// ============================================================
let $ballContainer: JQuery<HTMLElement> | null = null;
let pointerStartX = 0;
let pointerStartY = 0;
let elementStartLeft = 0;
let elementStartTop = 0;
let isPointerDown = false;
let hasMoved = false;

const BALL_SELECTOR = '[data-fab-ball="1"]';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** 外层页面 window（脚本 iframe 的父窗口） */
const parentWin = window.parent || window;

function getViewport(): { w: number; h: number } {
  return {
    w: parentWin.innerWidth || 1280,
    h: parentWin.innerHeight || 720,
  };
}

function isMobile(): boolean {
  return getViewport().w < 640;
}

function getBallSize(): number {
  return isMobile() ? 52 : 68;
}

function getPanelWidth(): string {
  return isMobile() ? 'calc(100vw - 24px)' : '380px';
}

function debug(...args: any[]) {
  console.log('[伊瑟利亚总结助手·调试]', ...args);
}

// ============================================================
// 发光余量（box-shadow 最大约 28px，取 30px 安全值）
// ============================================================
const GLOW_MARGIN = 30;

function getIframeSize(): number {
  return getBallSize() + GLOW_MARGIN * 2;
}

// ============================================================
// 防抖切换
// ============================================================
let lastToggleTime = 0;

function togglePanel() {
  const now = Date.now();
  if (now - lastToggleTime < 200) {
    debug('togglePanel 防抖跳过');
    return;
  }
  lastToggleTime = now;
  panelState.expanded = !panelState.expanded;
  panelState.collapsed = !panelState.expanded;
  debug('togglePanel, 新状态 expanded=', panelState.expanded);
  if ($ballContainer) {
    if (panelState.expanded) {
      $ballContainer[0].style.width = `calc(${getPanelWidth()} + ${GLOW_MARGIN * 2}px)`;
      $ballContainer[0].style.height = 'auto';
    } else {
      const size = `${getIframeSize()}px`;
      $ballContainer[0].style.width = size;
      $ballContainer[0].style.height = size;
    }
  }
}

// ============================================================
// 获取聊天文件名（用于世界书后缀）
// ============================================================
function getChatFileName(): string {
  try {
    const chatId = SillyTavern.getCurrentChatId();
    if (chatId) return chatId.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_');
  } catch {}
  return `chat_${Date.now()}`;
}

// ============================================================
// 拖拽逻辑 — Pointer Events API（在 iframe 内执行）
// 使用 screenX/Y 避免跨 iframe 坐标反馈，transform 实现 GPU 合成
// ============================================================
function setupDragAndEvents(
  iframeDoc: Document,
  iframeEl: HTMLIFrameElement,
) {
  // 等待 Vue 渲染完成
  requestAnimationFrame(() => {
    const ball = iframeDoc.querySelector(BALL_SELECTOR) as HTMLElement | null;
    if (!ball) {
      debug('未找到 ball 元素，重试...');
      setTimeout(() => setupDragAndEvents(iframeDoc, iframeEl), 100);
      return;
    }

    debug('ball 元素已找到，绑定拖拽事件');

    // 给 iframe 添加 GPU 合成提示
    iframeEl.style.willChange = 'transform';

    // rAF 节流状态
    let rafId = 0;
    let pendingDx = 0;
    let pendingDy = 0;

    function applyPosition() {
      rafId = 0;
      if (!isPointerDown || !$ballContainer) return;

      const vp = getViewport();
      const ballSz = iframeEl.offsetWidth || getBallSize();
      const newLeft = clamp(elementStartLeft + pendingDx, 0, Math.max(0, vp.w - ballSz));
      const newTop = clamp(elementStartTop + pendingDy, 0, Math.max(0, vp.h - ballSz));

      // 使用 transform translate 代替 left/top，避免触发布局重排
      iframeEl.style.transform = `translate(${newLeft - elementStartLeft}px, ${newTop - elementStartTop}px)`;
    }

    ball.addEventListener('pointerdown', (e: PointerEvent) => {
      if (!$ballContainer) return;
      debug('pointerdown');

      // 用 screenX/screenY 记录起点（绝对屏幕坐标，不受 iframe 视口位移影响）
      const iframeRect = iframeEl.getBoundingClientRect();
      pointerStartX = e.screenX;
      pointerStartY = e.screenY;
      elementStartLeft = iframeRect.left;
      elementStartTop = iframeRect.top;
      isPointerDown = true;
      hasMoved = false;
      pendingDx = 0;
      pendingDy = 0;

      ball.setPointerCapture(e.pointerId);
      iframeEl.style.cursor = 'grabbing';
      // 禁用 iframe 上可能存在的 transition，确保 transform 即时生效
      iframeEl.style.transition = 'none';
    });

    ball.addEventListener('pointermove', (e: PointerEvent) => {
      if (!isPointerDown || !$ballContainer) return;
      e.preventDefault();

      const dx = e.screenX - pointerStartX;
      const dy = e.screenY - pointerStartY;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        hasMoved = true;
      }

      if (!hasMoved) return;

      // 暂存最新的偏移量
      pendingDx = dx;
      pendingDy = dy;

      // 通过 rAF 节流，避免积压太多样式变更
      if (!rafId) {
        rafId = requestAnimationFrame(applyPosition);
      }
    });

    ball.addEventListener('pointerup', (e: PointerEvent) => {
      if (!$ballContainer || !isPointerDown) return;

      // 取消未执行的 rAF
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }

      ball.releasePointerCapture(e.pointerId);
      iframeEl.style.cursor = '';
      iframeEl.style.transition = '';

      // 将 transform 的偏移量固化到 left/top
      if (hasMoved) {
        const vp = getViewport();
        const ballSz = iframeEl.offsetWidth || getBallSize();
        const finalLeft = clamp(elementStartLeft + pendingDx, 0, Math.max(0, vp.w - ballSz));
        const finalTop = clamp(elementStartTop + pendingDy, 0, Math.max(0, vp.h - ballSz));
        iframeEl.style.left = `${finalLeft}px`;
        iframeEl.style.top = `${finalTop}px`;
        iframeEl.style.transform = 'none';
        // 更新起始坐标，以免下次 drag 重算
        elementStartLeft = finalLeft;
        elementStartTop = finalTop;
      }

      isPointerDown = false;

      if (!hasMoved) {
        // 没有拖拽 → 单击切换面板
        debug('pointerup 无移动 → 切换面板');
        togglePanel();
      }
    });

    // 防止拖动时选中文本
    ball.addEventListener('dragstart', (e: DragEvent) => e.preventDefault());

    debug('拖拽事件绑定完成');
  });
}

// ============================================================
// 主入口
// ============================================================
$(() => {
  debug('脚本开始加载...');

  try {
    const pinia = createPinia();
    const store = useSummaryStore(pinia);

    // 初始化 store（传入聊天文件名作为世界书后缀）
    const chatSuffix = getChatFileName();
    store.initialize(chatSuffix);

    // 注册脚本按钮
    replaceScriptButtons([
      { name: '📜 生成总结', visible: true },
    ]);

    // ============================================================
    // 创建悬浮球 iframe（挂载到酒馆外层页面，而非脚本 iframe 内）
    // ============================================================
    const vp = getViewport();
    const ballSize = getBallSize();
    const iframeSize = getIframeSize();
    const $iframe = createScriptIdIframe()
      .css({
        position: 'fixed',
        left: `${Math.max(8, vp.w - ballSize - 8 - GLOW_MARGIN)}px`,
        top: `${Math.max(8, vp.h - ballSize - 8 - GLOW_MARGIN)}px`,
        width: `${iframeSize}px`,
        height: `${iframeSize}px`,
        zIndex: '2147483647',
        overflow: 'visible',
        background: 'transparent',
        border: 'none',
      })
      .appendTo(parentWin.document.body);

    $ballContainer = $iframe as unknown as JQuery<HTMLElement>;

    // 等待 iframe 加载完毕
    $iframe[0].onload = () => {
      debug('iframe 已加载，准备挂载 Vue');

      const iframeDoc = $iframe[0].contentDocument!;

      // 覆盖 iframe_srcdoc 中的 overflow:hidden，增大 body 留出发光空间
      const overflowStyle = iframeDoc.createElement('style');
      overflowStyle.textContent = `
        html { overflow: hidden !important; }
        body {
          overflow: visible !important;
          padding: ${GLOW_MARGIN}px !important;
          margin: 0 !important;
        }
      `;
      iframeDoc.head.appendChild(overflowStyle);

      // 挂载 Vue 应用到新 iframe 的 body（先挂载，让样式先注入当前 document）
      const app = createApp(FloatingBallPanel, { panelState })
        .use(pinia);
      app.mount(iframeDoc.body);

      // 再将脚本 iframe 中的 Vue 样式复制到新 iframe 的 head
      const { destroy: destroyStyle } = teleportStyle(iframeDoc.head);

      // 挂载后设置拖拽等逻辑
      setupDragAndEvents(iframeDoc, $iframe[0]);
    };

    // 如果 iframe 已加载完毕则直接触发
    if ($iframe[0].contentDocument?.readyState === 'complete') {
      $iframe[0].onload!(new Event('load'));
    }

    // ============================================================
    // 注入总结到上下文（yuzuki 式前情提要，纯注入不建世界书）
    // ============================================================
    eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }: any) => {
      const marker = '【伊瑟利亚总结】';
      if ((chat || []).some((m: any) => String(m?.content || '').includes(marker))) return;

      const injected = store.buildInjectionText();
      if (!injected) return;

      chat.unshift({
        role: 'system',
        content: `${marker}\n${injected.text}`,
      });
    });

    // ============================================================
    // 监听聊天文件变更：重置总结数据 + 更新世界书后缀
    // ============================================================
    eventOn(tavern_events.CHAT_CHANGED, () => {
      const chatId = (() => { try { return SillyTavern.getCurrentChatId() || ''; } catch { return ''; } })();
      const newSuffix = getChatFileName();
      store.settings.worldbookSuffix = newSuffix;
      store.resetForNewChat(chatId);
    });

    // ============================================================
    // 脚本按钮事件
    // ============================================================
    eventOn(getButtonEvent('📜 生成总结'), () => {
      if (store.loading) {
        toastr.info('正在总结中，请稍候...');
        return;
      }
      store.generateSummary(false).then(result => {
        if (result) toastr.success('剧情总结完成', '伊瑟利亚总结助手');
      });
    });

    // ============================================================
    // 卸载清理
    // ============================================================
    $(window).on('pagehide', () => {
      store.destroy();
      $iframe.remove();
    });

    toastr.success('伊瑟利亚总结助手已就绪', '加载成功');
  } catch (e: any) {
    console.error('[伊瑟利亚总结助手] 加载失败:', e?.message || e);
    toastr.error(e?.message || '未知错误', '伊瑟利亚总结助手加载失败');
  }
});
