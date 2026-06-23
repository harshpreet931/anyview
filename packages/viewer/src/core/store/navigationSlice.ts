/* ============================================================
 * Navigation Slice
 * Page navigation and scroll position tracking.
 * ============================================================ */

import type { StateCreator } from 'zustand';
import type { DocumentSlice } from './documentSlice';

export interface NavigationSlice {
  currentPage: number;
  scrollOffset: number;
  isScrolling: boolean;

  goToPage: (index: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  firstPage: () => void;
  lastPage: () => void;
  setCurrentPage: (index: number) => void;
  setScrollOffset: (offset: number) => void;
  setScrolling: (scrolling: boolean) => void;
}

export const createNavigationSlice: StateCreator<
  NavigationSlice & DocumentSlice,
  [],
  [],
  NavigationSlice
> = (set, get) => ({
  currentPage: 0,
  scrollOffset: 0,
  isScrolling: false,

  goToPage: (index: number) => {
    const doc = get().document;
    if (!doc) return;
    const clamped = Math.max(0, Math.min(index, doc.pageCount - 1));
    set({ currentPage: clamped });
  },

  nextPage: () => {
    const { document: doc, currentPage } = get();
    if (!doc) return;
    if (currentPage < doc.pageCount - 1) {
      set({ currentPage: currentPage + 1 });
    }
  },

  prevPage: () => {
    const { currentPage } = get();
    if (currentPage > 0) {
      set({ currentPage: currentPage - 1 });
    }
  },

  firstPage: () => set({ currentPage: 0 }),

  lastPage: () => {
    const doc = get().document;
    if (!doc) return;
    set({ currentPage: doc.pageCount - 1 });
  },

  setCurrentPage: (index: number) => {
    const doc = get().document;
    if (!doc) return;
    const clamped = Math.max(0, Math.min(index, doc.pageCount - 1));
    if (get().currentPage !== clamped) {
      set({ currentPage: clamped });
    }
  },

  setScrollOffset: (offset: number) =>
    set({ scrollOffset: offset, isScrolling: true }),

  setScrolling: (scrolling: boolean) => set({ isScrolling: scrolling }),
});
