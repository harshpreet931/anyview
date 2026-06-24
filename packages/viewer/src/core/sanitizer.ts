/* ============================================================
 * Shared HTML sanitizer.
 *
 * Loads DOMPurify and registers (once) a hook that strips dangerous CSS from
 * `style` attributes. DOMPurify allows the `style` attribute but does not parse
 * its value, so `style="background:url(http://attacker/x)"` in a document would
 * fire a zero-click request — exfiltrating that the document was opened and
 * probing internal hosts. We drop any style carrying an external/relative
 * `url()`, `@import`, or `expression()`, while keeping inline `data:`/fragment
 * references that can't reach the network.
 * ============================================================ */

type Sanitizer = {
  sanitize: (dirty: string, config?: Record<string, unknown>) => string;
  addHook: (entry: string, cb: (node: unknown) => void) => void;
};

let hookRegistered = false;

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
      const el = node as { getAttribute?: (n: string) => string | null; removeAttribute?: (n: string) => void };
      const style = el.getAttribute?.('style');
      if (style && hasNetworkCss(style)) el.removeAttribute?.('style');
    });
    hookRegistered = true;
  }
  return DOMPurify;
}
