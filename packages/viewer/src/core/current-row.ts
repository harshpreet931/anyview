const END_TOLERANCE = 2;

export function rowAtOffset(items: { index: number; start: number }[], offset: number): number {
  let row = items.length > 0 ? items[0].index : 0;
  for (const it of items) {
    if (it.start <= offset + 1) row = it.index;
    else break;
  }
  return row;
}

/**
 * The row to report as current. A last page shorter than the viewport can never
 * bring its top to the top of the scroller, so reaching the end counts as being on it.
 */
export function currentRow(
  items: { index: number; start: number }[],
  offset: number,
  { viewport, total, count }: { viewport: number; total: number; count: number },
): number {
  if (count > 0 && total > viewport && offset + viewport >= total - END_TOLERANCE) return count - 1;
  return rowAtOffset(items, offset);
}
