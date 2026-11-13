function decoder(label: string, fatal = false): TextDecoder | null {
  try {
    return new TextDecoder(label, { fatal });
  } catch {
    return null;
  }
}

function charsetOf(mimeType?: string): string | null {
  const m = mimeType?.match(/charset\s*=\s*"?([^";\s]+)/i);
  return m ? m[1] : null;
}

function sniffUtf16(view: Uint8Array): 'utf-16le' | 'utf-16be' | null {
  const n = Math.min(view.length - (view.length % 2), 1024);
  if (n < 4) return null;
  let evenZeros = 0;
  let oddZeros = 0;
  for (let i = 0; i < n; i += 2) {
    if (view[i] === 0) evenZeros++;
    if (view[i + 1] === 0) oddZeros++;
  }
  const pairs = n / 2;
  if (oddZeros > pairs * 0.4 && evenZeros < pairs * 0.05) return 'utf-16le';
  if (evenZeros > pairs * 0.4 && oddZeros < pairs * 0.05) return 'utf-16be';
  return null;
}

/** Decodes text bytes, honouring a BOM, a declared charset, BOM-less UTF-16 and legacy single-byte files. */
export function decodeText(buffer: ArrayBuffer, mimeType?: string): string {
  const view = new Uint8Array(buffer);
  if (view[0] === 0xef && view[1] === 0xbb && view[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(view.subarray(3));
  }
  if (view[0] === 0xff && view[1] === 0xfe) return new TextDecoder('utf-16le').decode(view.subarray(2));
  if (view[0] === 0xfe && view[1] === 0xff) return new TextDecoder('utf-16be').decode(view.subarray(2));

  const declared = charsetOf(mimeType);
  const declaredDecoder = declared ? decoder(declared) : null;
  if (declaredDecoder && declaredDecoder.encoding !== 'utf-8') return declaredDecoder.decode(view);

  const utf16 = sniffUtf16(view);
  if (utf16) return new TextDecoder(utf16).decode(view);

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(view);
  } catch {
    return new TextDecoder('windows-1252').decode(view);
  }
}
