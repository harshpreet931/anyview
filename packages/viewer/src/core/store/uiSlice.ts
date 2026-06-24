/* ============================================================
 * UI Slice
 * Theme, sidebar, toolbar, locale, and recent files.
 * ============================================================ */

import type { StateCreator } from 'zustand';
import type { Theme, SidebarView, RecentFile } from '../types';

export type ToolbarDensity = 'compact' | 'default' | 'touch';

export interface UiSlice {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarView: SidebarView;
  sidebarWidth: number;
  searchOpen: boolean;
  commentsPanelOpen: boolean;
  toolbarDensity: ToolbarDensity;
  recentFiles: RecentFile[];
  locale: string;
  instanceId: string;

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarView: (view: SidebarView) => void;
  setSidebarWidth: (width: number) => void;
  toggleSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  toggleCommentsPanel: () => void;
  setToolbarDensity: (density: ToolbarDensity) => void;
  addRecentFile: (file: RecentFile) => void;
  setLocale: (locale: string) => void;
}

const MAX_RECENT_FILES = 10;
let instanceCounter = 0;

export const createUiSlice: StateCreator<
  UiSlice,
  [],
  [],
  UiSlice
> = (set, get) => ({
  theme: 'auto',
  sidebarOpen: true,
  sidebarView: 'thumbnails',
  sidebarWidth: 200,
  searchOpen: false,
  commentsPanelOpen: false,
  toolbarDensity: 'default',
  recentFiles: [],
  locale: 'en',
  instanceId: `dv-${++instanceCounter}`,

  setTheme: (theme: Theme) => set({ theme }),

  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),

  setSearchOpen: (open: boolean) => set({ searchOpen: open }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  setSidebarView: (view: SidebarView) => set({ sidebarView: view }),

  setSidebarWidth: (width: number) => {
    const clamped = Math.max(140, Math.min(width, 400));
    set({ sidebarWidth: clamped });
  },

  toggleCommentsPanel: () =>
    set((s) => ({ commentsPanelOpen: !s.commentsPanelOpen })),

  setToolbarDensity: (density: ToolbarDensity) => set({ toolbarDensity: density }),

  addRecentFile: (file: RecentFile) => {
    const existing = get().recentFiles.filter((f) => f.id !== file.id);
    const next = [file, ...existing].slice(0, MAX_RECENT_FILES);
    set({ recentFiles: next });
  },

  setLocale: (locale: string) => set({ locale }),
});
