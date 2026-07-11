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
