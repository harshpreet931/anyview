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
import { ViewerError, isViewerError } from '../../core/errors';
import { loadParser } from '../../core/load-parser';
import { loadSanitizer } from '../../core/sanitizer';

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

interface SlideContent {
  texts: string[];
  html: string;
}

export class PptxAdapter implements Adapter {
  readonly manifest = pptxManifest;
  private slides: SlideContent[] = [];

  async parse(
    source: FileSourceReader,
    signal: AbortSignal,
  ): Promise<DocumentModel> {
    const buffer = await source.arrayBuffer();
    if (signal.aborted) throw new Error('Parse cancelled');

    try {
      const JSZip = (await loadParser('jszip', () => import('jszip'))).default;
      const zip = await JSZip.loadAsync(buffer);

      const slideFiles = Object.keys(zip.files)
        .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
        .sort((a, b) => {
          const na = parseInt(a.match(/slide(\d+)\.xml/)?.[1] ?? '0');
          const nb = parseInt(b.match(/slide(\d+)\.xml/)?.[1] ?? '0');
          return na - nb;
        });

      this.slides = [];

      for (const slideFile of slideFiles) {
        const xml = await zip.file(slideFile)!.async('string');
        const content = this.parseSlideXml(xml);
        this.slides.push(content);
      }
    } catch (cause) {
      if (isViewerError(cause)) throw cause;
      throw new ViewerError('PARSE_ERROR', 'Failed to parse PPTX.', { cause });
    }

    const pages: PageRef[] = this.slides.map((_, i) => ({
      index: i,
      width: 960,
      height: 540,
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
    const target = ctx.target as HTMLElement;
    target.innerHTML = '';

    const slide = this.slides[ctx.page.index];
    if (!slide) {
      throw new ViewerError('RENDER_ERROR', `Slide ${ctx.page.index} not found.`);
    }

    const cssW = 960 * ctx.scale;
    const cssH = 540 * ctx.scale;

    // The slide is authored at a fixed 960×540 and scaled via transform. A
    // sized wrapper carries the scaled layout box (transform doesn't affect
    // layout), so the page measures correctly at any zoom.
    const wrapper = document.createElement('div');
    wrapper.style.width = `${cssW}px`;
    wrapper.style.height = `${cssH}px`;
    wrapper.style.overflow = 'hidden';
    wrapper.style.position = 'relative';

    const slideEl = document.createElement('div');
    slideEl.style.width = '960px';
    slideEl.style.height = '540px';
    slideEl.style.background = 'white';
    slideEl.style.boxSizing = 'border-box';
    slideEl.style.padding = '40px';
    slideEl.style.transform = `scale(${ctx.scale})`;
    slideEl.style.transformOrigin = 'top left';
    const DOMPurify = await loadSanitizer();
    slideEl.innerHTML = DOMPurify.sanitize(slide.html, {
      ALLOWED_TAGS: ['div', 'h1', 'h2', 'h3', 'p', 'span', 'br', 'b', 'i', 'em', 'strong', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['style'],
    });

    wrapper.appendChild(slideEl);
    target.appendChild(wrapper);

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

  private parseSlideXml(xml: string): SlideContent {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');

    const texts: string[] = [];

    doc.querySelectorAll('*').forEach((node) => {
      if (node.localName === 't' || node.tagName.split(':').pop() === 't') {
        const text = node.textContent?.trim();
        if (text) texts.push(text);
      }
    });

    let html = '<div style="font-family:Calibri,Arial,sans-serif;">';
    const title = texts[0];
    if (title) {
      html += `<h1 style="font-size:28px;font-weight:600;margin-bottom:16px;color:#333;">${this.escapeHtml(title)}</h1>`;
    }
    for (let i = 1; i < texts.length; i++) {
      html += `<p style="font-size:18px;margin:8px 0;color:#444;">${this.escapeHtml(texts[i])}</p>`;
    }
    html += '</div>';

    return { texts, html };
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  dispose(): void {
    this.slides = [];
  }
}
