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
  FileSourceReader,
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
  downloadDocument: () => Promise<void>;
  printDocument: () => Promise<void>;
  /** Retry the pending encrypted document with a password. */
  submitPassword: (password: string) => Promise<void>;
  /** Abandon a pending encrypted document (user dismissed the prompt). */
  cancelPassword: () => void;

  _setDocument: (model: DocumentModel, adapter: Adapter) => void;
  _setLoadState: (state: LoadState, error?: ViewerError) => void;
  _loadController: AbortController | null;
  _source: FileSource | null;
  _pendingPassword: {
    adapter: Adapter;
    reader: FileSourceReader;
    source: FileSource;
  } | null;
  _runParse: (
    adapter: Adapter,
    reader: FileSourceReader,
    controller: AbortController,
    source: FileSource,
    password?: string,
  ) => Promise<void>;
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
  _source: null,
  _pendingPassword: null,

  openDocument: async (source: FileSource) => {
    get()._loadController?.abort();
    // Tear down the previously loaded document before opening another: dispose
    // its adapter (frees the PDF worker / ImageBitmaps) and clear the page
    // cache, whose key isn't document-scoped — otherwise a new same-format
    // document would be served the previous one's cached pages.
    get().adapter?.dispose?.();
    get()._pendingPassword?.adapter.dispose?.();
    get().pageCache.clear();
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

    set({
      loadState: 'loading',
      loadError: null,
      adapter: null,
      _loadController: controller,
      _pendingPassword: null,
    });

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

      await get()._runParse(adapter, reader, controller, source);
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

  // Runs adapter.parse and applies the result. A PASSWORD_REQUIRED/INCORRECT
  // failure keeps the adapter + reader alive so submitPassword can retry the
  // same instance (its worker and buffer are already warm).
  _runParse: async (adapter, reader, controller, source, password) => {
    try {
      const model = await adapter.parse(
        reader,
        controller.signal,
        password !== undefined ? { password } : undefined,
      );
      if (controller.signal.aborted) return;

      set({
        document: model,
        adapter,
        loadState: 'loaded',
        loadError: null,
        _source: source,
        _pendingPassword: null,
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

      if (
        error.code === 'PASSWORD_REQUIRED' ||
        error.code === 'PASSWORD_INCORRECT'
      ) {
        set({
          loadState: 'error',
          loadError: error,
          _pendingPassword: { adapter, reader, source },
        });
      } else {
        adapter.dispose?.();
        set({ loadState: 'error', loadError: error, _pendingPassword: null });
      }
    }
  },

  submitPassword: async (password: string) => {
    const pending = get()._pendingPassword;
    if (!pending) return;
    get()._loadController?.abort();
    const controller = new AbortController();
    set({ loadState: 'loading', loadError: null, _loadController: controller });
    await get()._runParse(
      pending.adapter,
      pending.reader,
      controller,
      pending.source,
      password,
    );
  },

  cancelPassword: () => {
    const pending = get()._pendingPassword;
    pending?.adapter.dispose?.();
    set({ _pendingPassword: null, loadState: 'idle', loadError: null });
  },

  closeDocument: () => {
    get()._loadController?.abort();
    const { adapter, pageCache, _pendingPassword } = get();
    adapter?.dispose?.();
    _pendingPassword?.adapter.dispose?.();
    pageCache.clear();

    set({
      document: null,
      adapter: null,
      loadState: 'idle',
      loadError: null,
      _loadController: null,
      _source: null,
      _pendingPassword: null,
      ...PER_DOCUMENT_RESET,
    });
  },

  setRegistry: (registry: AdapterRegistry) => set({ registry }),

  downloadDocument: async () => {
    const { adapter, document: model, _source } = get();
    if (!model) return;

    let blob: Blob | null = null;
    if (adapter?.exportDocument) {
      try {
        blob = await adapter.exportDocument('original');
      } catch {
        blob = null;
      }
    }
    if (!blob && _source) {
      try {
        const reader = await normalizeFileSource(_source);
        const buffer = await reader.arrayBuffer();
        blob = new Blob([buffer], {
          type: reader.meta.mimeType || 'application/octet-stream',
        });
      } catch {
        blob = null;
      }
    }
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const anchor = window.document.createElement('a');
    anchor.href = url;
    anchor.download = model.meta.name || 'document';
    anchor.rel = 'noopener';
    window.document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  },

  printDocument: async () => {
    const { adapter, document: model } = get();
    if (!model) return;

    // Print the original bytes in a new tab when the adapter can export them
    // (PDF); otherwise fall back to the browser print of the rendered DOM.
    if (adapter?.exportDocument && model.format === 'pdf') {
      try {
        const blob = await adapter.exportDocument('original');
        const url = URL.createObjectURL(blob);
        const win = window.open(url);
        if (win) {
          win.addEventListener('load', () => win.print());
          // Revoke once the print window has had time to load the bytes.
          setTimeout(() => URL.revokeObjectURL(url), 60_000);
          return;
        }
        URL.revokeObjectURL(url);
      } catch {
        /* fall through to window.print() */
      }
    }
    window.print();
  },

  _setDocument: (model: DocumentModel, adapter: Adapter) =>
    set({ document: model, adapter, loadState: 'loaded', loadError: null }),

  _setLoadState: (state: LoadState, error?: ViewerError) =>
    set({ loadState: state, loadError: error ?? null }),
});
