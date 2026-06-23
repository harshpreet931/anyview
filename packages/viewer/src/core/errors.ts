/* ============================================================
 * Typed Error Classes
 * ============================================================ */

export type ViewerErrorCode =
  | 'UNSUPPORTED_FORMAT'
  | 'PARSE_ERROR'
  | 'RENDER_ERROR'
  | 'PASSWORD_REQUIRED'
  | 'PASSWORD_INCORRECT'
  | 'NETWORK_ERROR'
  | 'CORRUPT_FILE'
  | 'PERMISSION_DENIED'
  | 'MEMORY_LIMIT'
  | 'WORKER_ERROR';

export interface ViewerErrorOptions {
  cause?: unknown;
  retryable?: boolean;
}

export class ViewerError extends Error {
  public readonly code: ViewerErrorCode;
  public readonly rootCause?: unknown;
  public readonly retryable: boolean;

  constructor(
    code: ViewerErrorCode,
    message: string,
    options?: ViewerErrorOptions,
  ) {
    super(
      message,
      options?.cause !== undefined ? { cause: options.cause } : undefined,
    );
    this.code = code;
    this.rootCause = options?.cause;
    this.retryable = options?.retryable ?? false;
    this.name = 'ViewerError';
  }
}

export function isViewerError(value: unknown): value is ViewerError {
  return value instanceof ViewerError;
}
