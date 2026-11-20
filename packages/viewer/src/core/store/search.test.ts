import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import type {
  Adapter,
  DocumentModel,
  RenderResult,
  SearchMatch,
  SearchQuery,
  SearchResult,
} from '../types';
import { QUERY, flush, makeDoc, manifest } from './test-fixtures';

const MATCHES: SearchMatch[] = [
  { pageIndex: 0, text: 'a', x: 0, y: 0.1, width: 0.1, height: 0.02 },
  { pageIndex: 2, text: 'a', x: 0, y: 0.2, width: 0.1, height: 0.02 },
  { pageIndex: 4, text: 'a', x: 0, y: 0.3, width: 0.1, height: 0.02 },
];

class FakeAdapter implements Adapter {
  readonly manifest = manifest({ search: true, textSelection: true });
  async parse(): Promise<DocumentModel> {
    return makeDoc(5);
  }
  async renderPage(): Promise<RenderResult> {
    return { width: 0, height: 0 };
  }
  async search(query: SearchQuery): Promise<SearchResult> {
    return { query, matches: MATCHES, totalMatches: MATCHES.length };
  }
}

describe('search slice', () => {
  it('runs the adapter search and jumps to the first match page', async () => {
    const store = createViewerStore();
    store.setState({ adapter: new FakeAdapter(), document: makeDoc(5) });
    store.getState().search(QUERY);
    await flush();
    expect(store.getState().searchState).toBe('done');
    expect(store.getState().searchResult?.totalMatches).toBe(3);
    expect(store.getState().currentMatchIndex).toBe(0);
    expect(store.getState().currentPage).toBe(0);
  });

  it('navigates matches, wraps, and moves the current page', async () => {
    const store = createViewerStore();
    store.setState({ adapter: new FakeAdapter(), document: makeDoc(5) });
    store.getState().search(QUERY);
    await flush();

    store.getState().nextMatch();
    expect(store.getState().currentMatchIndex).toBe(1);
    expect(store.getState().currentPage).toBe(2);

    store.getState().prevMatch();
    expect(store.getState().currentMatchIndex).toBe(0);
    expect(store.getState().currentPage).toBe(0);

    store.getState().prevMatch();
    expect(store.getState().currentMatchIndex).toBe(2);
    expect(store.getState().currentPage).toBe(4);
  });

  it('accepts externally-computed matches for reflowable formats', () => {
    const store = createViewerStore();
    store.setState({ document: makeDoc(1) });
    store.getState().search(QUERY);
    expect(store.getState().searchState).toBe('searching');

    store.getState().applySearchMatches([
      { pageIndex: 0, text: 'a', x: 0, y: 0, width: 0, height: 0 },
    ]);
    expect(store.getState().searchState).toBe('done');
    expect(store.getState().searchResult?.totalMatches).toBe(1);
  });

  it('clearSearch resets state', async () => {
    const store = createViewerStore();
    store.setState({ adapter: new FakeAdapter(), document: makeDoc(5) });
    store.getState().search(QUERY);
    await flush();
    store.getState().clearSearch();
    expect(store.getState().searchState).toBe('idle');
    expect(store.getState().searchResult).toBeNull();
    expect(store.getState().searchQuery).toBeNull();
  });
});
