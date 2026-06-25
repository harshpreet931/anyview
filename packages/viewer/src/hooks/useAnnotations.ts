/* ============================================================
 * useAnnotations - annotation state and controls
 * ============================================================ */

import { useViewerStore } from './useDocViewer';

export function useAnnotations() {
  const annotations = useViewerStore((s) => s.annotations);
  const activeAnnotationTool = useViewerStore((s) => s.activeAnnotationTool);
  const selectedAnnotationId = useViewerStore((s) => s.selectedAnnotationId);
  const addAnnotation = useViewerStore((s) => s.addAnnotation);
  const updateAnnotation = useViewerStore((s) => s.updateAnnotation);
  const deleteAnnotation = useViewerStore((s) => s.deleteAnnotation);
  const selectAnnotation = useViewerStore((s) => s.selectAnnotation);
  const setActiveTool = useViewerStore((s) => s.setActiveTool);

  return {
    annotations,
    activeAnnotationTool,
    selectedAnnotationId,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    selectAnnotation,
    setActiveTool,
  };
}
