/* ============================================================
 * useKeyboardShortcuts - global keyboard shortcut handler
 * ============================================================ */

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

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest('.dv-root')) {
        return;
      }

      // Ctrl/Cmd+F opens the in-document search, overriding the browser's
      // native find. Works regardless of focus so it also reaches the input.
      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow Escape to dismiss search while typing in its field.
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

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, nextPage, prevPage, firstPage, lastPage, zoomIn, zoomOut, toggleSidebar, setSearchOpen]);
}
