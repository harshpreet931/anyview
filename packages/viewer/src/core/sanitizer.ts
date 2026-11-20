import type { Config, DOMPurify } from 'dompurify';

export type Sanitizer = DOMPurify;

export const DOCUMENT_HTML_CONFIG = {
  ALLOWED_TAGS: [
    'a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo',
    'blockquote', 'br', 'caption', 'cite', 'code', 'col', 'colgroup',
    'data', 'dd', 'del', 'details', 'dfn', 'div', 'dl', 'dt', 'em',
    'figcaption', 'figure', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5',
    'h6', 'header', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'main', 'mark',
    'nav', 'ol', 'p', 'pre', 'q', 'rp', 'rt', 'ruby', 's', 'samp',
    'section', 'small', 'span', 'strong', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
    'var', 'wbr',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'alt', 'title', 'class', 'id', 'style', 'width',
    'height', 'colspan', 'rowspan', 'target', 'rel', 'border', 'data-*',
  ],
  ALLOW_DATA_ATTR: true,
  SANITIZE_NAMED_PROPS: true,
} satisfies Config;

const NAMED_PROP_PREFIX = 'user-content-';

let hookRegistered = false;

export function isInlineRef(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith('data:') || u.startsWith('#');
}

function decodeCssEscapes(css: string): string {
  return css
    .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16) || 0xfffd))
    .replace(/\\(.)/g, '$1');
}

function readUrlArgument(css: string, from: number): string {
  let i = from;
  while (/\s/.test(css[i] ?? '')) i++;
  const quote = css[i];
  if (quote === '"' || quote === "'") {
    const close = css.indexOf(quote, i + 1);
    return css.slice(i + 1, close === -1 ? css.length : close);
  }
  const close = css.indexOf(')', i);
  return css.slice(i, close === -1 ? css.length : close);
}

const NETWORK_FUNCTIONS = /^(?:-webkit-image-set|image-set|image|cross-fade|expression)\(/i;

export function hasNetworkCss(style: string): boolean {
  const css = decodeCssEscapes(style).replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === '"' || ch === "'") {
      const close = css.indexOf(ch, i + 1);
      if (close === -1) break;
      i = close;
      continue;
    }
    if (i > 0 && /[\w-]/.test(css[i - 1]!)) continue;
    const rest = css.slice(i, i + 20);
    if (/^@import/i.test(rest) || NETWORK_FUNCTIONS.test(rest)) return true;
    if (/^url\(/i.test(rest)) {
      if (!isInlineRef(readUrlArgument(css, i + 4))) return true;
    }
  }
  return false;
}

function stripNetworkStyle(el: Element): void {
  const style = el.getAttribute('style');
  if (style && hasNetworkCss(style)) el.removeAttribute('style');
}

function scopeFragmentHref(el: Element): void {
  const href = el.getAttribute('href');
  if (
    el.tagName === 'A' &&
    href &&
    href.length > 1 &&
    href.startsWith('#') &&
    !href.startsWith(`#${NAMED_PROP_PREFIX}`)
  ) {
    el.setAttribute('href', `#${NAMED_PROP_PREFIX}${href.slice(1)}`);
  }
}

function hardenBlankTarget(el: Element): void {
  if (el.tagName === 'A' && el.getAttribute('target') === '_blank') {
    el.setAttribute('rel', 'noopener noreferrer');
  }
}

function stripRemoteImageSrc(el: Element): void {
  const tag = el.tagName.toLowerCase();
  if (tag === 'img') {
    const src = el.getAttribute('src');
    if (src && !isInlineRef(src)) el.removeAttribute('src');
  } else if (tag === 'image') {
    // SVG <image> can load via href or the legacy xlink:href.
    for (const attr of ['href', 'xlink:href']) {
      const v = el.getAttribute(attr);
      if (v && !isInlineRef(v)) el.removeAttribute(attr);
    }
  }
}

/** Load DOMPurify with the style-attribute CSS guard installed. */
export async function loadSanitizer(): Promise<Sanitizer> {
  const DOMPurify = (await import('dompurify')).default;
  if (!hookRegistered) {
    DOMPurify.addHook('afterSanitizeAttributes', (el) => {
      stripNetworkStyle(el);
      scopeFragmentHref(el);
      hardenBlankTarget(el);
      stripRemoteImageSrc(el);
    });
    hookRegistered = true;
  }
  return DOMPurify;
}
