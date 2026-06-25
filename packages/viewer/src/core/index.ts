/* ============================================================
 * Core barrel export - framework-agnostic
 * ============================================================ */

export * from './types';
export { ViewerError, isViewerError, type ViewerErrorCode } from './errors';
export { createRegistry } from './registry';
export { detectFormat, getFormatSpecs, getFormatSpec } from './format-detect';
export { normalizeFileSource } from './file-source';
export { LRUCache, type LRUEntry } from './cache/lru-cache';
export {
  PageCache,
  makeCacheKey,
  estimateBitmapByteSize,
  type CachedPage,
} from './cache/page-cache';
export { createViewerStore, type ViewerStore } from './store';
export type {
  DocumentSlice,
  LoadState,
} from './store/documentSlice';
export type { NavigationSlice } from './store/navigationSlice';
export type { ViewportSlice } from './store/viewportSlice';
export type { SearchSlice, SearchState } from './store/searchSlice';
export type { AnnotationSlice } from './store/annotationSlice';
export type { UiSlice, ToolbarDensity } from './store/uiSlice';
