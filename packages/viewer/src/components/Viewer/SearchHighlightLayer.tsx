import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { revealMatch } from '../../core/reveal-match';
import type { SearchMatch, SearchResult } from '../../core/types';

type Box = Pick<SearchMatch, 'x' | 'y' | 'width' | 'height'>;

export interface SearchHighlightLayerProps {
  pageIndex: number;
  width: number;
  height: number;
}

export function SearchHighlightLayer({
  pageIndex,
  width,
  height,
}: SearchHighlightLayerProps) {
  const searchResult = useViewerStore((s) => s.searchResult);
  const currentMatchIndex = useViewerStore((s) => s.currentMatchIndex);
  const matchNonce = useViewerStore((s) => s.matchNonce);
  const currentRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ result: SearchResult; boxes: Map<number, Box> } | null>(null);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    const pageEl = layer?.parentElement;
    if (!layer || !pageEl || !searchResult) return;
    const measure = () => {
      const boxes = measureInTextLayer(pageEl, layer, searchResult, pageIndex);
      setMeasured((prev) =>
        prev && prev.result === searchResult && sameBoxes(prev.boxes, boxes) ? prev : { result: searchResult, boxes },
      );
    };
    measure();
    const observer = new MutationObserver((records) => {
      if (records.some(touchesTextLayer)) measure();
    });
    observer.observe(pageEl, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    return () => observer.disconnect();
  }, [searchResult, pageIndex, width, height]);

  useEffect(() => {
    revealMatch(currentRef.current, matchNonce);
  }, [matchNonce, currentMatchIndex]);

  if (!searchResult || searchResult.matches.length === 0) return null;

  const pageMatches: Array<{ globalIndex: number; match: SearchMatch }> = [];
  searchResult.matches.forEach((match, globalIndex) => {
    if (match.pageIndex === pageIndex) pageMatches.push({ globalIndex, match });
  });

  if (pageMatches.length === 0) return null;

  return (
    <div ref={layerRef} className="dv-search-layer" style={{ width, height }} aria-hidden="true">
      {pageMatches.map(({ globalIndex, match }) => {
        const isCurrent = globalIndex === currentMatchIndex;
        const box = (measured?.result === searchResult && measured.boxes.get(globalIndex)) || match;
        return (
          <div
            key={globalIndex}
            ref={isCurrent ? currentRef : undefined}
            className={
              isCurrent
                ? 'dv-search-highlight dv-search-highlight-current'
                : 'dv-search-highlight'
            }
            data-match-current={isCurrent || undefined}
            style={{
              left: `${box.x * width}px`,
              top: `${box.y * height}px`,
              width: `${Math.max(box.width * width, 2)}px`,
              height: `${Math.max(box.height * height, 2)}px`,
            }}
          />
        );
      })}
    </div>
  );
}

function measureInTextLayer(
  pageEl: HTMLElement,
  layer: HTMLElement,
  result: SearchResult,
  pageIndex: number,
): Map<number, Box> {
  const boxes = new Map<number, Box>();
  const frame = layer.getBoundingClientRect();
  if (!frame.width || !frame.height) return boxes;
  result.matches.forEach((match, i) => {
    if (match.pageIndex !== pageIndex || match.runIndex == null || match.start == null || match.end == null) return;
    const text = pageEl.querySelector(`.dv-text-layer span[data-run="${match.runIndex}"]`)?.firstChild;
    if (!(text instanceof Text) || text.data.slice(match.start, match.end) !== match.text) return;
    const range = document.createRange();
    range.setStart(text, match.start);
    range.setEnd(text, match.end);
    if (typeof range.getBoundingClientRect !== 'function') return;
    const r = range.getBoundingClientRect();
    if (!r.width || !r.height) return;
    boxes.set(i, {
      x: (r.left - frame.left) / frame.width,
      y: (r.top - frame.top) / frame.height,
      width: r.width / frame.width,
      height: r.height / frame.height,
    });
  });
  return boxes;
}

function sameBoxes(a: Map<number, Box>, b: Map<number, Box>): boolean {
  if (a.size !== b.size) return false;
  for (const [i, box] of a) {
    const other = b.get(i);
    if (
      !other ||
      !near(other.x, box.x) ||
      !near(other.y, box.y) ||
      !near(other.width, box.width) ||
      !near(other.height, box.height)
    ) {
      return false;
    }
  }
  return true;
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-4;
}

function touchesTextLayer(record: MutationRecord): boolean {
  const isTextLayer = (node: Node) => node instanceof Element && node.classList.contains('dv-text-layer');
  return (
    (record.target instanceof Element && !!record.target.closest('.dv-text-layer')) ||
    Array.from(record.addedNodes).some(isTextLayer) ||
    Array.from(record.removedNodes).some(isTextLayer)
  );
}
