/* ============================================================
 * useSearch — search state and controls
 * ============================================================ */

import { useViewerStore } from './useDocViewer';

export function useSearch() {
  const searchQuery = useViewerStore((s) => s.searchQuery);
  const searchState = useViewerStore((s) => s.searchState);
  const searchResult = useViewerStore((s) => s.searchResult);
  const currentMatchIndex = useViewerStore((s) => s.currentMatchIndex);
  const search = useViewerStore((s) => s.search);
  const clearSearch = useViewerStore((s) => s.clearSearch);
  const nextMatch = useViewerStore((s) => s.nextMatch);
  const prevMatch = useViewerStore((s) => s.prevMatch);
  const goToMatch = useViewerStore((s) => s.goToMatch);

  return {
    searchQuery,
    searchState,
    searchResult,
    currentMatchIndex,
    matchCount: searchResult?.matches.length ?? 0,
    search,
    clearSearch,
    nextMatch,
    prevMatch,
    goToMatch,
  };
}
