/* ============================================================
 * Core Type System
 * All shared types & interfaces for the document viewer.
 * This file is framework-agnostic — no React imports.
 * ============================================================ */

/* ---------- §3.1 Format Identity ---------- */

/**
 * String literal union of all supported format identifiers.
 * Adapters are keyed by this. The union is exhaustive —
 * the switch in format-detect.ts must cover every variant.
 */
export type FormatId =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'image'
  | 'markdown'
  | 'code'
  | 'csv'
  | 'html'
  | 'text';

/**
 * Extended MIME superset for format detection.
 * Each FormatId maps to one or more MIME types and extensions.
 */
export interface FormatSpec {
  readonly id: FormatId;
  readonly extensions: readonly string[];
  readonly mimeTypes: readonly string[];
}

/* ---------- §3.2 File Source ---------- */

/**
 * Unified file input abstraction. Adapters receive this and
 * normalize it internally. Every entry point (drag-drop, picker,
 * URL, buffer) produces one of these variants.
 */
export type FileSource =
  | { kind: 'file'; file: File }
  | { kind: 'handle'; handle: FileSystemFileHandle }
  | { kind: 'url'; url: string; filename?: string }
  | { kind: 'buffer'; buffer: ArrayBuffer; name: string; type: string };

/**
 * Normalized metadata extracted from any FileSource.
 */
export interface FileMeta {
  readonly name: string;
  readonly size: number;
  readonly mimeType: string;
  readonly lastModified?: number;
}

/**
 * Convert any FileSource to an ArrayBuffer (for worker transfer)
 * or a ReadableStream (for streaming). Adapters choose.
 */
export interface FileSourceReader {
  readonly meta: FileMeta;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): ReadableStream<Uint8Array> | null;
}

/* ---------- §3.3 Document Model ---------- */

/**
 * The parsed representation of a document, produced by an adapter.
 * This is format-agnostic — the viewer core operates on this shape
 * regardless of whether it's a PDF, DOCX, or image.
 */
export interface DocumentModel {
  readonly format: FormatId;
  readonly meta: FileMeta;
  readonly pageCount: number;
  readonly pages: ReadonlyArray<PageRef>;
  readonly outline?: ReadonlyArray<OutlineNode>;
  readonly attachments?: ReadonlyArray<AttachmentRef>;
  readonly metadata?: DocumentMetadata;
  readonly permissions?: DocumentPermissions;
}

export interface PageRef {
  readonly index: number;
  readonly width: number;
  readonly height: number;
  readonly rotation: 0 | 90 | 180 | 270;
  readonly label?: string;
}

export interface OutlineNode {
  readonly title: string;
  readonly dest: PageDestination | string | readonly unknown[];
  readonly children?: ReadonlyArray<OutlineNode>;
}

export interface PageDestination {
  readonly pageIndex: number;
  readonly scrollOffset?: number;
  readonly zoom?: number;
}

export interface AttachmentRef {
  readonly id: string;
  readonly name: string;
  readonly mimeType: string;
  readonly size: number;
  readonly getData: () => Promise<Blob>;
}

export interface DocumentMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly subject?: string;
  readonly keywords?: string;
  readonly creator?: string;
  readonly producer?: string;
  readonly creationDate?: Date;
  readonly modificationDate?: Date;
  readonly [key: string]: unknown;
}

export interface DocumentPermissions {
  readonly canPrint: boolean;
  readonly canCopy: boolean;
  readonly canAnnotate: boolean;
  readonly canEdit: boolean;
  readonly canFillForms: boolean;
}

/* ---------- §3.4 Adapter Capabilities ---------- */

export interface AdapterFeatures {
  readonly search: boolean;
  readonly annotations: boolean;
  readonly textSelection: boolean;
  readonly print: boolean;
  readonly thumbnails: boolean;
  readonly outline: boolean;
  readonly zoom: boolean;
  readonly rotation: boolean;
  readonly attachments: boolean;
  readonly fullscreen: boolean;
  readonly download: boolean;
}

/* ---------- §3.5 Render Target & Result ---------- */

export type RenderTarget = HTMLCanvasElement | HTMLElement;

export interface RenderContext {
  readonly page: PageRef;
  readonly target: RenderTarget;
  readonly scale: number;
  readonly rotation: 0 | 90 | 180 | 270;
  readonly devicePixelRatio: number;
  readonly signal: AbortSignal;
}

export interface RenderResult {
  readonly width: number;
  readonly height: number;
}

/**
 * Text layer for search + selection + a11y.
 * Adapters that support textSelection provide this per-page.
 *
 * NOTE: PDF.js `getTextContent()` returns items in PDF device-space
 * coordinates (using a 6-element `transform` array). The PDF adapter
 * must apply `page.getViewport({ scale: 1 }).transform` to convert
 * to page-relative coordinates, then normalize to 0–1 range.
 */
