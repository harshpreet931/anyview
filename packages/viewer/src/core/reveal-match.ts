const revealed = new WeakMap<Element, number>();
const following = new WeakMap<Element, () => void>();

const SETTLE_MS = 500;
const USER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

function viewerOf(el: Element | null | undefined): HTMLElement | null {
  return el?.closest<HTMLElement>('.dv-viewer-container') ?? null;
}

/** Whether the match for `nonce` was already revealed in the viewer that holds `el`. */
export function isRevealed(el: Element, nonce: number): boolean {
  const container = viewerOf(el);
  return !!container && revealed.get(container) === nonce;
}

/**
 * Centres a search match (its exact text when given a Range) inside the viewer's own scroller, once per
 * navigation, without scrolling the host page. With `followLayout`, it keeps the match centred while pages
 * around it are still being measured, until the layout settles or the user scrolls.
 */
export function revealMatch(target: Element | Range | null | undefined, nonce: number, followLayout = false): void {
  if (!target) return;
  const container = viewerOf(target instanceof Range ? target.startContainer.parentElement : target);
  if (!container || revealed.get(container) === nonce) return;
  revealed.set(container, nonce);
  following.get(container)?.();
  const centre = () => {
    const c = container.getBoundingClientRect();
    const r = target.getBoundingClientRect();
    container.scrollTo({
      top: container.scrollTop + (r.top - c.top) - (c.height - r.height) / 2,
      left: container.scrollLeft + (r.left - c.left) - (c.width - r.width) / 2,
    });
  };
  centre();
  if (followLayout) follow(container, target, centre);
}

function follow(container: HTMLElement, target: Element | Range, centre: () => void): void {
  const content = container.firstElementChild;
  if (!content || typeof ResizeObserver === 'undefined') return;
  const anchor = target instanceof Range ? target.startContainer : target;
  let quiet = setTimeout(() => stop(), SETTLE_MS);
  const observer = new ResizeObserver(() => {
    if (!anchor.isConnected) return stop();
    centre();
    clearTimeout(quiet);
    quiet = setTimeout(() => stop(), SETTLE_MS);
  });
  const stop = () => {
    observer.disconnect();
    clearTimeout(quiet);
    for (const type of USER_INPUT) container.removeEventListener(type, stop);
    following.delete(container);
  };
  observer.observe(content);
  for (const type of USER_INPUT) container.addEventListener(type, stop, { passive: true });
  following.set(container, stop);
}
