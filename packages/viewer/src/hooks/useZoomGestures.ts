import { useRef, useEffect, useLayoutEffect, useCallback, type RefObject } from 'react';
import { useViewerStore, useViewerStoreApi } from './useDocViewer';
import { useLatest } from './useLatest';
import { useWheelPinch } from './useWheelPinch';
import { useTouchPinch } from './useTouchPinch';
import { useMarqueeZoom } from './useMarqueeZoom';
import { clampZoom } from '../core/zoom';
import {
  clampRaw,
  pageSpan,
  previewTranslate,
  rubber,
  sameZoom,
  settleFrom,
  type Gesture,
  type MarqueeRect,
  type Point,
} from './zoom-gesture-math';

export type { MarqueeRect } from './zoom-gesture-math';

const FIT_ANIMATE_MS = 1000;
const SPRING: KeyframeAnimationOptions = { duration: 220, easing: 'cubic-bezier(0.2, 0, 0, 1)' };

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Lets the container anchor a zoom to the page under a point, so uneven gaps and stale row sizes can't drift it. */
export interface ZoomAnchoring<A> {
  capture(contentX: number, contentY: number): A;
  restore(anchor: A, ratio: number, viewX: number, viewY: number): void;
}

export interface GestureCore {
  gesture: RefObject<Gesture | null>;
  settleTimer: RefObject<ReturnType<typeof setTimeout> | undefined>;
  tapAnchor: RefObject<{ x: number; y: number; t: number } | null>;
  zoomRef: RefObject<number>;
  cancelSettle(): void;
  beginGesture(el: HTMLDivElement, cursorX: number, cursorY: number): void;
  applyLiveScale(): void;
  scaleTo(raw: number): void;
  commitGesture(): void;
  zoomTo(base: number, next: number, at: Point, cx: number, cy: number, from?: number): void;
}

/**
 * `isProgrammaticScrollRef` is owned by the caller because its scroll listener has to
 * ignore the scroll positions these gestures set.
 */
