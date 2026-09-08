// Pinia CDN 构建依赖这些 Vue 编译时常量，酒馆全局 Vue 未注入，需手动补齐
(globalThis as any).__VUE_PROD_DEVTOOLS__ = false;
(globalThis as any).__VUE_OPTIONS_API__ = false;
(globalThis as any).__VUE_PROD_HYDRATION_MISMATCH_DETAILS__ = false;

import { createPinia, setActivePinia } from 'pinia';
import { createApp, reactive } from 'vue';
import FloatingBallPanel from './FloatingBallPanel.vue';
import { usePlotPlannerStore } from './store';

// ---- 共享状态（reactive，Vue 组件会自动响应） ----
const panelState = reactive({
  expanded: false,
  collapsed: false,
});

// ---- 跨窗口工具 ----
/** 指向酒馆外层页面的 window 对象（脚本在 iframe 中运行） */
const OUTER = window.parent;

/** 在外层页面 document 上执行 querySelector */
function outerQS<T extends HTMLElement = HTMLElement>(sel: string): T | null {
  return (OUTER as any)?.document?.querySelector?.(sel) as T | null ?? null;
}

/** 外层页面 document */
function outerDoc(): Document {
  return (OUTER as any)?.document ?? document;
}

/** 外层页面 body */
function outerBody(): HTMLElement {
  return outerDoc().body;
}

// ---- Pointer Events 拖拽（瞬发无延迟，setPointerCapture 保证跟手） ----

let hostEl: HTMLElement | null = null;

let dragStartX = 0;
let dragStartY = 0;
let dragBaseLeft = 0;
let dragBaseTop = 0;
let isDragging = false;
let pointerDownOnHandle = false;

const BALL_SELECTOR = '[data-fab-ball="1"]';

function clamp(v: number, min: number, max: number) {
  return Math.min(Math.max(v, min), max);
}

function getViewportSize() {
  return { w: OUTER.innerWidth || 1280, h: OUTER.innerHeight || 720 };
}

function isHandleTarget(el: EventTarget | null): boolean {
  return !!(el && (el as HTMLElement).closest?.(BALL_SELECTOR));
}

function log(...args: any[]) {
  console.log('[剧情规划大师·调试]', ...args);
}

let lastToggleTime = 0;

function togglePanel() {
  const now = Date.now();
  if (now - lastToggleTime < 200) { log('togglePanel 防抖跳过'); return; }
  lastToggleTime = now;
  panelState.expanded = !panelState.expanded;
  panelState.collapsed = panelState.expanded ? false : true;
  log('togglePanel, 新状态 expanded=', panelState.expanded);
  if (!hostEl) return;
  if (panelState.expanded) {
    hostEl.style.width = '420px';
    hostEl.style.height = 'auto';
  } else {
    hostEl.style.width = '56px';
    hostEl.style.height = '56px';
  }
}

