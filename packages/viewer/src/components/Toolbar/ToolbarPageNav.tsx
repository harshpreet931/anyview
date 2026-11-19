import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import { Icon } from '../common/Icon';

export function ToolbarPageNav() {
  const strings = useStrings();
  const currentPage = useViewerStore((s) => s.currentPage);
  const pageCount = useViewerStore((s) => s.document?.pageCount ?? 0);
  const goToPage = useViewerStore((s) => s.goToPage);
  const nextPage = useViewerStore((s) => s.nextPage);
  const prevPage = useViewerStore((s) => s.prevPage);
  const empty = pageCount === 0;

  return (
    <div className="dv-toolbar-group dv-toolbar-page-nav">
      <button
        className="dv-button"
        onClick={prevPage}
        disabled={currentPage <= 0}
        aria-label={strings.navigation.previousPage}
        title={strings.navigation.previousPage}
      >
        <Icon name="chevron-left" />
      </button>
      <input
        type="number"
        className="dv-page-input"
        value={empty ? '' : currentPage + 1}
        placeholder={empty ? '–' : undefined}
        disabled={empty}
        min={1}
        max={pageCount || 1}
        onChange={(e) => {
          const val = parseInt(e.target.value, 10);
          if (!isNaN(val)) goToPage(val - 1);
        }}
        aria-label={strings.navigation.pageInput}
      />
      <span className="dv-page-count">
        / {empty ? '–' : pageCount}
      </span>
      <button
        className="dv-button"
        onClick={nextPage}
        disabled={currentPage >= pageCount - 1}
        aria-label={strings.navigation.nextPage}
        title={strings.navigation.nextPage}
      >
        <Icon name="chevron-right" />
      </button>
    </div>
  );
}
