import { useEffect, useRef, useState } from 'react';
import type { RenderContext } from '../../core/types';
import { displayedPageSize } from '../../core/rotation';
import { makeCacheKey, estimateBitmapByteSize } from '../../core/cache/page-cache';
import type { CachedPage } from '../../core/cache/page-cache';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useDomSearch } from '../../hooks/useDomSearch';
import { TextLayer } from './TextLayer';
import { SearchHighlightLayer } from './SearchHighlightLayer';
import { AnnotationLayer } from './AnnotationLayer';

export interface PageRendererProps {
  pageIndex: number;
}

export function PageRenderer({ pageIndex }: PageRendererProps) {
  const adapter = useViewerStore((s) => s.adapter);
  const document = useViewerStore((s) => s.document);
  const zoom = useViewerStore((s) => s.zoom);
  const rotation = useViewerStore((s) => s.rotation);
  const pageCache = useViewerStore((s) => s.pageCache);

  const targetRef = useRef<HTMLCanvasElement | HTMLDivElement | null>(null);
  const reflowRef = useRef<HTMLElement | null>(null);
  const [contentKey, setContentKey] = useState(0);

  const format = document?.format;
  const isCanvasFormat = format === 'pdf' || format === 'image';
  const features = adapter?.manifest.features;
  // Flowing formats are laid out once at 100% and scaled with a transform, so a zoom never rebuilds,
  // rewraps or even re-lays them out; the page box takes the measured height times the zoom.
  const renderScale = isCanvasFormat ? zoom : 1;
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = reflowRef.current;
    if (isCanvasFormat || !el) return;
    const ro = new ResizeObserver(() => setNaturalHeight(el.offsetHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isCanvasFormat]);

  useDomSearch(reflowRef, !isCanvasFormat, contentKey, pageIndex);

  useEffect(() => {
    if (!adapter || !document || !targetRef.current) return;

    const controller = new AbortController();

    const page = document.pages[pageIndex];
    if (!page) return;

    const cacheKey = makeCacheKey(
      document.format,
      pageIndex,
      renderScale,
      rotation,
      window.devicePixelRatio,
    );
    const cached = pageCache.get(cacheKey);

    if (cached && targetRef.current instanceof HTMLCanvasElement) {
      paintCached(cached, targetRef.current);
      return;
    }

    const ctx: RenderContext = {
      page,
      target: targetRef.current,
      scale: renderScale,
      rotation,
      devicePixelRatio: window.devicePixelRatio,
      signal: controller.signal,
    };

    // The worker renders in arrival order, so pages outside the view queue up behind the visible ones.
    // Visibility is read a frame later, once the virtual rows have moved to their new positions.
    const target = targetRef.current;
    const start = () =>
      new Promise<void>((resolve, reject) => {
        if (!isCanvasFormat) return resolve();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const frame = requestAnimationFrame(() => {
          if (inView(target)) resolve();
          else timer = setTimeout(resolve, OFFSCREEN_DELAY_MS);
        });
        controller.signal.addEventListener('abort', () => {
          cancelAnimationFrame(frame);
          clearTimeout(timer);
          reject(new DOMException('Render cancelled', 'AbortError'));
        });
      });

    start()
      .then(() => adapter.renderPage(ctx))
      .then((result) => {
        if (controller.signal.aborted) {
          result.bitmap?.close();
          return;
        }

        if (targetRef.current instanceof HTMLCanvasElement) {
          const canvas = targetRef.current;
          (result.bitmap ? Promise.resolve(result.bitmap) : createImageBitmap(canvas))
            .then((bitmap) => {
              if (controller.signal.aborted) {
                bitmap.close();
                return;
              }
              const cachedPage: CachedPage = {
                key: cacheKey,
                bitmap,
                byteSize: estimateBitmapByteSize(
                  result.width,
                  result.height,
                  window.devicePixelRatio,
                ),
                width: result.width,
                height: result.height,
                lastAccessed: Date.now(),
              };
              pageCache.set(cacheKey, cachedPage);
            })
            .catch(() => {});
        } else {
          setContentKey((k) => k + 1);
        }
      })
      .catch(() => {});

    return () => controller.abort();
  }, [adapter, document, pageIndex, renderScale, rotation, pageCache, isCanvasFormat]);

  if (!document || !adapter) return null;

  const page = document.pages[pageIndex];
  if (!page) return null;

  const { width: scaledWidth, height: scaledHeight } = displayedPageSize(
    page.width,
    page.height,
    page.rotation,
    rotation,
    zoom,
  );

  const showTextLayer = format === 'pdf' && !!features?.textSelection;

  return (
    <div
      className="dv-page"
      style={{
        width: `${scaledWidth}px`,
        height: isCanvasFormat
          ? `${scaledHeight}px`
          : naturalHeight != null
            ? `${naturalHeight * zoom}px`
            : 'auto',
        minHeight: isCanvasFormat ? undefined : `${scaledHeight}px`,
      }}
      data-page-index={pageIndex}
      data-format={format}
    >
      {isCanvasFormat ? (
        <canvas
          ref={(el) => {
            targetRef.current = el;
          }}
          {...(format === 'image' ? { role: 'img', 'aria-label': document.meta.name } : {})}
        />
      ) : (
        <div
          ref={(el) => {
            targetRef.current = el;
            reflowRef.current = el;
          }}
          className="dv-reflow-target"
          style={{ width: `${scaledWidth / zoom}px`, transform: `scale(${zoom})`, transformOrigin: '0 0' }}
        />
      )}

      {showTextLayer && (
        <TextLayer pageIndex={pageIndex} width={scaledWidth} height={scaledHeight} />
      )}

      {isCanvasFormat && (
        <SearchHighlightLayer
          pageIndex={pageIndex}
          width={scaledWidth}
          height={scaledHeight}
        />
      )}

      {features?.annotations && (
        <AnnotationLayer
          pageIndex={pageIndex}
          width={scaledWidth}
          height={scaledHeight}
        />
      )}
    </div>
  );
}

const OFFSCREEN_DELAY_MS = 120;

function inView(el: Element): boolean {
  const view = el.closest('.dv-viewer-container');
  if (!view) return true;
  const r = el.getBoundingClientRect();
  const v = view.getBoundingClientRect();
  return r.bottom > v.top && r.top < v.bottom && r.right > v.left && r.left < v.right;
}

function paintCached(cached: CachedPage, target: HTMLCanvasElement): void {
  if (cached.bitmap instanceof ImageBitmap) {
    const bitmap = cached.bitmap;
    target.width = bitmap.width;
    target.height = bitmap.height;

    const c2d = target.getContext('2d');
    if (c2d) {
      c2d.drawImage(bitmap, 0, 0);
    }
  }
}
