import type { OutlineNode } from './types';

export const HEADINGS = 'h1, h2, h3, h4, h5, h6';

export const headingsIn = (root: ParentNode): Element[] => Array.from(root.querySelectorAll(HEADINGS));

/**
 * The outline of a flowing page. Each entry's offset is read from its rendered heading when it is followed, so the
 * jump lands exactly on the heading however the page has laid out; it is the page top until the page is drawn.
 */
export class HeadingOutline {
  readonly nodes: OutlineNode[];
  private target: HTMLElement | null = null;
  private find: () => readonly Element[] = () => [];

  /** Entries titled after `headings`, found in the page as built at parse time. */
  constructor(headings: readonly Element[]) {
    const offset = (i: number) => this.offset(i);
    this.nodes = headings.map((heading, i) => ({
      title: heading.textContent?.trim() ?? '',
      dest: {
        pageIndex: 0,
        get scrollOffset() {
          return offset(i);
        },
      },
    }));
  }

  /** Points the entries at the headings `find` returns from `target`, in outline order, as the page is drawn. */
  attach(target: HTMLElement, find: () => readonly Element[]): void {
    this.target = target;
    this.find = find;
  }

  private offset(i: number): number {
    const heading = this.target?.isConnected && this.find()[i];
    if (!this.target || !heading) return 0;
    const page = this.target.getBoundingClientRect();
    const zoom = this.target.offsetWidth ? page.width / this.target.offsetWidth : 1;
    return (heading.getBoundingClientRect().top - page.top) / zoom;
  }
}
