import type { DocumentMetadata, OutlineNode, PageRef } from '../../core/types';
import type { Rotation } from '../../core/rotation';

export interface ParsedPdf {
  readonly pageCount: number;
  readonly pages: PageRef[];
  readonly docId: number;
}

export interface PdfTextRun {
  str: string;
  width: number;
  height: number;
  x: number;
  y: number;
  angle: number;
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
    rotation: Rotation,
    dpr: number,
    renderId: number,
  ): Promise<ImageBitmap>;
  cancelRender(renderId: number): void;
  getTextContent(
    docId: number,
    pageIndex: number,
    rotation: Rotation,
    textId: number,
  ): Promise<{
    items: PdfTextRun[];
    viewportWidth: number;
    viewportHeight: number;
  }>;
  cancelText(textId: number): void;
  getOutline(docId: number): Promise<OutlineNode[] | null>;
  getMetadata(docId: number): Promise<DocumentMetadata | null>;
  dispose(docId: number): Promise<void>;
}
