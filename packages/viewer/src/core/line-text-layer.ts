import type { TextLayer } from './types';

const CHAR_WIDTH = 8;

type LineWidth = (line: string) => number;

const defaultLineWidth: LineWidth = (line) => line.length * CHAR_WIDTH;

export function lineTextLayer(
  lines: readonly string[],
  lineHeight: number,
  lineWidth: LineWidth = defaultLineWidth,
): TextLayer {
  return {
    pageIndex: 0,
    items: lines.map((line, i) => ({
      str: line,
      x: 0,
      y: i * lineHeight,
      width: lineWidth(line),
      height: lineHeight,
    })),
  };
}

export function widestLine(lines: readonly string[], lineWidth: LineWidth = defaultLineWidth): number {
  // A loop, not Math.max(...spread): spreading a huge array overflows the call-stack argument limit.
  let widest = 0;
  for (const line of lines) {
    const width = lineWidth(line);
    if (width > widest) widest = width;
  }
  return widest;
}
