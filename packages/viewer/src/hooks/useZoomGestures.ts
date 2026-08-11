import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  type RefObject,
} from 'react';
import { useViewerStore } from './useDocViewer';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(z, MAX_ZOOM));

export type MarqueeRect = { left: number; top: number; w: number; h: number };

/**
 * Ctrl+wheel, two-finger pinch and marquee-drag zoom for the scroll container.
 *
 * Wheel and pinch share one live gesture: the content is scaled with a CSS transform
 * while the fingers move, and the real zoom is committed once at the end, anchored so
 * the point under the cursor stays put.
 *
 * `isProgrammaticScrollRef` is owned by the caller because its scroll listener has to
 * ignore the scroll positions these gestures set.
 */
export function useZoomGestures(
  scrollRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  isProgrammaticScrollRef: RefObject<boolean>,
): { marquee: MarqueeRect | null } {
  const zoom = useViewerStore((s) => s.zoom);
  const setZoom = useViewerStore((s) => s.setZoom);
  const cursorMode = useViewerStore((s) => s.cursorMode);
  const setCursorMode = useViewerStore((s) => s.setCursorMode);

  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);

  const zoomRef = useRef(zoom);
  // Synced in a layout effect rather than during render: the gesture handlers read this to seed
  // a pinch, and a layout effect commits before the browser can dispatch the next pointer event.
  useLayoutEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const gesture = useRef<{
    base: number;
    factor: number;
    originX: number;
    originY: number;
    cursorX: number;
    cursorY: number;
  } | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingAnchor = useRef<{ ratio: number; x: number; y: number; cx: number; cy: number } | null>(null);

  const applyLiveScale = useCallback(() => {
    const content = contentRef.current;
    const g = gesture.current;
    if (!content || !g) return;
    content.style.transformOrigin = `${g.originX}px ${g.originY}px`;
    content.style.transform = `scale(${g.factor})`;
  }, [contentRef]);

  const commitGesture = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    const g = gesture.current;
    gesture.current = null;
    const content = contentRef.current;
    if (!g) return;
    const next = clampZoom(g.base * g.factor);
    if (Math.abs(next - g.base) < 1e-4) {
      if (content) {
        content.style.transform = '';
        content.style.transformOrigin = '';
      }
      return;
    }
    pendingAnchor.current = {
      ratio: next / g.base,
      x: g.originX,
      y: g.originY,
      cx: g.cursorX,
      cy: g.cursorY,
    };
    isProgrammaticScrollRef.current = true;
    setZoom(next);
  }, [setZoom, contentRef, isProgrammaticScrollRef]);

  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    const content = contentRef.current;
    if (content) {
      content.style.transform = '';
      content.style.transformOrigin = '';
    }
    const el = scrollRef.current;
    if (el) {
      el.scrollLeft = anchor.x * anchor.ratio - anchor.cx;
      el.scrollTop = anchor.y * anchor.ratio - anchor.cy;
    }
  }, [zoom, contentRef, scrollRef]);

  // macOS Chrome delivers a trackpad pinch as ctrl+wheel; listener stays non-passive to preventDefault the page zoom.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (!contentRef.current) return;

      const rect = el.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;
      if (!gesture.current) {
        gesture.current = {
          base: zoomRef.current,
          factor: 1,
          originX: el.scrollLeft + cursorX,
          originY: el.scrollTop + cursorY,
          cursorX,
          cursorY,
        };
      }
      const g = gesture.current;
      const target = clampZoom(g.base * g.factor * Math.exp(-e.deltaY * 0.0015));
      g.factor = target / g.base;
      applyLiveScale();

      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(commitGesture, 90);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      // A gesture settling when the viewer unmounts would otherwise commit 90ms later, into a store the component no longer owns.
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [applyLiveScale, commitGesture, scrollRef, contentRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const pts = new Map<number, { x: number; y: number }>();
    let startDist = 0;
    let pinching = false;

    const twoPoints = () => Array.from(pts.values());
    const distance = () => {
      const [a, b] = twoPoints();
      return Math.hypot(a!.x - b!.x, a!.y - b!.y);
    };
    const midpoint = () => {
      const [a, b] = twoPoints();
      const rect = el.getBoundingClientRect();
      return { x: (a!.x + b!.x) / 2 - rect.left, y: (a!.y + b!.y) / 2 - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) {
        pinching = true;
        startDist = distance() || 1;
        const mid = midpoint();
        gesture.current = {
          base: zoomRef.current,
          factor: 1,
          originX: el.scrollLeft + mid.x,
          originY: el.scrollTop + mid.y,
          cursorX: mid.x,
          cursorY: mid.y,
        };
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pinching || pts.size < 2 || !gesture.current) return;
      e.preventDefault();
      const g = gesture.current;
      const target = clampZoom((g.base * distance()) / startDist);
      g.factor = target / g.base;
      applyLiveScale();
    };
    const onUp = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2 && pinching) {
        pinching = false;
        commitGesture();
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [applyLiveScale, commitGesture, scrollRef]);

  useEffect(() => {
    if (cursorMode !== 'marquee') return;
    const el = scrollRef.current;
    if (!el) return;
    let start: { x: number; y: number } | null = null;
    const toContent = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      return { x: el.scrollLeft + (e.clientX - rect.left), y: el.scrollTop + (e.clientY - rect.top) };
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      start = toContent(e);
      setMarquee({ left: start.x, top: start.y, w: 0, h: 0 });
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!start) return;
      const p = toContent(e);
      setMarquee({
        left: Math.min(start.x, p.x),
        top: Math.min(start.y, p.y),
        w: Math.abs(p.x - start.x),
        h: Math.abs(p.y - start.y),
      });
    };
    const onUp = (e: PointerEvent) => {
      if (!start) return;
      const p = toContent(e);
      const left = Math.min(start.x, p.x);
      const top = Math.min(start.y, p.y);
      const w = Math.abs(p.x - start.x);
      const h = Math.abs(p.y - start.y);
      start = null;
      setMarquee(null);
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
      }
      setCursorMode('select');
      if (w < 12 || h < 12) return;

      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const cur = zoomRef.current;
      const next = Math.max(0.1, Math.min(cur * Math.min(cw / w, ch / h), 5));
      const ratio = next / cur;
      const cx = left + w / 2;
      const cy = top + h / 2;
      isProgrammaticScrollRef.current = true;
      zoomRef.current = next;
      setZoom(next);
      requestAnimationFrame(() => {
        el.scrollLeft = cx * ratio - cw / 2;
        el.scrollTop = cy * ratio - ch / 2;
      });
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
  }, [cursorMode, setZoom, setCursorMode, scrollRef, isProgrammaticScrollRef]);

  // Derived rather than cleared from the effect above, so leaving marquee mode
  // never needs a setState during an effect.
  return { marquee: cursorMode === 'marquee' ? marquee : null };
}
