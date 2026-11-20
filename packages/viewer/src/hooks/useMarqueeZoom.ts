import { useEffect, useState, type RefObject } from 'react';
import { useViewerStore } from './useDocViewer';
import type { GestureCore } from './useZoomGestures';
import { clampZoom } from '../core/zoom';
import { rectBetween, sameZoom, toLocal, type MarqueeRect, type Point } from './zoom-gesture-math';

const MIN_MARQUEE = 12;

export function useMarqueeZoom(
  scrollRef: RefObject<HTMLDivElement | null>,
  core: GestureCore,
): { marquee: MarqueeRect | null } {
  const cursorMode = useViewerStore((s) => s.cursorMode);
  const setCursorMode = useViewerStore((s) => s.setCursorMode);
  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);
  const { zoomRef, zoomTo } = core;

  useEffect(() => {
    if (cursorMode !== 'marquee') return;
    const el = scrollRef.current;
    if (!el) return;
    let start: Point | null = null;
    const toContent = (e: PointerEvent) => {
      const p = toLocal(el, e.clientX, e.clientY);
      return { x: el.scrollLeft + p.x, y: el.scrollTop + p.y };
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      start = toContent(e);
      setMarquee({ left: start.x, top: start.y, w: 0, h: 0 });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* the pointer is already gone */
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!start) return;
      setMarquee(rectBetween(start, toContent(e)));
    };
    const onUp = (e: PointerEvent) => {
      if (!start) return;
      const { left, top, w, h } = rectBetween(start, toContent(e));
      start = null;
      setMarquee(null);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        /* the pointer is already released */
      }
      setCursorMode('select');
      if (w < MIN_MARQUEE || h < MIN_MARQUEE) return;

      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const cur = zoomRef.current;
      const next = clampZoom(cur * Math.min(cw / w, ch / h));
      if (sameZoom(next, cur)) return;
      zoomRef.current = next;
      zoomTo(cur, next, { x: left + w / 2, y: top + h / 2 }, cw / 2, ch / 2, cur / next);
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [cursorMode, setCursorMode, scrollRef, zoomRef, zoomTo]);

  // Derived rather than cleared from the effect above, so leaving marquee mode
  // never needs a setState during an effect.
  return { marquee: cursorMode === 'marquee' ? marquee : null };
}
