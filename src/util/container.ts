const STORAGE_KEY = 'wxhl003_btn_pos';

export function getOwnerDocument(): Document {
  try { return window.parent?.document ?? document; }
  catch { return document; }
}

export function getOwnerWindow(): Window {
  try { return window.parent ?? window; }
  catch { return window; }
}

export function clampPosition(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 获取最外层容器元素 (div[script_id]) */
export function getContainer(): HTMLElement | null {
  try {
    const id = getScriptId();
    return (getOwnerDocument().querySelector(`div[script_id="${id}"]`) ?? null) as HTMLElement | null;
  } catch {
    return null;
  }
}

/** 获取容器当前的 bounding rect */
export function getContainerRect(): DOMRect | null {
  return getContainer()?.getBoundingClientRect() ?? null;
}

/** 移动最外层容器 (基于最外层) */
export function moveContainer(left: number, top: number) {
  const el = getContainer();
  if (!el) return;
  const win = getOwnerWindow();
  const rect = el.getBoundingClientRect();
  const clampedLeft = clampPosition(left, 0, Math.max(0, win.innerWidth - rect.width));
  const clampedTop = clampPosition(top, 0, Math.max(0, win.innerHeight - rect.height));
  el.style.left = `${clampedLeft}px`;
  el.style.top = `${clampedTop}px`;
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  savePosition(clampedLeft, clampedTop);
}

/** 保存容器位置 */
export function savePosition(left: number, top: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ left, top }));
  } catch { /* ignore */ }
}

/** 加载容器位置 */
export function loadPosition(): { left: number; top: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const pos = JSON.parse(raw);
    const win = getOwnerWindow();
    if (typeof pos.left === 'number' && typeof pos.top === 'number') {
      return {
        left: clampPosition(pos.left, 0, win.innerWidth - 64),
        top: clampPosition(pos.top, 0, win.innerHeight - 64),
      };
    }
    return null;
  } catch {
    return null;
  }
}