export function useZoomGestures<A>(
  scrollRef: RefObject<HTMLDivElement | null>,
  contentRef: RefObject<HTMLDivElement | null>,
  isProgrammaticScrollRef: RefObject<boolean>,
  anchoring: ZoomAnchoring<A>,
  sizerRef: RefObject<HTMLDivElement | null>,
): { marquee: MarqueeRect | null } {
  const zoom = useViewerStore((s) => s.zoom);
  const setZoom = useViewerStore((s) => s.setZoom);
  const store = useViewerStoreApi();
  const horizontal = useViewerStore((s) => s.scrollMode === 'horizontal');
  const horizontalRef = useLatest(horizontal);

  const zoomRef = useRef(zoom);
  // Synced in a layout effect rather than during render: the gesture handlers read this to seed
  // a pinch, and a layout effect commits before the browser can dispatch the next pointer event.
  useLayoutEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  const gesture = useRef<Gesture | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingAnchor = useRef<{ ratio: number; at: A; cx: number; cy: number; from?: number | undefined } | null>(null);
  const tapAnchor = useRef<{ x: number; y: number; t: number } | null>(null);
  const animation = useRef<Animation | null>(null);
  const anchoringRef = useLatest(anchoring);

  // While a gesture or animation is showing, the content gets its own compositor layer, and a sizer
  // holds the scroll range open: a scaled-down preview shrinks it and the browser would clamp the scroll.
  const setZooming = useCallback(
    (active: boolean) => {
      const content = contentRef.current;
      if (content) content.style.willChange = active ? 'transform' : '';
      const sizer = sizerRef.current;
      const el = scrollRef.current;
      if (!sizer || !el) return;
      sizer.style.width = active ? `${el.scrollWidth}px` : '0px';
      sizer.style.height = active ? `${el.scrollHeight}px` : '0px';
    },
    [contentRef, sizerRef, scrollRef],
  );

  const playSettle = useCallback(
    (content: HTMLDivElement, fromTransform: string) => {
      const anim = content.animate([{ transform: fromTransform }, { transform: 'none' }], SPRING);
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
    },
    [setZooming],
  );

  const cancelSettle = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
  }, []);

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
    [contentRef, horizontalRef, setZooming],
  );

  const applyLiveScale = useCallback(() => {
    const content = contentRef.current;
    const el = scrollRef.current;
    const g = gesture.current;
    if (!content || !el || !g) return;
    const { tx, ty } = previewTranslate(g, {
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      clientWidth: el.clientWidth,
      clientHeight: el.clientHeight,
      contentWidth: content.offsetWidth,
      contentHeight: content.offsetHeight,
    });
    g.tx = tx;
    g.ty = ty;
    content.style.transformOrigin = `${g.originX}px ${g.originY}px`;
    content.style.transform = `translate(${tx}px, ${ty}px) scale(${g.factor})`;
  }, [contentRef, scrollRef]);

  const scaleTo = useCallback(
    (raw: number) => {
      const g = gesture.current;
      if (!g) return;
      g.raw = clampRaw(raw);
      g.factor = rubber(g.raw) / g.base;
      applyLiveScale();
    },
    [applyLiveScale],
  );

  const zoomTo = useCallback(
    (base: number, next: number, at: Point, cx: number, cy: number, from?: number) => {
      pendingAnchor.current = { ratio: next / base, at: anchoringRef.current.capture(at.x, at.y), cx, cy, from };
      isProgrammaticScrollRef.current = true;
      setZoom(next);
    },
    [anchoringRef, isProgrammaticScrollRef, setZoom],
  );

  const commitGesture = useCallback(() => {
    cancelSettle();
    const g = gesture.current;
    gesture.current = null;
    const content = contentRef.current;
    if (!g) return;
    const next = clampZoom(g.raw);
    const from = settleFrom(g.base * g.factor, next);
    if (sameZoom(next, g.base)) {
      if (content) {
        const stretched = content.style.transform;
        content.style.transform = '';
        if (from !== undefined && !reducedMotion()) {
          playSettle(content, stretched);
        } else {
          content.style.transformOrigin = '';
          setZooming(false);
        }
      }
      return;
    }
    zoomTo(
      g.base,
      next,
      { x: g.originX, y: g.originY },
      g.originX - (scrollRef.current?.scrollLeft ?? g.scrollX) + g.tx,
      g.originY - (scrollRef.current?.scrollTop ?? g.scrollY) + g.ty,
      from,
    );
  }, [cancelSettle, contentRef, scrollRef, setZooming, playSettle, zoomTo]);

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
    playSettle(content, `scale(${shown * anchor.from})`);
  }, [zoom, contentRef, scrollRef, anchoringRef, setZooming, playSettle]);

  // Zooms that don't come from a gesture (toolbar, keys, fit modes, the API) anchor on the middle of the view.
  useEffect(() => {
    let fitChosenAt = -Infinity;
    return store.subscribe((next, prev) => {
      if (next.fitMode !== prev.fitMode && next.fitMode !== 'custom') fitChosenAt = performance.now();
      if (next.zoom === prev.zoom || next.document !== prev.document) return;
      if (pendingAnchor.current || gesture.current) return;
      const el = scrollRef.current;
      if (!el || !contentRef.current || prev.zoom <= 0) return;
      const tap = tapAnchor.current && performance.now() - tapAnchor.current.t < 1000 ? tapAnchor.current : null;
      tapAnchor.current = null;
      const cx = tap ? tap.x : el.clientWidth / 2;
      const cy = tap ? tap.y : el.scrollTop <= 0 ? 0 : el.clientHeight / 2;
      const ratio = next.zoom / prev.zoom;
      const animate = next.fitMode === 'custom' || !!tap || performance.now() - fitChosenAt < FIT_ANIMATE_MS;
      pendingAnchor.current = {
        ratio,
        at: anchoringRef.current.capture(el.scrollLeft + cx, el.scrollTop + cy),
        cx,
        cy,
        ...(animate ? { from: 1 / ratio } : {}),
      };
    });
  }, [store, scrollRef, contentRef, anchoringRef]);

  const core: GestureCore = {
    gesture,
    settleTimer,
    tapAnchor,
    zoomRef,
    cancelSettle,
    beginGesture,
    applyLiveScale,
    scaleTo,
    commitGesture,
    zoomTo,
  };
  useWheelPinch(scrollRef, contentRef, core);
  useTouchPinch(scrollRef, contentRef, core);
  return useMarqueeZoom(scrollRef, core);
}
