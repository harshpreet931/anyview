import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { AdapterFeatures } from '../../core/types';

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
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M7 1h2v6h3l-4 4-4-4h3V1zM3 13h10v2H3v-2z" />
          </svg>
        </button>
      )}
      {features?.print && (
        <button
          className="dv-button"
          onClick={() => printDocument()}
          aria-label={strings.toolbar.print}
          title={strings.toolbar.print}
        >
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 1h8v3H4V1zM3 5h10a2 2 0 0 1 2 2v4h-3v4H4v-4H1V7a2 2 0 0 1 2-2zm3 6v3h4v-3H6zm6-2.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5z" />
          </svg>
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
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M1 1h5v2H3v3H1V1zm9 0h5v5h-2V3h-3V1zM1 10h2v3h3v2H1v-5zm12 0h2v5h-5v-2h3v-3z" />
          </svg>
        </button>
      )}
      {hasDocument && (
        <button
          className="dv-button"
          onClick={() => setPropertiesOpen(true)}
          aria-label={strings.toolbar.properties}
          title={strings.toolbar.properties}
        >
          <svg viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2.5A1.1 1.1 0 1 1 8 5.7a1.1 1.1 0 0 1 0-2.2zM6.5 7h2.2v4.5H10V13H6v-1.5h1.2V8.5H6.5V7z" />
          </svg>
        </button>
      )}
    </div>
  );
}
