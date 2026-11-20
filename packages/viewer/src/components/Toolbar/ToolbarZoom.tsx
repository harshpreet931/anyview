import { useViewerStore } from '../../hooks/useDocViewer';
import { useStrings } from '../../i18n/I18nProvider';
import type { ViewerStrings } from '../../i18n/types';
import type { AdapterFeatures, FitMode } from '../../core/types';
import { IconButton } from './IconButton';

const ZOOM_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 5];

const FIT_OPTIONS: ReadonlyArray<{
  value: string;
  fitMode: FitMode;
  labelKey: keyof ViewerStrings['toolbar'];
}> = [
  { value: 'fit-page', fitMode: 'page-fit', labelKey: 'fitPage' },
  { value: 'fit-width', fitMode: 'page-width', labelKey: 'fitWidth' },
  { value: 'actual', fitMode: 'actual-size', labelKey: 'actualSize' },
];

export function ToolbarZoom({ features }: { features?: AdapterFeatures | undefined }) {
  const strings = useStrings();
  const zoom = useViewerStore((s) => s.zoom);
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const setZoom = useViewerStore((s) => s.setZoom);
  const fitMode = useViewerStore((s) => s.fitMode);
  const setFitMode = useViewerStore((s) => s.setFitMode);
  const cursorMode = useViewerStore((s) => s.cursorMode);
  const setCursorMode = useViewerStore((s) => s.setCursorMode);

  const matchedPreset = ZOOM_PRESETS.find((p) => Math.abs(p - zoom) < 0.005);
  const zoomValue =
    FIT_OPTIONS.find((o) => o.fitMode === fitMode)?.value ??
    (matchedPreset !== undefined ? String(matchedPreset) : 'live');

  const handleZoomSelect = (value: string) => {
    const fit = FIT_OPTIONS.find((o) => o.value === value);
    if (fit) setFitMode(fit.fitMode);
    else if (value !== 'live') setZoom(parseFloat(value));
  };

  return (
    <div className="dv-toolbar-group dv-toolbar-zoom">
      {features?.zoom !== false && (
        <>
          <IconButton
            icon="zoom-out"
            label={strings.toolbar.zoomOut}
            className="dv-toolbar-zoom-step"
            onClick={zoomOut}
          />
          <select
            className="dv-zoom-select"
            value={zoomValue}
            onChange={(e) => handleZoomSelect(e.target.value)}
            aria-label={strings.toolbar.zoomLevel}
          >
            {zoomValue === 'live' && <option value="live">{Math.round(zoom * 100)}%</option>}
            <optgroup label={strings.toolbar.fitGroup}>
              {FIT_OPTIONS.map(({ value, labelKey }) => (
                <option key={value} value={value}>
                  {strings.toolbar[labelKey]}
                </option>
              ))}
            </optgroup>
            {ZOOM_PRESETS.map((preset) => (
              <option key={preset} value={String(preset)}>
                {`${Math.round(preset * 100)}%`}
              </option>
            ))}
          </select>
          <IconButton
            icon="zoom-in"
            label={strings.toolbar.zoomIn}
            className="dv-toolbar-zoom-step"
            onClick={zoomIn}
          />
          <IconButton
            icon="marquee"
            label={strings.toolbar.marqueeZoom}
            title={strings.toolbar.marqueeZoomHint}
            className="dv-toolbar-marquee"
            onClick={() => setCursorMode(cursorMode === 'marquee' ? 'select' : 'marquee')}
            aria-pressed={cursorMode === 'marquee'}
            data-toggled={cursorMode === 'marquee'}
          />
        </>
      )}
    </div>
  );
}
