import Decimal from 'decimal.js';

/**
 * Exact decimal arithmetic helpers for the compliance engine.
 *
 * WHY: raw JavaScript floats change PASS/FAIL verdicts at the MPE limit.
 * OIML R-76 treats an error EQUAL to the MPE as acceptable (<=), but in
 * binary floating point, for example:
 *
 *    0.04 - 0.03            === 0.010000000000000002   (> MPE 0.01 -> wrong FAIL)
 *    Math.abs(5.004 - 5)    === 0.0039999999999995595
 *    5.01 / 0.01            === 500.99999999999994     (not 501)
 *
 * Every mass, error, MPE and load-in-e value used for a compliance
 * DECISION must therefore go through Decimal, never through `number`.
 *
 * Numbers are converted via their shortest round-trip string form, so
 * `D(5.004)` is exactly 5.004 - not the binary approximation.
 */

// 34 significant digits is far beyond any weighing application.
Decimal.set({ precision: 34, rounding: Decimal.ROUND_HALF_UP });

export type Numeric = number | string | Decimal | null | undefined;

/** True when a value can be used as a finite decimal. */
export function isNumeric(value: Numeric): boolean {
  if (value === null || value === undefined) return false;
  if (value instanceof Decimal) return value.isFinite();
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string' && value.trim() === '') return false;
  try {
    return new Decimal(value).isFinite();
  } catch {
    return false;
  }
}

/** Convert to Decimal. Throws on non-numeric input - guard with isNumeric first. */
export function D(value: Numeric): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined) {
    throw new Error('Cannot convert null/undefined to Decimal');
  }
  // Number -> string uses the shortest round-trip representation,
  // so the decimal the user actually typed is preserved.
  return new Decimal(typeof value === 'number' ? value.toString() : value);
}

/** Convert back to a JS number for storage/display. Null-safe. */
export function toNumber(value: Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  return value.toNumber();
}

/** |a - b| computed exactly. */
export function absDiff(a: Numeric, b: Numeric): Decimal {
  return D(a).minus(D(b)).abs();
}

/**
 * Compliance comparison: is |error| within the MPE?
 * R-76 treats error == MPE as acceptable, so this is <=.
 */
export function withinLimit(absoluteError: Numeric, limit: Numeric): boolean {
  return D(absoluteError).lte(D(limit));
}

/**
 * Express a load as a number of verification intervals (load / e).
 * Used for MPE band selection, so it must be exact.
 */
export function loadInE(load: Numeric, e: Numeric): Decimal {
  return D(load).abs().div(D(e));
}

/** Format for display without float artefacts (e.g. 0.004, not 0.0039999999999995595). */
export function formatDecimal(value: Numeric, decimalPlaces = 4): string {
  if (!isNumeric(value)) return '-';
  // toFixed then strip trailing zeros, but always keep at least one decimal.
  const fixed = D(value).toFixed(decimalPlaces);
  return fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
}

/** Signed display with an explicit + for positive errors. */
export function formatSigned(value: Numeric, decimalPlaces = 4): string {
  if (!isNumeric(value)) return '-';
  const d = D(value);
  const body = formatDecimal(d, decimalPlaces);
  return d.isPositive() && !d.isZero() ? `+${body}` : body;
}

export { Decimal };
