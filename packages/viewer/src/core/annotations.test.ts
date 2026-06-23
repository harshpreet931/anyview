import { describe, it, expect } from 'vitest';
import { serializeAnnotations, parseAnnotations } from './annotations';
import type { HighlightAnnotation } from './types';

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

describe('annotation serialization', () => {
  it('round-trips annotations', () => {
    const json = serializeAnnotations([highlight]);
    const back = parseAnnotations(json);
    expect(back).toHaveLength(1);
    expect(back[0]).toEqual(highlight);
  });

  it('emits a version field', () => {
    expect(JSON.parse(serializeAnnotations([])).version).toBe(1);
  });

  it('returns [] for malformed input', () => {
    expect(parseAnnotations('not json')).toEqual([]);
    expect(parseAnnotations('{"version":1}')).toEqual([]);
    expect(parseAnnotations('[]')).toEqual([]);
  });
});
