const CHARS_PER_LINE = 80;
const LINE_HEIGHT = 24;

export function headingScrollOffset(doc: Document, heading: Element): number {
  if (!doc.body) return 0;
  const range = doc.createRange();
  range.setStart(doc.body, 0);
  range.setEndBefore(heading);
  const charsBefore = range.toString().length;
  return Math.ceil(charsBefore / CHARS_PER_LINE) * LINE_HEIGHT;
}
