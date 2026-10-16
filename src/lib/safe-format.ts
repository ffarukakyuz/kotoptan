/**
 * Defensive String, Phone, Price & Text Formatting Helpers
 *
 * Guarantees that even if data from backend/state/DB/localStorage is
 * undefined or null when the page first loads, these functions NEVER throw:
 * "Cannot read properties of undefined (reading 'replaceAll')" or (reading 'replace')
 * and return safe defaults (such as empty string "") instead of crashing the UI.
 */

/**
 * Converts any value safely to a string without throwing.
 * Returns "" if null, undefined, or empty.
 */
export function safeString(value?: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

/**
 * Defensive replaceAll helper.
 * Guaranteed never to throw 'Cannot read properties of undefined (reading replaceAll)'.
 */
export function safeReplaceAll(
  value: unknown,
  search: string | RegExp,
  replacement: string | ((substring: string, ...args: unknown[]) => string),
): string {
  const str = safeString(value);
  if (!str) return "";
  try {
    if (typeof str.replaceAll === "function") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return str.replaceAll(search as any, replacement as any);
    }
    if (typeof search === "string") {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return str.replace(new RegExp(escaped, "g"), replacement as any);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return str.replace(search, replacement as any);
  } catch {
    return str;
  }
}

/**
 * Defensive replace helper.
 * Guaranteed never to throw 'Cannot read properties of undefined (reading replace)'.
 */
export function safeReplace(
  value: unknown,
  search: string | RegExp,
  replacement: string | ((substring: string, ...args: unknown[]) => string),
): string {
  const str = safeString(value);
  if (!str) return "";
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return str.replace(search, replacement as any);
  } catch {
    return str;
  }
}

/**
 * Defensive phone number sanitizer and formatter.
 * Returns only digits or standard normalized 10-digit format.
 * If input is undefined, null, or empty, safely returns "".
 */
export function formatPhoneNumber(raw?: unknown): string {
  if (raw === null || raw === undefined) return "";
  const str = safeString(raw).trim();
  if (!str) return "";
  if (str === "misafir") return "misafir";

  let digits = str.replace(/\D/g, "");
  if (!digits) return "";

  if (digits.startsWith("90") && digits.length >= 12) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Formats a phone number for display (e.g. 0544 893 13 00).
 * Safely returns "" if input is undefined/null.
 */
export function formatPhoneDisplay(raw?: unknown): string {
  const norm = formatPhoneNumber(raw);
  if (!norm || norm === "misafir") return safeString(raw);
  if (norm.length === 10) {
    return `0${norm.slice(0, 3)} ${norm.slice(3, 6)} ${norm.slice(6, 8)} ${norm.slice(8, 10)}`;
  }
  return `0${norm}`;
}

/**
 * Defensive price / currency formatter.
 * Safely returns "" if price is null/undefined or not yet loaded.
 */
export function formatPrice(price?: unknown): string {
  if (price === null || price === undefined || price === "") return "";
  const num =
    typeof price === "number"
      ? price
      : parseFloat(safeString(price).replace(/\s+/g, "").replace(",", "."));
  if (Number.isNaN(num)) return "";
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${num.toFixed(2)} TL`;
  }
}

/**
 * Defensive text trimmer.
 * Safely returns "" if value is null/undefined.
 */
export function safeTrim(value?: unknown): string {
  return safeString(value).trim();
}

/**
 * Defensive text lower-caser.
 * Safely returns "" if value is null/undefined.
 */
export function safeLowerCase(value?: unknown): string {
  return safeString(value).toLowerCase();
}
