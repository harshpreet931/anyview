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
  const setFitMode = useViewerStore((s) => s.setFitMode);
  const toggleSidebar = useViewerStore((s) => s.toggleSidebar);
  const setSearchOpen = useViewerStore((s) => s.setSearchOpen);
  const undoAnnotation = useViewerStore((s) => s.undoAnnotation);
  const rootElement = useViewerStore((s) => s._rootElement);
  const pageCount = useViewerStore((s) => s.document?.pageCount);

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

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
        if (undoAnnotation()) e.preventDefault();
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
          case '0':
            e.preventDefault();
            setFitMode('page-fit');
            break;
        }
        return;
      }

      const container = target.closest<HTMLElement>('.dv-viewer-container');
      if (!container) return;

      const isArrow = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
      if (isArrow && container.scrollWidth > container.clientWidth + 1) return;
      const isPaging = e.key === 'PageUp' || e.key === 'PageDown' || e.key === 'Home' || e.key === 'End';
      if (isPaging && (pageCount ?? 0) <= 1) return;

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
  }, [enabled, rootElement, nextPage, prevPage, firstPage, lastPage, zoomIn, zoomOut, setFitMode, toggleSidebar, setSearchOpen, pageCount, undoAnnotation]);
}
