import { SplitMode, SplitParticipant, SplitShare } from './types';

/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Works out what each participant owes for a single expense.
 *
 * The result always sums to exactly `amountMinor`, whatever the mode. No cent
 * is created and none is lost.
 */
export function computeSplit(
  _amountMinor: number,
  _mode: SplitMode,
  _participants: readonly SplitParticipant[],
): SplitShare[] {
  throw new Error('computeSplit is not implemented yet');
}
