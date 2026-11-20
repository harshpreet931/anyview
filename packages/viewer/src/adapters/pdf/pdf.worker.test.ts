import { describe, it, expect } from 'vitest';
import source from './pdf.worker.ts?raw';

describe('pdf worker', () => {
  it('has no dynamic imports, so bundlers that emit classic workers can build it', () => {
    expect(source).not.toMatch(/\bimport\(\s*['"]/);
  });
});
