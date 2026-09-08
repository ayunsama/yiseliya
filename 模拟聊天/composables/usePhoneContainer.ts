function getOwnerDocument(): Document | null {
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

export function usePhoneContainer() {
  function getContainer(): HTMLElement | null {
    try {
      const id = getScriptId();
      return (getOwnerDocument()?.querySelector(`div[script_id="${id}"]`) ?? null) as HTMLElement | null;
    } catch {
      return null;
    }
  }

  function getRect(): DOMRect | null {
    return getContainer()?.getBoundingClientRect() ?? null;
  }

  function clampPosition(left: number, top: number, width: number, height: number): { left: number; top: number } {
    const win = getOwnerWindow();
    const vw = win.innerWidth;
    const vh = win.innerHeight;
    return {
      left: Math.min(Math.max(left, 0), Math.max(0, vw - width)),
      top: Math.min(Math.max(top, 0), Math.max(0, vh - height)),
    };
  }

  function move(left: number, top: number) {
    const el = getContainer();
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pos = clampPosition(left, top, rect.width, rect.height);
    el.style.left = `${pos.left}px`;
    el.style.top = `${pos.top}px`;
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    savePosition(pos.left, pos.top);
  }

  function resize(width: string, height: string) {
    const el = getContainer();
    if (!el) return;
    el.style.width = width;
    el.style.height = height;
  }

  function savePosition(left: number, top: number) {
    try {
      localStorage.setItem('phoneIframePos', JSON.stringify({ left, top }));
    } catch {
      // ignore storage errors
    }
  }

  function loadPosition(): { left: number; top: number } | null {
    try {
      const raw = localStorage.getItem('phoneIframePos');
      if (!raw) return null;
      const pos = JSON.parse(raw) as { left: number; top: number };
      const win = getOwnerWindow();
      const vw = win.innerWidth;
      const vh = win.innerHeight;
      return {
        left: Math.min(Math.max(pos.left, 0), Math.max(0, vw - 64)),
        top: Math.min(Math.max(pos.top, 0), Math.max(0, vh - 64)),
      };
    } catch {
      return null;
    }
  }

  return {
    getContainer,
    getRect,
    move,
    resize,
    loadPosition,
  };
}
