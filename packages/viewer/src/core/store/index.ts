/* ============================================================
 * Viewer Store — Zustand store composed of slices.
 *
 * Uses subscribeWithSelector middleware (required for
 * selector-based transient subscriptions in Zustand v5).
 * ============================================================ */

import { create } from 'zustand';
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware';
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

export const createViewerStore = () =>
  create<ViewerStore>()(
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
            name: 'doc-viewer-prefs',
            partialize: (state) => ({
              zoom: state.zoom,
              fitMode: state.fitMode,
              theme: state.theme,
              sidebarOpen: state.sidebarOpen,
              sidebarView: state.sidebarView,
              sidebarWidth: state.sidebarWidth,
              toolbarDensity: state.toolbarDensity,
              locale: state.locale,
              recentFiles: state.recentFiles,
            }),
          },
        ),
        { name: 'doc-viewer' },
      ),
    ),
  );
