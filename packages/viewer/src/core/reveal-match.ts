const revealed = new WeakMap<Element, number>();

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
 * navigation, without scrolling the host page.
 */
export function revealMatch(target: Element | Range | null | undefined, nonce: number): void {
  if (!target) return;
  const container = viewerOf(target instanceof Range ? target.startContainer.parentElement : target);
  if (!container || revealed.get(container) === nonce) return;
  revealed.set(container, nonce);
  const c = container.getBoundingClientRect();
  const r = target.getBoundingClientRect();
  container.scrollTo({
    top: container.scrollTop + (r.top - c.top) - (c.height - r.height) / 2,
    left: container.scrollLeft + (r.left - c.left) - (c.width - r.width) / 2,
  });
}
