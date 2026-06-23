/* ============================================================
 * DocViewer — main top-level component
 * ============================================================ */

import {
  useEffect,
  useRef,
  useMemo,
  useImperativeHandle,
  forwardRef,
  type CSSProperties,
} from 'react';
import type {
  DocViewerProps,
  DocViewerRef,
  AdapterRegistry,
} from '../core/types';
import { createRegistry } from '../core/registry';
import { registerBuiltInAdapters } from '../adapters';
import { createViewerStore } from '../core/store';
import { ViewerStoreProvider, useViewerStore } from '../hooks/useDocViewer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { I18nProvider } from '../i18n/I18nProvider';
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { ViewerContainer } from './Viewer';

function DocViewerInner(
  props: DocViewerProps & { store: ReturnType<typeof createViewerStore> },
) {
  const {
    source,
    onDocumentLoad,
    onError,
    onAnnotationChange,
    theme = 'auto',
    initialZoom,
    locale = 'en',
    showToolbar = true,
    showSidebar = true,
    className,
  } = props;

  const openDocument = useViewerStore((s) => s.openDocument);
  const closeDocument = useViewerStore((s) => s.closeDocument);
  const setTheme = useViewerStore((s) => s.setTheme);
  const setZoom = useViewerStore((s) => s.setZoom);
  const setLocale = useViewerStore((s) => s.setLocale);
  const onAnnotationChangeSub = useViewerStore((s) => s.onAnnotationChange);
  const document = useViewerStore((s) => s.document);
  const loadState = useViewerStore((s) => s.loadState);
  const loadError = useViewerStore((s) => s.loadError);
  const adapter = useViewerStore((s) => s.adapter);

  useKeyboardShortcuts();

  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  // Bridge internal annotation changes to the consumer callback.
  useEffect(() => {
    if (!onAnnotationChange) return;
    return onAnnotationChangeSub(onAnnotationChange);
  }, [onAnnotationChange, onAnnotationChangeSub]);

  useEffect(() => {
    if (initialZoom !== undefined) {
      setZoom(initialZoom);
    }
  }, [initialZoom, setZoom]);

  useEffect(() => {
    if (source) {
      openDocument(source);
    }
    return () => {
      closeDocument();
    };
  }, [source, openDocument, closeDocument]);

  useEffect(() => {
    if (loadState === 'loaded' && document && onDocumentLoad) {
      onDocumentLoad(document);
    }
  }, [loadState, document, onDocumentLoad]);

  useEffect(() => {
    if (loadState === 'error' && loadError && onError) {
      onError(loadError);
    }
  }, [loadState, loadError, onError]);

  const features = adapter?.manifest.features;
  const rootClassName = useMemo(() => {
    const classes = ['dv-root', `dv-theme-${theme}`];
    if (className) classes.push(className);
    return classes.join(' ');
  }, [theme, className]);

  const rootStyle: CSSProperties = {
    position: 'relative',
    width: '100%',
    height: '100%',
  };

  return (
    <I18nProvider locale={locale}>
      <div className={rootClassName} style={rootStyle} aria-label="Document viewer">
        <div className="dv-main-container">
          {showToolbar && <Toolbar {...(features ? { features } : {})} />}
          <div
            className="dv-loading-bar"
            data-active={loadState === 'loading'}
            role="progressbar"
            aria-label="Loading document"
            aria-hidden={loadState !== 'loading'}
          />
          <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
            {showSidebar && <Sidebar />}
            <div style={{ flex: 1, position: 'relative' }}>
              <ViewerContainer />
            </div>
          </div>
        </div>
      </div>
    </I18nProvider>
  );
}

export const DocViewer = forwardRef<DocViewerRef, DocViewerProps>(
  function DocViewer(props, ref) {
    const storeRef = useRef<ReturnType<typeof createViewerStore>>(undefined);

    if (!storeRef.current) {
      storeRef.current = createViewerStore();

      const registry: AdapterRegistry =
        props.registry ?? createRegistry();

      if (!props.registry) {
        registerBuiltInAdapters(registry);
      }

      storeRef.current.getState().setRegistry(registry);
    }

    const store = storeRef.current;

    useImperativeHandle(ref, () => ({
      goToPage: (index: number) => store.getState().goToPage(index),
      zoomIn: () => store.getState().zoomIn(),
      zoomOut: () => store.getState().zoomOut(),
      setZoom: (zoom: number) => store.getState().setZoom(zoom),
      rotate: (direction: 'cw' | 'ccw') =>
        direction === 'cw'
          ? store.getState().rotateClockwise()
          : store.getState().rotateCounterClockwise(),
      search: (query: import('../core/types').SearchQuery) => store.getState().search(query),
      nextMatch: () => store.getState().nextMatch(),
      prevMatch: () => store.getState().prevMatch(),
      download: async () => {
        const adapter = store.getState().adapter;
        if (adapter?.exportDocument) {
          const blob = await adapter.exportDocument('original');
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = store.getState().document?.meta.name ?? 'document';
          a.click();
          URL.revokeObjectURL(url);
        }
      },
      print: async () => {
        const state = store.getState();
        const ad = state.adapter;
        // Print the original bytes when the adapter can export them (PDF);
        // otherwise fall back to the browser print of the rendered DOM.
        if (ad?.exportDocument && state.document?.format === 'pdf') {
          try {
            const blob = await ad.exportDocument('original');
            const url = URL.createObjectURL(blob);
            const win = window.open(url);
            if (win) {
              win.addEventListener('load', () => win.print());
              return;
            }
            URL.revokeObjectURL(url);
          } catch {
            /* fall through to window.print() */
          }
        }
        window.print();
      },
      getDocument: () => store.getState().document,
      getAnnotations: () => store.getState().annotations,
    }), [store]);

    return (
      <ViewerStoreProvider store={store}>
        <DocViewerInner {...props} store={store} />
      </ViewerStoreProvider>
    );
  },
);
