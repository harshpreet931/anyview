import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { displayedPageSize } from '../../core/rotation';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useLatest } from '../../hooks/useLatest';
import { useStrings } from '../../i18n/I18nProvider';
import { formatString } from '../../i18n/strings';
import type { Adapter, FormatId, PageRef } from '../../core/types';
import { useSidebarList } from './useSidebarList';

export const LIVE_PREVIEW_MAX_BYTES = 1_000_000;

// From viewer.css: the item's inline padding (12 + 12) and the thumbnail's (6 + 6) take this much
// of the panel width; the thumbnail's block padding (6 + 4) and its one-line label (6 + 18) add this
// much height. Item sizes are exact, so the list needs no DOM measuring.
const THUMB_INSET = 36;
const THUMB_CHROME = 34;
const THUMB_GAP = 4;
// Re-rendering on every pixel of a resize is wasted work; thumbnails re-render per 32 px step.
const RENDER_WIDTH_STEP = 32;
const SCROLL_SETTLE_MS = 100;

const pageSize = (page: PageRef) => displayedPageSize(page.width, page.height, page.rotation, 0, 1);

export function ThumbnailList({
  pages,
  format,
  adapter,
  live,
  scrollElement,
  resizing,
  onThumbnailClick,
}: {
  pages: readonly PageRef[];
  format: FormatId;
  adapter: Adapter | null;
  live: boolean;
  scrollElement: HTMLElement;
  resizing: boolean;
  onThumbnailClick: (index: number) => void;
}) {
  const currentPage = useViewerStore((s) => s.currentPage);
  const [panelWidth, setPanelWidth] = useState(() => scrollElement.clientWidth);
  const thumbWidth = Math.max(0, panelWidth - THUMB_INSET);

  const widthStep = Math.ceil(thumbWidth / RENDER_WIDTH_STEP) * RENDER_WIDTH_STEP;
  const [renderWidth, setRenderWidth] = useState(widthStep);
  if (!resizing && renderWidth !== widthStep) setRenderWidth(widthStep);

  useEffect(() => {
    const ro = new ResizeObserver(() => setPanelWidth(scrollElement.clientWidth));
    ro.observe(scrollElement);
    return () => ro.disconnect();
  }, [scrollElement]);

  const { virtualizer, active, moveFocus, listRef, listProps } = useSidebarList({
    count: pages.length,
    scrollElement,
    estimateSize: (i) => {
      const size = pageSize(pages[i]!);
      return (thumbWidth * size.height) / size.width + THUMB_CHROME;
    },
    paddingEnd: 16,
    gap: THUMB_GAP,
    restingIndex: currentPage,
  });

  const widthRef = useRef(thumbWidth);
  useLayoutEffect(() => {
    if (widthRef.current === thumbWidth) return;
    widthRef.current = thumbWidth;
    // Every thumbnail changes height with the width; keep the one at the top of the panel in place.
    const offset = scrollElement.scrollTop;
    const anchor = virtualizer.getVirtualItemForOffset(offset);
    virtualizer.measure();
    virtualizer.getVirtualItems();
    const item = anchor && virtualizer.measurementsCache[anchor.index];
    if (!anchor || !item) return;
    if (listRef.current) listRef.current.style.height = `${virtualizer.getTotalSize()}px`;
    virtualizer.scrollToOffset(item.start + ((offset - anchor.start) / anchor.size) * item.size);
  }, [thumbWidth, virtualizer, listRef, scrollElement]);

  const clickedRef = useRef<number | null>(null);
  const shownRef = useRef(false);
  useLayoutEffect(() => {
    const clicked = clickedRef.current;
    clickedRef.current = null;
    const item = virtualizer.measurementsCache[currentPage];
    if (clicked === currentPage || !item) return;
    // The virtualizer's own 'auto' reads a scroll offset that lags a scroll it has just made, so
    // visibility is checked against the panel itself.
    const top = scrollElement.scrollTop;
    const shown = shownRef.current;
    shownRef.current = true;
    if (shown && item.start >= top && item.end <= top + scrollElement.clientHeight) return;
    virtualizer.scrollToIndex(currentPage, { align: !shown ? 'center' : item.start < top ? 'start' : 'end' });
  }, [currentPage, virtualizer, scrollElement]);
  useLayoutEffect(() => () => {
    shownRef.current = false;
  }, []);

  const select = useLatest((index: number) => {
    clickedRef.current = index;
    onThumbnailClick(index);
  });
  const onSelect = useCallback((index: number) => select.current(index), [select]);
  const isScrolling = useCallback(() => virtualizer.isScrolling, [virtualizer]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const itemSize = virtualizer.measurementsCache[active]?.size || 1;
    const perPage = Math.max(1, Math.floor((virtualizer.scrollRect?.height ?? 0) / itemSize));
    const target: Record<string, number> = {
      ArrowDown: active + 1,
      ArrowUp: active - 1,
      PageDown: active + perPage,
      PageUp: active - perPage,
      Home: 0,
      End: pages.length - 1,
    };
    const next = target[e.key];
    if (next === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    moveFocus(next);
  };

  const liveAdapter = live ? adapter : null;

  return (
    <ul className="dv-thumbnail-list" ref={listRef} {...listProps} onKeyDown={onKeyDown}>
      {virtualizer.getVirtualItems().map((item) => (
        <li
          key={item.key}
          data-index={item.index}
          aria-setsize={pages.length}
          aria-posinset={item.index + 1}
          style={{ transform: `translateY(${item.start}px)` }}
        >
          <Thumbnail
            page={pages[item.index]!}
            index={item.index}
            format={format}
            adapter={liveAdapter}
            current={currentPage === item.index}
            tabbable={active === item.index}
            thumbWidth={thumbWidth}
            renderWidth={renderWidth}
            isScrolling={isScrolling}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}

const Thumbnail = memo(function Thumbnail({
  page,
  index,
  format,
  adapter,
  current,
  tabbable,
  thumbWidth,
  renderWidth,
  isScrolling,
  onSelect,
}: {
  page: PageRef;
  index: number;
  format: FormatId;
  adapter: Adapter | null;
  current: boolean;
  tabbable: boolean;
  thumbWidth: number;
  renderWidth: number;
  isScrolling: () => boolean;
  onSelect: (index: number) => void;
}) {
  const strings = useStrings();
  const canvasFormat = format === 'pdf' || format === 'image';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const size = pageSize(page);
  const scale = canvasFormat ? renderWidth / size.width : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    return () => {
      if (!canvas) return;
      canvas.width = 0;
      canvas.height = 0;
    };
  }, []);

  useEffect(() => {
    if (!adapter?.renderPage) return;
    const target = canvasFormat ? canvasRef.current : docRef.current;
    if (!target) return;

    const controller = new AbortController();

    const render = () => {
      if (!canvasFormat) {
        target.style.width = `${page.width}px`;
        target.style.height = `${page.height}px`;
      }
      adapter
        .renderPage({
          page,
          target,
          scale,
          rotation: 0,
          devicePixelRatio: window.devicePixelRatio,
          signal: controller.signal,
        })
        .then((result) => {
          result.bitmap?.close();
          if (!canvasFormat) return;
          target.style.width = '';
          target.style.height = '';
        })
        .catch(() => {});
    };

    // A fling mounts and unmounts thumbnails within a few frames; only those still mounted render.
    const timer = isScrolling() ? setTimeout(render, SCROLL_SETTLE_MS) : undefined;
    if (timer === undefined) render();

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [adapter, page, canvasFormat, scale, isScrolling]);

  return (
    <button
      className="dv-thumbnail"
      data-current={current}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onSelect(index)}
      aria-label={formatString(strings.navigation.pageLabel, index + 1)}
      aria-current={current ? 'page' : undefined}
    >
      <div
        className="dv-thumbnail-image"
        style={{ ['--dv-thumb-ratio' as string]: `${size.width / size.height}` }}
      >
        {canvasFormat ? (
          <canvas ref={canvasRef} className="dv-thumbnail-canvas" />
        ) : (
          <div
            ref={docRef}
            className="dv-thumbnail-doc"
            aria-hidden="true"
            style={{ transform: `scale(${thumbWidth / page.width})` }}
          />
        )}
      </div>
      <div className="dv-thumbnail-label">{page.label || index + 1}</div>
    </button>
  );
});
