import { makeSafeUrlTransform } from './markdown-url';
import { markSanitized, type SafeHtml } from './safe-html';

export const MARKDOWN_HEADING = /^(#{1,6})\s+(.+)$/;

export async function loadMarkdownRenderer(): Promise<(markdown: string) => SafeHtml> {
  const [
    React,
    { renderToStaticMarkup },
    { default: ReactMarkdown, defaultUrlTransform },
    { default: remarkGfm },
  ] = await Promise.all([
    import('react'),
    import('react-dom/server'),
    import('react-markdown'),
    import('remark-gfm'),
  ]);
  const urlTransform = makeSafeUrlTransform(defaultUrlTransform);

  // react-markdown has no rehype-raw, so the serializer escapes every span of document text.
  return (markdown) =>
    markSanitized(
      renderToStaticMarkup(
        React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], urlTransform }, markdown),
      ),
    );
}
