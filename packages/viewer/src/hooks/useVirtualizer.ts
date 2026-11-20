import { type RefObject } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useViewerStore } from './useDocViewer';
import { displayedPageSize } from '../core/rotation';

export function useVirtualizerHook(
  scrollRef: RefObject<HTMLDivElement | null>,
) {
  const doc = useViewerStore((s) => s.document);
  const zoom = useViewerStore((s) => s.zoom);
  const rotation = useViewerStore((s) => s.rotation);
  const scrollMode = useViewerStore((s) => s.scrollMode);

  const pageCount = doc?.pages.length ?? 0;

  const virtualizer = useVirtualizer({
    count: pageCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: (index) => {
      const page = doc?.pages[index];
      if (!page) return 400;
      const size = displayedPageSize(page.width, page.height, page.rotation, rotation, zoom);
      return scrollMode === 'horizontal' ? size.width : size.height;
    },
    overscan: 2,
    horizontal: scrollMode === 'horizontal',
  });

  return { virtualizer, pageCount };
}
