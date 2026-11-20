import type { PageRef } from '../../core/types';
import { displayedPageSize, type Rotation } from '../../core/rotation';

/** Space between two pages along the scroll axis: the page's margin on both sides. */
export const PAGE_GAP = 48;
export const PAGE_SPREAD_GAP = 16;

const FALLBACK_PAGE_SIZE = 400;

/**
 * A page's box on screen, in whole pixels. The virtualizer rounds the sizes it measures,
 * so a fractional box would never match its estimate and every first measurement would move the scroll.
 */
export function pageBox(page: PageRef, rotation: Rotation, zoom: number): { width: number; height: number } {
  const { width, height } = displayedPageSize(page.width, page.height, page.rotation, rotation, zoom);
  return { width: Math.round(width), height: Math.round(height) };
}

/** The size of one row of pages along the scroll axis, gap included. */
export function rowSize(
  pages: ReadonlyArray<PageRef> | undefined,
  row: ReadonlyArray<number> | undefined,
  rotation: Rotation,
  zoom: number,
  horizontal: boolean,
): number {
  let main = 0;
  for (const index of row ?? []) {
    const page = pages?.[index];
    if (!page) continue;
    const box = pageBox(page, rotation, zoom);
    main = Math.max(main, horizontal ? box.width : box.height);
  }
  return (main || FALLBACK_PAGE_SIZE) + PAGE_GAP;
}
