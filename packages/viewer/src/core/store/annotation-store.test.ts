import { describe, it, expect } from 'vitest';
import { createViewerStore } from './index';
import { serializeAnnotations, parseAnnotations } from '../annotations';
import type { HighlightAnnotation } from '../types';

function highlight(id: string): HighlightAnnotation {
  return {
    id,
    pageIndex: 0,
    type: 'highlight',
    color: '#ffd400',
    opacity: 0.4,
    createdAt: 1,
    updatedAt: 1,
    data: { rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }] },
  };
}

describe('annotation store actions', () => {
  it('setAnnotations replaces the set and notifies', () => {
    const store = createViewerStore();
    const seen: number[] = [];
    store.getState().onAnnotationChange((a) => seen.push(a.length));

    store.getState().setAnnotations([highlight('a'), highlight('b')]);
    expect(store.getState().annotations).toHaveLength(2);
    expect(seen).toEqual([2]);

    store.getState().setAnnotations([highlight('c')]);
    expect(store.getState().annotations).toHaveLength(1);
    expect(seen).toEqual([2, 1]);
  });

  it('clearAnnotations empties and notifies only when there was something', () => {
    const store = createViewerStore();
    const seen: number[] = [];
    store.getState().onAnnotationChange((a) => seen.push(a.length));

    store.getState().clearAnnotations();
    expect(seen).toEqual([]); // nothing to clear → no notify

    store.getState().addAnnotation(highlight('a'));
    store.getState().clearAnnotations();
    expect(store.getState().annotations).toEqual([]);
    expect(seen).toEqual([1, 0]);
  });

  it('round-trips through the sidecar export/import shape', () => {
    const store = createViewerStore();
    store.getState().setAnnotations([highlight('a'), highlight('b')]);

    const json = serializeAnnotations(store.getState().annotations);
    store.getState().clearAnnotations();
    expect(store.getState().annotations).toEqual([]);

    store.getState().setAnnotations(parseAnnotations(json));
    expect(store.getState().annotations).toHaveLength(2);
    expect(store.getState().annotations[0]!.id).toBe('a');
  });
});
