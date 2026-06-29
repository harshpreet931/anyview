import { describe, it, expect } from 'vitest';
import { loadSanitizer } from './sanitizer';

describe('sanitizer', () => {
  it('strips image sources that would reach the network', async () => {
    const DOMPurify = await loadSanitizer();
    const out = DOMPurify.sanitize('<img src="http://attacker.example/beacon.png">', {
      ALLOWED_TAGS: ['img'],
      ALLOWED_ATTR: ['src'],
    });
    expect(out).not.toContain('http://attacker.example');
    expect(out.toLowerCase()).not.toContain('src=');
  });

  it('keeps inline data: images', async () => {
    const DOMPurify = await loadSanitizer();
    const data = 'data:image/png;base64,iVBORw0KGgo=';
    const out = DOMPurify.sanitize(`<img src="${data}">`, {
      ALLOWED_TAGS: ['img'],
      ALLOWED_ATTR: ['src'],
    });
    expect(out).toContain(data);
  });

  it('drops style attributes carrying a network url()', async () => {
    const DOMPurify = await loadSanitizer();
    const out = DOMPurify.sanitize(
      '<div style="background:url(http://attacker.example/x)">hi</div>',
      { ALLOWED_TAGS: ['div'], ALLOWED_ATTR: ['style'] },
    );
    expect(out).not.toContain('attacker.example');
  });
});
