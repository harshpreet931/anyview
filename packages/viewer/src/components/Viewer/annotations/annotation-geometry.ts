import type { Rotation } from '../../../core/rotation';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const INK_THICKNESS = 0.004;
export const SHAPE_STROKE = 0.003;
export const FREE_TEXT_SIZE = 0.024;
export const LINE_HIGHLIGHT_HEIGHT = 0.016;
export const EDITOR_W = 220;
export const EDITOR_H = 84;

/** Stored geometry is in the unrotated page; these map it to and from what is on screen. */
export function toPage(p: Point, turn: Rotation): Point {
  if (turn === 90) return { x: p.y, y: 1 - p.x };
  if (turn === 180) return { x: 1 - p.x, y: 1 - p.y };
  if (turn === 270) return { x: 1 - p.y, y: p.x };
  return p;
}

export function toScreen(p: Point, turn: Rotation): Point {
  if (turn === 90) return { x: 1 - p.y, y: p.x };
  if (turn === 180) return { x: 1 - p.x, y: 1 - p.y };
  if (turn === 270) return { x: p.y, y: 1 - p.x };
  return p;
}

export function rotateTransform(turn: Rotation, width: number, height: number): string | undefined {
  if (turn === 90) return `translate(${width} 0) rotate(90)`;
  if (turn === 180) return `translate(${width} ${height}) rotate(180)`;
  if (turn === 270) return `translate(0 ${height}) rotate(270)`;
  return undefined;
}

export function pointsToPath(points: readonly Point[], width: number, height: number): string {
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * width} ${p.y * height}`)
    .join(' ');
}

export function lineHighlightRects(svg: SVGSVGElement, from: Point, to: Point, turn: Rotation): Rect[] {
  const page = svg.getBoundingClientRect();
  const left = Math.min(from.x, to.x);
  const right = Math.max(from.x, to.x);
  const y = (from.y + to.y) / 2;
  const rects: Rect[] = [];
  const spans = svg.parentElement?.querySelectorAll<HTMLElement>('.dv-text-layer span') ?? [];
  for (const span of spans) {
    const b = span.getBoundingClientRect();
    if (!b.width || !b.height || !page.width || !page.height) continue;
    const a = toPage({ x: (b.left - page.left) / page.width, y: (b.top - page.top) / page.height }, turn);
    const c = toPage({ x: (b.right - page.left) / page.width, y: (b.bottom - page.top) / page.height }, turn);
    const r = {
      x: Math.min(a.x, c.x),
      y: Math.min(a.y, c.y),
      width: Math.abs(c.x - a.x),
      height: Math.abs(c.y - a.y),
    };
    if (y < r.y || y > r.y + r.height || r.x > right || r.x + r.width < left) continue;
    const x = Math.max(r.x, left);
    rects.push({ x, y: r.y, width: Math.min(r.x + r.width, right) - x, height: r.height });
  }
  if (rects.length > 0) return rects;
  return [{ x: left, y: y - LINE_HIGHLIGHT_HEIGHT / 2, width: right - left, height: LINE_HIGHLIGHT_HEIGHT }];
}
