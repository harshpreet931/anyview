import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useLocale, useStrings } from '../../i18n/I18nProvider';
import { formatFileSize } from '../../i18n/format';
import { formatString } from '../../i18n/strings';
import type {
  SidebarView,
  PageRef,
  Adapter,
  FormatId,
  OutlineNode,
  PageDestination,
} from '../../core/types';

const SIDEBAR_MIN_WIDTH = 140;
const SIDEBAR_MAX_WIDTH = 400;

/** Below this viewer width the sidebar covers the page, so it starts closed
 *  and closes itself after a jump. Matches the 640px container query. */
export const NARROW_VIEWER_WIDTH = 640;

export function Sidebar() {
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  const sidebarView = useViewerStore((s) => s.sidebarView);
  const setSidebarView = useViewerStore((s) => s.setSidebarView);
  const sidebarWidth = useViewerStore((s) => s.sidebarWidth);
  const setSidebarWidth = useViewerStore((s) => s.setSidebarWidth);
  const document = useViewerStore((s) => s.document);
  const adapter = useViewerStore((s) => s.adapter);
  const currentPage = useViewerStore((s) => s.currentPage);
  const goToPageInStore = useViewerStore((s) => s.goToPage);
  const closeSidebarTransiently = useViewerStore((s) => s.closeSidebarTransiently);
  const asideRef = useRef<HTMLElement>(null);
  const setScrollOffset = useViewerStore((s) => s.setScrollOffset);
  const strings = useStrings();
  const instanceId = useViewerStore((s) => s.instanceId);

  const goToPage = useCallback(
    (pageIndex: number) => {
      goToPageInStore(pageIndex);
      const host = asideRef.current?.parentElement;
      if (host && host.clientWidth < NARROW_VIEWER_WIDTH) {
        closeSidebarTransiently();
        host.querySelector<HTMLElement>('.dv-viewer-container')?.focus({ preventScroll: true });
      }
    },
    [goToPageInStore, closeSidebarTransiently],
  );

  const navigateToOutline = useCallback(
    (pageIndex: number, scrollOffset?: number) => {
      goToPage(pageIndex);
      if (scrollOffset != null) setScrollOffset(scrollOffset);
    },
    [goToPage, setScrollOffset],
  );

  const [resizing, setResizing] = useState(false);
  const startResize = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = sidebarWidth;
      setResizing(true);
      const onMove = (ev: PointerEvent) =>
        setSidebarWidth(startWidth + (ev.clientX - startX));
      const onUp = () => {
        setResizing(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [sidebarWidth, setSidebarWidth],
  );

  const onResizeKey = useCallback(
    (e: React.KeyboardEvent) => {
      const STEP = 16;
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          setSidebarWidth(sidebarWidth - STEP);
          break;
        case 'ArrowRight':
          e.preventDefault();
          setSidebarWidth(sidebarWidth + STEP);
          break;
        case 'Home':
          e.preventDefault();
          setSidebarWidth(SIDEBAR_MIN_WIDTH);
          break;
        case 'End':
          e.preventDefault();
          setSidebarWidth(SIDEBAR_MAX_WIDTH);
          break;
      }
    },
    [sidebarWidth, setSidebarWidth],
  );

  if (!sidebarOpen || !document) return null;

  const views: { id: SidebarView; label: string }[] = [
    { id: 'thumbnails', label: strings.sidebar.thumbnails },
    ...(document.outline && document.outline.length > 0
      ? [{ id: 'outline' as SidebarView, label: strings.sidebar.outline }]
      : []),
    ...(document.attachments && document.attachments.length > 0
      ? [{ id: 'attachments' as SidebarView, label: strings.sidebar.attachments }]
      : []),
  ];

  const activeView = views.some((v) => v.id === sidebarView)
    ? sidebarView
    : 'thumbnails';

  const tabId = (view: SidebarView) => `${instanceId}-sidebar-tab-${view}`;
  const panelId = `${instanceId}-sidebar-panel`;

  return (
    <aside
      ref={asideRef}
      className="dv-sidebar"
      data-open={sidebarOpen}
      aria-label={strings.sidebar.region}
      style={{ width: `${sidebarWidth}px` }}
    >
      <div
        className="dv-sidebar-views"
        role="tablist"
        aria-label={strings.sidebar.viewSwitcher}
        onKeyDown={(e) => {
          const i = views.findIndex((v) => v.id === activeView);
          const next =
            e.key === 'ArrowRight' || e.key === 'ArrowDown'
              ? (i + 1) % views.length
              : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
                ? (i - 1 + views.length) % views.length
                : e.key === 'Home'
                  ? 0
                  : e.key === 'End'
                    ? views.length - 1
                    : -1;
          if (next === -1) return;
          e.preventDefault();
          e.stopPropagation();
          setSidebarView(views[next]!.id);
          e.currentTarget
            .querySelector<HTMLElement>(`#${CSS.escape(tabId(views[next]!.id))}`)
            ?.focus();
        }}
      >
        {views.map((view) => (
          <button
            key={view.id}
            id={tabId(view.id)}
            role="tab"
            aria-selected={activeView === view.id}
            aria-controls={panelId}
            tabIndex={activeView === view.id ? 0 : -1}
            className="dv-sidebar-view-tab"
            data-toggled={activeView === view.id}
            onClick={() => setSidebarView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId(activeView)}
        tabIndex={0}
        style={{ flex: 1, overflow: 'auto' }}
      >
        {activeView === 'thumbnails' && (
          <ThumbnailList
            pages={document.pages}
            format={document.format}
            adapter={adapter}
            live={!!adapter?.manifest.features.thumbnails || document.meta.size <= LIVE_PREVIEW_MAX_BYTES}
            currentPage={currentPage}
            onThumbnailClick={goToPage}
          />
        )}

        {activeView === 'outline' && document.outline && (
          <OutlineList nodes={document.outline} onNavigate={navigateToOutline} />
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
  );
}

const LIVE_PREVIEW_MAX_BYTES = 1_000_000;

function ThumbnailList({
  pages,
  format,
  adapter,
  live,
  currentPage,
  onThumbnailClick,
}: {
  pages: readonly PageRef[];
  format: FormatId;
  adapter: Adapter | null;
  live: boolean;
  currentPage: number;
  onThumbnailClick: (index: number) => void;
}) {
  return (
    <ul className="dv-thumbnail-list">
      {pages.map((page, index) => (
        <li key={page.index}>
          <Thumbnail
            page={page}
            index={index}
            format={format}
            adapter={live ? adapter : null}
            current={currentPage === index}
            onClick={() => onThumbnailClick(index)}
          />
        </li>
      ))}
    </ul>
  );
}

const THUMB_WIDTH = 150;

function Thumbnail({
  page,
  index,
  format,
  adapter,
  current,
  onClick,
}: {
  page: PageRef;
  index: number;
  format: FormatId;
  adapter: Adapter | null;
  current: boolean;
  onClick: () => void;
}) {
  const strings = useStrings();
  const canvasFormat = format === 'pdf' || format === 'image';
  const buttonRef = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adapter?.renderPage) return;
    const button = buttonRef.current;
    const target = canvasFormat ? canvasRef.current : docRef.current;
    if (!button || !target) return;

    const controller = new AbortController();
    let started = false;

    const render = () => {
      if (started) return;
      started = true;

      if (canvasFormat) {
        const canvas = canvasRef.current!;
        adapter
          .renderPage({
            page,
            target: canvas,
            scale: THUMB_WIDTH / page.width,
            rotation: 0,
            devicePixelRatio: window.devicePixelRatio,
            signal: controller.signal,
          })
          .then(() => {
            canvas.style.width = '';
            canvas.style.height = '';
          })
          .catch(() => {});
        return;
      }

      const doc = docRef.current!;
      const boxWidth = doc.parentElement?.clientWidth || THUMB_WIDTH;
      doc.style.width = `${page.width}px`;
      doc.style.height = `${page.height}px`;
      doc.style.transform = `scale(${boxWidth / page.width})`;
      adapter
        .renderPage({
          page,
          target: doc,
          scale: 1,
          rotation: 0,
          devicePixelRatio: window.devicePixelRatio,
          signal: controller.signal,
        })
        .catch(() => {});
    };

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          render();
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(button);

    return () => {
      io.disconnect();
      controller.abort();
    };
  }, [adapter, page, canvasFormat]);

  return (
    <button
      ref={buttonRef}
      className="dv-thumbnail"
      data-current={current}
      onClick={onClick}
      aria-label={formatString(strings.navigation.pageLabel, index + 1)}
      aria-current={current ? 'page' : undefined}
    >
      <div
        className="dv-thumbnail-image"
        style={{ ['--dv-thumb-ratio' as string]: `${page.width / page.height}` }}
      >
        {canvasFormat ? (
          <canvas ref={canvasRef} className="dv-thumbnail-canvas" />
        ) : (
          <div ref={docRef} className="dv-thumbnail-doc" aria-hidden="true" />
        )}
      </div>
      <div className="dv-thumbnail-label">{page.label || index + 1}</div>
    </button>
  );
}

// Outline nodes carry no id, so identity comes from title + destination. Repeats of that pair
// (a document really can have two "Introduction" headings on one page) get an occurrence suffix.
function keyOutlineNodes(
  nodes: ReadonlyArray<OutlineNode>,
): ReadonlyArray<{ node: OutlineNode; key: string }> {
  const seen = new Map<string, number>();
  return nodes.map((node) => {
    const dest =
      typeof node.dest === 'object' && node.dest !== null && 'pageIndex' in node.dest
        ? String((node.dest as PageDestination).pageIndex)
        : String(node.dest);
    const base = `${node.title} ${dest}`;
    const seenBefore = seen.get(base) ?? 0;
    seen.set(base, seenBefore + 1);
    return { node, key: seenBefore === 0 ? base : `${base} ${seenBefore}` };
  });
}

function OutlineList({
  nodes,
  onNavigate,
  depth = 0,
}: {
  nodes: ReadonlyArray<OutlineNode>;
  onNavigate: (pageIndex: number, scrollOffset?: number) => void;
  depth?: number;
}) {
  return (
    <ul
      className="dv-outline-list"
      role={depth === 0 ? 'tree' : 'group'}
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      {keyOutlineNodes(nodes).map(({ node, key }) => (
        <li key={key} role="treeitem">
          <button
            className="dv-outline-item"
            onClick={() => {
              if (typeof node.dest === 'object' && node.dest !== null && 'pageIndex' in node.dest) {
                const dest = node.dest as { pageIndex: number; scrollOffset?: number };
                onNavigate(dest.pageIndex, dest.scrollOffset);
              }
            }}
          >
            {node.title}
          </button>
          {node.children && (
            <OutlineList nodes={node.children} onNavigate={onNavigate} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}

function AttachmentList({
  attachments,
}: {
  attachments: ReadonlyArray<import('../../core/types').AttachmentRef>;
}) {
  const locale = useLocale();
  return (
    <ul className="dv-attachment-list">
      {attachments.map((att) => (
        <li key={att.id}>
          <button
            className="dv-attachment-item"
            onClick={async () => {
              let url: string | undefined;
              try {
                const blob = await att.getData();
                url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = att.name;
                a.click();
              } catch {
                // A failed attachment read has nowhere to surface; the viewer keeps off console.
              } finally {
                if (url) URL.revokeObjectURL(url);
              }
            }}
          >
            {att.name}
            <span className="dv-attachment-size">{formatFileSize(att.size, locale)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
