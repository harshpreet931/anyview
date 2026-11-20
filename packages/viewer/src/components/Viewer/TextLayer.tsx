import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { TextLayerItem } from '../../core/types';
import { useViewerStore } from '../../hooks/useDocViewer';

export interface TextLayerProps {
  pageIndex: number;
  width: number;
  height: number;
}

const SETTLE_DELAY_MS = 150;

export function TextLayer({ pageIndex, width, height }: TextLayerProps) {
  const adapter = useViewerStore((s) => s.adapter);
  const rotation = useViewerStore((s) => s.rotation);
  const [items, setItems] = useState<readonly TextLayerItem[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adapter?.getTextLayer) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    // Pages that only flash past during a fling never ask, so the worker stays free for the page that lands.
    const timer = setTimeout(() => {
      adapter
        .getTextLayer!(pageIndex, controller.signal, rotation)
        .then((layer) => {
          if (!controller.signal.aborted) setItems(layer.items);
        })
        .catch(() => {
          if (!controller.signal.aborted) setItems([]);
        });
    }, SETTLE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [adapter, pageIndex, rotation]);

  // Match each span to the source run width (pdf.js technique) so selection aligns with the bitmap glyphs.
  // Width and font size both scale with zoom, so the ratio is measured once per run and reused on every zoom.
  const ratios = useRef<{ items: readonly TextLayerItem[]; values: number[] } | null>(null);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const spans = Array.from(container.querySelectorAll<HTMLElement>('span[data-tw]'));
    if (ratios.current?.items !== items || ratios.current.values.length !== spans.length) {
      for (const span of spans) span.style.transform = '';
      const values = spans.map((span) => {
        const target = parseFloat(span.dataset.tw ?? '0') * width;
        const natural = span.offsetWidth;
        return target > 0 && natural > 0 ? target / natural : 0;
      });
      ratios.current = { items, values };
    }
    const values = ratios.current.values;
    spans.forEach((span, i) => {
      const rotate = span.dataset.angle ? `rotate(${span.dataset.angle}deg) ` : '';
      const scale = values[i] ? `scaleX(${values[i]})` : '';
      span.style.transform = `${rotate}${scale}`.trim();
    });
  }, [items, width, height]);

  const runs = useMemo(
    () =>
      items.map((item, i) =>
        item.str ? (
          <span
            key={i}
            data-run={i}
            data-tw={item.width}
            data-angle={item.angle || undefined}
            style={{
              left: `${item.x * 100}%`,
              top: `${item.y * 100}%`,
              fontSize: `calc(var(--dv-text-h) * ${item.height})`,
            }}
          >
            {item.str}
          </span>
        ) : null,
      ),
    [items],
  );

  if (items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="dv-text-layer"
      style={{ width, height, '--dv-text-h': `${height}px` } as CSSProperties}
    >
      {runs}
    </div>
  );
}
