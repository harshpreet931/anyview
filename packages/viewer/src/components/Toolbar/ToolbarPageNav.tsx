import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import { IconButton } from './IconButton';

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
      <IconButton
        icon="chevron-left"
        label={strings.navigation.previousPage}
        onClick={prevPage}
        disabled={currentPage <= 0}
      />
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
      <IconButton
        icon="chevron-right"
        label={strings.navigation.nextPage}
        onClick={nextPage}
        disabled={currentPage >= pageCount - 1}
      />
    </div>
  );
}
