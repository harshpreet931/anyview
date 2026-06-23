import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import type {
  Adapter,
  AdapterFeatures,
  AdapterManifest,
  DocumentModel,
  PageRef,
  RenderResult,
  SearchMatch,
  SearchQuery,
  SearchResult,
} from '../types';

const FEATURES: AdapterFeatures = {
  search: true,
  annotations: false,
  textSelection: true,
  print: false,
  thumbnails: false,
  outline: false,
  zoom: true,
  rotation: false,
  attachments: false,
  fullscreen: false,
  download: false,
};

function makeDoc(pageCount: number): DocumentModel {
  const pages: PageRef[] = Array.from({ length: pageCount }, (_, i) => ({
    index: i,
    width: 100,
    height: 100,
    rotation: 0 as const,
  }));
  return {
    format: 'pdf',
    meta: { name: 't.pdf', size: 0, mimeType: 'application/pdf' },
    pageCount,
    pages,
  };
}

const MATCHES: SearchMatch[] = [
  { pageIndex: 0, text: 'a', x: 0, y: 0.1, width: 0.1, height: 0.02 },
  { pageIndex: 2, text: 'a', x: 0, y: 0.2, width: 0.1, height: 0.02 },
  { pageIndex: 4, text: 'a', x: 0, y: 0.3, width: 0.1, height: 0.02 },
];

class FakeAdapter implements Adapter {
  readonly manifest: AdapterManifest = {
    id: 'pdf',
    label: 'PDF',
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
    icon: '',
    features: FEATURES,
    priority: 100,
    protocolVersion: 1,
  };
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

const QUERY: SearchQuery = {
  text: 'a',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  diacritics: false,
};

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

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

    store.getState().prevMatch(); // wrap to last
    expect(store.getState().currentMatchIndex).toBe(2);
    expect(store.getState().currentPage).toBe(4);
  });

  it('accepts externally-computed matches for reflowable formats', () => {
    const store = createViewerStore();
    store.setState({ document: makeDoc(1) });
    store.getState().search(QUERY); // no adapter.search → awaits DOM results
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
