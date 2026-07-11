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
