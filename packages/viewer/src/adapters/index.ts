import type { AdapterRegistry } from '../core/types';
import { pdfManifest } from './pdf/PdfAdapter';
import { imageManifest } from './image/ImageAdapter';
import { markdownManifest } from './markdown/MarkdownAdapter';
import { codeManifest } from './code/CodeAdapter';
import { textManifest } from './text/TextAdapter';
import { docxManifest } from './docx/DocxAdapter';
import { xlsxManifest } from './xlsx/XlsxAdapter';
import { pptxManifest } from './pptx/PptxAdapter';
import { csvManifest } from './csv/CsvAdapter';
import { htmlManifest } from './html/HtmlAdapter';

export function registerBuiltInAdapters(registry: AdapterRegistry): void {
  registry.register(pdfManifest, () => import('./pdf'));
  registry.register(imageManifest, () => import('./image'));
  registry.register(markdownManifest, () => import('./markdown'));
  registry.register(codeManifest, () => import('./code'));
  registry.register(textManifest, () => import('./text'));
  registry.register(docxManifest, () => import('./docx'));
  registry.register(xlsxManifest, () => import('./xlsx'));
  registry.register(pptxManifest, () => import('./pptx'));
  registry.register(csvManifest, () => import('./csv'));
  registry.register(htmlManifest, () => import('./html'));
}
