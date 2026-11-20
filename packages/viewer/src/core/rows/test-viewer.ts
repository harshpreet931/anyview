import { vi } from 'vitest';

export interface TestViewer {
  readonly container: HTMLElement;
  /** Scrolls the view, as a user would, and fires the scroll event. */
  scroll(top: number): void;
  /** Moves row lists down by `by` px without scrolling, as a transform on a page would. */
  shift(by: number): void;
  dispose(): void;
}

/**
 * A viewer scroller for jsdom, which has no layout: it is `height` px tall and every row list inside it (`.dv-rows`)
 * starts at its top at zoom 1, so lists see the rows that `scrollTop` brings into view.
 */
export function testViewer(height = 600): TestViewer {
  const container = document.createElement('div');
  container.className = 'dv-viewer-container';
  document.body.appendChild(container);
  let top = 0;
  let shift = 0;
  Object.defineProperty(container, 'clientHeight', { get: () => height });
  Object.defineProperty(container, 'scrollTop', {
    get: () => top,
    set: (value: number) => {
      top = Math.max(0, value);
    },
  });
  const rect = (y: number, h: number) => ({ top: y, bottom: y + h, height: h, left: 0, right: 800, width: 800, x: 0, y }) as DOMRect;
  const original = Element.prototype.getBoundingClientRect;
  const spy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this === container) return rect(0, height);
    if (this instanceof HTMLElement && this.classList.contains('dv-rows') && container.contains(this)) {
      return rect(shift - top, parseFloat(this.style.height) || 0);
    }
    return original.call(this);
  });
  return {
    container,
    scroll(next) {
      container.scrollTop = next;
      container.dispatchEvent(new Event('scroll'));
    },
    shift(by) {
      shift = by;
    },
    dispose() {
      spy.mockRestore();
      container.remove();
    },
  };
}
