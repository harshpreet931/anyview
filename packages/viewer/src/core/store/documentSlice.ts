/* ============================================================
 * Document Slice
 * Manages the loaded document, adapter, and load state.
 * ============================================================ */

import type { StateCreator } from 'zustand';
import type {
  Adapter,
  AdapterRegistry,
  DocumentModel,
  FileSource,
} from '../types';
import type { ViewerError } from '../errors';
import type { NavigationSlice } from './navigationSlice';
import type { ViewportSlice } from './viewportSlice';
import type { SearchSlice } from './searchSlice';
import type { AnnotationSlice } from './annotationSlice';
import { normalizeFileSource } from '../file-source';
import { PageCache } from '../cache/page-cache';

const PER_DOCUMENT_RESET = {
  currentPage: 0,
  scrollOffset: 0,
  rotation: 0 as const,
  searchQuery: null,
  searchResult: null,
  searchState: 'idle' as const,
  currentMatchIndex: 0,
  annotations: [],
  selectedAnnotationId: null,
  activeAnnotationTool: null,
};

export type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface DocumentSlice {
  document: DocumentModel | null;
  loadState: LoadState;
  loadError: ViewerError | null;
  adapter: Adapter | null;
  registry: AdapterRegistry | null;
  pageCache: PageCache;

  openDocument: (source: FileSource) => Promise<void>;
  closeDocument: () => void;
  setRegistry: (registry: AdapterRegistry) => void;

  _setDocument: (model: DocumentModel, adapter: Adapter) => void;
  _setLoadState: (state: LoadState, error?: ViewerError) => void;
  _loadController: AbortController | null;
}

export const createDocumentSlice: StateCreator<
  DocumentSlice & NavigationSlice & ViewportSlice & SearchSlice & AnnotationSlice,
  [],
  [],
  DocumentSlice
> = (set, get) => ({
  document: null,
  loadState: 'idle',
  loadError: null,
  adapter: null,
  registry: null,
  pageCache: new PageCache(),
  _loadController: null,

  openDocument: async (source: FileSource) => {
    get()._loadController?.abort();
    const controller = new AbortController();

    const registry = get().registry;
    if (!registry) {
      set({
        loadState: 'error',
        loadError: new (await import('../errors')).ViewerError(
          'UNSUPPORTED_FORMAT',
          'No adapter registry configured.',
        ),
      });
      return;
    }

    set({ loadState: 'loading', loadError: null, _loadController: controller });

    try {
      const reader = await normalizeFileSource(source);
      if (controller.signal.aborted) return;

      const format = registry.detectFormat(reader.meta.name, reader.meta.mimeType);

      if (!format) {
        const { ViewerError } = await import('../errors');
        throw new ViewerError(
          'UNSUPPORTED_FORMAT',
          `Cannot detect format for "${reader.meta.name}" (MIME: ${reader.meta.mimeType}).`,
        );
      }

      const adapter = await registry.loadAdapter(format);
      if (controller.signal.aborted) return;

      const model = await adapter.parse(reader, controller.signal);
      if (controller.signal.aborted) return;

      set({
        document: model,
        adapter,
        loadState: 'loaded',
        loadError: null,
        ...PER_DOCUMENT_RESET,
      });
    } catch (cause) {
      if (controller.signal.aborted) return;

      const { ViewerError, isViewerError } = await import('../errors');
      const error = isViewerError(cause)
        ? cause
        : new ViewerError('PARSE_ERROR', 'Failed to open document.', {
            cause,
            retryable: false,
          });

      set({
        loadState: 'error',
        loadError: error,
      });
    }
  },

  closeDocument: () => {
    get()._loadController?.abort();
    const { adapter, pageCache } = get();
    adapter?.dispose?.();
    pageCache.clear();

    set({
      document: null,
      adapter: null,
      loadState: 'idle',
      loadError: null,
      _loadController: null,
      ...PER_DOCUMENT_RESET,
    });
  },

  setRegistry: (registry: AdapterRegistry) => set({ registry }),

  _setDocument: (model: DocumentModel, adapter: Adapter) =>
    set({ document: model, adapter, loadState: 'loaded', loadError: null }),

  _setLoadState: (state: LoadState, error?: ViewerError) =>
    set({ loadState: state, loadError: error ?? null }),
});
