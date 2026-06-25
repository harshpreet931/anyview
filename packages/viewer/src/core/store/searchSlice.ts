/* ============================================================
 * Search Slice
 * Search query state, results, and match navigation.
 * ============================================================ */

import type { StateCreator } from 'zustand';
import type { SearchMatch, SearchQuery, SearchResult } from '../types';
import type { DocumentSlice } from './documentSlice';
import type { NavigationSlice } from './navigationSlice';

export type SearchState = 'idle' | 'searching' | 'done' | 'error';

export interface SearchSlice {
  searchQuery: SearchQuery | null;
  searchState: SearchState;
  searchResult: SearchResult | null;
  currentMatchIndex: number;
  /**
   * Bumped every time the active match changes (including re-selecting the
   * same index). UI layers watch this to re-scroll the current match into
   * view even when the target page is already visible.
   */
  matchNonce: number;

  search: (query: SearchQuery) => void;
  clearSearch: () => void;
  nextMatch: () => void;
  prevMatch: () => void;
  goToMatch: (index: number) => void;
  /**
   * Supply matches computed outside the adapter (e.g. DOM-based search for
   * reflowable formats that have no adapter `search()`), keyed to the active
   * query. The matches are the full set aggregated across every rendered page,
   * so the current index is preserved (clamped) rather than reset - a fresh
   * query already resets it via `search()`.
   */
  applySearchMatches: (matches: SearchMatch[]) => void;
  _setSearchResult: (result: SearchResult) => void;
  _setSearchState: (state: SearchState) => void;
  _searchController: AbortController | null;
}

export const createSearchSlice: StateCreator<
  SearchSlice & DocumentSlice & NavigationSlice,
  [],
  [],
  SearchSlice
> = (set, get) => {
  /** Move the viewport to the page holding the active match. */
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

    // Adapter search only drives canvas-rendered formats (PDF), where matches
    // carry real pixel coordinates for the positioned highlight layer. Every
    // reflowable format is searched against its real DOM text by the
    // useDomSearch hook, which reports matches via applySearchMatches().
    const useAdapterSearch =
      !!adapter?.search && (format === 'pdf' || format === 'image');
    if (!useAdapterSearch) return;

    adapter!
      .search!(query, controller.signal)
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
