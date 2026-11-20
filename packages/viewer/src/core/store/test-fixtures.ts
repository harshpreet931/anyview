import type {
  Adapter,
  AdapterFeatures,
  AdapterManifest,
  DocumentModel,
  FileSource,
  FileSourceReader,
  RenderResult,
  SearchQuery,
} from '../types';

export function manifest(features: Partial<AdapterFeatures> = {}): AdapterManifest {
  return {
    id: 'pdf',
    label: 'PDF',
    extensions: ['pdf'],
    mimeTypes: ['application/pdf'],
    icon: '',
    features: {
      search: false,
      annotations: false,
      textSelection: false,
      print: false,
      thumbnails: false,
      outline: false,
      zoom: true,
      rotation: false,
      attachments: false,
      fullscreen: false,
      download: false,
      ...features,
    },
    priority: 100,
    protocolVersion: 1,
  };
}

export function makeDoc(pageCount = 1): DocumentModel {
  return {
    format: 'pdf',
    meta: { name: 't.pdf', size: 0, mimeType: 'application/pdf' },
    pageCount,
    pages: Array.from({ length: pageCount }, (_, index) => ({
      index,
      width: 100,
      height: 100,
      rotation: 0 as const,
    })),
  };
}

export class DeferredAdapter implements Adapter {
  readonly manifest = manifest();
  disposeCount = 0;
  parseCount = 0;
  private resolve!: (model: DocumentModel) => void;
  private reject!: (err: unknown) => void;

  parse(): Promise<DocumentModel> {
    this.parseCount += 1;
    return new Promise<DocumentModel>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
  settle(model: DocumentModel): void {
    this.resolve(model);
  }
  fail(err: unknown): void {
    this.reject(err);
  }
  async renderPage(): Promise<RenderResult> {
    return { width: 0, height: 0 };
  }
  dispose(): void {
    this.disposeCount += 1;
  }
}

export const reader: FileSourceReader = {
  meta: { name: 't.pdf', size: 0, mimeType: 'application/pdf' },
  arrayBuffer: async () => new ArrayBuffer(0),
  stream: () => null,
};

export function bufferSource(name = 't.pdf'): FileSource {
  return { kind: 'buffer', buffer: new ArrayBuffer(4), name, type: 'application/pdf' };
}

export const source = bufferSource();

export const QUERY: SearchQuery = {
  text: 'a',
  caseSensitive: false,
  wholeWord: false,
  regex: false,
  diacritics: false,
};

export const flush = () => new Promise<void>((r) => setTimeout(r, 0));
