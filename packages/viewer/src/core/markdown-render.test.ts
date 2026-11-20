import { describe, it, expect } from 'vitest';
import { loadMarkdownRenderer, markdownPieces } from './markdown-render';

const rendered = async (markdown: string, size: number) => {
  const render = await loadMarkdownRenderer();
  const pieces = markdownPieces(markdown, size);
  return {
    whole: render(markdown),
    joined: pieces.map(render).filter(Boolean).join('\n'),
    count: pieces.length,
  };
};

describe('markdownPieces', () => {
  it('splits a long document into pieces that render the same as the whole', async () => {
    const markdown = Array.from({ length: 40 }, (_, i) =>
      [
        `## Part ${i}`,
        `Some *text* with a [link][home] and \`code ${i}\`.`,
        '```js\nconst a = 1;\n\nconsole.log(a);\n```',
        `- one ${i}\n- two\n\n- three\n\n  more of three`,
        `1. first\n2. second\n\n3. third`,
        `| a | b |\n|---|---|\n| ${i} | x |`,
        `> quoted\n> again`,
        '<pre>\nraw\n\nstill raw\n</pre>',
        '<!-- a\n\ncomment -->',
        '    indented code\n\n    still code',
        'Setext title\n============',
      ].join('\n\n'),
    ).join('\n\n') + '\n\n[home]: https://example.com "Home"\n';
    const { whole, joined, count } = await rendered(markdown, 200);
    expect(count).toBeGreaterThan(20);
    expect(joined).toBe(whole);
  });

  it('keeps a fence that holds blank lines and unindented text in one piece', async () => {
    const markdown = `${'intro\n\n'.repeat(30)}~~~~\nstart\n\nnot a paragraph\n\n~~~\n\nstill code\n~~~~\n\nafter`;
    const { whole, joined } = await rendered(markdown, 20);
    expect(joined).toBe(whole);
  });

  it('starts every piece after the first with a block that has no top margin', async () => {
    const markdown = Array.from({ length: 60 }, (_, i) =>
      [`# Title ${i}`, 'Under\n-----', '***', '___', '<div>raw</div>', `[r${i}]: https://example.com`, `Text ${i}`, '> quote', '```\ncode\n```'].join('\n\n'),
    ).join('\n\n');
    const render = await loadMarkdownRenderer();
    const pieces = markdownPieces(markdown, 50);
    expect(pieces.length).toBeGreaterThan(30);
    for (const piece of pieces.slice(1)) {
      const first = document.createElement('div');
      first.innerHTML = render(piece);
      expect(['P', 'PRE', 'BLOCKQUOTE', 'TABLE']).toContain(first.firstElementChild?.tagName);
    }
  });

  it('leaves a document with footnotes whole', async () => {
    const markdown = `${'para\n\n'.repeat(50)}A note[^1].\n\n[^1]: The note.\n`;
    expect(markdownPieces(markdown, 20)).toEqual([markdown]);
  });

  it('leaves a short document whole', () => {
    expect(markdownPieces('# Title\n\ntext\n', 1000)).toEqual(['# Title\n\ntext\n']);
  });
});
