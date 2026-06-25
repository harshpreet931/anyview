/* ============================================================
 * loadParser - dynamic import of a third-party parser library.
 *
 * Adapters code-split their heavy parsers (xlsx, mammoth, jszip, …)
 * behind dynamic imports. When the dependency is missing from the
 * consumer's app - or a chunk fails to load - the raw bundler error
 * is cryptic. This wraps the import so the failure becomes an
 * actionable ViewerError that names the package to install.
 * ============================================================ */

import { ViewerError } from './errors';

export async function loadParser<T>(
  pkg: string,
  importer: () => Promise<T>,
): Promise<T> {
  try {
    return await importer();
  } catch (cause) {
    throw new ViewerError(
      'PARSE_ERROR',
      `Could not load the "${pkg}" package required to open this document. ` +
        `Make sure it is installed in your app: npm install ${pkg}`,
      { cause },
    );
  }
}
