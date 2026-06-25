/* ============================================================
 * TextLayer - invisible, selectable text positioned over a
 * rasterized page (PDF). Enables real text selection, copy,
 * and accessible reading order on top of the canvas bitmap.
 * ============================================================ */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { TextLayerItem } from '../../core/types';
import { useViewerStore } from '../../hooks/useDocViewer';

export interface TextLayerProps {
  pageIndex: number;
  /** Rendered page width in CSS px (page.width * zoom). */
  width: number;
  /** Rendered page height in CSS px. */
  height: number;
}

export function TextLayer({ pageIndex, width, height }: TextLayerProps) {
  const adapter = useViewerStore((s) => s.adapter);
  const [items, setItems] = useState<readonly TextLayerItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Text geometry is zoom-independent (normalized 0–1), so fetch once per
  // page/adapter and only re-scale via width/height afterwards.
  useEffect(() => {
    if (!adapter?.getTextLayer) {
      setItems([]);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    adapter
      .getTextLayer(pageIndex, controller.signal)
      .then((layer) => {
        if (!cancelled) setItems(layer.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [adapter, pageIndex]);

  // Match each span's rendered width to the source run width (pdf.js
  // technique) so selection rectangles line up with the bitmap glyphs.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const spans = container.querySelectorAll<HTMLElement>('span[data-tw]');
    spans.forEach((span) => {
      span.style.transform = '';
      const target = parseFloat(span.dataset.tw ?? '0');
      const natural = span.offsetWidth;
      if (target > 0 && natural > 0) {
        span.style.transform = `scaleX(${target / natural})`;
      }
    });
  }, [items, width, height]);

  if (items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="dv-text-layer"
      style={{ width, height }}
      aria-hidden="false"
    >
      {items.map((item, i) =>
        item.str ? (
          <span
            key={i}
            data-tw={item.width * width}
            style={{
              left: `${item.x * width}px`,
              top: `${item.y * height}px`,
              fontSize: `${Math.max(item.height * height, 1)}px`,
            }}
          >
            {item.str}
          </span>
        ) : null,
      )}
    </div>
  );
}
