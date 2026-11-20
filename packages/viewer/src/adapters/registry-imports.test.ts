import { describe, expect, it } from 'vitest';
import source from './index.ts?raw';

describe('built-in adapter registration', () => {
  it('imports only manifests up front, so engines stay out of the initial bundle', () => {
    const staticImports = [...source.matchAll(/^import (?!type).* from '([^']+)';$/gm)].map((m) => m[1]);
    expect(staticImports.length).toBeGreaterThan(0);
    for (const path of staticImports) expect(path).toMatch(/^\.\/[a-z]+\/manifest$/);
  });
});
