import { useRef, useState } from 'react';
import { SIDEBAR_MAX_WIDTH, SIDEBAR_MIN_WIDTH } from '../../core/zoom';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { SidebarView } from '../../core/types';
import { AttachmentList } from './AttachmentList';
import { OutlineList } from './OutlineList';
import { LIVE_PREVIEW_MAX_BYTES, ThumbnailList } from './Thumbnails';
import { useSidebarResize } from './useSidebarResize';

/** Below this viewer width the sidebar covers the page, so it starts closed
 *  and closes itself after a jump. Matches the 640px container query. */
export const NARROW_VIEWER_WIDTH = 640;

export function Sidebar() {
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  const sidebarView = useViewerStore((s) => s.sidebarView);
  const setSidebarView = useViewerStore((s) => s.setSidebarView);
  const document = useViewerStore((s) => s.document);
  const adapter = useViewerStore((s) => s.adapter);
  const goToPageInStore = useViewerStore((s) => s.goToPage);
  const closeSidebarTransiently = useViewerStore((s) => s.closeSidebarTransiently);
  const setScrollOffset = useViewerStore((s) => s.setScrollOffset);
  const instanceId = useViewerStore((s) => s.instanceId);
  const strings = useStrings();
  const asideRef = useRef<HTMLElement>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const { sidebarWidth, resizing, startResize, onResizeKey } = useSidebarResize();

  if (!sidebarOpen || !document) return null;

  const goToPage = (pageIndex: number) => {
    goToPageInStore(pageIndex);
    const host = asideRef.current?.parentElement;
    if (host && host.clientWidth < NARROW_VIEWER_WIDTH) {
      closeSidebarTransiently();
      host.querySelector<HTMLElement>('.dv-viewer-container')?.focus({ preventScroll: true });
    }
  };

  const navigateToOutline = (pageIndex: number, scrollOffset?: number) => {
    goToPage(pageIndex);
    if (scrollOffset != null) setScrollOffset(scrollOffset);
  };

  const views: SidebarView[] = ['thumbnails'];
  if (document.outline?.length) views.push('outline');
  if (document.attachments?.length) views.push('attachments');

  const activeView = views.includes(sidebarView) ? sidebarView : 'thumbnails';

  const tabId = (view: SidebarView) => `${instanceId}-sidebar-tab-${view}`;
  const panelId = `${instanceId}-sidebar-panel`;

  const onTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = views.indexOf(activeView);
    const indexForKey: Record<string, number> = {
      ArrowRight: i + 1,
      ArrowDown: i + 1,
      ArrowLeft: i - 1,
      ArrowUp: i - 1,
      Home: 0,
      End: views.length - 1,
    };
    const target = indexForKey[e.key];
    if (target === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    const next = views[(target + views.length) % views.length]!;
    setSidebarView(next);
    e.currentTarget.querySelector<HTMLElement>(`#${CSS.escape(tabId(next))}`)?.focus();
  };

  return (
    <>
      <div className="dv-sidebar-backdrop" aria-hidden="true" onClick={closeSidebarTransiently} />
      <aside
        ref={asideRef}
        className="dv-sidebar"
        aria-label={strings.sidebar.region}
        style={{ width: `${sidebarWidth}px` }}
      >
        <div
          className="dv-sidebar-views"
          role="tablist"
          aria-label={strings.sidebar.viewSwitcher}
          onKeyDown={onTabKeyDown}
        >
          {views.map((view) => (
            <button
              key={view}
              id={tabId(view)}
              role="tab"
              aria-selected={activeView === view}
              aria-controls={panelId}
              tabIndex={activeView === view ? 0 : -1}
              className="dv-sidebar-view-tab"
              data-toggled={activeView === view}
              onClick={() => setSidebarView(view)}
            >
              {strings.sidebar[view]}
            </button>
          ))}
        </div>

        <div
          ref={setPanel}
          id={panelId}
          role="tabpanel"
          aria-labelledby={tabId(activeView)}
          tabIndex={0}
          style={{ flex: 1, overflow: 'auto' }}
        >
          {panel && activeView === 'thumbnails' && (
            <ThumbnailList
              pages={document.pages}
              format={document.format}
              adapter={adapter}
              live={!!adapter?.manifest.features.thumbnails || document.meta.size <= LIVE_PREVIEW_MAX_BYTES}
              scrollElement={panel}
              resizing={resizing}
              onThumbnailClick={goToPage}
            />
          )}

          {panel && activeView === 'outline' && document.outline && (
            <OutlineList nodes={document.outline} scrollElement={panel} onNavigate={navigateToOutline} />
          )}

          {activeView === 'attachments' && document.attachments && (
            <AttachmentList attachments={document.attachments} />
          )}
        </div>

        <div
          className="dv-sidebar-resizer"
          data-active={resizing}
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={strings.sidebar.resize}
          aria-valuenow={sidebarWidth}
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          onPointerDown={startResize}
          onKeyDown={onResizeKey}
        />
      </aside>
    </>
  );
}
