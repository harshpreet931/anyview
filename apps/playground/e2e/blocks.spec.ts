import { test, expect, type Page } from '@playwright/test';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { openApp, revealViewer, waitForReflow, waitForStable } from './helpers';

const JSZip = createRequire(new URL('../../../packages/viewer/package.json', import.meta.url))('jszip');

type FilePayload = { name: string; mimeType: string; buffer: Buffer };

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore.';

function markdown(paragraphs: number, every = 50): string {
  const parts: string[] = [];
  for (let i = 1; i <= paragraphs; i++) {
    if (i % every === 1) parts.push(`## Section ${Math.ceil(i / every)}`);
    if (i % 25 === 0) parts.push('```js\nconst x = ' + i + ';\n\nx;\n```');
    parts.push(`Paragraph ${i}. **${LOREM}** _more_ \`code${i}\`.`);
  }
  parts.push('ENDOFDOC');
  return parts.join('\n\n');
}

function html(paragraphs: number, every = 50): string {
  let body = '';
  for (let i = 1; i <= paragraphs; i++) {
    if (i % every === 1) body += `<h2>Section ${Math.ceil(i / every)}</h2>`;
    body += `<p>Paragraph ${i}. <b>${LOREM}</b> <a href="#p${i}">more</a></p>`;
  }
  return `<!doctype html><html><head><title>Big</title></head><body><div class="doc"><article>${body}<p>ENDOFDOC</p></article></div></body></html>`;
}

async function docx(paragraphs: number, every = 50): Promise<Buffer> {
  const zip = new JSZip();
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file('word/styles.xml', `<?xml version="1.0" encoding="UTF-8"?><w:styles ${W}><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/></w:style></w:styles>`);
  let body = '';
  for (let i = 1; i <= paragraphs; i++) {
    if (i % every === 1) body += `<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Section ${Math.ceil(i / every)}</w:t></w:r></w:p>`;
    body += `<w:p><w:r><w:t>Paragraph ${i}. ${LOREM}</w:t></w:r></w:p>`;
  }
  body += '<w:p><w:r><w:t>ENDOFDOC</w:t></w:r></w:p>';
  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${body}</w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer' });
}

function notebook(cells: number): string {
  const list: unknown[] = [];
  for (let i = 0; i < cells; i++) {
    if (i % 4 === 0) list.push({ cell_type: 'markdown', source: [`## Section ${i / 4 + 1}\n`, `\n`, `Notes for ${i}. ${LOREM}`] });
    else list.push({ cell_type: 'code', source: [`def f${i}(x):\n`, `    return x * ${i}\n`, `print(f${i}(2))`], outputs: [{ output_type: 'stream', name: 'stdout', text: [`${i * 2}\n`.repeat(8)] }] });
  }
  list.push({ cell_type: 'markdown', source: ['ENDOFDOC'] });
  return JSON.stringify({ cells: list, metadata: { language_info: { name: 'python' } }, nbformat: 4, nbformat_minor: 5 });
}

const md = (text: string): FilePayload => ({ name: 'big.md', mimeType: 'text/markdown', buffer: Buffer.from(text) });
const htmlFile = (text: string): FilePayload => ({ name: 'big.html', mimeType: 'text/html', buffer: Buffer.from(text) });
const docxFile = (buffer: Buffer): FilePayload => ({ name: 'big.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer });
const nbFile = (text: string): FilePayload => ({ name: 'big.ipynb', mimeType: 'application/x-ipynb+json', buffer: Buffer.from(text) });

/**
 * Opens the file and reports the longest main-thread task from the moment it is picked until it is fully drawn.
 * The file goes in by path and the wait runs inside the page, so no test-harness script runs while it loads.
 */
async function openTimed(page: Page, file: FilePayload): Promise<number> {
  const path = test.info().outputPath(file.name);
  writeFileSync(path, file.buffer);
  await page.addInitScript(() => {
    const w = window as unknown as { __tasks: number[] };
    w.__tasks = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__tasks.push(entry.duration);
    }).observe({ type: 'longtask' });
  });
  await openApp(page);
  await revealViewer(page);
  await page.evaluate(() => ((window as unknown as { __tasks: number[] }).__tasks.length = 0));
  await page.locator('.pg-upload-btn input[type="file"]').setInputFiles(path);
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const drawn = () => {
          const units = document.querySelectorAll('.dv-reflow-target [data-dv-unit]');
          return !!units[units.length - 1]?.textContent?.includes('ENDOFDOC');
        };
        const poll = setInterval(() => {
          if (!drawn()) return;
          clearInterval(poll);
          setTimeout(() => resolve(Math.max(0, ...(window as unknown as { __tasks: number[] }).__tasks)), 300);
        }, 100);
      }),
  );
}

async function openOutlineEntry(page: Page, title: string, index: number) {
  await page.getByRole('tab', { name: 'Outline' }).click();
  await page.locator('[role="treeitem"][tabindex="0"]').focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < index; i++) await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('treeitem', { name: title, exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
}

/** Where the heading sits relative to the top of the viewer, once the scroll has settled. */
async function headingTop(page: Page, title: string): Promise<number> {
  const container = page.locator('.dv-viewer-container');
  await waitForStable(() => container.evaluate((el) => el.scrollTop));
  return container.evaluate((el, title) => {
    const heading = Array.from(el.querySelectorAll('h1, h2, h3')).find((h) => h.textContent?.trim() === title)!;
    return heading.getBoundingClientRect().top - el.getBoundingClientRect().top;
  }, title);
}

test.describe('big flowing documents open without freezing', () => {
  test.setTimeout(120_000);

  test('a 4 MB Markdown file never blocks the main thread for long', async ({ page }) => {
    expect(await openTimed(page, md(markdown(24_000)))).toBeLessThan(250);
  });

  test('a 5 MB HTML file inside wrappers never blocks the main thread for long', async ({ page }) => {
    expect(await openTimed(page, htmlFile(html(30_000)))).toBeLessThan(250);
    await expect(page.locator('.dv-reflow-target .doc > article .dv-reflow-piece > h2').first()).toHaveText('Section 1');
  });

  test('a notebook with a thousand cells never blocks the main thread for long', async ({ page }) => {
    expect(await openTimed(page, nbFile(notebook(1000)))).toBeLessThan(250);
  });

  test('a DOCX with thousands of paragraphs never blocks the main thread for long', async ({ page }) => {
    expect(await openTimed(page, docxFile(await docx(6000)))).toBeLessThan(250);
  });
});

test.describe('outline jumps on flowing documents', () => {
  test.setTimeout(120_000);

  const cases: Array<[string, () => Promise<FilePayload>]> = [
    ['Markdown', async () => md(markdown(5000))],
    ['HTML', async () => htmlFile(html(5000))],
    ['DOCX', async () => docxFile(await docx(5000))],
    ['Jupyter', async () => nbFile(notebook(400))],
  ];

  for (const [format, file] of cases) {
    test(`${format}: an outline entry lands exactly on its heading`, async ({ page }) => {
      await openApp(page);
      await page.locator('.pg-upload-btn input[type="file"]').setInputFiles(await file());
      await waitForReflow(page);
      await expect(page.locator('.dv-reflow-target [data-dv-unit]').last()).toContainText('ENDOFDOC', { timeout: 60_000 });
      await revealViewer(page);
      await openOutlineEntry(page, 'Section 51', 50);
      expect(Math.abs(await headingTop(page, 'Section 51'))).toBeLessThan(2);
      await openOutlineEntry(page, 'Section 12', 11);
      expect(Math.abs(await headingTop(page, 'Section 12'))).toBeLessThan(2);
    });
  }
});
