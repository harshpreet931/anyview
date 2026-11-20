import type { AdapterRegistry } from '../core/types';
import { pdfManifest } from './pdf/manifest';
import { imageManifest } from './image/manifest';
import { markdownManifest } from './markdown/manifest';
import { codeManifest } from './code/manifest';
import { textManifest } from './text/manifest';
import { docxManifest } from './docx/manifest';
import { xlsxManifest } from './xlsx/manifest';
import { pptxManifest } from './pptx/manifest';
import { csvManifest } from './csv/manifest';
import { htmlManifest } from './html/manifest';
import { ipynbManifest } from './ipynb/manifest';

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
  registry.register(ipynbManifest, () => import('./ipynb'));
}
