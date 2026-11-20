import { describe, it, expect } from 'vitest';
import { MarkdownAdapter } from './MarkdownAdapter';
import { textReader } from '../test-reader';
import type { PageDestination } from '../../core/types';

describe('MarkdownAdapter outline', () => {
  it('gives repeated headings their own scroll offsets', async () => {
    const markdown = '# Notes\n\ntext\n\n# Notes\n\nmore\n\n# Notes\n';
    const adapter = new MarkdownAdapter();
    const model = await adapter.parse(textReader(markdown, 'doc.md', 'text/markdown'), new AbortController().signal);
    expect(model.outline?.map((node) => (node.dest as PageDestination).scrollOffset)).toEqual([0, 4 * 24, 8 * 24]);
  });
});
