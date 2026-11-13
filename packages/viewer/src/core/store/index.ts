import { create } from 'zustand';
import {
  createJSONStorage,
  devtools,
  persist,
  subscribeWithSelector,
} from 'zustand/middleware';
import { createDocumentSlice, type DocumentSlice } from './documentSlice';
import { createNavigationSlice, type NavigationSlice } from './navigationSlice';
import { createViewportSlice, type ViewportSlice } from './viewportSlice';
import { createSearchSlice, type SearchSlice } from './searchSlice';
import {
  createAnnotationSlice,
  type AnnotationSlice,
} from './annotationSlice';
import { createUiSlice, type UiSlice } from './uiSlice';

export type { DocumentSlice, LoadState } from './documentSlice';
export type { NavigationSlice } from './navigationSlice';
export type { ViewportSlice } from './viewportSlice';
export type { SearchSlice, SearchState } from './searchSlice';
export type { AnnotationSlice } from './annotationSlice';
export type { UiSlice, ToolbarDensity } from './uiSlice';

export type ViewerStore = DocumentSlice &
  NavigationSlice &
  ViewportSlice &
  SearchSlice &
  AnnotationSlice &
  UiSlice;

const noopStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
};
const safeStorage = createJSONStorage(() =>
  typeof window !== 'undefined' ? window.localStorage : noopStorage,
);

export interface CreateViewerStoreOptions {
  /** localStorage key for persisted preferences; pass a distinct key per viewer to isolate them. */
  persistKey?: string;
}

export const createViewerStore = (options?: CreateViewerStoreOptions) => {
  const persistKey = options?.persistKey ?? 'doc-viewer-prefs';
  const store = create<ViewerStore>()(
    subscribeWithSelector(
      devtools(
        persist(
          (...a) => ({
            ...createDocumentSlice(...a),
            ...createNavigationSlice(...a),
            ...createViewportSlice(...a),
            ...createSearchSlice(...a),
            ...createAnnotationSlice(...a),
            ...createUiSlice(...a),
          }),
          {
            name: persistKey,
            storage: safeStorage,
            merge: (persisted, current) => {
              const saved = (persisted ?? {}) as Partial<ViewerStore>;
              return {
                ...current,
                ...saved,
                sidebarPref: saved.sidebarOpen ?? current.sidebarPref,
              };
            },
            partialize: (state) => ({
              zoom: state.zoom,
              fitMode: state.fitMode,
              theme: state.theme,
              sidebarOpen: state.sidebarPref,
              sidebarView: state.sidebarView,
              sidebarWidth: state.sidebarWidth,
              toolbarDensity: state.toolbarDensity,
              locale: state.locale,
              recentFiles: state.recentFiles,
            }),
          },
        ),
        { name: persistKey },
      ),
    ),
  );
  store.subscribe(
    (s) => s.rotation,
    () => store.getState()._refreshSearchGeometry(),
  );
  return store;
};
