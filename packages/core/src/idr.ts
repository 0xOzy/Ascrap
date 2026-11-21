/**
 * Indonesian Rupiah (IDR) amount parsing.
 *
 * Indonesian formatting differs from English in ways that silently corrupt
 * naive parsers: dots are thousand separators and commas are the decimal
 * mark — `Rp 1.250.000` is one million two hundred fifty thousand rupiah,
 * not 1.25. Amounts are also commonly written with magnitude words:
 * `850 ribu` (850 thousand), `1,25 juta` (1.25 million), `2 miliar` (2 billion).
 */

const MULTIPLIERS: Record<string, number> = {
  ribu: 1_000,
  rb: 1_000,
  juta: 1_000_000,
  jt: 1_000_000,
  miliar: 1_000_000_000,
  milyar: 1_000_000_000,
  triliun: 1_000_000_000_000,
  t: 1_000_000_000_000,
};

/** Parse an Indonesian-formatted number body (no currency marker, no magnitude word). */
function parseIdNumber(body: string): number | null {
  const s = body.trim();
  if (!s) return null;

  // English-style decimal with 1–2 fraction digits and no thousand dots: "1.5"
  if (/^\d+\.\d{1,2}$/.test(s)) return Number.parseFloat(s);

  // Indonesian format: dots group thousands, comma is the decimal mark.
  if (!/^[\d.,]+$/.test(s)) return null;
  const normalized = s.replace(/\./g, "").replace(",", ".");
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : null;
}

/**
 * Parse a single IDR amount string to a plain number of rupiah.
 * Returns null when the string is not a parseable amount.
 *
 * Examples:
 *   parseIdr("Rp 1.250.000")     -> 1250000
 *   parseIdr("Rp1.250.000,00")   -> 1250000
 *   parseIdr("IDR 99.000")       -> 99000
 *   parseIdr("850 ribu")         -> 850000
 *   parseIdr("1,25 juta")        -> 1250000
 *   parseIdr("2,5 miliar")       -> 2500000000
 */
export function parseIdr(input: string): number | null {
  if (!input) return null;
  let s = input.trim().toLowerCase();
  s = s.replace(/^(rp\.?|idr)\s*/i, "").trim();

  let multiplier = 1;
  const magnitude = s.match(/\s*(ribu|rb|juta|jt|miliar|milyar|triliun|t)\.?$/i);
  if (magnitude) {
    multiplier = MULTIPLIERS[magnitude[1].toLowerCase()] ?? 1;
    s = s.slice(0, magnitude.index).trim();
  }

  const value = parseIdNumber(s);
  if (value === null) return null;
  return Math.round(value * multiplier);
}

const AMOUNT_PATTERN =
  /(?:rp\.?|idr)\s*[\d][\d.,]*\s*(?:ribu|juta|miliar|milyar|triliun|rb|jt)?\b|[\d][\d.,]*\s*(?:ribu|juta|miliar|milyar|triliun)\b/gi;

/**
 * Find every IDR amount mentioned in a text and return the parsed values,
 * in document order. Bare numbers without a currency marker or magnitude
 * word are ignored (they are too ambiguous to claim as prices).
 */
export function findIdrAmounts(text: string): number[] {
  const amounts: number[] = [];
  for (const match of text.matchAll(AMOUNT_PATTERN)) {
    const value = parseIdr(match[0]);
    if (value !== null) amounts.push(value);
  }
  return amounts;
}
