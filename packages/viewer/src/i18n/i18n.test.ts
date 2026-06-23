import { describe, it, expect } from 'vitest';
import { formatString, resolveStrings, registerStrings } from './I18nProvider';
import { en } from './en';

describe('i18n', () => {
  it('formats placeholders', () => {
    expect(formatString('{0} of {1}', 1, 12)).toBe('1 of 12');
    expect(formatString('no placeholders')).toBe('no placeholders');
    expect(formatString('{0}{1}', 'a')).toBe('a');
  });

  it('resolves the base English table', () => {
    expect(resolveStrings('en')).toBe(en);
  });

  it('falls back to English for unknown locales', () => {
    expect(resolveStrings('xx-YY')).toBe(en);
  });

  it('resolves a registered locale (including region subtags)', () => {
    const fr = { ...en, search: { ...en.search, placeholder: 'Rechercher…' } };
    registerStrings('fr', fr);
    expect(resolveStrings('fr')).toBe(fr);
    expect(resolveStrings('fr-FR')).toBe(fr);
  });
});
