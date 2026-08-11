import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';

export function ToolbarPageNav() {
  const strings = useStrings();
  const currentPage = useViewerStore((s) => s.currentPage);
  const pageCount = useViewerStore((s) => s.document?.pageCount ?? 0);
  const goToPage = useViewerStore((s) => s.goToPage);
  const nextPage = useViewerStore((s) => s.nextPage);
  const prevPage = useViewerStore((s) => s.prevPage);

  return (
    <div className="dv-toolbar-group dv-toolbar-page-nav">
      <button
        className="dv-button"
        onClick={prevPage}
        disabled={currentPage <= 0}
        aria-label={strings.navigation.previousPage}
        title={strings.navigation.previousPage}
      >
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M10 4L6 8l4 4V4z" />
        </svg>
      </button>
      <input
        type="number"
        className="dv-page-input"
        value={currentPage + 1}
        min={1}
        max={pageCount || 1}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val)) goToPage(val - 1);
        }}
        aria-label={strings.navigation.pageInput}
      />
      <span className="dv-page-count">
        / {pageCount}
      </span>
      <button
        className="dv-button"
        onClick={nextPage}
        disabled={currentPage >= pageCount - 1}
        aria-label={strings.navigation.nextPage}
        title={strings.navigation.nextPage}
      >
        <svg viewBox="0 0 16 16" fill="currentColor">
          <path d="M6 4l4 4-4 4V4z" />
        </svg>
      </button>
    </div>
  );
}
