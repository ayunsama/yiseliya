function getOwnerDocument(): Document {
  try {
    return window.parent?.document ?? document;
  } catch {
    return document;
  }
}

export function useDrag(
  onMove: (left: number, top: number) => void,
  onClick?: () => void,
) {
  let dragStartX = 0;
  let dragStartY = 0;
  let initialLeft = 0;
  let initialTop = 0;
  let isDragging = false;
  let overlay: HTMLElement | null = null;

  function startDrag(e: MouseEvent | TouchEvent, getContainerRect: () => DOMRect | null) {
    const evt = 'touches' in e ? e.touches[0] : e;
    dragStartX = evt.clientX;
    dragStartY = evt.clientY;
    const rect = getContainerRect();
    initialLeft = rect?.left ?? 0;
    initialTop = rect?.top ?? 0;
    isDragging = false;

    const doc = getOwnerDocument();
    overlay = doc.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.zIndex = '10000';
    overlay.style.cursor = 'grabbing';
    overlay.style.userSelect = 'none';
    doc.body.appendChild(overlay);

    overlay.addEventListener('mousemove', onDrag);
    overlay.addEventListener('mouseup', endDrag);
    overlay.addEventListener('mouseleave', endDrag);
    overlay.addEventListener('touchmove', onTouchDrag, { passive: false });
    overlay.addEventListener('touchend', endDrag);

    if ('preventDefault' in e) {
      e.preventDefault();
    }
  }

  function onDrag(e: MouseEvent) {
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      isDragging = true;
    }
    onMove(initialLeft + dx, initialTop + dy);
  }

  function onTouchDrag(e: TouchEvent) {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragStartX;
    const dy = touch.clientY - dragStartY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
      isDragging = true;
    }
    onMove(initialLeft + dx, initialTop + dy);
    e.preventDefault();
  }

  function endDrag() {
    if (overlay) {
      overlay.removeEventListener('mousemove', onDrag);
      overlay.removeEventListener('mouseup', endDrag);
      overlay.removeEventListener('mouseleave', endDrag);
      overlay.removeEventListener('touchmove', onTouchDrag);
      overlay.removeEventListener('touchend', endDrag);
      overlay.remove();
      overlay = null;
    }
    const hadDragged = isDragging;
    isDragging = false;
    if (!hadDragged) {
      onClick?.();
    }
    return hadDragged;
  }

  function getWasDragging() {
    return isDragging;
  }

  return {
    startDrag,
    endDrag,
    wasDragging: getWasDragging,
  };
}
