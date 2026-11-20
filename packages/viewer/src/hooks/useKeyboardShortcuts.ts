import { useEffect } from 'react';
import { useViewerStore, useViewerStoreApi } from './useDocViewer';

export function useKeyboardShortcuts(
  enabled: boolean = true,
) {
  const store = useViewerStoreApi();
  const rootElement = useViewerStore((s) => s._rootElement);

  useEffect(() => {
    if (!enabled || !rootElement) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const state = store.getState();

      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        state.setSearchOpen(true);
        return;
      }

      if (e.key === 'Escape') {
        state.setSearchOpen(false);
        return;
      }

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
        if (state.undoAnnotation()) e.preventDefault();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault();
            state.zoomIn();
            break;
          case '-':
            e.preventDefault();
            state.zoomOut();
            break;
          case '0':
            e.preventDefault();
            state.setFitMode('page-fit');
            break;
        }
        return;
      }

      const container = target.closest<HTMLElement>('.dv-viewer-container');
      if (!container) return;

      const isArrow = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (isArrow && container.scrollWidth > container.clientWidth + 1) return;
      const isPaging = e.key === 'PageUp' || e.key === 'PageDown' || e.key === 'Home' || e.key === 'End';
      if (isPaging && (state.document?.pageCount ?? 0) <= 1) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          state.nextPage();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          state.prevPage();
          break;
        case 'Home':
          e.preventDefault();
          state.firstPage();
          break;
        case 'End':
          e.preventDefault();
          state.lastPage();
          break;
        case 's':
          e.preventDefault();
          state.toggleSidebar();
          break;
      }
    };

    rootElement.addEventListener('keydown', handler);
    return () => rootElement.removeEventListener('keydown', handler);
  }, [enabled, rootElement, store]);
}
