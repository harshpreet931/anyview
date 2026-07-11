import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  RenderResult,
  SearchQuery,
  SearchResult,
} from '../types';

const MANIFEST: AdapterManifest = {
  id: 'pdf',
  label: 'PDF',
  extensions: ['pdf'],
  mimeTypes: ['application/pdf'],
  icon: '',
  features: {
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
  },
  priority: 100,
  protocolVersion: 1,
};

class DeferredSearchAdapter implements Adapter {
  readonly manifest = MANIFEST;
  private resolve!: (result: SearchResult) => void;

  async parse(): Promise<DocumentModel> {
    return makeDoc();
  }
  async renderPage(): Promise<RenderResult> {
    return { width: 0, height: 0 };
  }
  search(): Promise<SearchResult> {
    return new Promise<SearchResult>((res) => {
      this.resolve = res;
    });
  }
  settleSearch(result: SearchResult): void {
    this.resolve(result);
  }
  dispose(): void {}
}

function makeDoc(): DocumentModel {
  return {
    format: 'pdf',
    meta: { name: 't.pdf', size: 0, mimeType: 'application/pdf' },
    pageCount: 3,
    pages: Array.from({ length: 3 }, (_, i) => ({
      index: i,
      width: 100,
      height: 100,
      rotation: 0 as const,
    })),
  };
}

const QUERY: SearchQuery = {
  text: 'a',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  diacritics: false,
};

const RESULT: SearchResult = {
  query: QUERY,
  matches: [{ pageIndex: 0, text: 'a', x: 0, y: 0, width: 0.1, height: 0.02 }],
  totalMatches: 1,
};

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe('document/search lifecycle', () => {
  it('a search resolving after closeDocument does not resurrect results', async () => {
    const store = createViewerStore();
    const adapter = new DeferredSearchAdapter();
    store.setState({ adapter, document: makeDoc() });

    store.getState().search(QUERY);
    await flush();
    expect(store.getState().searchState).toBe('searching');

    store.getState().closeDocument();
    adapter.settleSearch(RESULT);
    await flush();

    expect(store.getState().document).toBeNull();
    expect(store.getState().searchState).toBe('idle');
    expect(store.getState().searchResult).toBeNull();
  });
});
