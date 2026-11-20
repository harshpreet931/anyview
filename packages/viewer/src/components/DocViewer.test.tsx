import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { registerStrings } from '../i18n/strings';
import { useNavigation } from '../hooks/useNavigation';
import { DocViewer } from './DocViewer';

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

async function mount(ui: ReactNode): Promise<HTMLDivElement> {
  const el = document.createElement('div');
  document.body.appendChild(el);
  host = el;
  root = createRoot(el);
  await act(async () => root!.render(ui));
  return el;
}

const flush = () => act(() => new Promise((r) => setTimeout(r, 50)));

describe('DocViewer source identity', () => {
  it('does not reload when the parent re-renders with an equivalent inline source', async () => {
    const buffer = new TextEncoder().encode('hello world').buffer;
    const onDocumentLoad = vi.fn();
    let bump: () => void = () => {};

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

    await mount(<Host />);
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

    await mount(<Host />);
    await vi.waitFor(() => expect(onDocumentLoad).toHaveBeenCalledTimes(1));
    await act(async () => swap());
    await vi.waitFor(() => expect(onDocumentLoad).toHaveBeenCalledTimes(2));
  });
});

describe('DocViewer localisation', () => {
  it('uses the registered locale for its own labels', async () => {
    registerStrings('xq', { viewer: { label: 'Visionneuse' }, toolbar: { label: 'Barre' } });
    const el = await mount(<DocViewer locale="xq" />);
    expect(el.querySelector('[aria-label="Visionneuse"]')).not.toBeNull();
    expect(el.querySelector('[aria-label="Barre"]')).not.toBeNull();
  });
});

describe('DocViewer children', () => {
  it('renders children inside the viewer store so the hooks work', async () => {
    function Indicator() {
      const { currentPage, totalPages } = useNavigation();
      return <span data-testid="indicator">{`${currentPage + 1} / ${totalPages}`}</span>;
    }
    const el = await mount(
      <DocViewer>
        <Indicator />
      </DocViewer>,
    );
    expect(el.querySelector('[data-testid="indicator"]')?.textContent).toBe('1 / 0');
  });
});
