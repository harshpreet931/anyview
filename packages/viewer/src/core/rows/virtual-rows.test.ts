import { afterEach, describe, expect, it } from 'vitest';
import { MAX_LIST_HEIGHT, PRINT_ROW_LIMIT, listHeight, mountRows, scrollMap, type RowsOptions } from './virtual-rows';
import { testViewer, type TestViewer } from './test-viewer';

const ROW = 20;

function list(count: number, extra: Partial<RowsOptions> = {}) {
  const spacer = document.createElement('div');
  spacer.className = 'dv-rows';
  const layer = document.createElement('div');
  spacer.appendChild(layer);
  const options: RowsOptions = {
    count,
    rowHeight: ROW,
    spacer,
    layer,
    renderRow: (i) => {
      const el = document.createElement('div');
      el.dataset.row = String(i);
      el.textContent = `row ${i}`;
      return el;
    },
    ...extra,
  };
  return { spacer, layer, options };
}

const rendered = (layer: HTMLElement) => Array.from(layer.children, (el) => Number((el as HTMLElement).dataset.row));
const shift = (el: HTMLElement) => Number(/translateY\((-?[\d.e+]+)px\)/.exec(el.style.transform)?.[1] ?? NaN);

describe('scrollMap', () => {
  it('is the identity while every row fits under the height limit', () => {
    const map = scrollMap(10_000, 10_000, 600);
    expect(map.compressed).toBe(false);
    expect(map.toVirtual(1234)).toBe(1234);
    expect(map.toScroll(1234)).toBe(1234);
  });

  it('spreads every row over a compressed range, scrolling 1:1 near both ends', () => {
    const total = 40_000_000;
    const map = scrollMap(total, MAX_LIST_HEIGHT, 600);
    const end = MAX_LIST_HEIGHT - 600;
    expect(map.compressed).toBe(true);
    expect(map.toVirtual(0)).toBe(0);
    expect(map.toVirtual(end)).toBe(total - 600);
    expect(map.toVirtual(100) - map.toVirtual(0)).toBeCloseTo(100);
    expect(map.toVirtual(end) - map.toVirtual(end - 100)).toBeCloseTo(100);
    for (const p of [0, 50, end / 3, end / 2, end - 1, end]) expect(map.toScroll(map.toVirtual(p))).toBeCloseTo(p, 3);
    let last = -1;
    for (let p = 0; p <= end; p += end / 97) {
      const v = map.toVirtual(p);
      expect(v).toBeGreaterThan(last);
      last = v;
    }
  });
});

