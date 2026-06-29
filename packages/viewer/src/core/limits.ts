/* ============================================================
 * Resource limits.
 *
 * Reflowable adapters transform a whole document synchronously on the main
 * thread (markdown/notebook render, Shiki highlight, DOMPurify, mammoth). A
 * pathologically large input would block the thread long enough to look like a
 * hang, so refuse it up front with a clear error rather than freezing the page.
 * ============================================================ */

import { ViewerError } from './errors';

/** Ceiling on the raw bytes a whole-document synchronous transform will accept. */
export const MAX_TRANSFORM_BYTES = 24 * 1024 * 1024; // 24 MB

export function assertTransformSize(byteLength: number): void {
  if (byteLength > MAX_TRANSFORM_BYTES) {
    throw new ViewerError(
      'MEMORY_LIMIT',
      'This document is too large to display.',
    );
  }
}
