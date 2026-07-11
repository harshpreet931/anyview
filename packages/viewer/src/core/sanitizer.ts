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

function isInlineRef(url: string): boolean {
  const u = url.trim().toLowerCase();
  return u.startsWith('data:') || u.startsWith('#');
}

function hasNetworkCss(style: string): boolean {
  if (/@import/i.test(style) || /expression\s*\(/i.test(style)) return true;
  const urlRe = /url\(\s*(['"]?)([^'")]*)\1\s*\)/gi;
  for (let m = urlRe.exec(style); m; m = urlRe.exec(style)) {
    const target = m[2]!.trim().toLowerCase();
    // Only data: URIs and #fragments can't reach the network; everything else can.
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
