import type { BundledLanguage, GrammarState, ThemedToken } from 'shiki';
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

export interface Tokenizer {
  readonly fg: string | undefined;
  readonly bg: string | undefined;
  readonly themeName: string | undefined;
  /** The tokens of each line of `code`, continuing from `state`, with the state after its last line; null if it fails. */
  tokenize(code: string, state?: GrammarState): { lines: ThemedToken[][]; state: GrammarState | undefined } | null;
}

/** Lines longer than this are left plain: a grammar can take seconds on one huge minified line. */
const TOKENIZE_MAX_LINE = 5_000;

/** A Shiki tokenizer that continues from where the previous piece of code ended, or null when Shiki or the language fails to load. */
export async function loadTokenizer(language: string): Promise<Tokenizer | null> {
  try {
    const shiki = await import('shiki');
    const highlighter = await shiki.createHighlighter({ themes: [CODE_THEME], langs: [language] });
    const options = { lang: language as BundledLanguage, theme: CODE_THEME, tokenizeMaxLineLength: TOKENIZE_MAX_LINE };
    const root = highlighter.codeToTokens('', options);
    return {
      fg: root.fg,
      bg: root.bg,
      themeName: root.themeName,
      tokenize(code, state) {
        try {
          const result = highlighter.codeToTokens(code, state ? { ...options, grammarState: state } : options);
          return { lines: result.tokens, state: result.grammarState };
        } catch {
          return null;
        }
      },
    };
  } catch {
    return null;
  }
}
