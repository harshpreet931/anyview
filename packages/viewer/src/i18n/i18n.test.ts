import { describe, it, expect } from 'vitest';
import { formatString, resolveStrings, registerStrings } from './strings';
import { en } from './en';
import { formatFileSize, formatDateTime } from './format';

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
    expect(resolveStrings('fr')).toEqual(fr);
    expect(resolveStrings('fr-FR')).toEqual(fr);
  });

  it('fills keys missing from a registered table with English', () => {
    registerStrings('de', { toolbar: { fitPage: 'Ganze Seite' } });
    const de = resolveStrings('de');
    expect(de.toolbar.fitPage).toBe('Ganze Seite');
    expect(de.toolbar.zoomIn).toBe(en.toolbar.zoomIn);
    expect(de.search.placeholder).toBe(en.search.placeholder);
  });

  it('covers every control label the viewer renders', () => {
    expect(en.toolbar).toMatchObject({
      zoomLevel: expect.any(String),
      fitPage: expect.any(String),
      fitWidth: expect.any(String),
      actualSize: expect.any(String),
      marqueeZoom: expect.any(String),
      pageLayout: expect.any(String),
      singlePage: expect.any(String),
      twoPages: expect.any(String),
      twoPagesCover: expect.any(String),
      label: expect.any(String),
      annotationTools: expect.any(String),
    });
    expect(Object.keys(en.annotations).sort()).toEqual(
      ['arrow', 'draw', 'ellipse', 'freeText', 'freeTextItem', 'highlight', 'highlightItem', 'inkItem', 'line', 'note', 'noteItem', 'rectangle', 'shapeItem'].sort(),
    );
    expect(en.viewer).toMatchObject({ label: expect.any(String), content: expect.any(String), loading: expect.any(String) });
  });

  it('formats sizes and dates for the locale', () => {
    expect(formatFileSize(1536, 'en')).toBe('1.5 kB');
    expect(formatFileSize(1536, 'de')).toBe('1,5 kB');
    expect(formatFileSize(512, 'en')).toBe('512 byte');
    const when = new Date(Date.UTC(2026, 0, 31, 12));
    expect(formatDateTime(when, 'de')).toContain('31.01.2026');
    expect(formatDateTime(when, 'not a locale!')).toBe(formatDateTime(when, 'en'));
  });
});
