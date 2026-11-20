import type { RenderContext, RenderResult } from './types';
import { setSafeHtml, type SafeHtml } from './safe-html';

interface ReflowStyle {
  className: string;
  maxWidth?: number;
  fontSize?: number;
  padding?: string;
}

/** Render sanitized markup as one flowing page, the shared layout of the HTML-like formats. */
export function renderReflowPage(
  ctx: RenderContext,
  html: SafeHtml,
  { className, maxWidth = 800, fontSize = 16, padding = '24px' }: ReflowStyle,
): RenderResult {
  const container = document.createElement('div');
  container.className = className;
  container.style.padding = padding;
  container.style.maxWidth = `${maxWidth}px`;
  container.style.margin = '0 auto';
  container.style.fontSize = `${fontSize * ctx.scale}px`;
  container.style.lineHeight = '1.6';
  container.style.color = 'var(--dv-page-ink)';
  container.style.background = 'var(--dv-page-bg)';
  setSafeHtml(container, html);
  ctx.target.replaceChildren(container);
  return {
    width: ctx.page.width * ctx.scale,
    height: container.scrollHeight || ctx.page.height * ctx.scale,
  };
}
