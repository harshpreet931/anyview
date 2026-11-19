import type { ThemeRegistration } from 'shiki';

const ink = '#2b2825';
const tangerine = '#c2410c';
const brown = '#8b4513';
const ochre = '#8f5f00';
const amber = '#b45309';
const olive = '#557326';
const umber = '#5c4a3a';
const muted = '#6b635a';
const comment = '#756a5e';
const red = '#b42318';

export const CODE_THEME: ThemeRegistration = {
  name: 'anyview-sand',
  type: 'light',
  colors: {
    'editor.background': '#f6f6f6',
    'editor.foreground': ink,
  },
  tokenColors: [
    { settings: { foreground: ink, background: '#f6f6f6' } },
    { scope: ['comment', 'punctuation.definition.comment', 'string.comment'], settings: { foreground: comment, fontStyle: 'italic' } },
    {
      scope: ['keyword', 'storage', 'storage.type', 'storage.modifier', 'keyword.operator.new', 'keyword.operator.expression', 'keyword.operator.logical', 'keyword.control'],
      settings: { foreground: tangerine },
    },
    { scope: ['keyword.operator', 'punctuation', 'meta.brace', 'meta.delimiter'], settings: { foreground: muted } },
    { scope: ['string', 'string.quoted', 'string.template', 'punctuation.definition.string', 'markup.inline.raw'], settings: { foreground: olive } },
    { scope: ['string.regexp', 'constant.character.escape', 'constant.other.character-class'], settings: { foreground: ochre } },
    { scope: ['constant', 'constant.numeric', 'constant.language', 'support.constant', 'variable.other.constant', 'variable.other.enummember'], settings: { foreground: amber } },
    { scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function', 'variable.function'], settings: { foreground: brown } },
    {
      scope: ['entity.name.type', 'entity.name.class', 'entity.other.inherited-class', 'support.type', 'support.class', 'entity.name.namespace', 'storage.type.primitive', 'support.type.primitive'],
      settings: { foreground: ochre },
    },
    { scope: ['variable', 'variable.parameter', 'meta.definition.variable'], settings: { foreground: ink } },
    { scope: ['variable.language', 'variable.language.this', 'variable.language.self'], settings: { foreground: tangerine, fontStyle: 'italic' } },
    { scope: ['variable.other.property', 'support.variable.property', 'meta.object-literal.key', 'entity.name.tag.yaml', 'support.type.property-name'], settings: { foreground: umber } },
    { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: tangerine } },
    { scope: ['entity.other.attribute-name'], settings: { foreground: ochre } },
    { scope: ['entity.name.function.decorator', 'meta.decorator', 'punctuation.decorator'], settings: { foreground: amber } },
    { scope: ['markup.heading', 'entity.name.section'], settings: { foreground: tangerine, fontStyle: 'bold' } },
    { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
    { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
    { scope: ['markup.underline.link', 'string.other.link'], settings: { foreground: ochre } },
    { scope: ['markup.inserted'], settings: { foreground: olive } },
    { scope: ['markup.deleted', 'invalid', 'invalid.illegal'], settings: { foreground: red } },
  ],
};
