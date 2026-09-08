import { createApp } from 'vue';
import { createScriptIdDiv } from '../util/script';
import App from './App.vue';
import cssText from './styles.css?raw';
import { usePerformance } from './composables/usePerformance';

const app = createApp(App);

function getOwnerDocument(): Document {
  try {
    return window.parent?.document ?? document;
  } catch {
    return document;
  }
}

function getOwnerWindow(): Window {
  try {
    return window.parent ?? window;
  } catch {
    return window;
  }
}

$(() => {
  const ownerWindow = getOwnerWindow();
  const ownerDoc = getOwnerDocument();

  const { detectReduceMotion } = usePerformance();
  detectReduceMotion(ownerDoc).then(reduce => {
    if (reduce) {
      ownerDoc.body.classList.add('st-reduce-motion');
      document.body.classList.add('st-reduce-motion');
    }
  }).catch(() => {
    // ignore detection errors
  });

  const savedPos = (() => {
    try {
      const raw = localStorage.getItem('phoneIframePos');
      if (!raw) return null;
      const pos = JSON.parse(raw) as { left: number; top: number };
      const vw = ownerWindow.innerWidth;
      const vh = ownerWindow.innerHeight;
      return {
        left: Math.min(Math.max(pos.left, 0), Math.max(0, vw - 64)),
        top: Math.min(Math.max(pos.top, 0), Math.max(0, vh - 64)),
      };
    } catch {
      return null;
    }
  })();

  const $container = createScriptIdDiv()
    .css({
      position: 'fixed',
      bottom: savedPos ? 'auto' : '24px',
      right: savedPos ? 'auto' : '24px',
      left: savedPos ? `${savedPos.left}px` : 'auto',
      top: savedPos ? `${savedPos.top}px` : 'auto',
      width: '64px',
      height: '64px',
      border: 'none',
      zIndex: '1000',
      background: 'transparent',
      overflow: 'hidden',
      boxSizing: 'border-box',
    })
    .appendTo('body');

  const styleEl = ownerDoc.createElement('style');
  styleEl.textContent = cssText;
  ownerDoc.head.appendChild(styleEl);

  app.mount($container[0]);

  $(window).on('pagehide', () => {
    styleEl.remove();
    app.unmount();
    $container.remove();
  });
});
