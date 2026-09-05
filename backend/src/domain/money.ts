/* eslint-disable @typescript-eslint/no-unused-vars */

const NOT_IMPLEMENTED = 'not implemented yet';

/** True when the value is a safe integer, which is what a cent count must be. */
export function isMinorAmount(_value: unknown): boolean {
  throw new Error(`isMinorAmount is ${NOT_IMPLEMENTED}`);
}

/** Throws unless the value is a valid cent count. */
export function assertMinorAmount(_value: unknown, _label: string): asserts _value is number {
  throw new Error(`assertMinorAmount is ${NOT_IMPLEMENTED}`);
}

/** Adds a list of cent amounts. */
export function sumMinor(_amounts: readonly number[]): number {
  throw new Error(`sumMinor is ${NOT_IMPLEMENTED}`);
}

/**
 * Divides `total` across `weights` so that the parts sum to exactly `total`.
 *
 * This is the kernel every split mode is built on. Integer division leaves a
 * remainder of at most `weights.length - 1` cents; those cents are handed out
 * by the largest-remainder method, with ties broken by position so the result
 * is fully deterministic.
 */
export function allocate(_total: number, _weights: readonly number[]): number[] {
  throw new Error(`allocate is ${NOT_IMPLEMENTED}`);
}
