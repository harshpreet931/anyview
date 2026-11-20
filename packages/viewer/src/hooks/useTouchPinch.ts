import { useEffect, type RefObject } from 'react';
import { useViewerStoreApi } from './useDocViewer';
import type { GestureCore } from './useZoomGestures';
import { clampZoom } from '../core/zoom';
import { sameZoom, toLocal } from './zoom-gesture-math';

const DOUBLE_TAP = 2;
const TAP_MS = 250;
const TAP_SLOP = 10;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 30;

const find = (list: TouchList, id: number) => {
  for (let i = 0; i < list.length; i++) if (list[i]!.identifier === id) return list[i]!;
  return null;
};

// Touch pinch uses touch events, not pointer events: once the browser starts panning it cancels the
// pointers, and only a cancelable touchmove can stop that pan. Moving both fingers pans while zooming.
export function useTouchPinch(
  scrollRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  core: GestureCore,
) {
  const store = useViewerStoreApi();
  const { gesture, tapAnchor, cancelSettle, beginGesture, scaleTo, commitGesture, zoomTo } = core;

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
      const { x, y } = toLocal(el, clientX, clientY);
      if (s.fitMode === 'custom') {
        tapAnchor.current = { x, y, t: performance.now() };
        s.setFitMode('page-width');
        return;
      }
      const next = clampZoom(s.zoom * DOUBLE_TAP);
      if (sameZoom(next, s.zoom)) return;
      zoomTo(s.zoom, next, { x: el.scrollLeft + x, y: el.scrollTop + y }, x, y, s.zoom / next);
    };

    const measure = (a: Touch, b: Touch) => ({
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1,
      mid: toLocal(el, (a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2),
    });

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
      cancelSettle();
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
        g.panX = m.mid.x - startMid.x;
        g.panY = m.mid.y - startMid.y;
        scaleTo((g.base * m.dist) / startDist);
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
  }, [scrollRef, contentRef, store, gesture, tapAnchor, cancelSettle, beginGesture, scaleTo, commitGesture, zoomTo]);
}
