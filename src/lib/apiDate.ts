/**
 * Reads a timestamp the API sent.
 *
 * Email dates are stored as UTC with no zone marker ("2026-09-28T17:59:00"), and `new Date()` reads
 * such a string as the VIEWER'S local time. In US time zones that put every email 4-7 hours late,
 * so "days ago" ran a day short and evening mail showed the next day's date (2026-10-05). Strings
 * with a zone ("...Z", "+00:00") and date-only strings already parse correctly and pass through.
 *
 * Mirrors the extension's `parseEmailDate` (popup/src/utils/uiHelpers.js), which has done this all
 * along, so the popup and the web read the same instant from the same string.
 */
export function parseApiDate(value?: string | number | Date | null): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const raw = String(value).trim();
  if (!raw) return null;
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);
  const naiveDateTime = !hasZone && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(raw);
  const date = new Date(naiveDateTime ? `${raw.replace(" ", "T")}Z` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Epoch milliseconds for sorting; an unreadable value sorts as 0, as `new Date(0)` did. */
export function apiDateMs(value?: string | number | Date | null): number {
  return parseApiDate(value)?.getTime() ?? 0;
}
