import { describe, expect, it } from 'vitest';
import { LineIndex, mountLines } from './lines';

describe('LineIndex', () => {
  it('splits the text into lines like split("\\n"), without carriage returns', () => {
    const text = 'one\r\ntwo\n\nthree\n';
    const lines = new LineIndex(text);
    expect(lines.count).toBe(5);
    expect(Array.from({ length: lines.count }, (_, i) => lines.line(i))).toEqual(['one', 'two', '', 'three', '']);
  });

  it('measures the widest line in columns, with tabs expanded to the next stop of 4', () => {
    expect(new LineIndex('ab\n\tx\nabcdef').columns).toBe(6);
    expect(new LineIndex('a\tb\n\t\tx').columns).toBe(9);
  });

  it('indexes half a million lines quickly', () => {
    const text = Array.from({ length: 500_000 }, (_, i) => `2026-11-20 INFO request ${i} handled`).join('\n');
    const t0 = performance.now();
    const lines = new LineIndex(text);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(lines.count).toBe(500_000);
    expect(lines.line(499_999)).toBe('2026-11-20 INFO request 499999 handled');
  });
});

describe('mountLines', () => {
  it('renders each line as one unit that never wraps', () => {
    const pre = document.createElement('pre');
    document.body.appendChild(pre);
    const lines = new LineIndex('alpha\n\tbeta');
    mountLines(pre, lines.count, (i) => lines.line(i), new AbortController().signal);
    const units = pre.querySelectorAll<HTMLElement>('[data-dv-unit]');
    expect(Array.from(units, (u) => [u.dataset.dvUnit, u.textContent])).toEqual([
      ['0', 'alpha'],
      ['1', '\tbeta'],
    ]);
    expect(units[0]!.classList.contains('dv-line')).toBe(true);
    pre.remove();
  });
});
