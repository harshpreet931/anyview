import { describe, it, expect } from 'vitest';
import { hasNetworkCss } from './sanitizer';

describe('hasNetworkCss', () => {
  it.each([
    'background:url(https://beacon.invalid/a.png)',
    'background:url("https://beacon.invalid/quoted-paren)")',
    "background:url('https://beacon.invalid/x')",
    'background:\\75 rl(https://beacon.invalid/escaped)',
    'background:\\55RL(https://beacon.invalid/escaped-upper)',
    'background-image:image-set("https://beacon.invalid/set.png" 1x)',
    'background-image:-webkit-image-set(url(https://beacon.invalid/w.png) 1x)',
    'background:URL( //beacon.invalid/protocol-relative )',
    '@import "https://beacon.invalid/i.css"',
    'width:expression(alert(1))',
    'background:url(data:image/png;base64,AAAA), url(https://beacon.invalid/second)',
  ])('flags %s', (style) => {
    expect(hasNetworkCss(style)).toBe(true);
  });

  it.each([
    'color:red;font-weight:bold',
    'background:url(data:image/png;base64,iVBORw0KGgo=)',
    'background:url("data:image/svg+xml;utf8,<svg></svg>")',
    'clip-path:url(#shape)',
    'content:"url(not-a-function)"',
    '',
  ])('allows %s', (style) => {
    expect(hasNetworkCss(style)).toBe(false);
  });
});
