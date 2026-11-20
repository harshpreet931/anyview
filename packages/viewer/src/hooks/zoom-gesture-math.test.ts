import { describe, it, expect } from 'vitest';
import { MAX_ZOOM, MIN_ZOOM } from '../core/zoom';
import {
  clampRaw,
  pageSpan,
  previewTranslate,
  rectBetween,
  rubber,
  sameZoom,
  settleFrom,
  toLocal,
  wheelFactor,
  type Gesture,
} from './zoom-gesture-math';

const gesture = (over: Partial<Gesture> = {}): Gesture => ({
  base: 1,
  raw: 1,
  factor: 1,
  originX: 0,
  originY: 0,
  cursorX: 0,
  cursorY: 0,
  scrollX: 0,
  scrollY: 0,
  span: null,
  panX: 0,
  panY: 0,
  tx: 0,
  ty: 0,
  ...over,
});

const view = { scrollLeft: 0, scrollTop: 0, clientWidth: 800, clientHeight: 600, contentWidth: 800, contentHeight: 2000 };

describe('rubber', () => {
  it('passes zooms inside the limits through', () => {
    expect(rubber(1)).toBe(1);
    expect(rubber(MIN_ZOOM)).toBe(MIN_ZOOM);
    expect(rubber(MAX_ZOOM)).toBe(MAX_ZOOM);
  });

  it('resists past the limits and never goes 1.5x beyond them', () => {
    expect(rubber(MAX_ZOOM * 2)).toBeGreaterThan(MAX_ZOOM);
    expect(rubber(MAX_ZOOM * 2)).toBeLessThan(MAX_ZOOM * 2);
    expect(rubber(MAX_ZOOM * 1e6)).toBeLessThan(MAX_ZOOM * 1.5);
    expect(rubber(MIN_ZOOM / 2)).toBeLessThan(MIN_ZOOM);
    expect(rubber(MIN_ZOOM / 1e6)).toBeGreaterThan(MIN_ZOOM / 1.5);
  });
});

describe('clampRaw', () => {
  it('keeps the raw zoom within 4x of the limits', () => {
    expect(clampRaw(1)).toBe(1);
    expect(clampRaw(1000)).toBe(MAX_ZOOM * 4);
    expect(clampRaw(0)).toBe(MIN_ZOOM / 4);
  });
});

describe('wheelFactor', () => {
  it('steps mouse notches by a fixed ratio', () => {
    expect(wheelFactor({ deltaMode: 1, deltaY: -3 })).toBe(1.15);
    expect(wheelFactor({ deltaMode: 0, deltaY: 100 })).toBe(1 / 1.15);
    expect(wheelFactor({ deltaMode: 1, deltaY: 0 })).toBe(1);
  });

  it('follows small trackpad pixel deltas exponentially', () => {
    expect(wheelFactor({ deltaMode: 0, deltaY: -10 })).toBeCloseTo(Math.exp(0.1));
    expect(wheelFactor({ deltaMode: 0, deltaY: 0 })).toBe(1);
  });
});

describe('sameZoom and settleFrom', () => {
  it('treats tiny zoom differences as no change', () => {
    expect(sameZoom(1, 1.00005)).toBe(true);
    expect(sameZoom(1, 1.001)).toBe(false);
  });

  it('only settles from a visibly different scale', () => {
    expect(settleFrom(1.0005, 1)).toBeUndefined();
    expect(settleFrom(2, 1)).toBe(2);
    expect(settleFrom(1, 2)).toBe(0.5);
  });
});

describe('rectBetween', () => {
  it('normalises a drag in any direction', () => {
    const rect = { left: 10, top: 20, w: 30, h: 40 };
    expect(rectBetween({ x: 10, y: 20 }, { x: 40, y: 60 })).toEqual(rect);
    expect(rectBetween({ x: 40, y: 60 }, { x: 10, y: 20 })).toEqual(rect);
    expect(rectBetween({ x: 40, y: 20 }, { x: 10, y: 60 })).toEqual(rect);
  });
});

describe('toLocal', () => {
  it('offsets client coordinates by the element box', () => {
    const el = { getBoundingClientRect: () => ({ left: 100, top: 50 }) } as Element;
    expect(toLocal(el, 130, 70)).toEqual({ x: 30, y: 20 });
  });
});

describe('pageSpan', () => {
  const box = (left: number, right: number) => () => ({ left, right }) as DOMRect;

  it('is null without pages', () => {
    expect(pageSpan(document.createElement('div'))).toBeNull();
  });

  it('spans the pages relative to the content', () => {
    const content = document.createElement('div');
    content.getBoundingClientRect = box(50, 950);
    for (const [l, r] of [[150, 650], [100, 700]] as const) {
      const page = document.createElement('div');
      page.className = 'dv-page';
      page.getBoundingClientRect = box(l, r);
      content.appendChild(page);
    }
    expect(pageSpan(content)).toEqual({ left: 50, right: 650 });
  });
});

describe('previewTranslate', () => {
  it('does not move an unscaled preview', () => {
    expect(previewTranslate(gesture(), view)).toEqual({ tx: 0, ty: 0 });
  });

  it('pins content smaller than the view to the scroll start', () => {
    const g = gesture({ factor: 0.5, originX: 400, originY: 300 });
    expect(previewTranslate(g, view)).toEqual({ tx: -200, ty: -150 });
  });

  it('centres narrow pages horizontally', () => {
    const g = gesture({ factor: 0.5, originX: 400, span: { left: 0, right: 800 } });
    expect(previewTranslate(g, view).tx).toBe(0);
    const offCentre = gesture({ factor: 0.5, originX: 0, span: { left: 0, right: 800 } });
    expect(previewTranslate(offCentre, view).tx).toBe(200);
  });

  it('keeps the pan inside the scroll range when zoomed in', () => {
    const g = gesture({ factor: 2, originY: 300, panY: 10000 });
    expect(previewTranslate(g, view).ty).toBe(300);
    const back = gesture({ factor: 2, originY: 300, panY: -10000 });
    expect(previewTranslate(back, view).ty).toBe(600 - (300 + 1700 * 2));
  });

  it('folds scroll the browser did during the gesture into the pan', () => {
    const g = gesture({ factor: 2, originY: 300, panY: 50, scrollY: 0 });
    expect(previewTranslate(g, { ...view, scrollTop: 20 }).ty).toBe(70);
  });
});