export interface TextLayerItem {
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextLayer {
  readonly pageIndex: number;
  readonly items: ReadonlyArray<TextLayerItem>;
}

/* ---------- §3.6 Search ---------- */

export interface SearchQuery {
  readonly text: string;
  readonly caseSensitive: boolean;
  readonly wholeWord: boolean;
  readonly regex: boolean;
  readonly diacritics: boolean;
}

export interface SearchMatch {
  readonly pageIndex: number;
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SearchResult {
  readonly query: SearchQuery;
  readonly matches: ReadonlyArray<SearchMatch>;
  readonly totalMatches: number;
}

/* ---------- §3.7 Annotations ---------- */

export type AnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikethrough'
  | 'sticky-note'
  | 'free-text'
  | 'ink'
  | 'shape'
  | 'stamp'
  | 'redaction';

export interface BaseAnnotation<
  T extends AnnotationType = AnnotationType,
  D = Record<string, unknown>,
> {
  readonly id: string;
  readonly pageIndex: number;
  readonly type: T;
  readonly color: string;
  readonly opacity: number;
  readonly createdBy?: string;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly data: D;
}

export interface HighlightAnnotation extends BaseAnnotation<'highlight'> {
  readonly data: {
    readonly rects: ReadonlyArray<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  };
}

export interface InkAnnotation extends BaseAnnotation<'ink'> {
  readonly data: {
    readonly paths: ReadonlyArray<ReadonlyArray<{ x: number; y: number }>>;
    readonly thickness: number;
  };
}

export interface StickyNoteAnnotation extends BaseAnnotation<'sticky-note'> {
  readonly data: {
    readonly x: number;
    readonly y: number;
    readonly comment: string;
  };
}

export type Annotation =
  | HighlightAnnotation
  | InkAnnotation
  | StickyNoteAnnotation;

export type AnnotationChangeListener = (annotations: Annotation[]) => void;

/* ---------- §4 Adapter Registry Protocol ---------- */

export interface AdapterManifest {
  readonly id: FormatId;
  readonly label: string;
  readonly extensions: readonly string[];
  readonly mimeTypes: readonly string[];
  readonly icon: string;
  readonly features: AdapterFeatures;
  readonly priority: number;
  readonly protocolVersion: number;
}

export interface ParseOptions {
  /** Password for an encrypted document, supplied on a retry after the
   *  adapter reported PASSWORD_REQUIRED/PASSWORD_INCORRECT. */
  readonly password?: string;
}

export interface Adapter {
  readonly manifest: AdapterManifest;
  parse(
    source: FileSourceReader,
    signal: AbortSignal,
    options?: ParseOptions,
  ): Promise<DocumentModel>;
  renderPage(ctx: RenderContext): Promise<RenderResult>;
  getTextLayer?(pageIndex: number, signal?: AbortSignal): Promise<TextLayer>;
  search?(query: SearchQuery, signal: AbortSignal): Promise<SearchResult>;
  exportDocument?(format: 'original' | 'pdf'): Promise<Blob>;
  dispose?(): void;
}

/**
 * A no-argument constructor that produces a fresh {@link Adapter} instance.
 *
 * Adapters MUST be loaded as classes (not pre-constructed singletons) so the
 * registry can hand every open document its own instance. Sharing a single
 * adapter instance across documents/viewers corrupts per-document state
 * (worker handles, buffers, page refs).
 */
export type AdapterConstructor = new () => Adapter;

/**
 * The loader registered with the registry. Performs a dynamic `import()` of
 * the adapter module and resolves to its default export, which must be an
 * {@link AdapterConstructor}.
 */
export type AdapterLoader = () => Promise<{ default: AdapterConstructor }>;

export interface AdapterRegistry {
  register(manifest: AdapterManifest, loader: AdapterLoader): void;
  getManifests(): readonly AdapterManifest[];
  detectFormat(filename: string, mimeType?: string): FormatId | null;
  getManifest(format: FormatId): AdapterManifest | null;
  /**
   * Load the adapter for a format and return a FRESH instance. The underlying
   * module is imported once and cached; the constructor is invoked on every
   * call so each document gets isolated state.
   */
  loadAdapter(format: FormatId): Promise<Adapter>;
  unloadAdapter(format: FormatId): void;
  onRegister(cb: (manifest: AdapterManifest) => void): () => void;
}

/* ---------- §7 Store Types ---------- */

export type Theme = 'light' | 'dark' | 'auto' | 'sepia';
export type SidebarView = 'thumbnails' | 'outline' | 'attachments' | 'layers';
export type FitMode = 'actual-size' | 'page-fit' | 'page-width' | 'custom';
export type ScrollMode = 'page' | 'vertical' | 'horizontal' | 'wrapped';
export type SpreadMode = 'none' | 'odd' | 'even';
export type CursorMode = 'select' | 'hand';

export interface RecentFile {
  readonly id: string;
  readonly name: string;
  readonly format: FormatId;
  readonly handle?: FileSystemFileHandle;
}

/* ---------- §12 Component Props ---------- */

export interface DocViewerProps {
  source?: FileSource;
  onDocumentLoad?: (model: DocumentModel) => void;
  onError?: (error: import('./errors').ViewerError) => void;
  onAnnotationChange?: (annotations: Annotation[]) => void;
  theme?: Theme;
  initialZoom?: number;
  showToolbar?: boolean;
  showSidebar?: boolean;
  registry?: AdapterRegistry;
  locale?: string;
  className?: string;
  /**
   * localStorage key for persisted UI preferences. Give each <DocViewer> on a
   * page a distinct key so their zoom/theme/sidebar prefs don't collide.
   */
  persistKey?: string;
}

export interface DocViewerRef {
  goToPage: (index: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setZoom: (zoom: number) => void;
  rotate: (direction: 'cw' | 'ccw') => void;
  search: (query: SearchQuery) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  download: () => Promise<void>;
  print: () => Promise<void>;
  getDocument: () => DocumentModel | null;
  getAnnotations: () => Annotation[];
}
