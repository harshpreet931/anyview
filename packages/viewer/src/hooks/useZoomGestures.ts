import {
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  type RefObject,
} from 'react';
import { useViewerStore, useViewerStoreApi } from './useDocViewer';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(z, MAX_ZOOM));
const SETTLE_MS = 150;
const STRETCH = Math.log(1.5);
const DOUBLE_TAP = 2;
const TAP_MS = 250;
const TAP_SLOP = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 30;
const STIFFNESS = 0.55;

/** Past a limit the zoom keeps moving with growing resistance (the iOS rubber band), up to 1.5x beyond it. */
function rubber(z: number): number {
  if (z > MAX_ZOOM) {
    const o = Math.log(z / MAX_ZOOM);
    return MAX_ZOOM * Math.exp((o * STRETCH * STIFFNESS) / (STRETCH + STIFFNESS * o));
  }
  if (z < MIN_ZOOM) {
    const o = Math.log(MIN_ZOOM / z);
    return MIN_ZOOM / Math.exp((o * STRETCH * STIFFNESS) / (STRETCH + STIFFNESS * o));
  }
  return z;
}
const clampRaw = (z: number) => Math.max(MIN_ZOOM / 4, Math.min(z, MAX_ZOOM * 4));
const SPRING: KeyframeAnimationOptions = { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' };
const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const NOTCH = 1.15;

/** Trackpad pinches arrive as small pixel deltas at Chrome's rate of e^(-deltaY/100); mouse notches step by a fixed ratio. */
function wheelFactor(e: WheelEvent): number {
  const notch = e.deltaMode !== 0 || Math.abs(e.deltaY) >= 50;
  if (notch) return e.deltaY < 0 ? NOTCH : e.deltaY > 0 ? 1 / NOTCH : 1;
  return Math.exp(-e.deltaY / 100);
}

export type MarqueeRect = { left: number; top: number; w: number; h: number };

/** Lets the container anchor a zoom to the page under a point, so uneven gaps and stale row sizes can't drift it. */
export interface ZoomAnchoring<A> {
  capture(contentX: number, contentY: number): A;
  restore(anchor: A, ratio: number, viewX: number, viewY: number): void;
}

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
export function useZoomGestures<A>(
  scrollRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  isProgrammaticScrollRef: RefObject<boolean>,
  anchoring: ZoomAnchoring<A>,
  sizerRef?: RefObject<HTMLDivElement | null>,
): { marquee: MarqueeRect | null } {
  const zoom = useViewerStore((s) => s.zoom);
  const setZoom = useViewerStore((s) => s.setZoom);
  const cursorMode = useViewerStore((s) => s.cursorMode);
  const setCursorMode = useViewerStore((s) => s.setCursorMode);
  const store = useViewerStoreApi();
  const horizontal = useViewerStore((s) => s.scrollMode === 'horizontal');
  const horizontalRef = useRef(horizontal);
  useLayoutEffect(() => {
    horizontalRef.current = horizontal;
  }, [horizontal]);

  const [marquee, setMarquee] = useState<MarqueeRect | null>(null);

  const zoomRef = useRef(zoom);
  // Synced in a layout effect rather than during render: the gesture handlers read this to seed
  // a pinch, and a layout effect commits before the browser can dispatch the next pointer event.
  useLayoutEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const gesture = useRef<{
    base: number;
    raw: number;
    factor: number;
    originX: number;
    originY: number;
    cursorX: number;
    cursorY: number;
    scrollX: number;
    scrollY: number;
    span: { left: number; right: number } | null;
    panX: number;
    panY: number;
    tx: number;
    ty: number;
  } | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingAnchor = useRef<{ ratio: number; at: A; cx: number; cy: number; from?: number } | null>(null);
  const tapAnchor = useRef<{ x: number; y: number; t: number } | null>(null);
  const animation = useRef<Animation | null>(null);
  const anchoringRef = useRef(anchoring);
  useLayoutEffect(() => {
    anchoringRef.current = anchoring;
  });

  // While a gesture or animation is showing, the content gets its own compositor layer, and a sizer
  // holds the scroll range open: a scaled-down preview shrinks it and the browser would clamp the scroll.
  const setZooming = useCallback(
    (active: boolean) => {
      const content = contentRef.current;
      if (content) content.style.willChange = active ? 'transform' : '';
      const sizer = sizerRef?.current;
      const el = scrollRef.current;
      if (!sizer || !el) return;
      sizer.style.width = active ? `${el.scrollWidth}px` : '0px';
      sizer.style.height = active ? `${el.scrollHeight}px` : '0px';
    },
    [contentRef, sizerRef, scrollRef],
  );

  const beginGesture = useCallback(
    (el: HTMLDivElement, cursorX: number, cursorY: number) => {
      animation.current?.cancel();
      setZooming(true);
      gesture.current = {
        base: zoomRef.current,
        raw: zoomRef.current,
        factor: 1,
        originX: el.scrollLeft + cursorX,
        originY: el.scrollTop + cursorY,
        cursorX,
        cursorY,
        scrollX: el.scrollLeft,
        scrollY: el.scrollTop,
        span: contentRef.current && !horizontalRef.current ? pageSpan(contentRef.current) : null,
        panX: 0,
        panY: 0,
        tx: 0,
        ty: 0,
      };
    },
    [contentRef, setZooming],
  );

  // Keeps the preview inside what the committed layout can show: narrow pages stay centred and
  // no edge is pulled into view past the scroll range, so letting go doesn't jump. Any scroll the
  // browser did on its own during the gesture is folded into the pan rather than added to it.
  const applyLiveScale = useCallback(() => {
    const content = contentRef.current;
    const el = scrollRef.current;
    const g = gesture.current;
    if (!content || !el || !g) return;
    const f = g.factor;
    const sl = el.scrollLeft;
    const st = el.scrollTop;
    const panX = g.panX + sl - g.scrollX;
    const panY = g.panY + st - g.scrollY;
    const fit = (pan: number, origin: number, scroll: number, size: number, view: number) => {
      const upper = scroll - origin * (1 - f);
      if (size * f < view) return upper;
      const lower = view - (origin + (size - origin) * f - scroll);
      return Math.min(upper, Math.max(lower, pan));
    };
    let tx: number;
    if (g.span) {
      const left = g.originX + (g.span.left - g.originX) * f - sl + panX;
      const w = (g.span.right - g.span.left) * f;
      const W = el.clientWidth;
      const want = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, left));
      tx = panX + want - left;
    } else {
      tx = fit(panX, g.originX, sl, content.offsetWidth, el.clientWidth);
    }
    const ty = fit(panY, g.originY, st, content.offsetHeight, el.clientHeight);
    g.tx = tx;
    g.ty = ty;
    content.style.transformOrigin = `${g.originX}px ${g.originY}px`;
    content.style.transform = `translate(${tx}px, ${ty}px) scale(${f})`;
  }, [contentRef, scrollRef]);

  const commitGesture = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    const g = gesture.current;
    gesture.current = null;
    const content = contentRef.current;
    if (!g) return;
    const next = clampZoom(g.raw);
    const shown = g.base * g.factor;
    if (Math.abs(next - g.base) < 1e-4) {
      if (content) {
        const stretched = content.style.transform;
        content.style.transform = '';
        if (Math.abs(shown / next - 1) > 1e-3 && !reducedMotion()) {
          const anim = content.animate([{ transform: stretched }, { transform: 'none' }], SPRING);
          animation.current = anim;
          const done = () => {
            if (animation.current !== anim) return;
            animation.current = null;
            if (!gesture.current) {
              content.style.transformOrigin = '';
              setZooming(false);
            }
          };
          anim.onfinish = done;
          anim.oncancel = done;
        } else {
          content.style.transformOrigin = '';
          setZooming(false);
        }
      }
      return;
    }
    pendingAnchor.current = {
      ratio: next / g.base,
      at: anchoringRef.current.capture(g.originX, g.originY),
      cx: g.originX - (scrollRef.current?.scrollLeft ?? g.scrollX) + g.tx,
      cy: g.originY - (scrollRef.current?.scrollTop ?? g.scrollY) + g.ty,
      ...(Math.abs(shown / next - 1) > 1e-3 ? { from: shown / next } : {}),
    };
    isProgrammaticScrollRef.current = true;
    setZoom(next);
  }, [setZoom, contentRef, scrollRef, isProgrammaticScrollRef, setZooming]);

  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    if (!anchor) return;
    pendingAnchor.current = null;
    const content = contentRef.current;
    if (content) {
      content.style.transform = '';
      content.style.transformOrigin = '';
    }
    const running = animation.current;
    const shown = running && content ? new DOMMatrix(getComputedStyle(content).transform).a || 1 : 1;
    running?.cancel();
    setZooming(false);
    anchoringRef.current.restore(anchor.at, anchor.ratio, anchor.cx, anchor.cy);
    const el = scrollRef.current;
    if (anchor.from == null || !content || !el || reducedMotion()) return;
    setZooming(true);
    content.style.transformOrigin = `${el.scrollLeft + anchor.cx}px ${el.scrollTop + anchor.cy}px`;
    const anim = content.animate(
      [{ transform: `scale(${shown * anchor.from})` }, { transform: 'none' }],
      SPRING,
    );
    animation.current = anim;
    const done = () => {
      if (animation.current !== anim) return;
      animation.current = null;
      if (!gesture.current) {
        content.style.transformOrigin = '';
        setZooming(false);
      }
    };
    anim.onfinish = done;
    anim.oncancel = done;
  }, [zoom, contentRef, scrollRef, setZooming]);

  // Zooms that don't come from a gesture (toolbar, keys, fit modes, the API) anchor on the middle of the view.
  useEffect(
    () =>
      store.subscribe((next, prev) => {
        if (next.zoom === prev.zoom || next.document !== prev.document) return;
        if (pendingAnchor.current || gesture.current) return;
        const el = scrollRef.current;
        if (!el || !contentRef.current || prev.zoom <= 0) return;
        const tap = tapAnchor.current && performance.now() - tapAnchor.current.t < 1000 ? tapAnchor.current : null;
        tapAnchor.current = null;
        const cx = tap ? tap.x : el.clientWidth / 2;
        const cy = tap ? tap.y : el.scrollTop <= 0 ? 0 : el.clientHeight / 2;
        const ratio = next.zoom / prev.zoom;
        pendingAnchor.current = {
          ratio,
          at: anchoringRef.current.capture(el.scrollLeft + cx, el.scrollTop + cy),
          cx,
          cy,
          ...(next.fitMode === 'custom' || tap ? { from: 1 / ratio } : {}),
        };
      }),
    [store, scrollRef, contentRef],
  );

  // Chrome and Firefox deliver a trackpad pinch as ctrl+wheel with small pixel deltas; a mouse sends
  // line deltas or whole notches. Safari on macOS sends gesture events instead. Listeners stay
  // non-passive so the browser's own page zoom can be cancelled.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const touchDevice = navigator.maxTouchPoints > 0;
    let safari = false;
    let safariBase = 1;

    const settle = () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(commitGesture, SETTLE_MS);
    };
    const local = (e: { clientX: number; clientY: number }) => {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const scaleTo = (raw: number) => {
      const g = gesture.current;
      if (!g) return;
      g.raw = clampRaw(raw);
      g.factor = rubber(g.raw) / g.base;
      applyLiveScale();
    };

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (safari || !contentRef.current) return;
      const p = local(e);
      if (!gesture.current) beginGesture(el, p.x, p.y);
      const g = gesture.current;
      if (!g) return;
      scaleTo(g.raw * wheelFactor(e));
      settle();
    };

    type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number };
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      if (touchDevice || !contentRef.current) return;
      const ge = e as GestureEvent;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (!gesture.current) {
        const p = local(ge);
        beginGesture(el, p.x, p.y);
      }
      const g = gesture.current;
      safari = true;
      safariBase = g ? g.raw / g.base : 1;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      if (!safari) return;
      const g = gesture.current;
      if (g) scaleTo(g.base * safariBase * (e as GestureEvent).scale);
    };
    const onGestureEnd = (e: Event) => {
      e.preventDefault();
      if (!safari) return;
      safari = false;
      commitGesture();
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGestureStart, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gesturechange', onGestureChange, { passive: false } as AddEventListenerOptions);
    el.addEventListener('gestureend', onGestureEnd, { passive: false } as AddEventListenerOptions);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      // A gesture settling when the viewer unmounts would otherwise commit later, into a store the component no longer owns.
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [applyLiveScale, beginGesture, commitGesture, scrollRef, contentRef]);

  // Touch pinch uses touch events, not pointer events: once the browser starts panning it cancels the
  // pointers, and only a cancelable touchmove can stop that pan. Moving both fingers pans while zooming.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let pair: [number, number] | null = null;
    let startDist = 1;
    let startMid = { x: 0, y: 0 };
    let follow: { id: number; x: number; y: number } | null = null;
    let tap: { id: number; x: number; y: number; t: number } | null = null;
    let lastTap: { x: number; y: number; t: number } | null = null;

    const doubleTap = (clientX: number, clientY: number) => {
      const s = store.getState();
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (s.fitMode === 'custom') {
        tapAnchor.current = { x, y, t: performance.now() };
        s.setFitMode('page-width');
        return;
      }
      const next = clampZoom(s.zoom * DOUBLE_TAP);
      if (Math.abs(next - s.zoom) < 1e-4) return;
      pendingAnchor.current = {
        ratio: next / s.zoom,
        at: anchoringRef.current.capture(el.scrollLeft + x, el.scrollTop + y),
        cx: x,
        cy: y,
        from: s.zoom / next,
      };
      isProgrammaticScrollRef.current = true;
      s.setZoom(next);
    };

    const find = (list: TouchList, id: number) => {
      for (let i = 0; i < list.length; i++) if (list[i]!.identifier === id) return list[i]!;
      return null;
    };
    const measure = (a: Touch, b: Touch) => {
      const rect = el.getBoundingClientRect();
      return {
        dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
        mid: { x: (a.clientX + b.clientX) / 2 - rect.left, y: (a.clientY + b.clientY) / 2 - rect.top },
      };
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length === 1 && !pair) {
        const t = e.touches[0]!;
        tap = { id: t.identifier, x: t.clientX, y: t.clientY, t: performance.now() };
      } else {
        tap = null;
        lastTap = null;
      }
      if (pair || e.touches.length < 2 || !contentRef.current) return;
      const a = e.touches[0]!;
      const b = e.touches[1]!;
      pair = [a.identifier, b.identifier];
      follow = null;
      const m = measure(a, b);
      startDist = m.dist;
      startMid = m.mid;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (gesture.current) commitGesture();
      beginGesture(el, m.mid.x, m.mid.y);
      if (e.cancelable) e.preventDefault();
    };
    const onMove = (e: TouchEvent) => {
      if (tap) {
        const t = find(e.touches, tap.id);
        if (!t || Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > TAP_SLOP) tap = null;
      }
      if (pair) {
        const a = find(e.touches, pair[0]);
        const b = find(e.touches, pair[1]);
        const g = gesture.current;
        if (!a || !b || !g) return;
        if (e.cancelable) e.preventDefault();
        const m = measure(a, b);
        g.raw = clampRaw((g.base * m.dist) / startDist);
        g.factor = rubber(g.raw) / g.base;
        g.panX = m.mid.x - startMid.x;
        g.panY = m.mid.y - startMid.y;
        applyLiveScale();
        return;
      }
      if (!follow || !e.cancelable) return;
      const t = find(e.touches, follow.id);
      if (!t) return;
      e.preventDefault();
      el.scrollBy(follow.x - t.clientX, follow.y - t.clientY);
      follow = { id: t.identifier, x: t.clientX, y: t.clientY };
    };
    const onEnd = (e: TouchEvent) => {
      if (pair && (!find(e.touches, pair[0]) || !find(e.touches, pair[1]))) {
        pair = null;
        commitGesture();
        const rest = e.touches[0];
        follow = rest ? { id: rest.identifier, x: rest.clientX, y: rest.clientY } : null;
        return;
      }
      if (e.touches.length === 0) follow = null;
      const now = performance.now();
      if (tap && e.touches.length === 0 && now - tap.t < TAP_MS && store.getState().cursorMode === 'select') {
        if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < DOUBLE_TAP_SLOP) {
          if (e.cancelable) e.preventDefault();
          lastTap = null;
          doubleTap(tap.x, tap.y);
        } else {
          lastTap = { x: tap.x, y: tap.y, t: now };
        }
      }
      tap = null;
    };

    el.addEventListener('touchstart', onStart, { passive: false });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [applyLiveScale, beginGesture, commitGesture, scrollRef, contentRef, store, isProgrammaticScrollRef]);

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
      if (Math.abs(next - cur) < 1e-4) return;
      pendingAnchor.current = {
        ratio: next / cur,
        at: anchoringRef.current.capture(left + w / 2, top + h / 2),
        cx: cw / 2,
        cy: ch / 2,
        from: cur / next,
      };
      isProgrammaticScrollRef.current = true;
      zoomRef.current = next;
      setZoom(next);
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

function pageSpan(content: HTMLElement): { left: number; right: number } | null {
  const pages = content.querySelectorAll<HTMLElement>('.dv-page');
  if (pages.length === 0) return null;
  const box = content.getBoundingClientRect();
  let left = Infinity;
  let right = -Infinity;
  for (const p of pages) {
    const r = p.getBoundingClientRect();
    left = Math.min(left, r.left - box.left);
    right = Math.max(right, r.right - box.left);
  }
  return { left, right };
}
