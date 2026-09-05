/**
 * Conversion between what a person types and what the API stores.
 *
 * The API deals only in integer minor units. This file is the single place
 * where the two representations meet, and it does the conversion by string
 * manipulation rather than by multiplying a float, because multiplying the
 * parsed value of "10.01" by 100 does not reliably give 1001.
 */

const AMOUNT_PATTERN = /^\s*(\d{1,12})(?:[.,](\d{1,2}))?\s*$/;

/**
 * Reads a typed amount in major units and returns minor units.
 *
 * Returns null when the input is not an amount at all, which the forms treat as
 * "not ready to submit" rather than as an error to shout about while the user
 * is still typing.
 */
export function parseAmount(input: string): number | null {
  const match = AMOUNT_PATTERN.exec(input ?? '');

  if (!match) {
    return null;
  }

  const whole = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');

  return whole * 100 + Number(fraction);
}

/** Renders minor units for display: 1001 becomes "10.01". */
export function formatAmount(minor: number): string {
  const sign = minor < 0 ? '-' : '';
  const absolute = Math.abs(minor);
  const whole = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, '0');

  return `${sign}${whole}.${cents}`;
}

/** Renders minor units with a currency code, for anywhere a total is shown. */
export function formatMoney(minor: number, currency: string): string {
  return `${currency} ${formatAmount(minor)}`;
}
