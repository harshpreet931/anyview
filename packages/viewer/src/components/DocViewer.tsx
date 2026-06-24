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
import { PasswordDialog, PropertiesDialog } from './Dialogs';

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
  const currentPage = useViewerStore((s) => s.currentPage);
  const pageCount = useViewerStore((s) => s.document?.pageCount ?? 0);

  const rootRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcuts();

  // Register the root as the fullscreen target and keep isFullscreen in sync
  // with the actual fullscreen state (covers Esc and browser-chrome exits).
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
      <div ref={rootRef} className={rootClassName} style={rootStyle} aria-label="Document viewer">
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

        {/* Announces page changes to assistive tech without stealing focus. */}
        <div className="dv-sr-only" role="status" aria-live="polite">
          {pageCount > 0 ? `Page ${currentPage + 1} of ${pageCount}` : ''}
        </div>

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
      download: () => store.getState().downloadDocument(),
      print: () => store.getState().printDocument(),
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
