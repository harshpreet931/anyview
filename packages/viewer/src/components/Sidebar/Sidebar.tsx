/* ============================================================
 * Sidebar - collapsible sidebar with view selector
 * ============================================================ */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { SidebarView, PageRef, Adapter, FormatId } from '../../core/types';

// Mirror the store's sidebar-width clamp, for the resizer's aria-value range.
const SIDEBAR_MIN_WIDTH = 140;
const SIDEBAR_MAX_WIDTH = 400;

export function Sidebar() {
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  const sidebarView = useViewerStore((s) => s.sidebarView);
  const setSidebarView = useViewerStore((s) => s.setSidebarView);
  const sidebarWidth = useViewerStore((s) => s.sidebarWidth);
  const setSidebarWidth = useViewerStore((s) => s.setSidebarWidth);
  const document = useViewerStore((s) => s.document);
  const adapter = useViewerStore((s) => s.adapter);
  const currentPage = useViewerStore((s) => s.currentPage);
  const goToPage = useViewerStore((s) => s.goToPage);
  const setScrollOffset = useViewerStore((s) => s.setScrollOffset);
  const strings = useStrings();
  const instanceId = useViewerStore((s) => s.instanceId);

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
        setSidebarWidth(startWidth + (ev.clientX - startX)); // store clamps
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

  // Keyboard resize for the separator (the store clamps to the same bounds).
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

  // Only offer tabs that have content - an empty Outline/Attachments tab is a
  // dead click. Thumbnails always apply.
  const views: { id: SidebarView; label: string }[] = [
    { id: 'thumbnails', label: strings.sidebar.thumbnails },
    ...(document.outline && document.outline.length > 0
      ? [{ id: 'outline' as SidebarView, label: strings.sidebar.outline }]
      : []),
    ...(document.attachments && document.attachments.length > 0
      ? [{ id: 'attachments' as SidebarView, label: strings.sidebar.attachments }]
      : []),
  ];

  // If the persisted view is no longer available, fall back to thumbnails.
  const activeView = views.some((v) => v.id === sidebarView)
    ? sidebarView
    : 'thumbnails';

  const tabId = (view: SidebarView) => `${instanceId}-sidebar-tab-${view}`;
  const panelId = `${instanceId}-sidebar-panel`;

  return (
    <div
      className="dv-sidebar"
      data-open={sidebarOpen}
      role="complementary"
      aria-label={strings.sidebar.region}
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="dv-sidebar-views" role="tablist" aria-label={strings.sidebar.viewSwitcher}>
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
    </div>
  );
}

function ThumbnailList({
  pages,
  format,
  adapter,
  currentPage,
  onThumbnailClick,
}: {
  pages: readonly PageRef[];
  format: FormatId;
  adapter: Adapter | null;
  currentPage: number;
  onThumbnailClick: (index: number) => void;
}) {
  return (
    <div className="dv-thumbnail-list" role="list">
      {pages.map((page, index) => (
        <Thumbnail
          key={index}
          page={page}
          index={index}
          format={format}
          adapter={adapter}
          current={currentPage === index}
          onClick={() => onThumbnailClick(index)}
        />
      ))}
    </div>
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
  // Canvas formats (PDF, image) paint into a <canvas>; reflowable formats
  // render their real DOM at full size into a <div> that we shrink with a CSS
  // transform - both produce a true preview of the page.
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
            // Let CSS size the display; keep the high-res backing store.
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

    // Lazily render only when the thumbnail scrolls near the viewport.
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
      aria-label={`Page ${index + 1}`}
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

function OutlineList({
  nodes,
  onNavigate,
  depth = 0,
}: {
  nodes: ReadonlyArray<import('../../core/types').OutlineNode>;
  onNavigate: (pageIndex: number, scrollOffset?: number) => void;
  depth?: number;
}) {
  return (
    <ul
      className="dv-outline-list"
      role={depth === 0 ? 'tree' : 'group'}
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      {nodes.map((node, i) => (
        <li key={i} role="treeitem">
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
  return (
    <ul className="dv-attachment-list">
      {attachments.map((att) => (
        <li key={att.id}>
          <button
            className="dv-attachment-item"
            onClick={() => {
              att.getData().then((blob) => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = att.name;
                a.click();
                URL.revokeObjectURL(url);
              });
            }}
          >
            {att.name}
            <span className="dv-attachment-size">{formatSize(att.size)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
