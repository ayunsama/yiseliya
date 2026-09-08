import { createPinia } from 'pinia';
import { createApp } from 'vue';
import { createScriptIdDiv } from '../../util/script';
import App from './App.vue';
import cssText from './global.css?raw';

$(() => {
  const app = createApp(App);
  app.use(createPinia());

  // Determine owner document (parent if in iframe)
  const ownerDoc = (() => {
    try { return window.parent?.document ?? document; }
    catch { return document; }
  })();
  const ownerWin = (() => {
    try { return window.parent ?? window; }
    catch { return window; }
  })();

  // Inject global styles into parent document
  const styleEl = ownerDoc.createElement('style');
  styleEl.textContent = cssText;
  ownerDoc.head.appendChild(styleEl);

  // Load saved position for the outermost container
  let savedLeft: number | null = null;
  let savedTop: number | null = null;
  try {
    const raw = localStorage.getItem('wxhl003_btn_pos');
    if (raw) {
      const pos = JSON.parse(raw);
      if (typeof pos.left === 'number' && typeof pos.top === 'number') {
        savedLeft = Math.max(0, Math.min(pos.left, ownerWin.innerWidth - 64));
        savedTop = Math.max(0, Math.min(pos.top, ownerWin.innerHeight - 64));
      }
    }
  } catch { /* ignore */ }

  // ============ 基于最外层的容器 ============
  // 拖拽时直接移动此容器，而非内部元素
  const $container = createScriptIdDiv()
    .attr('id', 'wxhl003-root')
    .css({
      position: 'fixed',
      left: savedLeft !== null ? `${savedLeft}px` : 'auto',
      top: savedTop !== null ? `${savedTop}px` : 'auto',
      bottom: savedLeft !== null ? 'auto' : '24px',
      right: savedLeft !== null ? 'auto' : '24px',
      width: '64px',
      height: '64px',
      border: 'none',
      zIndex: '2147483640',
      background: 'transparent',
      overflow: 'visible',
      // 拖拽逻辑基于此容器，事件由内部元素触发
    })
    .appendTo('body');

  app.mount($container[0]);

  $(window).on('pagehide', () => {
    styleEl.remove();
    app.unmount();
    $container.remove();
  });
});
