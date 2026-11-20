import { describe, it, expect } from 'vitest';
import { revealMatch } from './reveal-match';

const rect = (top: number, height: number) => ({ top, height, left: 0, width: 10, bottom: top + height, right: 10, x: 0, y: top }) as DOMRect;

describe('revealMatch', () => {
  it('centres the matched text, not the element that holds it', () => {
    const container = document.createElement('div');
    container.className = 'dv-viewer-container';
    const pre = document.createElement('pre');
    pre.textContent = 'a\n'.repeat(1000) + 'NEEDLE';
    container.appendChild(pre);
    document.body.appendChild(container);
    container.getBoundingClientRect = () => rect(0, 500);
    pre.getBoundingClientRect = () => rect(0, 20_000);
    const range = document.createRange();
    const text = pre.firstChild as Text;
    range.setStart(text, 2000);
    range.setEnd(text, 2006);
    range.getBoundingClientRect = () => rect(19_990, 10);
    let top = -1;
    container.scrollTo = ((opts: ScrollToOptions) => {
      top = opts.top!;
    }) as typeof container.scrollTo;

    revealMatch(range, 1);
    expect(top).toBe(19_990 - (500 - 10) / 2);
    container.remove();
  });
});

