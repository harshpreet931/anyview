const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;

function safeLocale(locale: string): string {
  try {
    return Intl.getCanonicalLocales(locale)[0] ?? 'en';
  } catch {
    return 'en';
  }
}

/** A byte count in the reader's locale, e.g. "1.5 kB" or "1,5 kB". */
export function formatFileSize(bytes: number, locale: string): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  return new Intl.NumberFormat(safeLocale(locale), {
    style: 'unit',
    unit: UNITS[unit],
    unitDisplay: 'short',
    maximumFractionDigits: unit === 0 ? 0 : 1,
  }).format(value);
}

export function formatDateTime(value: Date | string | number, locale: string): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat(safeLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
