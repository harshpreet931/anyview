import type { StateCreator } from 'zustand';
import type { DocumentSlice } from './documentSlice';
import type { ViewportSlice } from './viewportSlice';
import { groupRows } from '../group-rows';

export interface NavigationSlice {
  currentPage: number;
  /** Bumped by every navigation, so the view scrolls to the page even when it is already current. */
  navigationNonce: number;
  scrollOffset: number;
  isScrolling: boolean;
  /** Page indices currently rendered in the viewport (incl. overscan). */
  visiblePages: number[];

  goToPage: (index: number) => void;
  /** Moves to the next row: the next page, or the next spread in two-page mode. */
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  setCurrentPage: (index: number) => void;
  setScrollOffset: (offset: number) => void;
  setScrolling: (scrolling: boolean) => void;
  setVisiblePages: (pages: number[]) => void;
}

type NavigationState = NavigationSlice & DocumentSlice & ViewportSlice;

/** The first page of the row `by` rows away from the current one: a spread in two-page mode. */
function rowStep({ document: doc, currentPage, spreadMode, scrollMode }: NavigationState, by: 1 | -1) {
  if (!doc) return undefined;
  const rows = groupRows(doc.pageCount, spreadMode, scrollMode === 'horizontal');
  const row = rows.findIndex((r) => r.includes(currentPage));
  return rows[row + by]?.[0];
}

export const createNavigationSlice: StateCreator<
  NavigationState,
  [],
  [],
  NavigationSlice
> = (set, get) => ({
  currentPage: 0,
  navigationNonce: 0,
  scrollOffset: 0,
  isScrolling: false,
  visiblePages: [],

  goToPage: (index) => {
    const doc = get().document;
    if (!doc) return;
    set({
      currentPage: Math.max(0, Math.min(index, doc.pageCount - 1)),
      navigationNonce: get().navigationNonce + 1,
    });
  },

  nextPage: () => {
    const next = rowStep(get(), 1);
    if (next !== undefined) get().goToPage(next);
  },

  prevPage: () => {
    const prev = rowStep(get(), -1);
    if (prev !== undefined) get().goToPage(prev);
  },

  firstPage: () => get().goToPage(0),

  lastPage: () => get().goToPage((get().document?.pageCount ?? 0) - 1),

  setCurrentPage: (index) => {
    const doc = get().document;
    if (!doc) return;
    const clamped = Math.max(0, Math.min(index, doc.pageCount - 1));
    if (get().currentPage !== clamped) {
      set({ currentPage: clamped });
    }
  },

  setScrollOffset: (offset) =>
    set({ scrollOffset: offset, isScrolling: true }),

  setScrolling: (scrolling) => set({ isScrolling: scrolling }),

  setVisiblePages: (pages) => {
    const prev = get().visiblePages;
    if (prev.length === pages.length && prev.every((p, i) => p === pages[i])) {
      return;
    }
    set({ visiblePages: pages });
  },
});
