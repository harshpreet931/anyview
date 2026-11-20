import { MAX_ZOOM } from '../zoom';

/**
 * Browsers cap an element's height (about 33.5M px in Chrome, 17.9M px in Firefox). A list taller than this
 * height, measured at 100%, would pass the cap at the highest zoom, so its scroll range is compressed instead.
 */
export const MAX_LIST_HEIGHT = Math.floor(15_000_000 / MAX_ZOOM);
/** Printing a huge list would lay out thousands of pages; print stops here and the adapter says so. */
export const PRINT_ROW_LIMIT = 10_000;
/** Outside the viewer (a sidebar thumbnail) a list shows about one screen of rows and never follows a scroll. */
const PREVIEW_HEIGHT = 1_200;
const OVERSCAN = 8;
const RESYNC_MS = 150;

export interface RowsOptions {
  readonly count: number;
  readonly rowHeight: number;
  /** Sized here to hold the header and every row; the list starts at its top. */
  readonly spacer: HTMLElement;
  /** Holds the rendered rows and is moved to where they belong. */
  readonly layer: HTMLElement;
  /** Receives the row elements; the layer itself by default. */
  readonly parent?: HTMLElement;
  /** Stays at the top of the view while the rows scroll under it. */
  readonly header?: HTMLElement;
  readonly headerHeight?: number;
  readonly renderRow: (index: number) => Node;
  /** Called after the rendered rows change to [from, to). */
  readonly onWindow?: (from: number, to: number) => void;
}

export interface RowList {
  readonly from: number;
  readonly to: number;
  /** Scrolls the viewer so the row sits in the middle of the view, and renders it. */
  scrollToRow(index: number): void;
  /** Renders the rows in [from, to) again, where they are already rendered. */
  refresh(from?: number, to?: number): void;
}

export interface ScrollMap {
  readonly compressed: boolean;
  /** The position in the full list shown at scroll position `p` of the spacer. */
  toVirtual(p: number): number;
  toScroll(v: number): number;
}

/** The height a list of `count` rows takes in the page. */
export function listHeight(count: number, rowHeight: number): number {
  return Math.min(count * rowHeight, MAX_LIST_HEIGHT);
}

/**
 * Maps a scroll position in a spacer of `height` px to a position in a list of `total` px, for a view `view` px
 * tall. A compressed map is 1:1 for a quarter of the range at each end and linear in between.
 */
export function scrollMap(total: number, height: number, view: number): ScrollMap {
  const pmax = height - view;
  const vmax = total - view;
  if (total <= height || pmax <= 0) return { compressed: false, toVirtual: (p) => p, toScroll: (v) => v };
  const band = pmax / 4;
  const slope = (vmax - 2 * band) / (pmax - 2 * band);
  const toVirtual = (p: number) => {
    const q = Math.min(Math.max(p, 0), pmax);
    const v = q <= band ? q : q >= pmax - band ? vmax - (pmax - q) : band + (q - band) * slope;
    return v + (p - q);
  };
  const toScroll = (v: number) => {
    const w = Math.min(Math.max(v, 0), vmax);
    const p = w <= band ? w : w >= vmax - band ? pmax - (vmax - w) : band + (w - band) / slope;
    return p + (v - w);
  };
  return { compressed: true, toVirtual, toScroll };
}

/**
 * Renders the rows of a list that are in the viewer's view, plus a few on each side, and follows the viewer's
 * scroll until `signal` aborts. Printing renders up to {@link PRINT_ROW_LIMIT} rows; outside a viewer (a
 * thumbnail, a detached element) the first screen of rows is rendered once.
 */
export function mountRows(options: RowsOptions, signal: AbortSignal, print = false): RowList {
  const scroller = options.spacer.closest<HTMLElement>('.dv-viewer-container');
  if (print || !scroller) {
    const shown = print
      ? Math.min(options.count, PRINT_ROW_LIMIT)
      : Math.min(options.count, Math.ceil(PREVIEW_HEIGHT / options.rowHeight));
    return new StaticRows(options, shown);
  }
  return new VirtualRows(options, scroller, signal);
}

class StaticRows implements RowList {
  readonly from = 0;
  readonly to: number;

  constructor(private readonly options: RowsOptions, shown: number) {
    this.to = shown;
    // In flow, so a printout breaks between rows like any table or text.
    options.spacer.setAttribute('data-static', '');
    (options.parent ?? options.layer).replaceChildren(renderRows(options, 0, shown));
  }

  scrollToRow(): void {}

  refresh(from = this.from, to = this.to): void {
    replaceRows(this.options, this, from, to);
  }
}

function renderRows(options: RowsOptions, from: number, to: number): DocumentFragment {
  const frag = document.createDocumentFragment();
  for (let i = from; i < to; i++) frag.appendChild(options.renderRow(i));
  return frag;
}

function replaceRows(options: RowsOptions, window: { from: number; to: number }, from: number, to: number): void {
  const parent = options.parent ?? options.layer;
  for (let i = Math.max(from, window.from); i < Math.min(to, window.to); i++) {
    parent.children[i - window.from]?.replaceWith(options.renderRow(i));
  }
}

interface Geometry {
  zoom: number;
  view: number;
  /** How far the top of the view is below the first row, at 100%. */
  p: number;
  map: ScrollMap;
}

