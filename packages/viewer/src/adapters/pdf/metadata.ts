import type { DocumentMetadata } from '../../core/types';

type Defined<T> = { [K in keyof T]?: Exclude<T[K], undefined> };

function withoutUndefined<T extends object>(record: T): Defined<T> {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Defined<T>;
}

export function pdfMetadata(
  info: Record<string, unknown>,
  toDate: (pdfDate: string) => Date | null,
): DocumentMetadata {
  const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
  const date = (value: unknown) => {
    const parsed = typeof value === 'string' && value ? toDate(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
  };
  return withoutUndefined({
    title: text(info.Title),
    author: text(info.Author),
    subject: text(info.Subject),
    keywords: text(info.Keywords),
    creator: text(info.Creator),
    producer: text(info.Producer),
    creationDate: date(info.CreationDate),
    modificationDate: date(info.ModDate),
  });
}
