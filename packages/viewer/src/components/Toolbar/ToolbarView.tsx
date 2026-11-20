import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { AdapterFeatures, SpreadMode } from '../../core/types';
import { IconButton } from './IconButton';

/** Page orientation and spread layout: secondary, so it can fold into "More". */
export function ToolbarView({ features }: { features?: AdapterFeatures | undefined }) {
  const strings = useStrings();
  const spreadMode = useViewerStore((s) => s.spreadMode);
  const setSpreadMode = useViewerStore((s) => s.setSpreadMode);
  const rotateClockwise = useViewerStore((s) => s.rotateClockwise);
  const rotateCounterClockwise = useViewerStore((s) => s.rotateCounterClockwise);
  const pageCount = useViewerStore((s) => s.document?.pageCount ?? 0);

  if (!features?.rotation && pageCount <= 1) return null;

  return (
    <div className="dv-toolbar-group dv-toolbar-view">
      {features?.rotation && (
        <>
          <IconButton
            icon="rotate-ccw"
            label={strings.toolbar.rotateCounterClockwise}
            onClick={rotateCounterClockwise}
          />
          <IconButton icon="rotate-cw" label={strings.toolbar.rotateClockwise} onClick={rotateClockwise} />
        </>
      )}

      {pageCount > 1 && (
        <select
          className="dv-zoom-select"
          value={spreadMode}
          onChange={(e) => setSpreadMode(e.target.value as SpreadMode)}
          aria-label={strings.toolbar.pageLayout}
          title={strings.toolbar.pageLayout}
        >
          <option value="none">{strings.toolbar.singlePage}</option>
          <option value="even">{strings.toolbar.twoPages}</option>
          <option value="odd">{strings.toolbar.twoPagesCover}</option>
        </select>
      )}
    </div>
  );
}
