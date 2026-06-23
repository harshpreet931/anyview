/* ============================================================
 * Sidebar — collapsible sidebar with view selector
 * ============================================================ */

import { useViewerStore } from '../../hooks/useDocViewer';
import type { SidebarView, PageRef } from '../../core/types';

export function Sidebar() {
  const sidebarOpen = useViewerStore((s) => s.sidebarOpen);
  const sidebarView = useViewerStore((s) => s.sidebarView);
  const setSidebarView = useViewerStore((s) => s.setSidebarView);
  const sidebarWidth = useViewerStore((s) => s.sidebarWidth);
  const document = useViewerStore((s) => s.document);
  const currentPage = useViewerStore((s) => s.currentPage);
  const goToPage = useViewerStore((s) => s.goToPage);

  if (!sidebarOpen || !document) return null;

  const views: { id: SidebarView; label: string }[] = [
    { id: 'thumbnails', label: 'Thumbnails' },
    { id: 'outline', label: 'Outline' },
    { id: 'attachments', label: 'Attachments' },
  ];

  return (
    <div
      className="dv-sidebar"
      data-open={sidebarOpen}
      role="complementary"
      aria-label="Document views"
      style={{ width: `${sidebarWidth}px` }}
    >
      <div className="dv-sidebar-views" role="listbox" aria-label="Sidebar view">
        {views.map((view) => (
          <button
            key={view.id}
            role="option"
            aria-selected={sidebarView === view.id}
            className="dv-sidebar-view-tab"
            data-toggled={sidebarView === view.id}
            onClick={() => setSidebarView(view.id)}
          >
            {view.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {sidebarView === 'thumbnails' && (
          <ThumbnailList
            pages={document.pages}
            currentPage={currentPage}
            onThumbnailClick={goToPage}
          />
        )}

        {sidebarView === 'outline' && document.outline && (
          <OutlineList nodes={document.outline} onNavigate={goToPage} />
        )}

        {sidebarView === 'outline' && !document.outline && (
          <div className="dv-state-container">
            <div className="dv-state-description">No outline available</div>
          </div>
        )}

        {sidebarView === 'attachments' && document.attachments && (
          <AttachmentList attachments={document.attachments} />
        )}

        {sidebarView === 'attachments' && !document.attachments && (
          <div className="dv-state-container">
            <div className="dv-state-description">No attachments</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ThumbnailList({
  pages,
  currentPage,
  onThumbnailClick,
}: {
  pages: readonly PageRef[];
  currentPage: number;
  onThumbnailClick: (index: number) => void;
}) {
  return (
    <div className="dv-thumbnail-list" role="list">
      {pages.map((page, index) => (
        <button
          key={index}
          className="dv-thumbnail"
          data-current={currentPage === index}
          onClick={() => onThumbnailClick(index)}
          aria-label={`Page ${index + 1}`}
          aria-current={currentPage === index ? 'page' : undefined}
        >
          <div
            className="dv-thumbnail-image"
            style={{ ['--dv-thumb-ratio' as string]: `${page.width / page.height}` }}
          />
          <div className="dv-thumbnail-label">{page.label || index + 1}</div>
        </button>
      ))}
    </div>
  );
}

function OutlineList({
  nodes,
  onNavigate,
  depth = 0,
}: {
  nodes: ReadonlyArray<import('../../core/types').OutlineNode>;
  onNavigate: (pageIndex: number) => void;
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
                onNavigate((node.dest as { pageIndex: number }).pageIndex);
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
