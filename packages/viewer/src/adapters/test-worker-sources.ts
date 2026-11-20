import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** The source of a worker entry and of every local module it imports, by file. */
export function workerSources(file: string, seen = new Map<string, string>()): Map<string, string> {
  const source = readFileSync(file, 'utf8');
  seen.set(file, source);
  for (const [, spec] of source.matchAll(/^import\s+(?!type\b)[^;]*?from\s+'(\.{1,2}\/[^']+)'/gm)) {
    const dep = ['', '.ts', '.tsx', '/index.ts'].map((ext) => resolve(dirname(file), spec + ext)).find(existsSync);
    if (dep && !seen.has(dep)) workerSources(dep, seen);
  }
  return seen;
}
