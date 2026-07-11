// Image srcs reaching the network auto-fetch on render, leaking that the doc was opened; allow only inline data:/# refs.
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
