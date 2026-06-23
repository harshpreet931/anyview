/* ============================================================
 * useDocument — subscribe to document state
 * ============================================================ */

import { useViewerStore } from './useDocViewer';

export function useDocument() {
  const document = useViewerStore((s) => s.document);
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);

  return { document, loadState, loadError };
}
