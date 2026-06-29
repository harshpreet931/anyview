/* ============================================================
 * useKeyboardShortcuts - shortcuts scoped to this viewer's root,
 * so multiple viewers (and the host page) keep their own keys.
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
  const rootElement = useViewerStore((s) => s._rootElement);

  useEffect(() => {
    if (!enabled || !rootElement) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Ctrl/Cmd+F opens the in-document search, overriding the browser's
      // native find. The listener is on this viewer's root, so it only fires
      // when focus is already inside this viewer.
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

      // Navigation keys only act (and only swallow the default) when focus is in
      // the scrollable content region, so arrows/Home/End on a focused control
      // (button, select, the toolbar) keep their normal behavior.
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
