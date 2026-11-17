import type { PageRef } from '../../core/types';

export interface ParsedPdf {
  readonly pageCount: number;
  readonly pages: PageRef[];
  readonly docId: number;
}

export interface PdfOutlineItem {
  readonly title: string;
  readonly dest: { readonly pageIndex: number };
  readonly items?: readonly PdfOutlineItem[];
}

export interface PdfMetadata {
  readonly title?: string;
  readonly author?: string;
  readonly subject?: string;
  readonly keywords?: string;
  readonly creator?: string;
  readonly producer?: string;
  readonly creationDate?: Date;
  readonly modificationDate?: Date;
}

export interface PdfWorkerApi {
  parse(
    data: ArrayBuffer,
    password?: string,
    assetBase?: string,
  ): Promise<ParsedPdf>;
  renderPage(
    docId: number,
    pageIndex: number,
    scale: number,
    rotation: number,
    dpr: number,
    renderId?: number,
  ): Promise<ImageBitmap>;
  cancelRender(renderId: number): void;
  getTextContent(
    docId: number,
    pageIndex: number,
    rotation?: number,
  ): Promise<{
    items: Array<{ str: string; transform: readonly number[]; width: number; height: number; x: number; y: number; angle?: number }>;
    viewportWidth: number;
    viewportHeight: number;
  }>;
  getOutline(docId: number): Promise<PdfOutlineItem[] | null>;
  getMetadata(docId: number): Promise<PdfMetadata | null>;
  dispose(docId: number): Promise<void>;
}
