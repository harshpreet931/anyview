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
  _setSearchResult: (result: SearchResult) => void;
  _setSearchState: (state: SearchState) => void;
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
  const jumpToCurrentMatch = () => {
    const { searchResult, currentMatchIndex } = get();
    const match = searchResult?.matches[currentMatchIndex];
    if (!match) return;
    get().setCurrentPage(match.pageIndex);
    set((s) => ({ matchNonce: s.matchNonce + 1 }));
  };

  return {
  searchQuery: null,
  searchState: 'idle',
  searchResult: null,
  currentMatchIndex: 0,
  matchNonce: 0,
  _searchController: null,

  search: (query: SearchQuery) => {
    const { adapter } = get();
    const format = get().document?.format;

    get()._searchController?.abort();
    const controller = new AbortController();

    set({
      searchQuery: query,
      searchState: 'searching',
      searchResult: null,
      currentMatchIndex: 0,
      _searchController: controller,
    });

    const useAdapterSearch =
      !!adapter?.search && (format === 'pdf' || format === 'image');
    if (!useAdapterSearch) return;

    adapter!
      .search!(query, controller.signal, get().rotation)
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
    const { adapter, document, searchQuery } = get();
    const format = document?.format;
    if (!searchQuery || !adapter?.search || (format !== 'pdf' && format !== 'image')) return;
    get()._searchController?.abort();
    const controller = new AbortController();
    set({ _searchController: controller });
    adapter
      .search(searchQuery, controller.signal, get().rotation)
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
    const { searchResult, currentMatchIndex } = get();
    if (!searchResult || searchResult.matches.length === 0) return;
    const next = (currentMatchIndex + 1) % searchResult.matches.length;
    set({ currentMatchIndex: next });
    jumpToCurrentMatch();
  },

  prevMatch: () => {
    const { searchResult, currentMatchIndex } = get();
    if (!searchResult || searchResult.matches.length === 0) return;
    const prev =
      (currentMatchIndex - 1 + searchResult.matches.length) %
      searchResult.matches.length;
    set({ currentMatchIndex: prev });
    jumpToCurrentMatch();
  },

  goToMatch: (index: number) => {
    const { searchResult } = get();
    if (!searchResult || searchResult.matches.length === 0) return;
    const clamped = Math.max(0, Math.min(index, searchResult.matches.length - 1));
    set({ currentMatchIndex: clamped });
    jumpToCurrentMatch();
  },

  applySearchMatches: (matches: SearchMatch[]) => {
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
    if (matches.length > 0) {
      set((s) => ({ matchNonce: s.matchNonce + 1 }));
    }
  },

  _setSearchResult: (result: SearchResult) =>
    set({ searchResult: result, searchState: 'done', currentMatchIndex: 0 }),

  _setSearchState: (state: SearchState) => set({ searchState: state }),
  };
};
