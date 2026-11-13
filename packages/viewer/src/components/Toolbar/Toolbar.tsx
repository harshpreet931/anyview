import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { AdapterFeatures } from '../../core/types';
import { ToolbarPageNav } from './ToolbarPageNav';
import { ToolbarZoom, ToolbarView } from './ToolbarZoom';
import { ToolbarActions } from './ToolbarActions';
import { ToolbarAnnotations } from './ToolbarAnnotations';
import { ToolbarSearch } from './ToolbarSearch';
import { Icon } from '../common/Icon';

interface ToolbarProps {
  features?: AdapterFeatures;
}

/**
 * How much room the full toolbar needs. The stylesheet collapses the
 * secondary groups (view, actions, annotations) into a "More" popover once
 * the viewer itself is narrower than the tier's width (container queries),
 * so a 600px embed with a PDF never clips while a Markdown file keeps every
 * control inline at the same width.
 */
function toolbarTier(features: AdapterFeatures | undefined, pageCount: number) {
  if (features?.annotations) return 'lg';
  if (features?.rotation || pageCount > 1) return 'md';
  return 'sm';
}

export function Toolbar({ features }: ToolbarProps) {
  const strings = useStrings();
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  const toggleSidebar = useViewerStore((s) => s.toggleSidebar);
  const searchOpen = useViewerStore((s) => s.searchOpen);
  const setSearchOpen = useViewerStore((s) => s.setSearchOpen);
  const pageCount = useViewerStore((s) => s.document?.pageCount ?? 0);

  const overflowId = useId();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const overflowRef = useRef<HTMLDivElement>(null);

  const closeMore = useCallback((restoreFocus: boolean) => {
    setMoreOpen(false);
    if (restoreFocus) moreButtonRef.current?.focus();
  }, []);

  // Dismiss on outside pointer-down and on Escape, like any popover.
  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (overflowRef.current?.contains(t) || moreButtonRef.current?.contains(t)) return;
      setMoreOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      closeMore(true);
    };
    window.document.addEventListener('pointerdown', onPointerDown);
    window.document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.document.removeEventListener('pointerdown', onPointerDown);
      window.document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [moreOpen, closeMore]);

  // Picking a tool or action from the popover is a one-shot choice: close it
  // so the document is reachable again. Inline (wide) layouts ignore this.
  const onOverflowClick = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as Element).closest('button')) closeMore(false);
    },
    [closeMore],
  );

  return (
    <>
      <div
        className="dv-toolbar"
        role="toolbar"
        aria-label={strings.toolbar.label}
        data-tier={toolbarTier(features, pageCount)}
      >
        <div className="dv-toolbar-group">
          <button
            className="dv-button"
            onClick={toggleSidebar}
            aria-expanded={sidebarOpen}
            aria-label={strings.toolbar.sidebarToggle}
            title={strings.toolbar.sidebarToggle}
          >
            <Icon name="sidebar" />
          </button>
        </div>

        <ToolbarPageNav />

        <div className="dv-toolbar-spacer" />

        {features?.search && (
          <div className="dv-toolbar-group">
            <button
              className="dv-button"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-expanded={searchOpen}
              aria-label={strings.toolbar.searchToggle}
              title={strings.toolbar.searchToggle}
              data-toggled={searchOpen}
            >
              <Icon name="search" />
            </button>
          </div>
        )}

        <ToolbarZoom {...(features ? { features } : {})} />

        {/* Before the popover in DOM order so Tab moves from the button into it. */}
        <button
          ref={moreButtonRef}
          className="dv-button dv-toolbar-more"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls={overflowId}
          aria-label={strings.toolbar.overflowMenu}
          title={strings.toolbar.overflowMenu}
          data-toggled={moreOpen}
        >
          <Icon name="more" />
        </button>

        {/* Inline on wide viewers (display: contents); a popover on narrow ones. */}
        <div
          ref={overflowRef}
          id={overflowId}
          className="dv-toolbar-overflow"
          data-open={moreOpen}
          onClick={onOverflowClick}
          onChange={() => closeMore(false)}
        >
          <ToolbarView {...(features ? { features } : {})} />
          <ToolbarActions {...(features ? { features } : {})} />
          {features?.annotations && <ToolbarAnnotations />}
        </div>
      </div>

      {searchOpen && features?.search && <ToolbarSearch />}
    </>
  );
}
