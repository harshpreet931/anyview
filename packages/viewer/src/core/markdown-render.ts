import { makeSafeUrlTransform } from './markdown-url';
import { markSanitized, type SafeHtml } from './safe-html';

export async function loadMarkdownRenderer(): Promise<(markdown: string) => SafeHtml> {
  const [
    React,
    { renderToStaticMarkup },
    { default: ReactMarkdown, defaultUrlTransform },
    { default: remarkGfm },
  ] = await Promise.all([
    import('react'),
    import('react-dom/server'),
    import('react-markdown'),
    import('remark-gfm'),
  ]);
  const urlTransform = makeSafeUrlTransform(defaultUrlTransform);

  // react-markdown has no rehype-raw, so the serializer escapes every span of document text.
  return (markdown) =>
    markSanitized(
      renderToStaticMarkup(
        React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], urlTransform }, markdown),
      ),
    );
}

export const MARKDOWN_PIECE_CHARS = 16 * 1024;

const FENCE = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/;
// A piece starts with a paragraph, fence, table or quote: blocks with no top margin. Not a heading, rule, list,
// definition or raw HTML.
const PIECE_START = /^[^\s#<_=*+\-[]/;
const ORDERED_ITEM = /^\d{1,9}[.)](?:[ \t]|$)/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;
const DEFINITION = /^ {0,3}\[(?:[^\]\\]|\\.)+\]:[ \t]*\S/;
const FOOTNOTE = /^[ \t>]*\[\^[^\]]+\]:/m;
const HTML_BLOCKS: ReadonlyArray<readonly [RegExp, RegExp]> = [
  [/^ {0,3}<(?:script|pre|style|textarea)(?:[\s>]|$)/i, /<\/(?:script|pre|style|textarea)>/i],
  [/^ {0,3}<!--/, /-->/],
  [/^ {0,3}<\?/, /\?>/],
  [/^ {0,3}<![A-Za-z]/, />/],
  [/^ {0,3}<!\[CDATA\[/, /\]\]>/],
];

/**
 * Splits Markdown into pieces of about `size` characters that each render exactly as they do in place: only at a
 * blank line before an unindented block, outside fenced code and raw HTML. Link reference definitions are repeated
 * in every piece; a document with footnotes, which are numbered across it, stays whole.
 */
export function markdownPieces(markdown: string, size = MARKDOWN_PIECE_CHARS): string[] {
  if (markdown.length <= size || FOOTNOTE.test(markdown)) return [markdown];
  const lines = markdown.split('\n');
  const pieces: string[] = [];
  const definitions: string[] = [];
  let start = 0;
  let chars = 0;
  let fence: { char: string; length: number } | null = null;
  let htmlEnd: RegExp | null = null;
  let blank = true;
  let definitionMayStart = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let isDefinition = false;
    if (fence) {
      const close = FENCE.exec(line);
      if (close && close[1]![0] === fence.char && close[1]!.length >= fence.length && !line.slice(close[0].length).trim()) {
        fence = null;
      }
    } else if (htmlEnd) {
      if (htmlEnd.test(line)) htmlEnd = null;
    } else {
      if (blank && chars >= size && PIECE_START.test(line) && !ORDERED_ITEM.test(line) && !SETEXT_UNDERLINE.test(lines[i + 1] ?? '')) {
        pieces.push(lines.slice(start, i).join('\n'));
        start = i;
        chars = 0;
      }
      const open = FENCE.exec(line);
      const html = open ? undefined : HTML_BLOCKS.find(([begin]) => begin.test(line));
      if (open) fence = { char: open[1]![0]!, length: open[1]!.length };
      else if (html && !html[1].test(line.replace(html[0], ''))) htmlEnd = html[1];
      else if (definitionMayStart && DEFINITION.test(line)) {
        definitions.push(line.trim());
        isDefinition = true;
      }
    }
    blank = !line.trim();
    definitionMayStart = blank || isDefinition;
    chars += line.length + 1;
  }
  pieces.push(lines.slice(start).join('\n'));
  if (definitions.length === 0 || pieces.length === 1) return pieces;
  const shared = `${definitions.join('\n')}\n\n`;
  return pieces.map((piece) => shared + piece);
}
