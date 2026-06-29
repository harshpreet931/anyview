/* ============================================================
 * Shared HTML sanitizer.
 *
 * Loads DOMPurify and registers (once) a hook that strips dangerous CSS from
 * `style` attributes. DOMPurify allows the `style` attribute but does not parse
 * its value, so `style="background:url(http://attacker/x)"` in a document would
 * fire a zero-click request - exfiltrating that the document was opened and
 * probing internal hosts. We drop any style carrying an external/relative
 * `url()`, `@import`, or `expression()`, while keeping inline `data:`/fragment
 * references that can't reach the network.
 *
 * It also forces `rel="noopener noreferrer"` on any `target="_blank"` link so a
 * document can't reverse-tabnab the host page through `window.opener`, and it
 * strips image sources that would reach the network: an `<img src="http://...">`
 * (or SVG `<image href>`) auto-fetches on open, leaking that the document was
 * viewed and probing internal hosts. Only inline `data:`/fragment images load.
 * ============================================================ */

type Sanitizer = {
  sanitize: (dirty: string, config?: Record<string, unknown>) => string;
  addHook: (entry: string, cb: (node: unknown) => void) => void;
};

type MutableEl = {
  tagName?: string;
  getAttribute?: (name: string) => string | null;
  setAttribute?: (name: string, value: string) => void;
  removeAttribute?: (name: string) => void;
};

let hookRegistered = false;

// An image reference that can't reach the network: inline data: or a fragment.
function isInlineRef(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith('data:') || u.startsWith('#');
}

function hasNetworkCss(style: string): boolean {
  if (/@import/i.test(style) || /expression\s*\(/i.test(style)) return true;
  const urlRe = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
  for (let m = urlRe.exec(style); m; m = urlRe.exec(style)) {
    const target = m[2]!.trim().toLowerCase();
    // data: URIs and in-document fragments can't reach the network; anything
    // else (http(s):, protocol-relative, absolute/relative paths) can.
    if (!target.startsWith('data:') && !target.startsWith('#')) return true;
  }
  return false;
}

/** Load DOMPurify with the style-attribute CSS guard installed. */
export async function loadSanitizer(): Promise<Sanitizer> {
  const DOMPurify = (await import('dompurify')).default as unknown as Sanitizer;
  if (!hookRegistered) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      const el = node as MutableEl;
      const style = el.getAttribute?.('style');
      if (style && hasNetworkCss(style)) el.removeAttribute?.('style');
      if (el.tagName === 'A' && el.getAttribute?.('target') === '_blank') {
        el.setAttribute?.('rel', 'noopener noreferrer');
      }
      const tag = el.tagName?.toLowerCase();
      if (tag === 'img') {
        const src = el.getAttribute?.('src');
        if (src && !isInlineRef(src)) el.removeAttribute?.('src');
      } else if (tag === 'image') {
        // SVG <image> can load via href or the legacy xlink:href.
        for (const attr of ['href', 'xlink:href']) {
          const v = el.getAttribute?.(attr);
          if (v && !isInlineRef(v)) el.removeAttribute?.(attr);
        }
      }
    });
    hookRegistered = true;
  }
  return DOMPurify;
}
