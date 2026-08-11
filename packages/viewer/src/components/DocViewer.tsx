import {
  useEffect,
  useRef,
  useMemo,
  useState,
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
import { parseAnnotations } from '../core/annotations';
import { registerBuiltInAdapters } from '../adapters';
import { createViewerStore } from '../core/store';
import { ViewerStoreProvider, useViewerStore } from '../hooks/useDocViewer';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { I18nProvider, useStrings } from '../i18n/I18nProvider';
import { formatString } from '../i18n/strings';
import { Toolbar } from './Toolbar/Toolbar';
import { Sidebar } from './Sidebar/Sidebar';
import { ViewerContainer } from './Viewer/ViewerContainer';
import { PasswordDialog } from './Dialogs/PasswordDialog';
import { PropertiesDialog } from './Dialogs/PropertiesDialog';

const ROOT_STYLE: CSSProperties = {
  position: 'relative',
  width: '100%',
  height: '100%',
};

function PageAnnouncer() {
  const strings = useStrings();
  const currentPage = useViewerStore((s) => s.currentPage);
  const pageCount = useViewerStore((s) => s.document?.pageCount ?? 0);
  return (
    <div className="dv-sr-only" role="status" aria-live="polite">
      {pageCount > 0
        ? formatString(strings.navigation.pageStatus, currentPage + 1, pageCount)
        : ''}
    </div>
  );
}

function DocViewerInner(
  props: DocViewerProps & { store: ReturnType<typeof createViewerStore> },
) {
  const {
    source,
    onDocumentLoad,
    onError,
    onAnnotationChange,
    page,
    onPageChange,
    onZoom,
    onSearchResult,
    onVisiblePagesChange,
    onSelectionChange,
    theme = 'auto',
    initialZoom,
    locale = 'en',
    showToolbar = true,
    showSidebar = true,
    className,
    store,
  } = props;

  const openDocument = useViewerStore((s) => s.openDocument);
  const closeDocument = useViewerStore((s) => s.closeDocument);
  const setTheme = useViewerStore((s) => s.setTheme);
  const setZoom = useViewerStore((s) => s.setZoom);
  const setLocale = useViewerStore((s) => s.setLocale);
  const onAnnotationChangeSub = useViewerStore((s) => s.onAnnotationChange);
  const document = useViewerStore((s) => s.document);
  const loadState = useViewerStore((s) => s.loadState);
  const adapter = useViewerStore((s) => s.adapter);

  const submitPassword = useViewerStore((s) => s.submitPassword);
  const cancelPassword = useViewerStore((s) => s.cancelPassword);
  const passwordPending = useViewerStore((s) => s._pendingPassword !== null);
  const passwordIncorrect = useViewerStore(
    (s) => s.loadError?.code === 'PASSWORD_INCORRECT',
  );
  const pendingFileName = useViewerStore(
    (s) => s._pendingPassword?.reader.meta.name ?? 'document',
  );
  const propertiesOpen = useViewerStore((s) => s.propertiesOpen);
  const setPropertiesOpen = useViewerStore((s) => s.setPropertiesOpen);
  const setRootElement = useViewerStore((s) => s.setRootElement);
  const setFullscreen = useViewerStore((s) => s._setFullscreen);
  const pageCache = useViewerStore((s) => s.pageCache);

  const rootRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcuts();

  useEffect(() => {
    const onVisibility = () => {
      if (window.document.visibilityState === 'hidden') pageCache.trim();
    };
    window.document.addEventListener('visibilitychange', onVisibility);
    return () =>
      window.document.removeEventListener('visibilitychange', onVisibility);
  }, [pageCache]);

  useEffect(() => {
    setRootElement(rootRef.current);
    const onChange = () =>
      setFullscreen(window.document.fullscreenElement === rootRef.current);
    window.document.addEventListener('fullscreenchange', onChange);
    return () => {
      window.document.removeEventListener('fullscreenchange', onChange);
      setRootElement(null);
    };
  }, [setRootElement, setFullscreen]);

  useEffect(() => {
    setTheme(theme);
  }, [theme, setTheme]);

  useEffect(() => {
    setLocale(locale);
  }, [locale, setLocale]);

  useEffect(() => {
    if (!onAnnotationChange) return;
    return onAnnotationChangeSub(onAnnotationChange);
  }, [onAnnotationChange, onAnnotationChangeSub]);

  useEffect(() => {
    if (!onPageChange) return;
    return store.subscribe(
      (s) => s.currentPage,
      (p) => onPageChange(p, store.getState().document?.pageCount ?? 0),
    );
  }, [onPageChange, store]);

  useEffect(() => {
    if (!onZoom) return;
    return store.subscribe(
      (s) => s.zoom,
      (z) => onZoom(z, store.getState().fitMode),
    );
  }, [onZoom, store]);

  useEffect(() => {
    if (!onSearchResult) return;
    return store.subscribe(
      (s) => s.searchResult,
      (r) => onSearchResult(r),
    );
  }, [onSearchResult, store]);

  useEffect(() => {
    if (!onVisiblePagesChange) return;
    return store.subscribe(
      (s) => s.visiblePages,
      (pages) => onVisiblePagesChange(pages),
      { equalityFn: (a, b) => a.length === b.length && a.every((p, i) => p === b[i]) },
    );
  }, [onVisiblePagesChange, store]);

  useEffect(() => {
    if (page != null && loadState === 'loaded') store.getState().goToPage(page);
  }, [page, store, loadState]);

  useEffect(() => {
    if (!onSelectionChange) return;
    const handler = () => {
      const root = rootRef.current;
      const sel = window.getSelection();
      if (!root || !sel || sel.rangeCount === 0) return;
      const anchor = sel.anchorNode;
      if (!anchor || !root.contains(anchor)) return;
      const host = anchor.nodeType === 1 ? (anchor as Element) : anchor.parentElement;
      const pageEl = host?.closest?.('[data-page-index]');
      const idx = pageEl ? Number(pageEl.getAttribute('data-page-index')) : NaN;
      onSelectionChange({
        text: sel.toString(),
        ...(Number.isNaN(idx) ? {} : { pageIndex: idx }),
      });
    };
    window.document.addEventListener('selectionchange', handler);
    return () => window.document.removeEventListener('selectionchange', handler);
  }, [onSelectionChange]);

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

  // Both fire on the store transition, not on rendered state: an inline callback prop would
  // otherwise change identity every render and re-announce a load that already happened.
  useEffect(() => {
    if (!onDocumentLoad) return;
    return store.subscribe(
      (s) => (s.loadState === 'loaded' ? s.document : null),
      (model) => {
        if (model) onDocumentLoad(model);
      },
    );
  }, [onDocumentLoad, store]);

  useEffect(() => {
    if (!onError) return;
    return store.subscribe(
      (s) => (s.loadState === 'error' ? s.loadError : null),
      (error) => {
        if (error) onError(error);
      },
    );
  }, [onError, store]);

  const features = adapter?.manifest.features;
  const rootClassName = useMemo(() => {
    const classes = ['dv-root', `dv-theme-${theme}`];
    if (className) classes.push(className);
    return classes.join(' ');
  }, [theme, className]);

  return (
    <I18nProvider locale={locale}>
      <div ref={rootRef} className={rootClassName} style={ROOT_STYLE} aria-label="Document viewer">
        <div className="dv-main-container">
          {showToolbar && <Toolbar {...(features ? { features } : {})} />}
          <progress
            className="dv-loading-bar"
            data-active={loadState === 'loading'}
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

        <PageAnnouncer />

        {passwordPending && (
          <PasswordDialog
            fileName={pendingFileName}
            incorrect={passwordIncorrect}
            onSubmit={(pw) => submitPassword(pw)}
            onCancel={cancelPassword}
          />
        )}

        {propertiesOpen && document && (
          <PropertiesDialog
            document={document}
            onClose={() => setPropertiesOpen(false)}
          />
        )}
      </div>
    </I18nProvider>
  );
}

export const DocViewer = forwardRef<DocViewerRef, DocViewerProps>(
  function DocViewer(props, ref) {
    const [store] = useState(() => {
      const s = createViewerStore(
        props.persistKey ? { persistKey: props.persistKey } : undefined,
      );

      const registry: AdapterRegistry = props.registry ?? createRegistry();
      if (!props.registry) {
        registerBuiltInAdapters(registry);
      }
      s.getState().setRegistry(registry);

      return s;
    });

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
      download: () => store.getState().downloadDocument(),
      print: () => store.getState().printDocument(),
      getDocument: () => store.getState().document,
      getAnnotations: () => store.getState().annotations,
      addAnnotation: (annotation) => store.getState().addAnnotation(annotation),
      updateAnnotation: (id, patch) => store.getState().updateAnnotation(id, patch),
      deleteAnnotation: (id) => store.getState().deleteAnnotation(id),
      setAnnotations: (annotations) => store.getState().setAnnotations(annotations),
      clearAnnotations: () => store.getState().clearAnnotations(),
      setActiveTool: (tool) => store.getState().setActiveTool(tool),
      exportAnnotations: () => ({
        version: 1,
        annotations: store.getState().annotations,
      }),
      importAnnotations: (data) => {
        const annotations =
          typeof data === 'string' ? parseAnnotations(data) : data.annotations;
        store.getState().setAnnotations(annotations);
      },
    }), [store]);

    return (
      <ViewerStoreProvider store={store}>
        <DocViewerInner {...props} store={store} />
      </ViewerStoreProvider>
    );
  },
);
