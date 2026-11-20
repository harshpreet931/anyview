import { CODE_THEME } from './code-theme';

/** Highlight with Shiki, or fall back to `plain` when Shiki or the language fails to load or render. */
export async function loadHighlighter(
  language: string,
  plain: (code: string) => string,
): Promise<(code: string) => string> {
  try {
    const shiki = await import('shiki');
    const highlighter = await shiki.createHighlighter({ themes: [CODE_THEME], langs: [language] });
    return (code) => {
      try {
        return highlighter.codeToHtml(code, { lang: language, theme: CODE_THEME });
      } catch {
        return plain(code);
      }
    };
  } catch {
    return plain;
  }
}
