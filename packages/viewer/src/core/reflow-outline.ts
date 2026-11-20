const CHARS_PER_LINE = 80;
const LINE_HEIGHT = 24;

const offsetFor = (chars: number) => Math.ceil(chars / CHARS_PER_LINE) * LINE_HEIGHT;

export function headingScrollOffset(doc: Document, heading: Element): number {
  return headingScrollOffsets(doc, [heading])[0]!;
}

/** Offsets for many headings (in document order) in one pass over the text, instead of one range per heading. */
export function headingScrollOffsets(doc: Document, headings: readonly Element[]): number[] {
  if (!doc.body || headings.length === 0) return headings.map(() => 0);
  const out: number[] = [];
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let chars = 0;
  let next = 0;
  for (let node: Node | null = walker.currentNode; node && next < headings.length; node = walker.nextNode()) {
    if (node === headings[next]) {
      out.push(offsetFor(chars));
      next++;
    } else if (node.nodeType === Node.TEXT_NODE) {
      chars += (node as Text).data.length;
    }
  }
  while (out.length < headings.length) out.push(offsetFor(chars));
  return out;
}
