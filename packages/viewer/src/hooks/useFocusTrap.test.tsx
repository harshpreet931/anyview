import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { useFocusTrap } from './useFocusTrap';

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function Dialog({ onEscape }: { onEscape: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true, () => onEscape());
  return (
    <div ref={ref}>
      <button>first</button>
      <button>second</button>
    </div>
  );
}

function render(onEscape: () => void) {
  act(() => root!.render(<Dialog onEscape={onEscape} />));
}

describe('useFocusTrap', () => {
  it('keeps focus where the user moved it when the parent re-renders with a new onEscape', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    render(() => {});

    const second = host.querySelectorAll('button')[1]!;
    second.focus();
    render(() => {});

    expect(document.activeElement).toBe(second);
  });

  it('calls the latest onEscape on Escape', () => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const first = vi.fn();
    const latest = vi.fn();
    render(first);
    render(latest);

    act(() => {
      host!.querySelector('button')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });
});
