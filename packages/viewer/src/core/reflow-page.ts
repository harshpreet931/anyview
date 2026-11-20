import type { RenderContext, RenderResult } from './types';
import { appendSafeHtml, EMPTY_HTML, setSafeHtml, type SafeHtml } from './safe-html';
import { throwIfCancelled } from './errors';
import { blockUnits, unitText } from './search-units';

interface ReflowStyle {
  className: string;
  maxWidth?: number;
  fontSize?: number;
  padding?: string;
}

/**
 * A flowing page's sanitized markup, kept in pieces so a long document is built a slice at a time: `shell` is a
 * chain of empty wrappers (or nothing), and the pieces go in order into its innermost element. Each piece parses
 * on its own, and starts with a block that has no top margin, so the pieces sit exactly as the whole would.
 */
export interface ReflowContent {
  readonly shell: SafeHtml;
  readonly pieces: readonly SafeHtml[];
}

export const EMPTY_REFLOW: ReflowContent = { shell: EMPTY_HTML, pieces: [] };

const PIECE = 'dv-reflow-piece';
const NEW_PIECE = 'dv-reflow-piece-new';
const SLICE_MS = 30;
const FRAME_CHARS = 128 * 1024;

function nextTask(): Promise<void> {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = () => {
      channel.port1.close();
      resolve();
    };
    channel.port2.postMessage(null);
  });
}

// A hidden tab draws no frames, so there is nothing to spread out.
const nextFrame = () => new Promise<void>((resolve) => (document.hidden ? resolve() : requestAnimationFrame(() => resolve())));

/**
 * A pause to await between the steps of a long job: it yields to the event loop once a slice of work has run, so
 * no task blocks input for long. Message tasks are not throttled in background tabs the way timers are.
 */
export function timeSlices(signal: AbortSignal): () => Promise<void> {
  let start = performance.now();
  return async () => {
    if (performance.now() - start < SLICE_MS) return;
    await nextTask();
    throwIfCancelled(signal);
    start = performance.now();
  };
}

type Add = (parent: Element, piece: HTMLElement, chars: number) => Promise<void> | void;

/**
 * Adds pieces a frame's worth at a time. A piece is drawn in full in the frame it arrives and skipped once off
 * screen, at the size it was drawn at, so the page is laid out a piece at a time but always at its real height.
 */
function inFrames(signal: AbortSignal): { add: Add; done: () => Promise<void> } {
  let fresh: HTMLElement[] = [];
  let chars = FRAME_CHARS;
  const settle = async () => {
    await nextFrame();
    throwIfCancelled(signal);
    for (const piece of fresh) piece.classList.remove(NEW_PIECE);
    fresh = [];
    chars = 0;
  };
  const append = (parent: Element, piece: HTMLElement, length: number) => {
    piece.classList.add(NEW_PIECE);
    piece.style.containIntrinsicSize = `auto ${Math.ceil((piece.textContent?.length ?? 0) / 80) * 24}px`;
    parent.append(piece);
    fresh.push(piece);
    chars += length;
  };
  return {
    add: (parent, piece, length) => {
      if (chars < FRAME_CHARS) return append(parent, piece, length);
      return settle().then(() => append(parent, piece, length));
    },
    done: settle,
  };
}

/** Builds the content into `root` and returns its search units: the blocks, or the blocks of each piece. */
async function fill(root: Element, { shell, pieces }: ReflowContent, add: Add): Promise<Element[]> {
  setSafeHtml(root, shell);
  let parent = root;
  while (parent.firstElementChild) parent = parent.firstElementChild;
  if (pieces.length === 1) {
    appendSafeHtml(parent, pieces[0]!);
    return blockUnits(root);
  }
  const added: HTMLElement[] = [];
  for (const html of pieces) {
    const piece = root.ownerDocument.createElement('div');
    piece.className = PIECE;
    appendSafeHtml(piece, html);
    const wait = add(parent, piece, html.length);
    if (wait) await wait;
    added.push(piece);
  }
  return added.flatMap(blockUnits);
}

const appendNow: Add = (parent, piece) => {
  parent.append(piece);
};

/**
 * Render sanitized markup as one flowing page, the shared layout of the HTML-like formats. A long page arrives a
 * frame's worth at a time; print adds it all at once.
 */
export async function renderReflowPage(
  ctx: RenderContext,
  content: ReflowContent,
  { className, maxWidth = 800, fontSize = 16, padding = '24px' }: ReflowStyle,
): Promise<RenderResult> {
  const container = document.createElement('div');
  container.className = className;
  container.style.padding = padding;
  container.style.maxWidth = `${maxWidth}px`;
  container.style.margin = '0 auto';
  container.style.fontSize = `${fontSize * ctx.scale}px`;
  container.style.lineHeight = '1.6';
  container.style.color = 'var(--dv-page-ink)';
  container.style.background = 'var(--dv-page-bg)';
  ctx.target.replaceChildren(container);
  let units: Element[];
  if (ctx.print || content.pieces.length < 2) {
    units = await fill(container, content, appendNow);
  } else {
    const frames = inFrames(ctx.signal);
    units = await fill(container, content, frames.add);
    await frames.done();
  }
  units.forEach((el, i) => el.setAttribute('data-dv-unit', String(i)));
  return {
    width: ctx.page.width * ctx.scale,
    height: container.scrollHeight || ctx.page.height * ctx.scale,
  };
}

/** The page built in a detached, inert document, a slice at a time: for reading its text and headings. */
export async function detachedReflow(content: ReflowContent, signal: AbortSignal): Promise<HTMLElement> {
  return (await detachedUnits(content, signal)).root;
}

async function detachedUnits(content: ReflowContent, signal: AbortSignal): Promise<{ root: HTMLElement; units: Element[] }> {
  const root = document.implementation.createHTMLDocument('').body;
  const next = timeSlices(signal);
  const units = await fill(root, content, (parent, piece) => {
    parent.append(piece);
    return next();
  });
  return { root, units };
}

/** The search text of each block that {@link renderReflowPage} marks as a unit. */
export async function reflowBlockTexts(content: ReflowContent, signal: AbortSignal): Promise<string[]> {
  const { units } = await detachedUnits(content, signal);
  const next = timeSlices(signal);
  const texts: string[] = [];
  for (const el of units) {
    texts.push(unitText(el).text);
    await next();
  }
  return texts;
}
