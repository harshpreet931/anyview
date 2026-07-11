import { useEffect, useRef, useState } from 'react';
import type { RenderContext } from '../../core/types';
import { totalRotation, isSidewaysRotation, type Rotation } from '../../core/rotation';
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
  const renderTokenRef = useRef(0);
  const [contentKey, setContentKey] = useState(0);

  const format = document?.format;
  const isCanvasFormat = format === 'pdf' || format === 'image';
  const features = adapter?.manifest.features;

  useDomSearch(reflowRef, !isCanvasFormat, contentKey, pageIndex);

  useEffect(() => {
    if (!adapter || !document || !targetRef.current) return;

    const token = ++renderTokenRef.current;
    const controller = new AbortController();

    const page = document.pages[pageIndex];
    if (!page) return;

    const cacheKey = makeCacheKey(
      document.format,
      pageIndex,
      zoom,
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
      scale: zoom,
      rotation,
      devicePixelRatio: window.devicePixelRatio,
      signal: controller.signal,
    };

    adapter
      .renderPage(ctx)
      .then((result) => {
        if (token !== renderTokenRef.current || controller.signal.aborted) return;

        if (targetRef.current instanceof HTMLCanvasElement) {
          const canvas = targetRef.current;
          createImageBitmap(canvas)
            .then((bitmap) => {
              if (token !== renderTokenRef.current || controller.signal.aborted) {
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
  }, [adapter, document, pageIndex, zoom, rotation, pageCache]);

  if (!document || !adapter) return null;

  const page = document.pages[pageIndex];
  if (!page) return null;

  const isSideways = isSidewaysRotation(
    totalRotation(page.rotation as Rotation, rotation as Rotation),
  );
  const scaledWidth = (isSideways ? page.height : page.width) * zoom;
  const scaledHeight = (isSideways ? page.width : page.height) * zoom;

  const showTextLayer = isCanvasFormat && format === 'pdf' && !!features?.textSelection;

  return (
    <div
      className="dv-page"
      style={{
        width: `${scaledWidth}px`,
        height: isCanvasFormat ? `${scaledHeight}px` : 'auto',
        minHeight: isCanvasFormat ? undefined : `${scaledHeight}px`,
      }}
      data-page-index={pageIndex}
      data-format={format}
    >
      {isCanvasFormat ? (
        <canvas ref={targetRef as React.RefObject<HTMLCanvasElement>} />
      ) : (
        <div
          ref={(el) => {
            targetRef.current = el;
            reflowRef.current = el;
          }}
          className="dv-reflow-target"
          style={{ width: '100%' }}
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

function paintCached(
  cached: CachedPage,
  target: HTMLCanvasElement | HTMLDivElement,
): void {
  if (target instanceof HTMLCanvasElement && cached.bitmap instanceof ImageBitmap) {
    const bitmap = cached.bitmap;
    target.width = bitmap.width;
    target.height = bitmap.height;
    target.style.width = `${cached.width}px`;
    target.style.height = `${cached.height}px`;

    const c2d = target.getContext('2d');
    if (c2d) {
      c2d.drawImage(bitmap, 0, 0);
    }
  }
}
