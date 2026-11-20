declare const safeHtmlBrand: unique symbol;

/**
 * Markup that has already been escaped or run through the sanitizer. The brand
 * makes the compiler - not code review - the thing that stops a raw document
 * string from reaching the DOM.
 */
export type SafeHtml = string & { readonly [safeHtmlBrand]: true };

/**
 * Brand a string as safe. Call this only on the result of an escape or a
 * `DOMPurify.sanitize()`, never on bytes that came straight out of a file.
 */
export function markSanitized(html: string): SafeHtml {
  return html as SafeHtml;
}

export const EMPTY_HTML = markSanitized('');

/**
 * Replace an element's children with parsed markup.
 *
 * The markup is parsed into a `<template>` first. Template content lives in an
 * inert document, so nothing fetches, loads, or runs while it is being parsed -
 * the nodes only become live once they are adopted below.
 */
export function setSafeHtml(el: Element, html: SafeHtml): void {
  el.replaceChildren(parseSafeHtml(html));
}

/** Append parsed markup after an element's children, parsed inertly like {@link setSafeHtml}. */
export function appendSafeHtml(el: Element, html: SafeHtml): void {
  el.append(parseSafeHtml(html));
}

function parseSafeHtml(html: SafeHtml): DocumentFragment {
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

export function escapeHtml(text: string): SafeHtml {
  const div = document.createElement('div');
  div.textContent = text;
  return markSanitized(div.innerHTML);
}
