import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DocViewer } from './DocViewer';

// jsdom lacks these; the viewer only needs them to exist.
beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  globalThis.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const flush = () => act(() => new Promise((r) => setTimeout(r, 50)));

describe('DocViewer source identity', () => {
  it('does not reload when the parent re-renders with an equivalent inline source', async () => {
    const buffer = new TextEncoder().encode('hello world').buffer;
    const onDocumentLoad = vi.fn();
    let bump: () => void = () => {};

    // The README pattern: an inline `source={{...}}` object and parent state
    // that changes while the document is open (e.g. from onPageChange).
    function Host() {
      const [n, setN] = useState(0);
      bump = () => setN((v) => v + 1);
      return (
        <div style={{ height: 600 }} data-n={n}>
          <DocViewer
            source={{ kind: 'buffer', buffer, name: 'note.txt', type: 'text/plain' }}
            onDocumentLoad={onDocumentLoad}
          />
        </div>
      );
    }

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<Host />));
    await vi.waitFor(() => expect(onDocumentLoad).toHaveBeenCalledTimes(1));

    for (let i = 0; i < 3; i++) {
      await act(async () => bump());
      await flush();
    }
    expect(onDocumentLoad).toHaveBeenCalledTimes(1);
  });

  it('still reloads when the source really changes', async () => {
    const a = new TextEncoder().encode('first').buffer;
    const b = new TextEncoder().encode('second').buffer;
    const onDocumentLoad = vi.fn();
    let swap: () => void = () => {};

    function Host() {
      const [useB, setUseB] = useState(false);
      swap = () => setUseB(true);
      return (
        <div style={{ height: 600 }}>
          <DocViewer
            source={{ kind: 'buffer', buffer: useB ? b : a, name: 'n.txt', type: 'text/plain' }}
            onDocumentLoad={onDocumentLoad}
          />
        </div>
      );
    }

    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root!.render(<Host />));
    await vi.waitFor(() => expect(onDocumentLoad).toHaveBeenCalledTimes(1));
    await act(async () => swap());
    await vi.waitFor(() => expect(onDocumentLoad).toHaveBeenCalledTimes(2));
  });
});
