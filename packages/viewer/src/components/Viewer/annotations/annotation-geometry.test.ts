import { describe, expect, it } from 'vitest';
import type { Rotation } from '../../../core/rotation';
import { LINE_HIGHLIGHT_HEIGHT, lineHighlightRects, pointsToPath, rotateTransform, toPage, toScreen } from './annotation-geometry';

const turns: Rotation[] = [0, 90, 180, 270];

describe('annotation geometry', () => {
  it('toScreen undoes toPage for every quarter turn', () => {
    const p = { x: 0.25, y: 0.75 };
    for (const turn of turns) expect(toScreen(toPage(p, turn), turn)).toEqual(p);
  });

  it('maps the top-left of the screen to the right corner of the page', () => {
    const corner = { x: 0, y: 0 };
    expect(toPage(corner, 0)).toEqual({ x: 0, y: 0 });
    expect(toPage(corner, 90)).toEqual({ x: 0, y: 1 });
    expect(toPage(corner, 180)).toEqual({ x: 1, y: 1 });
    expect(toPage(corner, 270)).toEqual({ x: 1, y: 0 });
  });

  it('rotates the layer about the matching corner', () => {
    expect(rotateTransform(0, 200, 100)).toBeUndefined();
    expect(rotateTransform(90, 200, 100)).toBe('translate(200 0) rotate(90)');
    expect(rotateTransform(180, 200, 100)).toBe('translate(200 100) rotate(180)');
    expect(rotateTransform(270, 200, 100)).toBe('translate(0 100) rotate(270)');
  });

  it('builds a scaled path', () => {
    expect(pointsToPath([{ x: 0, y: 0.5 }, { x: 0.5, y: 1 }], 200, 100)).toBe('M 0 50 L 100 100');
  });

  it('falls back to a thin band when no text is crossed', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const [band, ...rest] = lineHighlightRects(svg, { x: 0.6, y: 0.4 }, { x: 0.2, y: 0.42 }, 0);
    expect(rest).toEqual([]);
    expect(band!.x).toBeCloseTo(0.2);
    expect(band!.width).toBeCloseTo(0.4);
    expect(band!.y).toBeCloseTo(0.41 - LINE_HIGHLIGHT_HEIGHT / 2);
    expect(band!.height).toBe(LINE_HIGHLIGHT_HEIGHT);
  });
});