$(async () => {
  console.log('[剧情规划大师] 脚本开始加载...');

  try {
    const pinia = createPinia();
    setActivePinia(pinia);

    replaceScriptButtons([
      { name: '📖 分析剧情', visible: true },
      { name: '🚀 生成推进', visible: true },
    ]);

    const store = usePlotPlannerStore();

    const vp = getViewportSize();
    const vw = vp.w;
    const vh = vp.h;

    // ---- 在外层页面创建宿主元素 ----
    const $host = $(outerDoc().createElement('div'))
      .attr('script_id', getScriptId())
      .css({
        position: 'fixed',
        left: `${Math.max(12, vw - 78)}px`,
        top: `${Math.max(12, vh - 78)}px`,
        width: '56px',
        height: '56px',
        zIndex: '2147483647',
        overflow: 'visible',
        background: 'transparent',
      });
    outerBody().appendChild($host[0]);
    hostEl = $host[0];

    // ---- 克隆样式到外层页面 head ----
    const { destroy: destroyStyle } = (() => {
      const doc = outerDoc();
      const $styleDiv = $(doc.createElement('div'))
        .attr('script_id', getScriptId())
        .append($('head > style', document).clone());
      doc.head.appendChild($styleDiv[0]);
      return { destroy: () => $styleDiv.remove() };
    })();

    const settingsApp = createApp(FloatingBallPanel as any, { panelState }).use(pinia);
    settingsApp.mount(hostEl);

    // ---- Pointer Events 拖拽（瞬发无延迟，setPointerCapture 保证跟手） ----
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
      outerBody().style.cursor = 'grabbing';
      e.preventDefault();
    });

    hostEl.addEventListener('pointermove', (e) => {
      if (!hostEl || activePointerId === null || e.pointerId !== activePointerId) return;

      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;

      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) isDragging = true;
      if (!isDragging) return;

      const vpp = getViewportSize();
      const pw = hostEl.offsetWidth;
      const ph = hostEl.offsetHeight;
      const newLeft = clamp(dragBaseLeft + dx, 0, Math.max(0, vpp.w - pw));
      const newTop = clamp(dragBaseTop + dy, 0, Math.max(0, vpp.h - ph));

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
        const vpp = getViewportSize();
        const pw = hostEl.offsetWidth;
        const ph = hostEl.offsetHeight;
        const finalLeft = clamp(parseFloat(hostEl.style.left) || 0, 0, Math.max(0, vpp.w - pw));
        const finalTop = clamp(parseFloat(hostEl.style.top) || 0, 0, Math.max(0, vpp.h - ph));
        hostEl.style.left = `${finalLeft}px`;
        hostEl.style.top = `${finalTop}px`;
      } else if (pointerDownOnHandle) {
        togglePanel();
      }
      isDragging = false;
      pointerDownOnHandle = false;
    });

    // ---- 将长规划压缩为关键要点（避免分析性文本淹没角色扮演指令） ----
    function condensePlanForContext(raw: string, maxLen = 500): string {
      if (!raw || raw.length <= maxLen) return raw;
      // 尝试提取"起承转合"各阶段的第一句话作为骨架
      const stages = ['起', '承', '转', '合'];
      const lines: string[] = [];
      let found = false;
      for (const stage of stages) {
        // 匹配形如「起（建置）」或「起」开头的段落
        const re = new RegExp(`${stage}[（(][^)）]*[)）]?[\\s\\S]*?(?=${stages.map(s => s + '[（(]').join('|')}|$)`, 'g');
        const m = raw.match(re);
        if (m && m[0]) {
          // 每个阶段只取前 120 字
          const trimmed = m[0].replace(/\n+/g, ' ').trim();
          lines.push(trimmed.length > 120 ? trimmed.slice(0, 120) + '…' : trimmed);
          found = true;
        }
      }
      if (found && lines.length > 0) return lines.join('\n');
      // 兜底：直接截断
      return raw.slice(0, maxLen) + '…';
    }

    // 4. 监听生成前的提示词准备，注入最新规划 + 推进到上下文
    eventOn(tavern_events.CHAT_COMPLETION_PROMPT_READY, ({ chat }: any) => {
      const marker = '【剧情规划大师】';
      const alreadyInjected = (chat || []).some((m: any) => String(m?.content || '').includes(marker));
      if (alreadyInjected) return;

      const parts: string[] = [];

      if (store.settings.injectPlanIntoContext) {
        const plan = store.plans[store.plans.length - 1]?.content?.trim();
        if (plan) {
          const condensed = condensePlanForContext(plan);
          parts.push(
            '【剧情规划参考 — 仅供内部参考，禁止输出以下任何内容】\n' +
            '你是角色扮演 AI，你的唯一任务是生成生动的角色扮演正文。以下规划仅为剧情走向的隐性指引，你必须将其转化为自然的人物对话、动作描写和心理活动，绝不输出分析、大纲、规划或任何元文本。\n' +
            `规划要点：\n${condensed}`
          );
        }
      }
      if (store.settings.injectPushIntoContext) {
        const adv = store.advances[store.advances.length - 1]?.content?.trim();
        if (adv) {
          // 推进通常较短（一句话），但也需要强指令
          const cleaned = adv.replace(/【最高权限】请立即停止任何正文输出[。.]?/g, '').trim();
          parts.push(
            '【剧情推进参考 — 仅供内部参考，禁止直接输出推进内容】\n' +
            '将以下推进方向自然地编织进角色扮演正文中，不要以任何形式复述或提及推进内容：\n' +
            cleaned
          );
        }
      }
      if (parts.length === 0) return;

      chat.unshift({
        role: 'system',
        content: `${marker}\n${parts.join('\n\n')}`,
      });
    });

    // 4.5 监听聊天切换：重置规划数据
    eventOn(tavern_events.CHAT_CHANGED, () => {
      const chatId = (() => { try { return SillyTavern.getCurrentChatId() || ''; } catch { return ''; } })();
      store.resetForNewChat(chatId);
    });

    // 5. 点击按钮 -> 执行分析
    eventOn(getButtonEvent('📖 分析剧情'), () => {
      if (store.loading) { toastr.info('正在分析中，请稍候...'); return; }
      store.generatePlan().then(r => { if (r) toastr.success('剧情规划完成', '剧情规划大师'); });
    });
    eventOn(getButtonEvent('🚀 生成推进'), () => {
      if (store.loading) { toastr.info('正在分析中，请稍候...'); return; }
      store.generateAdvance().then(r => { if (r) toastr.success('推进指令生成完成', '剧情规划大师'); });
    });

    // 6. 卸载清理（从外层页面移除宿主元素和样式）
    $(window).on('pagehide', () => {
      store.setAutoGenerate(false);
      store.setAutoAdvance(false);
      settingsApp.unmount();
      // 从外层页面移除宿主元素（PointerEvents 自动随元素回收）
      const outerHost = outerQS(`[script_id="${getScriptId()}"]`);
      if (outerHost) outerHost.remove();
      destroyStyle();
    });

    toastr.success('剧情规划大师已就绪', '加载成功');
  } catch (e: any) {
    console.error('[剧情规划大师] 加载失败:', e?.message || e);
    toastr.error(e?.message || '未知错误', '剧情规划大师加载失败');
  }
});
