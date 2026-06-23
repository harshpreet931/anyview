/* ============================================================
 * useDocViewer — main hook for accessing the viewer store
 * ============================================================ */

import { useStore } from 'zustand';
import { useContext, createContext, useMemo, type ReactNode } from 'react';
import { createViewerStore, type ViewerStore } from '../core/store';

type ViewerStoreInstance = ReturnType<typeof createViewerStore>;

const ViewerStoreContext = createContext<ViewerStoreInstance | null>(null);

export function ViewerStoreProvider({
  store,
  children,
}: {
  store: ViewerStoreInstance;
  children: ReactNode;
}) {
  return (
    <ViewerStoreContext.Provider value={store}>
      {children}
    </ViewerStoreContext.Provider>
  );
}

export function useViewerStore(): ViewerStore;
export function useViewerStore<T>(selector: (s: ViewerStore) => T): T;
export function useViewerStore<T>(selector?: (s: ViewerStore) => T): T | ViewerStore {
  const store = useContext(ViewerStoreContext);
  if (!store) {
    throw new Error('useViewerStore must be used within a ViewerStoreProvider');
  }
  return useStore(store, selector as (s: ViewerStore) => T);
}

export function useDocViewer() {
  const store = useContext(ViewerStoreContext);
  if (!store) {
    throw new Error('useDocViewer must be used within a ViewerStoreProvider');
  }

  const document = useStore(store, (s) => s.document);
  const loadState = useStore(store, (s) => s.loadState);
  const loadError = useStore(store, (s) => s.loadError);
  const adapter = useStore(store, (s) => s.adapter);
  const currentPage = useStore(store, (s) => s.currentPage);
  const zoom = useStore(store, (s) => s.zoom);
  const rotation = useStore(store, (s) => s.rotation);
  const fitMode = useStore(store, (s) => s.fitMode);
  const theme = useStore(store, (s) => s.theme);
  const sidebarOpen = useStore(store, (s) => s.sidebarOpen);

  const actions = useMemo(
    () => {
      const s = store.getState();
      return {
        openDocument: s.openDocument,
        closeDocument: s.closeDocument,
        goToPage: s.goToPage,
        nextPage: s.nextPage,
        prevPage: s.prevPage,
        setZoom: s.setZoom,
        zoomIn: s.zoomIn,
        zoomOut: s.zoomOut,
        rotateClockwise: s.rotateClockwise,
        rotateCounterClockwise: s.rotateCounterClockwise,
        setTheme: s.setTheme,
        toggleSidebar: s.toggleSidebar,
      };
    },
    [store],
  );

  return {
    document,
    loadState,
    loadError,
    adapter,
    currentPage,
    zoom,
    rotation,
    fitMode,
    theme,
    sidebarOpen,
    ...actions,
  };
}
