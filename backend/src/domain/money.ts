import { DomainError } from './types';

/**
 * True when the value is a safe integer, which is what a cent count must be.
 *
 * Rejects anything that merely looks whole: `0.1 + 0.2` is not `0.3`, and a
 * value beyond the safe integer range can no longer be incremented reliably.
 */
export function isMinorAmount(value: unknown): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

/** Throws unless the value is a valid cent count. */
export function assertMinorAmount(value: unknown, label: string): asserts value is number {
  if (!isMinorAmount(value)) {
    throw new DomainError(
      'INVALID_AMOUNT',
      `${label} must be a whole number of minor units, received ${String(value)}`,
    );
  }
}

/** Adds a list of cent amounts, rejecting the list if any entry is not one. */
export function sumMinor(amounts: readonly number[]): number {
  let total = 0;

  for (let index = 0; index < amounts.length; index += 1) {
    assertMinorAmount(amounts[index], `amount at position ${index}`);
    total += amounts[index];
  }

  return total;
}

/**
 * Divides `total` across `weights` so that the parts sum to exactly `total`.
 *
 * This is the kernel every split mode is built on. Integer division leaves a
 * remainder of at most `weights.length - 1` cents, which the largest-remainder
 * method hands to whoever was rounded down hardest. Ties go to the earlier
 * position, so the result is fully deterministic.
 *
 * A weight of zero can never receive a leftover cent: the leftover count is
 * always smaller than the number of parts with a non-zero remainder, and a zero
 * weight always has a remainder of zero.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  assertMinorAmount(total, 'total');

  if (total < 0) {
    throw new DomainError('INVALID_AMOUNT', `total must not be negative, received ${total}`);
  }

  if (weights.length === 0) {
    throw new DomainError('INVALID_WEIGHT', 'at least one weight is required');
  }

  let weightTotal = 0;
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) {
      throw new DomainError(
        'INVALID_WEIGHT',
        `every weight must be a whole number of zero or more, received ${weight}`,
      );
    }
    weightTotal += weight;
  }

  if (weightTotal === 0) {
    throw new DomainError('INVALID_WEIGHT', 'the weights must not all be zero');
  }

  const parts: number[] = new Array(weights.length);
  const remainders: { index: number; remainder: number }[] = new Array(weights.length);
  let allocated = 0;

  for (let index = 0; index < weights.length; index += 1) {
    // Scaling before dividing keeps the whole calculation in integers.
    const scaled = total * weights[index];
    const part = Math.floor(scaled / weightTotal);

    parts[index] = part;
    remainders[index] = { index, remainder: scaled - part * weightTotal };
    allocated += part;
  }

  remainders.sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const leftover = total - allocated;
  for (let position = 0; position < leftover; position += 1) {
    parts[remainders[position].index] += 1;
  }

  return parts;
}
