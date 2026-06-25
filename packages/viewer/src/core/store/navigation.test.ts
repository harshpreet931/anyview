import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';

describe('navigation slice - visiblePages', () => {
  it('updates on content change and no-ops on identical content', () => {
    const s = createViewerStore();
    expect(s.getState().visiblePages).toEqual([]);

    s.getState().setVisiblePages([0, 1]);
    const ref = s.getState().visiblePages;
    expect(ref).toEqual([0, 1]);

    // Same content → same reference (no state churn).
    s.getState().setVisiblePages([0, 1]);
    expect(s.getState().visiblePages).toBe(ref);

    // Different content → new value.
    s.getState().setVisiblePages([0, 1, 2]);
    expect(s.getState().visiblePages).toEqual([0, 1, 2]);
  });
});
