import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { PptxAdapter } from './PptxAdapter';
import type { FileSourceReader, RenderContext } from '../../core/types';

function slideXml(texts: string[]): string {
  const runs = texts.map((t) => `<a:p><a:r><a:t>${t}</a:t></a:r></a:p>`).join('');
  return `<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody>${runs}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;
}

async function deckReader(): Promise<FileSourceReader> {
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', slideXml(['Second']));
  zip.file('ppt/slides/slide2.xml', slideXml(['First &lt;img src=x onerror=alert(1)&gt;', 'Body']));
  zip.file(
    'ppt/presentation.xml',
    '<?xml version="1.0"?><p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst></p:presentation>',
  );
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="slides/slide1.xml"/><Relationship Id="rId2" Target="slides/slide2.xml"/></Relationships>',
  );
  const bytes = await zip.generateAsync({ type: 'arraybuffer' });
  return {
    meta: { name: 'deck.pptx', size: bytes.byteLength, mimeType: '' },
    arrayBuffer: async () => bytes,
    stream: () => null,
  };
}

function ctx(index: number, target: HTMLElement): RenderContext {
  return {
    page: { index, width: 960, height: 540, rotation: 0 },
    target,
    scale: 1,
    rotation: 0,
    devicePixelRatio: 1,
    signal: new AbortController().signal,
  };
}

describe('PptxAdapter', () => {
  it('orders slides by presentation.xml and renders their text as text', async () => {
    const adapter = new PptxAdapter();
    const model = await adapter.parse(await deckReader(), new AbortController().signal);
    expect(model.outline?.map((n) => n.title)).toEqual(['First <img src=x onerror=alert(1)>', 'Second']);

    const target = document.createElement('div');
    await adapter.renderPage(ctx(0, target));
    expect(target.querySelector('h1')?.textContent).toBe('First <img src=x onerror=alert(1)>');
    expect(target.querySelector('img')).toBeNull();
    expect(target.querySelector('p')?.textContent).toBe('Body');
  });

  it('searches every slide and marks each text it renders', async () => {
    const adapter = new PptxAdapter();
    await adapter.parse(await deckReader(), new AbortController().signal);
    const q = { text: 'second', caseSensitive: false, wholeWord: false, regex: false, diacritics: false };
    const [match] = (await adapter.search(q, new AbortController().signal)).matches;
    expect(match).toMatchObject({ pageIndex: 1, locator: { unit: 0, start: 0, end: 6 } });

    const target = document.createElement('div');
    await adapter.renderPage(ctx(1, target));
    expect(target.querySelector('[data-dv-unit="0"]')?.textContent).toBe('Second');
  });
});

