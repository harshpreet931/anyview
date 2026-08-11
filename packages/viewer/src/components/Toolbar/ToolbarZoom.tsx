import { useCallback } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { AdapterFeatures, SpreadMode } from '../../core/types';

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5];

export function ToolbarZoom({ features }: { features?: AdapterFeatures }) {
  const strings = useStrings();
  const zoom = useViewerStore((s) => s.zoom);
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const setZoom = useViewerStore((s) => s.setZoom);
  const fitMode = useViewerStore((s) => s.fitMode);
  const setFitMode = useViewerStore((s) => s.setFitMode);
  const spreadMode = useViewerStore((s) => s.spreadMode);
  const setSpreadMode = useViewerStore((s) => s.setSpreadMode);
  const cursorMode = useViewerStore((s) => s.cursorMode);
  const setCursorMode = useViewerStore((s) => s.setCursorMode);
  const rotateClockwise = useViewerStore((s) => s.rotateClockwise);
  const rotateCounterClockwise = useViewerStore((s) => s.rotateCounterClockwise);
  const pageCount = useViewerStore((s) => s.document?.pageCount ?? 0);

  const zoomPct = Math.round(zoom * 100);
  const matchedPreset = ZOOM_PRESETS.find((p) => Math.abs(p - zoom) < 0.005);
  const zoomValue =
    fitMode === 'page-fit'
      ? 'fit-page'
      : fitMode === 'page-width'
        ? 'fit-width'
        : fitMode === 'actual-size'
          ? 'actual'
          : matchedPreset !== undefined
            ? String(matchedPreset)
            : 'live';

  const handleZoomSelect = useCallback(
    (value: string) => {
      if (value === 'fit-page') setFitMode('page-fit');
      else if (value === 'fit-width') setFitMode('page-width');
      else if (value === 'actual') setFitMode('actual-size');
      else if (value !== 'live') setZoom(parseFloat(value));
    },
    [setFitMode, setZoom],
  );

  return (
    <div className="dv-toolbar-group">
      {features?.zoom !== false && (
        <>
          <button
            className="dv-button"
            onClick={zoomOut}
            aria-label={strings.toolbar.zoomOut}
            title={strings.toolbar.zoomOut}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 7h8v2H4V7z" />
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3z" />
            </svg>
          </button>
          <select
            className="dv-zoom-select"
            value={zoomValue}
            onChange={(e) => handleZoomSelect(e.target.value)}
            aria-label="Zoom level"
          >
            {zoomValue === 'live' && <option value="live">{zoomPct}%</option>}
            <optgroup label="Fit">
              <option value="fit-page">Fit page</option>
              <option value="fit-width">Fit width</option>
              <option value="actual">Actual size</option>
            </optgroup>
            <option value="0.5">50%</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
            <option value="2">200%</option>
            <option value="3">300%</option>
            <option value="5">500%</option>
          </select>
          <button
            className="dv-button"
            onClick={zoomIn}
            aria-label={strings.toolbar.zoomIn}
            title={strings.toolbar.zoomIn}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M7 4h2v3h3v2H9v3H7V9H4V7h3V4z" />
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2a5 5 0 1 1 0 10A5 5 0 0 1 8 3z" />
            </svg>
          </button>
          <button
            className="dv-button"
            onClick={() =>
              setCursorMode(cursorMode === 'marquee' ? 'select' : 'marquee')
            }
            aria-pressed={cursorMode === 'marquee'}
            data-toggled={cursorMode === 'marquee'}
            aria-label="Marquee zoom"
            title="Marquee zoom - drag a box to zoom in"
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
              <rect x="2.5" y="2.5" width="11" height="11" rx="1" strokeDasharray="2.5 1.8" />
              <path d="M6 8h4M8 6v4" strokeLinecap="round" />
            </svg>
          </button>
        </>
      )}

      {features?.rotation && (
        <>
          <button
            className="dv-button"
            onClick={rotateCounterClockwise}
            aria-label={strings.toolbar.rotateCounterClockwise}
            title={strings.toolbar.rotateCounterClockwise}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 1 1-5 5H1a7 7 0 1 0 7-7V0L4 2l4 2V3z" />
            </svg>
          </button>
          <button
            className="dv-button"
            onClick={rotateClockwise}
            aria-label={strings.toolbar.rotateClockwise}
            title={strings.toolbar.rotateClockwise}
          >
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 3a5 5 0 1 0 5 5h2A7 7 0 1 1 8 1V0l4 2-4 2V3z" />
            </svg>
          </button>
        </>
      )}

      {pageCount > 1 && (
        <select
          className="dv-zoom-select"
          value={spreadMode}
          onChange={(e) => setSpreadMode(e.target.value as SpreadMode)}
          aria-label="Page layout"
          title="Page layout"
        >
          <option value="none">Single page</option>
          <option value="even">Two pages</option>
          <option value="odd">Two pages (cover)</option>
        </select>
      )}
    </div>
  );
}
