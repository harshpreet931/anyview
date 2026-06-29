/* ============================================================
 * react-markdown URL transform.
 *
 * react-markdown's default transform allows http(s) image URLs, so a
 * `![](http://attacker/beacon.png)` would auto-fetch on render - leaking that
 * the document was opened. Block image sources that reach the network (only
 * inline data:/fragment images load), and delegate every other URL (links) to
 * react-markdown's default sanitizer so javascript: etc. stays blocked.
 * ============================================================ */

export function makeSafeUrlTransform(
  defaultUrlTransform: (url: string) => string,
): (url: string, key: string) => string {
  return (url, key) => {
    if (key === 'src') {
      return /^\s*(?:data:|#)/i.test(url) ? url : '';
    }
    return defaultUrlTransform(url);
  };
}
