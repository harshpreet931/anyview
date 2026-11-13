import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { AdapterFeatures } from '../../core/types';
import { Icon } from '../common/Icon';

export function ToolbarActions({ features }: { features?: AdapterFeatures }) {
  const strings = useStrings();
  const downloadDocument = useViewerStore((s) => s.downloadDocument);
  const printDocument = useViewerStore((s) => s.printDocument);
  const toggleFullscreen = useViewerStore((s) => s.toggleFullscreen);
  const isFullscreen = useViewerStore((s) => s.isFullscreen);
  const setPropertiesOpen = useViewerStore((s) => s.setPropertiesOpen);
  const hasDocument = useViewerStore((s) => s.document !== null);

  if (!features?.download && !features?.print && !features?.fullscreen && !hasDocument) {
    return null;
  }

  return (
    <div className="dv-toolbar-group dv-toolbar-actions">
      {features?.download && (
        <button
          className="dv-button"
          onClick={() => downloadDocument()}
          aria-label={strings.toolbar.download}
          title={strings.toolbar.download}
        >
          <Icon name="download" />
        </button>
      )}
      {features?.print && (
        <button
          className="dv-button"
          onClick={() => printDocument()}
          aria-label={strings.toolbar.print}
          title={strings.toolbar.print}
        >
          <Icon name="print" />
        </button>
      )}
      {features?.fullscreen && (
        <button
          className="dv-button"
          onClick={() => toggleFullscreen()}
          aria-pressed={isFullscreen}
          data-toggled={isFullscreen}
          aria-label={strings.toolbar.fullscreen}
          title={strings.toolbar.fullscreen}
        >
          <Icon name="fullscreen" />
        </button>
      )}
      {hasDocument && (
        <button
          className="dv-button"
          onClick={() => setPropertiesOpen(true)}
          aria-label={strings.toolbar.properties}
          title={strings.toolbar.properties}
        >
          <Icon name="info" />
        </button>
      )}
    </div>
  );
}
