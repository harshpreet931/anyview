import type { StateCreator } from 'zustand';
import type { SearchMatch, SearchQuery, SearchResult } from '../types';
import type { DocumentSlice } from './documentSlice';
import type { NavigationSlice } from './navigationSlice';
import type { ViewportSlice } from './viewportSlice';

export type SearchState = 'idle' | 'searching' | 'done' | 'error';

export interface SearchSlice {
  searchQuery: SearchQuery | null;
  searchState: SearchState;
  searchResult: SearchResult | null;
  currentMatchIndex: number;
  /** Bumped every time the active match changes so UI layers can re-scroll it into view. */
  matchNonce: number;

  search: (query: SearchQuery) => void;
  clearSearch: () => void;
  nextMatch: () => void;
  prevMatch: () => void;
  goToMatch: (index: number) => void;
  /** Supply matches computed outside the adapter (e.g. DOM-based search for reflowable formats). */
  applySearchMatches: (matches: SearchMatch[]) => void;
  /** Recomputes match boxes for the current query after the page geometry changed (e.g. rotation). */
  _refreshSearchGeometry: () => void;
  _searchController: AbortController | null;
}

export const createSearchSlice: StateCreator<
  SearchSlice & DocumentSlice & NavigationSlice & ViewportSlice,
  [],
  [],
  SearchSlice
> = (set, get) => {
  const adapterSearch = () => {
    const { adapter, document } = get();
    const format = document?.format;
    if (!adapter?.search || (format !== 'pdf' && format !== 'image')) return null;
    return adapter.search.bind(adapter);
  };

  const bumpMatchNonce = () => set((s) => ({ matchNonce: s.matchNonce + 1 }));

  const jumpToCurrentMatch = () => {
    const { searchResult, currentMatchIndex } = get();
    const match = searchResult?.matches[currentMatchIndex];
    if (!match) return;
    get().setCurrentPage(match.pageIndex);
    bumpMatchNonce();
  };

  const matchCount = () => get().searchResult?.matches.length ?? 0;

  return {
    searchQuery: null,
    searchState: 'idle',
    searchResult: null,
    currentMatchIndex: 0,
    matchNonce: 0,
    _searchController: null,

    search: (query) => {
      const run = adapterSearch();

      get()._searchController?.abort();
      const controller = new AbortController();

      set({
        searchQuery: query,
        searchState: 'searching',
        searchResult: null,
        currentMatchIndex: 0,
        _searchController: controller,
      });

      if (!run) return;

      run(query, controller.signal, get().rotation)
        .then((result) => {
          if (controller.signal.aborted) return;
          set({
            searchResult: result,
            searchState: 'done',
            currentMatchIndex: 0,
            _searchController: null,
          });
          jumpToCurrentMatch();
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          set({ searchState: 'error', _searchController: null });
        });
    },

    _refreshSearchGeometry: () => {
      const { searchQuery } = get();
      const run = adapterSearch();
      if (!searchQuery || !run) return;
      get()._searchController?.abort();
      const controller = new AbortController();
      set({ _searchController: controller });
      run(searchQuery, controller.signal, get().rotation)
        .then((result) => {
          if (controller.signal.aborted) return;
          const last = Math.max(0, result.matches.length - 1);
          set({
            searchResult: result,
            searchState: 'done',
            currentMatchIndex: Math.min(get().currentMatchIndex, last),
            _searchController: null,
          });
        })
        .catch(() => {
          if (!controller.signal.aborted) set({ _searchController: null });
        });
    },

    clearSearch: () => {
      get()._searchController?.abort();
      set({
        searchQuery: null,
        searchResult: null,
        searchState: 'idle',
        currentMatchIndex: 0,
        _searchController: null,
      });
    },

    nextMatch: () => {
      const count = matchCount();
      get().goToMatch((get().currentMatchIndex + 1) % count);
    },

    prevMatch: () => {
      const count = matchCount();
      get().goToMatch((get().currentMatchIndex - 1 + count) % count);
    },

    goToMatch: (index) => {
      const count = matchCount();
      if (count === 0) return;
      set({ currentMatchIndex: Math.max(0, Math.min(index, count - 1)) });
      jumpToCurrentMatch();
    },

    applySearchMatches: (matches) => {
      const query = get().searchQuery;
      if (!query) return;
      const clampedIndex =
        matches.length === 0
          ? 0
          : Math.min(get().currentMatchIndex, matches.length - 1);
      set({
        searchResult: { query, matches, totalMatches: matches.length },
        searchState: 'done',
        currentMatchIndex: clampedIndex,
      });
      if (matches.length > 0) bumpMatchNonce();
    },
  };
};
