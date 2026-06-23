/* ============================================================
 * SearchHighlightLayer — positioned highlight boxes for search
 * matches on a single page. The active match is styled distinctly
 * and scrolled into view whenever the selection changes.
 * ============================================================ */

import { useEffect, useRef } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';

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

  // Bring the active match into view when it changes (matchNonce bumps even
  // if the index repeats). The page is already scrolled into range by the
  // search slice, so this only does the fine, within-page adjustment.
  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center', inline: 'center' });
  }, [matchNonce, currentMatchIndex, width, height]);

  if (!searchResult || searchResult.matches.length === 0) return null;

  // Keep global indices so we can flag the active match across pages.
  const pageMatches: Array<{ globalIndex: number; match: (typeof searchResult.matches)[number] }> = [];
  searchResult.matches.forEach((match, globalIndex) => {
    if (match.pageIndex === pageIndex) pageMatches.push({ globalIndex, match });
  });

  if (pageMatches.length === 0) return null;

  return (
    <div className="dv-search-layer" style={{ width, height }} aria-hidden="true">
      {pageMatches.map(({ globalIndex, match }) => {
        const isCurrent = globalIndex === currentMatchIndex;
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
              left: `${match.x * width}px`,
              top: `${match.y * height}px`,
              width: `${Math.max(match.width * width, 2)}px`,
              height: `${Math.max(match.height * height, 2)}px`,
            }}
          />
        );
      })}
    </div>
  );
}
