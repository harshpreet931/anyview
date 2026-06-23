/* ============================================================
 * PDF Adapter Types
 * ============================================================ */

import type { PageRef } from '../../core/types';

export interface ParsedPdf {
  readonly pageCount: number;
  readonly pages: PageRef[];
  // The parsed PDFDocumentProxy stays inside the worker (it is not
  // serializable across Comlink); the main thread references it by id.
  readonly docId: number;
}

export interface PdfOutlineItem {
  readonly title: string;
  readonly dest: string | readonly unknown[];
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
  parse(data: ArrayBuffer, password?: string): Promise<ParsedPdf>;
  renderPage(
    docId: number,
    pageIndex: number,
    scale: number,
    rotation: number,
    dpr: number,
  ): Promise<ImageBitmap>;
  getTextContent(
    docId: number,
    pageIndex: number,
  ): Promise<{
    items: Array<{ str: string; transform: readonly number[]; width: number; height: number; x: number; y: number }>;
    viewportWidth: number;
    viewportHeight: number;
  }>;
  getOutline(docId: number): Promise<PdfOutlineItem[] | null>;
  getMetadata(docId: number): Promise<PdfMetadata | null>;
  dispose(docId: number): Promise<void>;
}
