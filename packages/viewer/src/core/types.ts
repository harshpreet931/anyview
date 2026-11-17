/** The formats anyview ships adapters for. */
export type BuiltInFormatId =
  | 'pdf'
  | 'docx'
  | 'xlsx'
  | 'pptx'
  | 'image'
  | 'markdown'
  | 'code'
  | 'csv'
  | 'html'
  | 'text'
  | 'ipynb';

/** A built-in format, or the id of a custom adapter registered at runtime. */
export type FormatId = BuiltInFormatId | (string & {});

/** Each FormatId maps to one or more MIME types and extensions. */
export interface FormatSpec {
  readonly id: FormatId;
  readonly extensions: readonly string[];
  readonly mimeTypes: readonly string[];
}

/** Unified file input abstraction produced by every entry point. */
export type FileSource =
  | { kind: 'file'; file: File }
  | { kind: 'handle'; handle: FileSystemFileHandle }
  | { kind: 'url'; url: string; filename?: string }
  | { kind: 'buffer'; buffer: ArrayBuffer; name: string; type: string };

/** Normalized metadata extracted from any FileSource. */
export interface FileMeta {
  readonly name: string;
  readonly size: number;
  readonly mimeType: string;
  readonly lastModified?: number;
}

/** Convert any FileSource to an ArrayBuffer or a ReadableStream. */
export interface FileSourceReader {
  readonly meta: FileMeta;
  arrayBuffer(): Promise<ArrayBuffer>;
  stream(): ReadableStream<Uint8Array> | null;
}

/** The parsed, format-agnostic representation of a document, produced by an adapter. */
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
  readonly bitmap?: ImageBitmap;
}

/** A positioned text item (coordinates normalized to 0–1) for search, selection, and a11y. */
export interface TextLayerItem {
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Clockwise on-screen angle of the run in degrees; (x, y) is its top-left before rotating. */
  readonly angle?: number;
}

export interface TextLayer {
  readonly pageIndex: number;
  readonly items: ReadonlyArray<TextLayerItem>;
}

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

export type ShapeKind = 'rectangle' | 'ellipse' | 'line' | 'arrow';

export interface ShapeAnnotation extends BaseAnnotation<'shape'> {
  readonly data: {
    readonly shape: ShapeKind;
    /** Drag start/end, normalized 0–1. Direction is preserved for line/arrow. */
    readonly from: { x: number; y: number };
    readonly to: { x: number; y: number };
    readonly strokeWidth: number;
  };
}

export interface FreeTextAnnotation extends BaseAnnotation<'free-text'> {
  readonly data: {
    readonly x: number;
    readonly y: number;
    readonly text: string;
    /** Font size as a fraction of page height. */
    readonly fontSize: number;
  };
}

export type Annotation =
  | HighlightAnnotation
  | InkAnnotation
  | StickyNoteAnnotation
  | ShapeAnnotation
  | FreeTextAnnotation;

/** A selectable annotation creation tool (distinct from the stored type). */
export type AnnotationTool =
  | 'highlight'
  | 'ink'
  | 'sticky-note'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'free-text';

export type AnnotationChangeListener = (annotations: Annotation[]) => void;

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
  /** Password for an encrypted document, supplied on a retry. */
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
  // `rotation` is the interactively-applied rotation; adapters compose it with any intrinsic rotation of their own.
  getTextLayer?(
    pageIndex: number,
    signal?: AbortSignal,
    rotation?: number,
  ): Promise<TextLayer>;
  search?(
    query: SearchQuery,
    signal: AbortSignal,
    rotation?: number,
  ): Promise<SearchResult>;
  exportDocument?(format: 'original' | 'pdf'): Promise<Blob>;
  dispose?(): void;
}

/** A no-argument constructor that produces a fresh {@link Adapter} instance. */
export type AdapterConstructor = new () => Adapter;

/** Dynamic-import loader resolving to the adapter module's default {@link AdapterConstructor}. */
export type AdapterLoader = () => Promise<{ default: AdapterConstructor }>;

export interface AdapterRegistry {
  register(manifest: AdapterManifest, loader: AdapterLoader): void;
  getManifests(): readonly AdapterManifest[];
  detectFormat(filename: string, mimeType?: string, head?: Uint8Array): FormatId | null;
  getManifest(format: FormatId): AdapterManifest | null;
  /** Load the adapter for a format and return a FRESH instance. */
  loadAdapter(format: FormatId): Promise<Adapter>;
  unloadAdapter(format: FormatId): void;
  onRegister(cb: (manifest: AdapterManifest) => void): () => void;
}

export type Theme = 'light' | 'dark' | 'auto' | 'sepia';
export type SidebarView = 'thumbnails' | 'outline' | 'attachments' | 'layers';
export type FitMode = 'actual-size' | 'page-fit' | 'page-width' | 'custom';
export type ScrollMode = 'page' | 'vertical' | 'horizontal' | 'wrapped';
export type SpreadMode = 'none' | 'odd' | 'even';
export type CursorMode = 'select' | 'hand' | 'marquee';

export interface RecentFile {
  readonly id: string;
  readonly name: string;
  readonly format: FormatId;
  readonly handle?: FileSystemFileHandle;
}

export interface DocViewerSelection {
  readonly text: string;
  readonly pageIndex?: number;
}

export interface DocViewerProps {
  source?: FileSource;
  /** Rendered inside the viewer, so components here can use the viewer hooks (useNavigation, useZoom, ...). */
  children?: import('react').ReactNode;
  onDocumentLoad?: (model: DocumentModel) => void;
  onError?: (error: import('./errors').ViewerError) => void;
  onAnnotationChange?: (annotations: Annotation[]) => void;
  /** Controlled current page - driving this prop navigates the viewer. */
  page?: number;
  onPageChange?: (page: number, pageCount: number) => void;
  onZoom?: (zoom: number, fitMode: FitMode) => void;
  onSearchResult?: (result: SearchResult | null) => void;
  onVisiblePagesChange?: (pages: number[]) => void;
  onSelectionChange?: (selection: DocViewerSelection) => void;
  theme?: Theme;
  initialZoom?: number;
  showToolbar?: boolean;
  showSidebar?: boolean;
  registry?: AdapterRegistry;
  locale?: string;
  className?: string;
  /** localStorage key for persisted UI preferences; give each <DocViewer> a distinct key. */
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
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (
    id: string,
    patch: Partial<Omit<Annotation, 'id' | 'pageIndex' | 'type'>>,
  ) => void;
  deleteAnnotation: (id: string) => void;
  setAnnotations: (annotations: Annotation[]) => void;
  clearAnnotations: () => void;
  setActiveTool: (tool: AnnotationTool | null) => void;
  exportAnnotations: () => import('./annotations').SerializedAnnotations;
  importAnnotations: (
    data: import('./annotations').SerializedAnnotations | string,
  ) => void;
}
