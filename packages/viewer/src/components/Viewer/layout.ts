import type { FormatId, PageRef } from '../../core/types';
import { displayedPageSize, type Rotation } from '../../core/rotation';

/** Space between two pages along the scroll axis: the page's margin on both sides. */
export const PAGE_GAP = 48;
export const PAGE_SPREAD_GAP = 16;

const FALLBACK_PAGE_SIZE = 400;

/** A portrait A4 sheet: a flowing page is never shorter, so a short document still reads as a page. */
const PAPER_RATIO = Math.SQRT2;

/** Whether the format's pages have a size of their own, rather than flowing to the height of their content. */
export function isFixedPageFormat(format: FormatId | undefined): boolean {
  return format === 'pdf' || format === 'image' || format === 'pptx';
}

/** The height of a sheet of paper as wide as the page. */
export function paperHeight(page: PageRef, rotation: Rotation, zoom: number): number {
  return displayedPageSize(page.width, page.height, page.rotation, rotation, zoom).width * PAPER_RATIO;
}

/**
 * A page's box on screen, in whole pixels. The virtualizer rounds the sizes it measures,
 * so a fractional box would never match its estimate and every first measurement would move the scroll.
 * A flowing page is at least a sheet of paper tall.
 */
export function pageBox(
  page: PageRef,
  rotation: Rotation,
  zoom: number,
  flowing = false,
): { width: number; height: number } {
  const { width, height } = displayedPageSize(page.width, page.height, page.rotation, rotation, zoom);
  const paper = flowing ? paperHeight(page, rotation, zoom) : 0;
  return { width: Math.round(width), height: Math.round(Math.max(height, paper)) };
}

/** The size of one row of pages along the scroll axis, gap included. */
export function rowSize(
  pages: ReadonlyArray<PageRef> | undefined,
  row: ReadonlyArray<number> | undefined,
  rotation: Rotation,
  zoom: number,
  horizontal: boolean,
  flowing = false,
): number {
  let main = 0;
  for (const index of row ?? []) {
    const page = pages?.[index];
    if (!page) continue;
    const box = pageBox(page, rotation, zoom, flowing);
    main = Math.max(main, horizontal ? box.width : box.height);
  }
  return (main || FALLBACK_PAGE_SIZE) + PAGE_GAP;
}
