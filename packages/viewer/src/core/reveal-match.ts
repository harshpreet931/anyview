const revealed = new WeakMap<Element, number>();

/** Centres a search match inside the viewer's own scroller, once per navigation, without scrolling the host page. */
export function revealMatch(el: Element | null | undefined, nonce: number): void {
  const container = el?.closest<HTMLElement>('.dv-viewer-container');
  if (!el || !container || revealed.get(container) === nonce) return;
  revealed.set(container, nonce);
  const c = container.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  container.scrollTo({
    top: container.scrollTop + (r.top - c.top) - (c.height - r.height) / 2,
    left: container.scrollLeft + (r.left - c.left) - (c.width - r.width) / 2,
  });
}