class VirtualRows implements RowList {
  from = 0;
  to = 0;
  private readonly total: number;
  private readonly height: number;
  private readonly inset: number;
  private readonly parent: HTMLElement;
  /** How far the rows are drawn above their place in the spacer: 0 unless the list is compressed. */
  private offset: number | null = null;
  private lastP = 0;
  private dragging = false;
  private resyncTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly options: RowsOptions,
    private readonly scroller: HTMLElement,
    signal: AbortSignal,
  ) {
    this.total = options.count * options.rowHeight;
    this.height = listHeight(options.count, options.rowHeight);
    this.inset = options.headerHeight ?? 0;
    this.parent = options.parent ?? options.layer;
    options.spacer.style.height = `${this.inset + this.height}px`;

    const update = () => this.update();
    // The scrollbar is the only part of the scroller not covered by its content.
    const press = (e: PointerEvent) => {
      if (e.target === scroller) this.dragging = true;
    };
    // A scrollbar drag may end without a pointerup reaching the page; the next move with no button pressed ends it too.
    const release = (e: Event) => {
      if (e.type !== 'pointermove' || !(e as PointerEvent).buttons) this.dragging = false;
    };
    // A transform (a page's entrance, a zoom) moves the rows without a scroll or a resize.
    const moves = ['scroll', 'animationend', 'animationcancel', 'transitionend'] as const;
    for (const type of moves) scroller.addEventListener(type, update, { passive: true });
    scroller.addEventListener('pointerdown', press);
    const ends = ['pointerup', 'pointercancel', 'pointermove'] as const;
    for (const type of ends) window.addEventListener(type, release, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (observer) {
      observer.observe(scroller);
      const page = options.spacer.closest('.dv-page');
      if (page) observer.observe(page);
      if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    }
    signal.addEventListener('abort', () => {
      for (const type of moves) scroller.removeEventListener(type, update);
      scroller.removeEventListener('pointerdown', press);
      for (const type of ends) window.removeEventListener(type, release);
      observer?.disconnect();
      clearTimeout(this.resyncTimer);
    });
    this.update();
  }

  scrollToRow(index: number): void {
    const g = this.geometry();
    const { rowHeight } = this.options;
    const v = Math.min(Math.max(index * rowHeight + rowHeight / 2 - g.view / 2, 0), Math.max(0, this.total - g.view));
    const p = g.map.toScroll(v);
    this.offset = v - p;
    this.lastP = p;
    this.scroller.scrollTop += (p - g.p) * g.zoom;
    this.update();
  }

  refresh(from = this.from, to = this.to): void {
    replaceRows(this.options, this, from, to);
  }

  private geometry(): Geometry {
    const view = this.scroller.getBoundingClientRect();
    const box = this.options.spacer.getBoundingClientRect();
    const height = this.options.spacer.offsetHeight;
    const zoom = height > 0 && box.height > 0 ? box.height / height : 1;
    const viewHeight = this.scroller.clientHeight / zoom;
    const p = (view.top + this.scroller.clientTop - box.top) / zoom - this.inset;
    return { zoom, view: viewHeight, p, map: scrollMap(this.total, this.height, viewHeight) };
  }

  private update(): void {
    const g = this.geometry();
    const canonical = g.map.toVirtual(g.p) - g.p;
    let offset = this.offset;
    if (!g.map.compressed) offset = 0;
    // A small scroll (wheel, keys, a reveal) moves the rows 1:1; a jump (the scrollbar) or an end maps directly.
    else if (offset == null || this.dragging || Math.abs(g.p - this.lastP) > g.view || g.p <= 0 || g.p >= this.height - g.view) {
      offset = canonical;
    }
    this.offset = offset;
    this.lastP = g.p;
    clearTimeout(this.resyncTimer);
    if (offset !== canonical) this.resyncTimer = setTimeout(() => this.resync(), RESYNC_MS);
    this.paint(g.p + offset, g.view, offset, g.p);
  }

  /** After 1:1 scrolling, moves the scrollbar to where the shown rows belong, without moving the rows. */
  private resync(): void {
    if (this.dragging || this.offset == null) return;
    const g = this.geometry();
    const v = g.p + this.offset;
    const p = g.map.toScroll(v);
    if (Math.abs(p - g.p) * g.zoom < 1) return;
    this.offset = v - p;
    this.lastP = p;
    this.scroller.scrollTop += (p - g.p) * g.zoom;
  }

  private paint(v: number, view: number, offset: number, p: number): void {
    const { count, rowHeight, layer, header } = this.options;
    const from = Math.min(Math.max(Math.floor(v / rowHeight) - OVERSCAN, 0), count);
    const to = Math.min(Math.max(Math.ceil((v + view) / rowHeight) + OVERSCAN, from), count);
    this.show(from, to);
    layer.style.transform = `translateY(${from * rowHeight - offset}px)`;
    if (header) header.style.transform = `translateY(${Math.min(Math.max(p + this.inset, 0), this.height)}px)`;
  }

  private show(from: number, to: number): void {
    if (from === this.from && to === this.to) return;
    const { parent } = this;
    if (to <= this.from || from >= this.to) {
      parent.replaceChildren(renderRows(this.options, from, to));
    } else {
      for (let i = this.from; i < from; i++) parent.firstChild?.remove();
      for (let i = to; i < this.to; i++) parent.lastChild?.remove();
      if (from < this.from) parent.prepend(renderRows(this.options, from, this.from));
      if (to > this.to) parent.append(renderRows(this.options, this.to, to));
    }
    this.from = from;
    this.to = to;
    this.options.onWindow?.(from, to);
  }
}
