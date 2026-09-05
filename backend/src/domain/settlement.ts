import { Balance, LedgerEntry, Transfer, UserId } from './types';

/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Nets a list of expenses down to one balance per member.
 *
 * Paying for something credits you the full amount; being a participant debits
 * you your share. Members with no activity are still returned, at zero, so the
 * caller gets a complete picture of the group.
 *
 * Balances come back in the same order as `memberIds`.
 */
export function computeBalances(
  _memberIds: readonly UserId[],
  _entries: readonly LedgerEntry[],
): Balance[] {
  throw new Error('computeBalances is not implemented yet');
}

/**
 * Reduces a set of balances to the shortest list of payments that settles them.
 *
 * Repeatedly matches the largest debtor against the largest creditor. Each pass
 * zeroes at least one party, so `n` people with non-zero balances settle in at
 * most `n - 1` transfers.
 */
export function simplifyDebts(_balances: readonly Balance[]): Transfer[] {
  throw new Error('simplifyDebts is not implemented yet');
}
