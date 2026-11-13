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

/** Offsets for many headings (in document order) in one pass over the text, instead of one range per heading. */
export function headingScrollOffsets(doc: Document, headings: readonly Element[]): number[] {
  const out: number[] = [];
  if (!doc.body || headings.length === 0) return headings.map(() => 0);
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let chars = 0;
  let next = 0;
  for (let node: Node | null = walker.currentNode; node && next < headings.length; node = walker.nextNode()) {
    if (node === headings[next]) {
      out.push(Math.ceil(chars / CHARS_PER_LINE) * LINE_HEIGHT);
      next++;
    } else if (node.nodeType === Node.TEXT_NODE) {
      chars += (node as Text).data.length;
    }
  }
  while (out.length < headings.length) out.push(Math.ceil(chars / CHARS_PER_LINE) * LINE_HEIGHT);
  return out;
}
