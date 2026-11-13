import type { Adapter, DocumentModel } from './types';

function copyStyles(into: Document): void {
  for (const node of Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))) {
    into.head.appendChild(into.importNode(node, true));
  }
  const style = into.createElement('style');
  style.textContent = `
    @page { margin: 16mm; }
    html, body { margin: 0; background: #fff; }
    .dv-print-page { break-after: page; }
    .dv-print-page:last-child { break-after: auto; }
    .dv-print-page > * { max-width: 100%; }
    .dv-print-page img { max-width: 100%; height: auto; }
  `;
  into.head.appendChild(style);
}

async function renderPages(adapter: Adapter, model: DocumentModel, into: Document): Promise<HTMLElement> {
  const root = into.createElement('div');
  root.className = 'dv-root dv-print-root';
  root.setAttribute('data-theme', 'light');
  const signal = new AbortController().signal;
  for (const page of model.pages) {
    const wrap = into.createElement('div');
    wrap.className = 'dv-print-page';
    root.appendChild(wrap);
    if (model.format === 'image') {
      const canvas = document.createElement('canvas');
      await adapter.renderPage({ page, target: canvas, scale: 1, rotation: 0, devicePixelRatio: 2, signal });
      const img = into.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.alt = model.meta.name;
      wrap.appendChild(img);
    } else {
      const target = into.createElement('div');
      target.className = 'dv-reflow-target';
      wrap.appendChild(target);
      await adapter.renderPage({ page, target, scale: 1, rotation: 0, devicePixelRatio: 1, signal });
    }
  }
  return root;
}

/** Prints just the document: every page is rendered afresh into a hidden frame, so the host page is never printed. */
export async function printInFrame(adapter: Adapter, model: DocumentModel): Promise<void> {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  try {
    const win = frame.contentWindow!;
    const doc = win.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
    doc.close();
    doc.title = model.meta.name;
    copyStyles(doc);
    doc.body.appendChild(await renderPages(adapter, model, doc));
    await Promise.all(
      Array.from(doc.images).map((img) =>
        img.complete ? null : new Promise((r) => img.addEventListener('load', r, { once: true })),
      ),
    );
    await doc.fonts?.ready;
    win.addEventListener('afterprint', cleanup, { once: true });
    win.focus();
    win.print();
  } finally {
    cleanup();
  }
}
