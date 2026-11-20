import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { AdapterFeatures } from '../../core/types';
import { IconButton } from './IconButton';

export function ToolbarActions({ features }: { features?: AdapterFeatures | undefined }) {
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
        <IconButton icon="download" label={strings.toolbar.download} onClick={() => downloadDocument()} />
      )}
      {features?.print && (
        <IconButton icon="print" label={strings.toolbar.print} onClick={() => printDocument()} />
      )}
      {features?.fullscreen && (
        <IconButton
          icon="fullscreen"
          label={strings.toolbar.fullscreen}
          onClick={() => toggleFullscreen()}
          aria-pressed={isFullscreen}
          data-toggled={isFullscreen}
        />
      )}
      {hasDocument && (
        <IconButton icon="info" label={strings.toolbar.properties} onClick={() => setPropertiesOpen(true)} />
      )}
    </div>
  );
}
