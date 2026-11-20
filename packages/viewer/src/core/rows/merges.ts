/** A block of cells shown as one, from its first row and column to its last, inclusive. */
export interface GridMerge {
  readonly top: number;
  readonly left: number;
  readonly bottom: number;
  readonly right: number;
}

/** Finds the merges that cross a range of rows, without a lookup per row and cell. */
export class MergeIndex {
  private readonly merges: GridMerge[];
  /** The lowest row reached by any merge up to each index, so a search can stop once nothing earlier reaches down. */
  private readonly reach: number[] = [];

  constructor(merges: readonly GridMerge[]) {
    this.merges = [...merges].sort((a, b) => a.top - b.top);
    let reach = -1;
    for (const m of this.merges) this.reach.push((reach = Math.max(reach, m.bottom)));
  }

  /** The merges with a row in [from, to). */
  within(from: number, to: number): GridMerge[] {
    let lo = 0;
    let hi = this.merges.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.merges[mid]!.top < to) lo = mid + 1;
      else hi = mid;
    }
    const found: GridMerge[] = [];
    for (let i = lo - 1; i >= 0 && this.reach[i]! >= from; i--) {
      if (this.merges[i]!.bottom >= from) found.push(this.merges[i]!);
    }
    return found;
  }
}

/** The merge among `merges` that covers a column. */
export const mergeAt = (merges: readonly GridMerge[], col: number) => merges.find((m) => m.left <= col && col <= m.right);
