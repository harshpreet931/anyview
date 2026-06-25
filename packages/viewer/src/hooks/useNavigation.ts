/* ============================================================
 * useNavigation - page navigation controls
 * ============================================================ */

import { useViewerStore } from './useDocViewer';

export function useNavigation() {
  const currentPage = useViewerStore((s) => s.currentPage);
  const pageCount = useViewerStore((s) => s.document?.pageCount ?? 0);
  const goToPage = useViewerStore((s) => s.goToPage);
  const nextPage = useViewerStore((s) => s.nextPage);
  const prevPage = useViewerStore((s) => s.prevPage);
  const firstPage = useViewerStore((s) => s.firstPage);
  const lastPage = useViewerStore((s) => s.lastPage);

  return {
    currentPage,
    pageCount,
    totalPages: pageCount,
    goToPage,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
  };
}
