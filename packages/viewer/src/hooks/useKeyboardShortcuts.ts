import { useEffect } from 'react';
import { useViewerStore } from './useDocViewer';

export function useKeyboardShortcuts(
  enabled: boolean = true,
) {
  const nextPage = useViewerStore((s) => s.nextPage);
  const prevPage = useViewerStore((s) => s.prevPage);
  const firstPage = useViewerStore((s) => s.firstPage);
  const lastPage = useViewerStore((s) => s.lastPage);
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const toggleSidebar = useViewerStore((s) => s.toggleSidebar);
  const setSearchOpen = useViewerStore((s) => s.setSearchOpen);
  const rootElement = useViewerStore((s) => s._rootElement);

  useEffect(() => {
    if (!enabled || !rootElement) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (e.key === 'Escape') setSearchOpen(false);
        return;
      }

      if (e.key === 'Escape') {
        setSearchOpen(false);
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case '=':
          case '+':
            e.preventDefault();
            zoomIn();
            break;
          case '-':
            e.preventDefault();
            zoomOut();
            break;
        }
        return;
      }

      if (!target.closest('.dv-viewer-container')) return;

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          nextPage();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          prevPage();
          break;
        case 'Home':
          e.preventDefault();
          firstPage();
          break;
        case 'End':
          e.preventDefault();
          lastPage();
          break;
        case 's':
          e.preventDefault();
          toggleSidebar();
          break;
      }
    };

    rootElement.addEventListener('keydown', handler);
    return () => rootElement.removeEventListener('keydown', handler);
  }, [enabled, rootElement, nextPage, prevPage, firstPage, lastPage, zoomIn, zoomOut, toggleSidebar, setSearchOpen]);
}
