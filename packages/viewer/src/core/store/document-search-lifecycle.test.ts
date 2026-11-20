import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import type { Adapter, DocumentModel, RenderResult, SearchResult } from '../types';
import { QUERY, flush, makeDoc, manifest } from './test-fixtures';

class DeferredSearchAdapter implements Adapter {
  readonly manifest = manifest({ search: true, textSelection: true });
  private resolve!: (result: SearchResult) => void;

  async parse(): Promise<DocumentModel> {
    return makeDoc(3);
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

const RESULT: SearchResult = {
  query: QUERY,
  matches: [{ pageIndex: 0, text: 'a', x: 0, y: 0, width: 0.1, height: 0.02 }],
  totalMatches: 1,
};

describe('document/search lifecycle', () => {
  it('a search resolving after closeDocument does not resurrect results', async () => {
    const store = createViewerStore();
    const adapter = new DeferredSearchAdapter();
    store.setState({ adapter, document: makeDoc(3) });

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
