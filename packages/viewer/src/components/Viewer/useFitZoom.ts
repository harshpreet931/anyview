import { useEffect, type RefObject } from 'react';
import { useViewerStore } from '../../hooks/useDocViewer';
import { displayedPageSize } from '../../core/rotation';
import { PAGE_GAP, PAGE_SPREAD_GAP } from './layout';

const FIXED_PAGE_FORMATS = new Set(['pdf', 'image', 'pptx']);

export function useFitZoom(scrollRef: RefObject<HTMLElement | null>): void {
  const document = useViewerStore((s) => s.document);
  const rotation = useViewerStore((s) => s.rotation);
  const spreadMode = useViewerStore((s) => s.spreadMode);
  const isHorizontal = useViewerStore((s) => s.scrollMode === 'horizontal');
  const fitMode = useViewerStore((s) => s.fitMode);
  const applyFitZoom = useViewerStore((s) => s._applyFitZoom);

  useEffect(() => {
    if (fitMode === 'custom') return;
    const el = scrollRef.current;
    const page = document?.pages[0];
    if (!el || !document || !page) return;

    const recompute = () => {
      const { width: pw, height: ph } = displayedPageSize(page.width, page.height, page.rotation, rotation, 1);
      const cols = spreadMode !== 'none' && !isHorizontal ? 2 : 1;
      const rowWidth = cols * pw + (cols - 1) * PAGE_SPREAD_GAP;
      const availW = el.clientWidth - PAGE_GAP;
      const availH = el.clientHeight - PAGE_GAP;
      if (availW <= 0 || availH <= 0 || rowWidth <= 0 || ph <= 0) return;
      const flowing = !FIXED_PAGE_FORMATS.has(document.format);
      let z = 1;
      if (fitMode === 'page-width' || (fitMode === 'page-fit' && flowing)) z = availW / rowWidth;
      else if (fitMode === 'page-fit') z = Math.min(availW / rowWidth, availH / ph);
      if (Number.isFinite(z) && z > 0) applyFitZoom(z);
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef, fitMode, document, rotation, spreadMode, isHorizontal, applyFitZoom]);
}
