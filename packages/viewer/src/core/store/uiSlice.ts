import type { StateCreator } from 'zustand';
import type { Theme, SidebarView, RecentFile } from '../types';
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '../zoom';

export type ToolbarDensity = 'compact' | 'default' | 'touch';

export interface UiSlice {
  theme: Theme;
  sidebarOpen: boolean;
  sidebarPref: boolean;
  sidebarView: SidebarView;
  sidebarWidth: number;
  searchOpen: boolean;
  propertiesOpen: boolean;
  commentsPanelOpen: boolean;
  toolbarDensity: ToolbarDensity;
  recentFiles: RecentFile[];
  locale: string;
  instanceId: string;

  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  closeSidebarTransiently: () => void;
  setSidebarView: (view: SidebarView) => void;
  setSidebarWidth: (width: number) => void;
  toggleSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  setPropertiesOpen: (open: boolean) => void;
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
  sidebarPref: true,
  sidebarView: 'thumbnails',
  sidebarWidth: 200,
  searchOpen: false,
  propertiesOpen: false,
  commentsPanelOpen: false,
  toolbarDensity: 'default',
  recentFiles: [],
  locale: 'en',
  instanceId: `dv-${++instanceCounter}`,

  setTheme: (theme) => set({ theme }),

  toggleSearch: () => set((s) => ({ searchOpen: !s.searchOpen })),

  setSearchOpen: (open) => set({ searchOpen: open }),

  setPropertiesOpen: (open) => set({ propertiesOpen: open }),

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen, sidebarPref: !s.sidebarOpen })),

  setSidebarOpen: (open) => set({ sidebarOpen: open, sidebarPref: open }),

  closeSidebarTransiently: () => set({ sidebarOpen: false }),

  setSidebarView: (view) => set({ sidebarView: view }),

  setSidebarWidth: (width) => {
    set({ sidebarWidth: Math.max(SIDEBAR_MIN_WIDTH, Math.min(width, SIDEBAR_MAX_WIDTH)) });
  },

  toggleCommentsPanel: () =>
    set((s) => ({ commentsPanelOpen: !s.commentsPanelOpen })),

  setToolbarDensity: (density) => set({ toolbarDensity: density }),

  addRecentFile: (file) => {
    const existing = get().recentFiles.filter((f) => f.id !== file.id);
    const next = [file, ...existing].slice(0, MAX_RECENT_FILES);
    set({ recentFiles: next });
  },

  setLocale: (locale) => set({ locale }),
});
