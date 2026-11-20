import { MAX_ZOOM, MIN_ZOOM } from '../core/zoom';

const STRETCH = Math.log(1.5);
const STIFFNESS = 0.55;
const NOTCH = 1.15;

export type Point = { x: number; y: number };
export type MarqueeRect = { left: number; top: number; w: number; h: number };
export type PageSpan = { left: number; right: number };

export interface Gesture {
  base: number;
  raw: number;
  factor: number;
  originX: number;
  originY: number;
  cursorX: number;
  cursorY: number;
  scrollX: number;
  scrollY: number;
  span: PageSpan | null;
  panX: number;
  panY: number;
  tx: number;
  ty: number;
}

export interface PreviewView {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
  contentWidth: number;
  contentHeight: number;
}

/** Past a limit the zoom keeps moving with growing resistance (the iOS rubber band), up to 1.5x beyond it. */
export function rubber(z: number): number {
  if (z > MAX_ZOOM) {
    const o = Math.log(z / MAX_ZOOM);
    return MAX_ZOOM * Math.exp((o * STRETCH * STIFFNESS) / (STRETCH + STIFFNESS * o));
  }
  if (z < MIN_ZOOM) {
    const o = Math.log(MIN_ZOOM / z);
    return MIN_ZOOM / Math.exp((o * STRETCH * STIFFNESS) / (STRETCH + STIFFNESS * o));
  }
  return z;
}

export const clampRaw = (z: number) => Math.max(MIN_ZOOM / 4, Math.min(z, MAX_ZOOM * 4));

/** Trackpad pinches arrive as small pixel deltas at Chrome's rate of e^(-deltaY/100); mouse notches step by a fixed ratio. */
export function wheelFactor(e: Pick<WheelEvent, 'deltaMode' | 'deltaY'>): number {
  const notch = e.deltaMode !== 0 || Math.abs(e.deltaY) >= 50;
  if (notch) return e.deltaY < 0 ? NOTCH : e.deltaY > 0 ? 1 / NOTCH : 1;
  return Math.exp(-e.deltaY / 100);
}

export const sameZoom = (a: number, b: number) => Math.abs(a - b) < 1e-4;

export function settleFrom(shown: number, next: number): number | undefined {
  const from = shown / next;
  return Math.abs(from - 1) > 1e-3 ? from : undefined;
}

export function toLocal(el: Element, clientX: number, clientY: number): Point {
  const rect = el.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

export function rectBetween(a: Point, b: Point): MarqueeRect {
  return {
    left: Math.min(a.x, b.x),
    top: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

export function pageSpan(content: HTMLElement): PageSpan | null {
  const pages = content.querySelectorAll<HTMLElement>('.dv-page');
  if (pages.length === 0) return null;
  const box = content.getBoundingClientRect();
  let left = Infinity;
  let right = -Infinity;
  for (const p of pages) {
    const r = p.getBoundingClientRect();
    left = Math.min(left, r.left - box.left);
    right = Math.max(right, r.right - box.left);
  }
  return { left, right };
}

// Keeps the preview inside what the committed layout can show: narrow pages stay centred and
// no edge is pulled into view past the scroll range, so letting go doesn't jump. Any scroll the
// browser did on its own during the gesture is folded into the pan rather than added to it.
export function previewTranslate(g: Gesture, view: PreviewView): { tx: number; ty: number } {
  const f = g.factor;
  const sl = view.scrollLeft;
  const st = view.scrollTop;
  const panX = g.panX + sl - g.scrollX;
  const panY = g.panY + st - g.scrollY;
  const fit = (pan: number, origin: number, scroll: number, size: number, viewSize: number) => {
    const upper = scroll - origin * (1 - f);
    if (size * f < viewSize) return upper;
    const lower = viewSize - (origin + (size - origin) * f - scroll);
    return Math.min(upper, Math.max(lower, pan));
  };
  let tx: number;
  if (g.span) {
    const left = g.originX + (g.span.left - g.originX) * f - sl + panX;
    const w = (g.span.right - g.span.left) * f;
    const W = view.clientWidth;
    const want = w <= W ? (W - w) / 2 : Math.min(0, Math.max(W - w, left));
    tx = panX + want - left;
  } else {
    tx = fit(panX, g.originX, sl, view.contentWidth, view.clientWidth);
  }
  const ty = fit(panY, g.originY, st, view.contentHeight, view.clientHeight);
  return { tx, ty };
}
