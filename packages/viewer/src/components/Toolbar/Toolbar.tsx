import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { AdapterFeatures } from '../../core/types';
import { ToolbarPageNav } from './ToolbarPageNav';
import { ToolbarZoom } from './ToolbarZoom';
import { ToolbarView } from './ToolbarView';
import { ToolbarActions } from './ToolbarActions';
import { ToolbarAnnotations } from './ToolbarAnnotations';
import { ToolbarSearch } from './ToolbarSearch';
import { IconButton } from './IconButton';

interface ToolbarProps {
  features?: AdapterFeatures | undefined;
}

const NARROW_TOOLBAR_WIDTH = 360;

// The stylesheet folds the secondary groups into "More" once the viewer is narrower than the tier needs.
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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const measure = () => setNarrow(el.clientWidth > 0 && el.clientWidth <= NARROW_TOOLBAR_WIDTH);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const closeMore = useCallback((restoreFocus: boolean) => {
    setMoreOpen(false);
    if (restoreFocus) moreButtonRef.current?.focus();
  }, []);

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
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
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
        ref={toolbarRef}
        className="dv-toolbar"
        role="toolbar"
        aria-label={strings.toolbar.label}
        data-tier={toolbarTier(features, pageCount)}
        data-narrow={narrow || undefined}
      >
        <div className="dv-toolbar-group">
          <IconButton
            icon="sidebar"
            label={strings.toolbar.sidebarToggle}
            onClick={toggleSidebar}
            aria-expanded={sidebarOpen}
          />
        </div>

        <ToolbarPageNav />

        <div className="dv-toolbar-spacer" />

        {features?.search && (
          <div className="dv-toolbar-group">
            <IconButton
              icon="search"
              label={strings.toolbar.searchToggle}
              onClick={() => setSearchOpen(!searchOpen)}
              aria-expanded={searchOpen}
              data-toggled={searchOpen}
            />
          </div>
        )}

        {!narrow && <ToolbarZoom features={features} />}

        {/* Before the popover in DOM order so Tab moves from the button into it. */}
        <IconButton
          ref={moreButtonRef}
          icon="more"
          label={strings.toolbar.overflowMenu}
          className="dv-toolbar-more"
          onClick={() => setMoreOpen((o) => !o)}
          aria-expanded={moreOpen}
          aria-controls={overflowId}
          data-toggled={moreOpen}
        />

        {/* Inline on wide viewers (display: contents); a popover on narrow ones. */}
        <div
          ref={overflowRef}
          id={overflowId}
          className="dv-toolbar-overflow"
          data-open={moreOpen}
          onClick={onOverflowClick}
          onChange={() => closeMore(false)}
        >
          {narrow && <ToolbarZoom features={features} />}
          <ToolbarView features={features} />
          <ToolbarActions features={features} />
          {features?.annotations && <ToolbarAnnotations />}
        </div>
      </div>

      {searchOpen && features?.search && <ToolbarSearch />}
    </>
  );
}
