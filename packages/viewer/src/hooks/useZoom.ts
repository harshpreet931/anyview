/* ============================================================
 * useZoom - zoom and fit mode controls
 * ============================================================ */

import { useViewerStore } from './useDocViewer';

export function useZoom() {
  const zoom = useViewerStore((s) => s.zoom);
  const fitMode = useViewerStore((s) => s.fitMode);
  const setZoom = useViewerStore((s) => s.setZoom);
  const zoomIn = useViewerStore((s) => s.zoomIn);
  const zoomOut = useViewerStore((s) => s.zoomOut);
  const setFitMode = useViewerStore((s) => s.setFitMode);

  return { zoom, fitMode, setZoom, zoomIn, zoomOut, setFitMode };
}
