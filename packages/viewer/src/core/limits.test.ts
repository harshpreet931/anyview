import { describe, it, expect } from 'vitest';
import { assertTransformSize, MAX_TRANSFORM_BYTES } from './limits';
import { isViewerError } from './errors';

describe('assertTransformSize', () => {
  it('allows documents within the budget', () => {
    expect(() => assertTransformSize(0)).not.toThrow();
    expect(() => assertTransformSize(MAX_TRANSFORM_BYTES)).not.toThrow();
  });

  it('rejects oversized documents with a MEMORY_LIMIT error', () => {
    try {
      assertTransformSize(MAX_TRANSFORM_BYTES + 1);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(isViewerError(e)).toBe(true);
      expect((e as { code: string }).code).toBe('MEMORY_LIMIT');
    }
  });
});
