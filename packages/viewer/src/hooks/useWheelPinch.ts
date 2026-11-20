import { useEffect, type RefObject } from 'react';
import type { GestureCore } from './useZoomGestures';
import { toLocal, wheelFactor } from './zoom-gesture-math';

const SETTLE_MS = 150;

type GestureEvent = UIEvent & { scale: number; clientX: number; clientY: number };

// Chrome and Firefox deliver a trackpad pinch as ctrl+wheel with small pixel deltas; a mouse sends
// line deltas or whole notches. Safari on macOS sends gesture events instead. Listeners stay
// non-passive so the browser's own page zoom can be cancelled.
export function useWheelPinch(
  scrollRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  core: GestureCore,
) {
  const { gesture, settleTimer, cancelSettle, beginGesture, scaleTo, commitGesture } = core;

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const touchDevice = navigator.maxTouchPoints > 0;
    let safari = false;
    let safariBase = 1;

    const settle = () => {
      cancelSettle();
      settleTimer.current = setTimeout(commitGesture, SETTLE_MS);
    };

    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      if (safari || !contentRef.current) return;
      const p = toLocal(el, e.clientX, e.clientY);
      if (!gesture.current) beginGesture(el, p.x, p.y);
      const g = gesture.current;
      if (!g) return;
      scaleTo(g.raw * wheelFactor(e));
      settle();
    };

    const onGestureStart = (e: Event) => {
      e.preventDefault();
      if (touchDevice || !contentRef.current) return;
      const ge = e as GestureEvent;
      cancelSettle();
      if (!gesture.current) {
        const p = toLocal(el, ge.clientX, ge.clientY);
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
    el.addEventListener('gesturestart', onGestureStart, { passive: false });
    el.addEventListener('gesturechange', onGestureChange, { passive: false });
    el.addEventListener('gestureend', onGestureEnd, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart);
      el.removeEventListener('gesturechange', onGestureChange);
      el.removeEventListener('gestureend', onGestureEnd);
      // A gesture settling when the viewer unmounts would otherwise commit later, into a store the component no longer owns.
      cancelSettle();
    };
  }, [scrollRef, contentRef, gesture, settleTimer, cancelSettle, beginGesture, scaleTo, commitGesture]);
}
