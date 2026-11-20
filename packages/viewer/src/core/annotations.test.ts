import { describe, it, expect } from 'vitest';
import { serializeAnnotations, parseAnnotations, validAnnotations } from './annotations';
import type {
  HighlightAnnotation,
  ShapeAnnotation,
  FreeTextAnnotation,
} from './types';

const highlight: HighlightAnnotation = {
  id: 'h1',
  pageIndex: 2,
  type: 'highlight',
  color: '#ffd400',
  opacity: 0.4,
  createdAt: 1,
  updatedAt: 1,
  data: { rects: [{ x: 0.1, y: 0.2, width: 0.3, height: 0.05 }] },
};

const arrow: ShapeAnnotation = {
  id: 's1',
  pageIndex: 0,
  type: 'shape',
  color: '#2563eb',
  opacity: 1,
  createdAt: 1,
  updatedAt: 1,
  data: { shape: 'arrow', from: { x: 0.1, y: 0.1 }, to: { x: 0.5, y: 0.6 }, strokeWidth: 0.003 },
};

const freeText: FreeTextAnnotation = {
  id: 't1',
  pageIndex: 1,
  type: 'free-text',
  color: '#111827',
  opacity: 1,
  createdAt: 1,
  updatedAt: 1,
  data: { x: 0.2, y: 0.3, text: 'Hello', fontSize: 0.024 },
};

describe('annotation serialization', () => {
  it('round-trips annotations', () => {
    const json = serializeAnnotations([highlight]);
    const back = parseAnnotations(json);
    expect(back).toHaveLength(1);
    expect(back[0]).toEqual(highlight);
  });

  it('round-trips shape and free-text annotations', () => {
    const back = parseAnnotations(serializeAnnotations([highlight, arrow, freeText]));
    expect(back).toHaveLength(3);
    expect(back[1]).toEqual(arrow);
    expect(back[2]).toEqual(freeText);
  });

  it('emits a version field', () => {
    expect(JSON.parse(serializeAnnotations([])).version).toBe(1);
  });

  it('returns [] for malformed input', () => {
    expect(parseAnnotations('not json')).toEqual([]);
    expect(parseAnnotations('{"version":1}')).toEqual([]);
    expect(parseAnnotations('[]')).toEqual([]);
  });

  it('drops structurally invalid annotations instead of passing them to render', () => {
    const json = JSON.stringify({
      version: 1,
      annotations: [
        highlight,
        null,
        {},
        { ...highlight, id: 'h2', data: {} },
        { ...highlight, id: 'h3', data: { rects: [null] } },
        { ...arrow, id: 's2', data: { shape: 'arrow', from: { x: 0 } } },
        { ...freeText, id: 't2', pageIndex: '1' },
        { id: 'i1', pageIndex: 0, type: 'ink', color: '#000', opacity: 1, createdAt: 1, updatedAt: 1, data: { paths: [[{ x: 0, y: 0 }], 'x'], thickness: 1 } },
        { id: 'n1', pageIndex: 0, type: 'sticky-note', color: '#000', opacity: 1, createdAt: 1, updatedAt: 1, data: { x: 0.1, y: 0.1 } },
        arrow,
      ],
    });
    expect(parseAnnotations(json).map((a) => a.id)).toEqual(['h1', 's1']);
  });

  it('validates object payloads too', () => {
    expect(validAnnotations([freeText, { type: 'highlight' }]).map((a) => a.id)).toEqual(['t1']);
    expect(validAnnotations(undefined)).toEqual([]);
    expect(validAnnotations('nope')).toEqual([]);
  });

  it('rejects inherited object keys as annotation types', () => {
    expect(validAnnotations([{ ...highlight, type: 'constructor' }, { ...highlight, type: 'toString' }])).toEqual([]);
  });
});
