import { useCallback } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { AdapterFeatures, SpreadMode } from '../../core/types';
import { Icon } from '../common/Icon';

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5];

export function ToolbarZoom({ features }: { features?: AdapterFeatures }) {
  const strings = useStrings();
  const zoom = useViewerStore((s) => s.zoom);
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const setZoom = useViewerStore((s) => s.setZoom);
  const fitMode = useViewerStore((s) => s.fitMode);
  const setFitMode = useViewerStore((s) => s.setFitMode);
  const cursorMode = useViewerStore((s) => s.cursorMode);
  const setCursorMode = useViewerStore((s) => s.setCursorMode);

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
    <div className="dv-toolbar-group dv-toolbar-zoom">
      {features?.zoom !== false && (
        <>
          <button
            className="dv-button dv-toolbar-zoom-step"
            onClick={zoomOut}
            aria-label={strings.toolbar.zoomOut}
            title={strings.toolbar.zoomOut}
          >
            <Icon name="zoom-out" />
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
            className="dv-button dv-toolbar-zoom-step"
            onClick={zoomIn}
            aria-label={strings.toolbar.zoomIn}
            title={strings.toolbar.zoomIn}
          >
            <Icon name="zoom-in" />
          </button>
          <button
            className="dv-button dv-toolbar-marquee"
            onClick={() =>
              setCursorMode(cursorMode === 'marquee' ? 'select' : 'marquee')
            }
            aria-pressed={cursorMode === 'marquee'}
            data-toggled={cursorMode === 'marquee'}
            aria-label="Marquee zoom"
            title="Marquee zoom - drag a box to zoom in"
          >
            <Icon name="marquee" />
          </button>
        </>
      )}
    </div>
  );
}

/** Page orientation and spread layout: secondary, so it can fold into "More". */
export function ToolbarView({ features }: { features?: AdapterFeatures }) {
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
          <button
            className="dv-button"
            onClick={rotateCounterClockwise}
            aria-label={strings.toolbar.rotateCounterClockwise}
            title={strings.toolbar.rotateCounterClockwise}
          >
            <Icon name="rotate-ccw" />
          </button>
          <button
            className="dv-button"
            onClick={rotateClockwise}
            aria-label={strings.toolbar.rotateClockwise}
            title={strings.toolbar.rotateClockwise}
          >
            <Icon name="rotate-cw" />
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
