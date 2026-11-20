import { useEffect, useRef } from 'react';
import type { createViewerStore, ViewerStore } from '../core/store';

export function useStoreListener<T>(
  store: ReturnType<typeof createViewerStore>,
  selector: (state: ViewerStore) => T,
  listener: ((value: T, state: ViewerStore) => void) | undefined,
  equalityFn?: (a: T, b: T) => boolean,
): void {
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  });
  const enabled = listener !== undefined;
  useEffect(() => {
    if (!enabled) return;
    return store.subscribe(
      selector,
      (value) => listenerRef.current?.(value, store.getState()),
      equalityFn ? { equalityFn } : undefined,
    );
  }, [store, selector, enabled, equalityFn]);
}
