/* ============================================================
 * ViewerContainer - scrollable container with virtualization
 * ============================================================ */

import {
  useRef,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from '../../hooks/useDocViewer';
import { PageRenderer } from './PageRenderer';
import { EmptyState, LoadingState, ErrorState } from '../States';

const PAGE_VERTICAL_GAP = 48;
const PAGE_SPREAD_GAP = 16;

// Mirror viewportSlice's clamp so the gesture focal-point math matches setZoom.
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const clampZoom = (z: number) => Math.max(MIN_ZOOM, Math.min(z, MAX_ZOOM));

export function ViewerContainer() {
  const document = useViewerStore((s) => s.document);
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);
  const zoom = useViewerStore((s) => s.zoom);
  const rotation = useViewerStore((s) => s.rotation);
  const scrollMode = useViewerStore((s) => s.scrollMode);
  const spreadMode = useViewerStore((s) => s.spreadMode);
  const currentPage = useViewerStore((s) => s.currentPage);
  const setCurrentPage = useViewerStore((s) => s.setCurrentPage);
  const setVisiblePages = useViewerStore((s) => s.setVisiblePages);
  const setZoom = useViewerStore((s) => s.setZoom);
  const fitMode = useViewerStore((s) => s.fitMode);
  const applyFitZoom = useViewerStore((s) => s._applyFitZoom);
  const cursorMode = useViewerStore((s) => s.cursorMode);
  const setCursorMode = useViewerStore((s) => s.setCursorMode);

  const scrollRef = useRef<HTMLDivElement>(null);
  // The virtualized, sized content layer. A zoom gesture scales this with a
  // cheap CSS transform for instant feedback, deferring the (expensive)
  // re-rasterize until the gesture settles.
  const contentRef = useRef<HTMLDivElement>(null);
  // Rubber-band rect (content coords) while dragging a marquee zoom.
  const [marquee, setMarquee] = useState<{ left: number; top: number; w: number; h: number } | null>(null);
  const isProgrammaticScroll = useRef(false);
  // Mirror the latest zoom so the imperative wheel listener reads it fresh.
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // An in-progress wheel/pinch zoom. `factor` is the live multiplier applied on
  // top of `base` (the committed zoom when the gesture began); `origin` is the
  // focal point in content coordinates and `cursor` its offset in the viewport.
  const gesture = useRef<{
    base: number;
    factor: number;
    originX: number;
    originY: number;
    cursorX: number;
    cursorY: number;
  } | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Carries the focal anchor from commit to the layout effect that re-applies
  // it once the page boxes have re-measured at the committed zoom.
  const pendingAnchor = useRef<{ ratio: number; x: number; y: number; cx: number; cy: number } | null>(null);

  // Paint the live gesture scale (no React render, no rasterization).
  const applyLiveScale = useCallback(() => {
    const content = contentRef.current;
    const g = gesture.current;
    if (!content || !g) return;
    content.style.transformOrigin = `${g.originX}px ${g.originY}px`;
    content.style.transform = `scale(${g.factor})`;
  }, []);

  // End the gesture: commit the real zoom (one rasterize) and hand the focal
  // anchor to the layout effect so the swap from transform to real layout is
  // seamless.
  const commitGesture = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    const g = gesture.current;
    gesture.current = null;
    const content = contentRef.current;
    if (!g) return;
    const next = clampZoom(g.base * g.factor);
    if (Math.abs(next - g.base) < 1e-4) {
      // No real change - just drop the (near-identity) transform.
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
    isProgrammaticScroll.current = true;
    setZoom(next);
  }, [setZoom]);

  // Once the committed zoom has re-laid out the pages, drop the transform and
  // restore the focal point - both in the same paint, so there's no flash.
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
  }, [zoom]);

  const isHorizontal = scrollMode === 'horizontal';
  const pageCount = document?.pages.length ?? 0;

  // Group page indices into rows. Each row is one page (single-page layout) or
  // a facing pair (spread). Spreads only apply to vertical scrolling; 'odd'
  // keeps the first page on its own (cover), 'even' pairs from the start.
  const rows = useMemo<number[][]>(() => {
    if (pageCount === 0) return [];
    if (isHorizontal || spreadMode === 'none') {
      return Array.from({ length: pageCount }, (_, i) => [i]);
    }
    const out: number[][] = [];
    let i = 0;
    if (spreadMode === 'odd') {
      out.push([0]);
      i = 1;
    }
    for (; i < pageCount; i += 2) {
      out.push(i + 1 < pageCount ? [i, i + 1] : [i]);
    }
    return out;
  }, [pageCount, isHorizontal, spreadMode]);

  // pageIndex -> row index, for mapping navigation to the virtualized rows.
  const pageToRow = useMemo<number[]>(() => {
    const map: number[] = [];
    rows.forEach((row, r) => row.forEach((p) => { map[p] = r; }));
    return map;
  }, [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (rowIndex) => {
      const gap = isHorizontal ? 0 : PAGE_VERTICAL_GAP;
      const row = document ? rows[rowIndex] : undefined;
      if (!row) return 400 + gap;
      const isSideways = rotation === 90 || rotation === 270;
      let main = 0;
      for (const p of row) {
        const page = document!.pages[p];
        if (!page) continue;
        const m = (isSideways ? page.width : page.height) * zoom;
        if (m > main) main = m; // a row is as tall as its tallest page
      }
      return (main || 400) + gap;
    },
    overscan: 2,
    horizontal: isHorizontal,
  });

  useEffect(() => {
    if (currentPage < 0 || currentPage >= pageCount) return;
    const targetRow = pageToRow[currentPage] ?? 0;
    const virtualItems = virtualizer.getVirtualItems();
    const firstVisible = virtualItems.length > 0 ? virtualItems[0].index : -1;
    const lastVisible = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;
    if (firstVisible < 0 || targetRow < firstVisible || targetRow > lastVisible) {
      isProgrammaticScroll.current = true;
      virtualizer.scrollToIndex(targetRow, { align: 'start' });
    }
  }, [currentPage, pageCount, virtualizer, pageToRow]);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl || pageCount === 0) return;

    let ticking = false;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (isProgrammaticScroll.current) {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => {
          isProgrammaticScroll.current = false;
        }, 150);
        return;
      }
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const offset = isHorizontal ? scrollEl.scrollLeft : scrollEl.scrollTop;
        const items = virtualizer.getVirtualItems();
        let topRow = items.length > 0 ? items[0].index : 0;
        for (const it of items) {
          if (it.start <= offset + 1) topRow = it.index;
          else break;
        }
        // Report the first page of the row at the top of the viewport.
        setCurrentPage(rows[topRow]?.[0] ?? 0);
        ticking = false;
      });
    };

    scrollEl.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [virtualizer, pageCount, setCurrentPage, isHorizontal, rows]);

  // Ctrl/Cmd + wheel zoom, anchored at the cursor. On macOS Chrome a trackpad
  // pinch is delivered as a wheel event with ctrlKey set, so this covers pinch
  // too. Listener is non-passive so we can preventDefault the browser page zoom.
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
      // Begin a gesture on the first event, anchored at the cursor. A burst of
      // events within the settle window accumulates into this one gesture.
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
    return () => el.removeEventListener('wheel', onWheel);
  }, [applyLiveScale, commitGesture]);

  // Two-finger touch pinch zoom, anchored at the pinch midpoint. (Trackpad
  // pinch is already handled as ctrl+wheel above; this is for touchscreens.)
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
        // Drive the pinch through the shared gesture: scale live, rasterize once
        // on lift.
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
  }, [applyLiveScale, commitGesture]);

  // Marquee zoom: while in 'marquee' cursor mode, drag a box to zoom into it.
  useEffect(() => {
    if (cursorMode !== 'marquee') {
      setMarquee(null);
      return;
    }
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
        /* pointer already released / unsupported */
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
        /* already released */
      }
      setCursorMode('select'); // one-shot: return to normal after zooming
      if (w < 12 || h < 12) return; // ignore taps / tiny boxes

      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const cur = zoomRef.current;
      const next = Math.max(0.1, Math.min(cur * Math.min(cw / w, ch / h), 5));
      const ratio = next / cur;
      const cx = left + w / 2;
      const cy = top + h / 2;
      isProgrammaticScroll.current = true;
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
  }, [cursorMode, setZoom, setCursorMode]);

  // Publish the page indices currently rendered (the virtualizer re-renders on
  // scroll, so this stays current). setVisiblePages no-ops when unchanged.
  useEffect(() => {
    const pages = virtualizer
      .getVirtualItems()
      .flatMap((it) => rows[it.index] ?? []);
    setVisiblePages(pages);
  });

  // Fit modes: derive a zoom from the container size + first page dims and keep
  // it in sync as the container resizes. Based on the first page so scrolling
  // between differently-sized pages doesn't jump the zoom.
  useEffect(() => {
    if (fitMode === 'custom') return;
    const el = scrollRef.current;
    const page = document?.pages[0];
    if (!el || !page) return;

    const recompute = () => {
      const isSideways = rotation === 90 || rotation === 270;
      const pw = isSideways ? page.height : page.width;
      const ph = isSideways ? page.width : page.height;
      // A vertical spread lays two pages across the width, so fitting must
      // account for both pages plus the gap between them.
      const cols = spreadMode !== 'none' && !isHorizontal ? 2 : 1;
      const rowWidth = cols * pw;
      const availW = el.clientWidth - PAGE_VERTICAL_GAP - (cols - 1) * PAGE_SPREAD_GAP;
      const availH = el.clientHeight - PAGE_VERTICAL_GAP;
      if (availW <= 0 || availH <= 0 || rowWidth <= 0 || ph <= 0) return;
      let z = 1;
      if (fitMode === 'page-width') z = availW / rowWidth;
      else if (fitMode === 'page-fit') z = Math.min(availW / rowWidth, availH / ph);
      else if (fitMode === 'actual-size') z = 1;
      if (Number.isFinite(z) && z > 0) applyFitZoom(z);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitMode, document, rotation, spreadMode, isHorizontal, applyFitZoom]);

  const showState =
    loadState === 'idle' ||
    loadState === 'loading' ||
    loadState === 'error' ||
    !document;

  return (
    <div
      className="dv-viewer-container"
      ref={scrollRef}
      tabIndex={0}
      role="region"
      aria-label="Document content"
      data-marquee={cursorMode === 'marquee' || undefined}
    >
      {showState ? (
        <>
          {loadState === 'idle' && <EmptyState />}
          {loadState === 'loading' && <LoadingState />}
          {loadState === 'error' && (
            <ErrorState {...(loadError?.message ? { message: loadError.message } : {})} />
          )}
        </>
      ) : (
        <div
          ref={contentRef}
          style={{
            height: isHorizontal ? '100%' : `${virtualizer.getTotalSize()}px`,
            width: isHorizontal ? `${virtualizer.getTotalSize()}px` : '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const row = rows[virtualItem.index] ?? [];
            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  ...(isHorizontal
                    ? { height: '100%', transform: `translateX(${virtualItem.start}px)` }
                    : { width: '100%', transform: `translateY(${virtualItem.start}px)` }),
                }}
              >
                {row.length > 1 ? (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'flex-start',
                      gap: `${PAGE_SPREAD_GAP}px`,
                    }}
                  >
                    {row.map((p) => (
                      <PageRenderer key={p} pageIndex={p} />
                    ))}
                  </div>
                ) : (
                  <PageRenderer pageIndex={row[0]!} />
                )}
              </div>
            );
          })}

          {marquee && (
            <div
              className="dv-marquee-rect"
              style={{
                position: 'absolute',
                left: `${marquee.left}px`,
                top: `${marquee.top}px`,
                width: `${marquee.w}px`,
                height: `${marquee.h}px`,
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
