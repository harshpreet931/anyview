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
    expect(seen).toEqual([]);

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

describe('annotation undo', () => {
  it('undoes adds, updates and deletes in reverse order and notifies', () => {
    const store = createViewerStore();
    const seen: number[] = [];
    store.getState().onAnnotationChange((a) => seen.push(a.length));
    const s = () => store.getState();

    s().addAnnotation(highlight('a'));
    s().addAnnotation(highlight('b'));
    s().updateAnnotation('a', { color: '#000000' });
    s().deleteAnnotation('b');
    expect(s().annotations.map((a) => a.id)).toEqual(['a']);

    expect(s().undoAnnotation()).toBe(true);
    expect(s().annotations.map((a) => a.id)).toEqual(['a', 'b']);
    s().undoAnnotation();
    expect(s().annotations[0]!.color).toBe('#ffd400');
    s().undoAnnotation();
    s().undoAnnotation();
    expect(s().annotations).toEqual([]);
    expect(s().undoAnnotation()).toBe(false);
    expect(seen.at(-1)).toBe(0);
  });

  it('starts a fresh history for each document', () => {
    const store = createViewerStore();
    store.getState().addAnnotation(highlight('a'));
    store.getState()._resetAnnotations();
    expect(store.getState().undoAnnotation()).toBe(false);
  });
});
