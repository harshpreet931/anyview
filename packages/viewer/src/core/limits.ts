import { ViewerError } from './errors';

/** Ceiling on the raw bytes a whole-document synchronous transform will accept. */
export const MAX_TRANSFORM_BYTES = 24 * 1024 * 1024;

export function assertTransformSize(byteLength: number): void {
  if (byteLength > MAX_TRANSFORM_BYTES) {
    throw new ViewerError(
      'MEMORY_LIMIT',
      'This document is too large to display.',
    );
  }
}

export const MAX_CANVAS_AREA = 16_777_216;
export const MAX_CANVAS_SIDE = 16_384;

/** Largest backing-store ratio (≤ dpr) that keeps a canvas of this CSS size inside browser limits. */
export function canvasPixelRatio(cssWidth: number, cssHeight: number, dpr: number): number {
  const w = Math.max(1, cssWidth);
  const h = Math.max(1, cssHeight);
  return Math.min(
    Math.max(dpr, 0.01),
    Math.sqrt(MAX_CANVAS_AREA / (w * h)),
    MAX_CANVAS_SIDE / Math.max(w, h),
  );
}
