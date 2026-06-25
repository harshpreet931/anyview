/* ============================================================
 * Public API Surface - Barrel Export
 * ============================================================ */

import './styles/viewer.css';

// Main component
export { DocViewer } from './components/DocViewer';

// Types
export type {
  FormatId,
  FormatSpec,
  FileSource,
  FileSourceReader,
  FileMeta,
  DocumentModel,
  PageRef,
  OutlineNode,
  PageDestination,
  AttachmentRef,
  DocumentMetadata,
  DocumentPermissions,
  AdapterManifest,
  AdapterFeatures,
  Adapter,
  AdapterLoader,
  AdapterConstructor,
  AdapterRegistry,
  RenderContext,
  RenderResult,
  RenderTarget,
  TextLayer,
  TextLayerItem,
  SearchQuery,
  SearchMatch,
  SearchResult,
  Annotation,
  AnnotationType,
  AnnotationChangeListener,
  BaseAnnotation,
  HighlightAnnotation,
  InkAnnotation,
  StickyNoteAnnotation,
  Theme,
  SidebarView,
  FitMode,
  ScrollMode,
  SpreadMode,
  CursorMode,
  RecentFile,
  DocViewerProps,
  DocViewerRef,
} from './core/types';

// Errors
export { ViewerError, isViewerError } from './core/errors';
export type { ViewerErrorCode } from './core/errors';

// Registry
export { createRegistry } from './core/registry';
export { registerBuiltInAdapters } from './adapters';

// Store
export { createViewerStore } from './core/store';
export type { ViewerStore } from './core/store';
export type {
  DocumentSlice,
  LoadState,
  NavigationSlice,
  ViewportSlice,
  SearchSlice,
  SearchState,
  AnnotationSlice,
  UiSlice,
  ToolbarDensity,
} from './core/store';

// Utilities
export { normalizeFileSource } from './core/file-source';
export { detectFormat, getFormatSpecs, getFormatSpec } from './core/format-detect';
export { PageCache, makeCacheKey, estimateBitmapByteSize } from './core/cache/page-cache';
export { LRUCache } from './core/cache/lru-cache';
export { serializeAnnotations, parseAnnotations } from './core/annotations';
export type { SerializedAnnotations } from './core/annotations';

// i18n
export {
  I18nProvider,
  useStrings,
  registerStrings,
  resolveStrings,
  formatString,
} from './i18n/I18nProvider';

// Hooks
export { useDocViewer, useViewerStore, ViewerStoreProvider } from './hooks/useDocViewer';
export { useDocument } from './hooks/useDocument';
export { useZoom } from './hooks/useZoom';
export { useNavigation } from './hooks/useNavigation';
export { useSearch } from './hooks/useSearch';
export { useAnnotations } from './hooks/useAnnotations';
export { useVirtualizerHook } from './hooks/useVirtualizer';
export { useFileInput } from './hooks/useFileInput';
export { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
export { useFocusTrap } from './hooks/useFocusTrap';

// Common components
export { Icon } from './components/common/Icon';
export { Button } from './components/common/Button';
export { Tooltip } from './components/common/Tooltip';
export { Spinner } from './components/common/Spinner';

// Dialogs
export { PasswordDialog } from './components/Dialogs/PasswordDialog';
export { PropertiesDialog } from './components/Dialogs/PropertiesDialog';
export { ErrorDialog } from './components/Dialogs/ErrorDialog';

// i18n
export { en as defaultStrings } from './i18n/en';
export type { ViewerStrings } from './i18n/types';
