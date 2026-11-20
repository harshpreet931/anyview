import type {
  Adapter,
  AdapterManifest,
  DocumentModel,
  FileSourceReader,
  OutlineNode,
  PageRef,
  RenderContext,
  RenderResult,
  TextLayer,
  TextLayerItem,
} from '../../core/types';
import type JSZip from 'jszip';
import { ViewerError, asParseError, throwIfCancelled } from '../../core/errors';
import { loadParser } from '../../core/load-parser';
import { escapeHtml, markSanitized, setSafeHtml, type SafeHtml } from '../../core/safe-html';

export const pptxManifest: AdapterManifest = {
  id: 'pptx',
  label: 'Presentation',
  extensions: ['pptx'],
  mimeTypes: [
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ],
  icon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1h10v14H3V1zm1 1v9h8V2H4zm0 10v2h8v-2H4z"/><path d="M5 4h6v1H5zm0 2h6v1H5zm0 2h4v1H5z" opacity="0.5"/></svg>`,
  features: {
    search: true,
    annotations: false,
    textSelection: true,
    print: false,
    thumbnails: true,
    outline: true,
    zoom: true,
    rotation: true,
    attachments: false,
    fullscreen: true,
    download: true,
  },
  priority: 100,
  protocolVersion: 1,
};

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

interface SlideContent {
  texts: string[];
  html: SafeHtml;
}

function relationshipId(el: Element): string | null {
  const direct = el.getAttribute('r:id');
  if (direct) return direct;
  for (const attr of Array.from(el.attributes)) {
    if (
      attr.localName === 'id' &&
      (attr.prefix === 'r' || (attr.namespaceURI ?? '').includes('relationships'))
    ) {
      return attr.value;
    }
  }
  return null;
}

export class PptxAdapter implements Adapter {
  readonly manifest = pptxManifest;
  private slides: SlideContent[] = [];

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    throwIfCancelled(signal);

    try {
      const zipLib = (await loadParser('jszip', () => import('jszip'))).default;
      const zip = await zipLib.loadAsync(buffer);
      const slideFiles = await orderedSlideFiles(zip);
      // Cleared first so a mid-parse failure can't leave the previous deck's slides behind.
      this.slides = [];
      this.slides = await Promise.all(
        slideFiles.map(async (slideFile) => parseSlideXml(await zip.file(slideFile)!.async('string'))),
      );
    } catch (cause) {
      throw asParseError(cause, 'Failed to parse PPTX.');
    }

    const pages: PageRef[] = this.slides.map((_, i) => ({
      index: i,
      width: SLIDE_WIDTH,
      height: SLIDE_HEIGHT,
      rotation: 0,
      ...(i === 0 ? { label: 'Slide 1' } : {}),
    }));

    const outline: OutlineNode[] = this.slides.map((slide, i) => ({
      title: slide.texts[0] ?? `Slide ${i + 1}`,
      dest: { pageIndex: i },
    }));

    return {
      format: 'pptx',
      meta: source.meta,
      pageCount: this.slides.length,
      pages,
      outline,
    };
  }

  async renderPage(ctx: RenderContext): Promise<RenderResult> {
    ctx.target.replaceChildren();
    const slide = this.slides[ctx.page.index];
    if (!slide) {
      throw new ViewerError('RENDER_ERROR', `Slide ${ctx.page.index} not found.`);
    }

    const cssW = SLIDE_WIDTH * ctx.scale;
    const cssH = SLIDE_HEIGHT * ctx.scale;

    const wrapper = document.createElement('div');
    wrapper.style.width = `${cssW}px`;
    wrapper.style.height = `${cssH}px`;
    wrapper.style.overflow = 'hidden';
    wrapper.style.position = 'relative';

    const slideEl = document.createElement('div');
    slideEl.style.width = `${SLIDE_WIDTH}px`;
    slideEl.style.height = `${SLIDE_HEIGHT}px`;
    slideEl.style.background = 'white';
    slideEl.style.boxSizing = 'border-box';
    slideEl.style.padding = '40px';
    slideEl.style.transform = `scale(${ctx.scale})`;
    slideEl.style.transformOrigin = 'top left';
    setSafeHtml(slideEl, slide.html);

    wrapper.appendChild(slideEl);
    ctx.target.appendChild(wrapper);

    return { width: cssW, height: cssH };
  }

  async getTextLayer(
    pageIndex: number,
    _signal?: AbortSignal,
  ): Promise<TextLayer> {
    const slide = this.slides[pageIndex];
    if (!slide) return { pageIndex, items: [] };

    const items: TextLayerItem[] = slide.texts.map((text, i) => ({
      str: text,
      x: 0,
      y: i * 30,
      width: text.length * 8,
      height: 24,
    }));

    return { pageIndex, items };
  }

  dispose(): void {
    this.slides = [];
  }
}

// Slide display order comes from presentation.xml relationship ids, not slideN.xml filenames.
async function orderedSlideFiles(zip: JSZip): Promise<string[]> {
  const all = Object.keys(zip.files).filter((n) =>
    /^ppt\/slides\/slide\d+\.xml$/.test(n),
  );
  const slideNum = (n: string) =>
    parseInt(n.match(/slide(\d+)\.xml/)?.[1] ?? '0', 10);
  const numeric = () => all.slice().sort((a, b) => slideNum(a) - slideNum(b));

  const presEntry = zip.file('ppt/presentation.xml');
  const relsEntry = zip.file('ppt/_rels/presentation.xml.rels');
  if (!presEntry || !relsEntry) return numeric();

  try {
    const parser = new DOMParser();
    const relsDoc = parser.parseFromString(
      await relsEntry.async('string'),
      'application/xml',
    );
    const relTarget = new Map<string, string>();
    relsDoc.querySelectorAll('*').forEach((el) => {
      if (el.localName !== 'Relationship') return;
      const id = el.getAttribute('Id');
      const target = el.getAttribute('Target');
      if (!id || !target) return;
      const path = target.replace(/^\//, '').replace(/^\.\.\//, '');
      relTarget.set(id, path.startsWith('ppt/') ? path : `ppt/${path}`);
    });

    const presDoc = parser.parseFromString(
      await presEntry.async('string'),
      'application/xml',
    );
    const ordered: string[] = [];
    presDoc.querySelectorAll('*').forEach((el) => {
      if (el.localName !== 'sldId') return;
      const rid = relationshipId(el);
      const file = rid ? relTarget.get(rid) : undefined;
      if (file && file in zip.files) ordered.push(file);
    });

    if (ordered.length === 0) return numeric();
    const seen = new Set(ordered);
    for (const f of numeric()) if (!seen.has(f)) ordered.push(f);
    return ordered;
  } catch {
    return numeric();
  }
}

function parseSlideXml(xml: string): SlideContent {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');

  const texts: string[] = [];

  doc.querySelectorAll('*').forEach((node) => {
    if (node.localName === 't') {
      const text = node.textContent?.trim();
      if (text) texts.push(text);
    }
  });

  let html = '<div style="font-family:Calibri,Arial,sans-serif;">';
  const title = texts[0];
  if (title) {
    html += `<h1 style="font-size:28px;font-weight:600;margin-bottom:16px;color:#333;">${escapeHtml(title)}</h1>`;
  }
  for (let i = 1; i < texts.length; i++) {
    html += `<p style="font-size:18px;margin:8px 0;color:#444;">${escapeHtml(texts[i])}</p>`;
  }
  html += '</div>';

  return { texts, html: markSanitized(html) };
}
