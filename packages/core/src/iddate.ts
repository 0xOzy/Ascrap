/**
 * Bahasa Indonesia date parsing.
 *
 * Indonesian month names differ from English (Mei, Agustus, Oktober,
 * Desember…) and the numeric convention is day-first (DD/MM/YYYY).
 */

const MONTHS: Record<string, number> = {
  januari: 1,
  jan: 1,
  februari: 2,
  feb: 2,
  maret: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  juni: 6,
  jun: 6,
  juli: 7,
  jul: 7,
  agustus: 8,
  agu: 8,
  agt: 8,
  ags: 8,
  september: 9,
  sep: 9,
  sept: 9,
  oktober: 10,
  okt: 10,
  november: 11,
  nov: 11,
  desember: 12,
  des: 12,
};

const MONTH_NAMES = Object.keys(MONTHS)
  .sort((a, b) => b.length - a.length)
  .join("|");

const NAMED_DATE = new RegExp(
  `\\b(\\d{1,2})\\s+(${MONTH_NAMES})\\s+(\\d{4})\\b`,
  "i",
);
const NUMERIC_DATE = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/;

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject overflow dates such as 31 Februari (which Date would roll over).
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/**
 * Find the first Indonesian date in a text and return it as ISO `YYYY-MM-DD`.
 * Accepts named months ("21 November 2026", "3 Agu 2026") and day-first
 * numeric dates ("21/11/2026", "21-11-2026"). Returns null when no valid
 * date is present.
 */
export function parseIndonesianDate(text: string): string | null {
  if (!text) return null;

  const named = text.match(NAMED_DATE);
  if (named) {
    const day = Number.parseInt(named[1], 10);
    const month = MONTHS[named[2].toLowerCase()];
    const year = Number.parseInt(named[3], 10);
    if (month) {
      const iso = toIso(year, month, day);
      if (iso) return iso;
    }
  }

  const numeric = text.match(NUMERIC_DATE);
  if (numeric) {
    const day = Number.parseInt(numeric[1], 10);
    const month = Number.parseInt(numeric[2], 10);
    const year = Number.parseInt(numeric[3], 10);
    return toIso(year, month, day);
  }

  return null;
}