describe('mountRows', () => {
  let viewer: TestViewer;
  afterEach(() => viewer?.dispose());

  it('renders only the rows in view', () => {
    viewer = testViewer(600);
    const { spacer, layer, options } = list(1_000_000);
    viewer.container.appendChild(spacer);
    mountRows(options, new AbortController().signal);
    const rows = rendered(layer);
    expect(rows[0]).toBe(0);
    expect(rows.length).toBeGreaterThanOrEqual(600 / ROW);
    expect(rows.length).toBeLessThan(600 / ROW + 20);
    expect(spacer.style.height).toBe(`${listHeight(1_000_000, ROW)}px`);
  });

  it('moves the window as the view scrolls and keeps the rows that stay', () => {
    viewer = testViewer(600);
    const { spacer, layer, options } = list(10_000);
    viewer.container.appendChild(spacer);
    mountRows(options, new AbortController().signal);
    viewer.scroll(200 * ROW);
    const kept = layer.querySelector('[data-row="205"]');
    expect(kept).not.toBeNull();
    viewer.scroll(203 * ROW);
    expect(layer.querySelector('[data-row="205"]')).toBe(kept);
    const rows = rendered(layer);
    expect(rows[0]).toBeLessThanOrEqual(203);
    expect(rows.at(-1)).toBeGreaterThanOrEqual(203 + 600 / ROW);
    expect(shift(layer)).toBe(rows[0]! * ROW);
  });

  it('reaches the last row of a list too tall for the browser', () => {
    viewer = testViewer(600);
    const count = 2_000_000;
    const { spacer, layer, options } = list(count);
    viewer.container.appendChild(spacer);
    mountRows(options, new AbortController().signal);
    expect(listHeight(count, ROW)).toBe(MAX_LIST_HEIGHT);
    viewer.scroll(MAX_LIST_HEIGHT - 600);
    const rows = rendered(layer);
    expect(rows.at(-1)).toBe(count - 1);
    const lastTop = shift(layer) + (rows.length - 1) * ROW;
    expect(lastTop).toBe(MAX_LIST_HEIGHT - ROW);
  });

  it('scrolls small steps 1:1 in a compressed list', () => {
    viewer = testViewer(600);
    const { spacer, layer, options } = list(2_000_000);
    viewer.container.appendChild(spacer);
    mountRows(options, new AbortController().signal);
    viewer.scroll(MAX_LIST_HEIGHT / 2);
    const row = layer.children[20] as HTMLElement;
    const at = shift(layer) + 20 * ROW - MAX_LIST_HEIGHT / 2;
    viewer.scroll(MAX_LIST_HEIGHT / 2 + 100);
    const index = rendered(layer).indexOf(Number(row.dataset.row));
    expect(shift(layer) + index * ROW - (MAX_LIST_HEIGHT / 2 + 100)).toBeCloseTo(at - 100);
  });

  it('tracks the scrollbar while it is dragged, until the pointer is let go', () => {
    viewer = testViewer(600);
    const { spacer, layer, options } = list(2_000_000);
    viewer.container.appendChild(spacer);
    mountRows(options, new AbortController().signal);
    const map = scrollMap(2_000_000 * ROW, MAX_LIST_HEIGHT, 600);
    const firstShown = () => Math.floor(map.toVirtual(viewer.container.scrollTop) / ROW);
    viewer.scroll(MAX_LIST_HEIGHT / 2);
    viewer.container.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));
    viewer.scroll(MAX_LIST_HEIGHT / 2 + 100);
    expect(rendered(layer)).toContain(firstShown());
    expect(rendered(layer)[0]).toBeGreaterThan(firstShown() - 20);

    window.dispatchEvent(new MouseEvent('pointermove', { buttons: 0 }));
    const row = Number((layer.children[20] as HTMLElement).dataset.row);
    const at = shift(layer) + 20 * ROW - viewer.container.scrollTop;
    viewer.scroll(viewer.container.scrollTop + 100);
    const index = rendered(layer).indexOf(row);
    expect(shift(layer) + index * ROW - viewer.container.scrollTop).toBeCloseTo(at - 100);
  });

  it('scrolls a row to the middle of the view, rendered', () => {
    viewer = testViewer(600);
    const { spacer, layer, options } = list(2_000_000);
    viewer.container.appendChild(spacer);
    const rows = mountRows(options, new AbortController().signal);
    rows.scrollToRow(1_500_000);
    const el = layer.querySelector<HTMLElement>('[data-row="1500000"]');
    expect(el).not.toBeNull();
    const index = rendered(layer).indexOf(1_500_000);
    const top = shift(layer) + index * ROW - viewer.container.scrollTop;
    expect(top).toBeCloseTo(300 - ROW / 2, 0);
  });

  it('keeps the header at the top of the view, over the rows', () => {
    viewer = testViewer(600);
    const header = document.createElement('div');
    const { spacer, layer, options } = list(10_000, { header, headerHeight: 30 });
    spacer.prepend(header);
    viewer.container.appendChild(spacer);
    mountRows(options, new AbortController().signal);
    expect(spacer.style.height).toBe(`${30 + 10_000 * ROW}px`);
    viewer.scroll(5_000);
    expect(shift(header)).toBe(5_000);
    expect(rendered(layer)[0]).toBeLessThanOrEqual(Math.floor((5_000 - 30) / ROW));
  });

  it('renders the first screen outside the viewer and every row up to the limit to print', () => {
    const preview = list(100_000);
    document.body.appendChild(preview.spacer);
    mountRows(preview.options, new AbortController().signal);
    expect(rendered(preview.layer)).toEqual(Array.from({ length: rendered(preview.layer).length }, (_, i) => i));
    expect(preview.layer.children.length).toBeLessThan(100);
    expect(preview.spacer.hasAttribute('data-static')).toBe(true);
    preview.spacer.remove();

    const print = list(PRINT_ROW_LIMIT + 5);
    mountRows(print.options, new AbortController().signal, true);
    expect(print.layer.children).toHaveLength(PRINT_ROW_LIMIT);
    expect(print.spacer.hasAttribute('data-static')).toBe(true);
    expect(print.spacer.style.height).toBe('');
  });

  it('catches up with its page once an animation that moved the page ends', () => {
    viewer = testViewer(600);
    const { spacer, layer, options } = list(10_000);
    viewer.container.appendChild(spacer);
    viewer.shift(5_000);
    mountRows(options, new AbortController().signal);
    expect(layer.children).toHaveLength(0);
    viewer.shift(0);
    spacer.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(rendered(layer)[0]).toBe(0);
    expect(layer.children.length).toBeGreaterThan(600 / ROW);
  });

  it('stops following the view once its page is gone', () => {
    viewer = testViewer(600);
    const { spacer, layer, options } = list(10_000);
    viewer.container.appendChild(spacer);
    const controller = new AbortController();
    mountRows(options, controller.signal);
    controller.abort();
    viewer.scroll(5_000);
    expect(rendered(layer)[0]).toBe(0);
  });
});
