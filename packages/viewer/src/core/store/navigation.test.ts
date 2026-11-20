import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import { makeDoc } from './test-fixtures';

describe('navigation slice - visiblePages', () => {
  it('updates on content change and no-ops on identical content', () => {
    const s = createViewerStore();
    expect(s.getState().visiblePages).toEqual([]);

    s.getState().setVisiblePages([0, 1]);
    const ref = s.getState().visiblePages;
    expect(ref).toEqual([0, 1]);

    s.getState().setVisiblePages([0, 1]);
    expect(s.getState().visiblePages).toBe(ref);

    s.getState().setVisiblePages([0, 1, 2]);
    expect(s.getState().visiblePages).toEqual([0, 1, 2]);
  });
});

function loaded(pageCount: number) {
  const s = createViewerStore();
  s.setState({ document: makeDoc(pageCount), loadState: 'loaded' });
  return s;
}

describe('navigation slice - stepping', () => {
  it('steps a whole spread in two-page mode', () => {
    const s = loaded(10);
    s.getState().setSpreadMode('even');
    s.getState().nextPage();
    expect(s.getState().currentPage).toBe(2);
    s.getState().setCurrentPage(3);
    s.getState().nextPage();
    expect(s.getState().currentPage).toBe(4);
    s.getState().setCurrentPage(5);
    s.getState().prevPage();
    expect(s.getState().currentPage).toBe(2);
  });

  it('keeps the cover on its own in cover mode', () => {
    const s = loaded(10);
    s.getState().setSpreadMode('odd');
    s.getState().nextPage();
    expect(s.getState().currentPage).toBe(1);
    s.getState().nextPage();
    expect(s.getState().currentPage).toBe(3);
    s.getState().prevPage();
    expect(s.getState().currentPage).toBe(1);
    s.getState().prevPage();
    expect(s.getState().currentPage).toBe(0);
  });

  it('steps one page when spreads are off or scrolling sideways', () => {
    const s = loaded(10);
    s.getState().nextPage();
    expect(s.getState().currentPage).toBe(1);
    s.getState().setSpreadMode('even');
    s.getState().setScrollMode('horizontal');
    s.getState().nextPage();
    expect(s.getState().currentPage).toBe(2);
  });

  it('stops at the first and last spread', () => {
    const s = loaded(5);
    s.getState().setSpreadMode('even');
    s.getState().prevPage();
    expect(s.getState().currentPage).toBe(0);
    s.getState().setCurrentPage(4);
    s.getState().nextPage();
    expect(s.getState().currentPage).toBe(4);
  });

  it('asks the view to scroll again when going to the page it is already on', () => {
    const s = loaded(10);
    s.getState().goToPage(3);
    const nonce = s.getState().navigationNonce;
    s.getState().goToPage(3);
    expect(s.getState().currentPage).toBe(3);
    expect(s.getState().navigationNonce).toBe(nonce + 1);
  });

  it('does not ask for a scroll when the page is only being tracked', () => {
    const s = loaded(10);
    const nonce = s.getState().navigationNonce;
    s.getState().setCurrentPage(4);
    expect(s.getState().navigationNonce).toBe(nonce);
  });
});
