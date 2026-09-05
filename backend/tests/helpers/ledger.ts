import { Balance, Transfer, UserId } from '../../src/domain/types';

/**
 * Applies a settlement plan to a set of balances and reports where everyone
 * ends up. Used to assert that a plan actually settles the group, rather than
 * merely looking plausible.
 */
export function applyTransfers(
  balances: readonly Balance[],
  transfers: readonly Transfer[],
): Map<UserId, number> {
  const result = new Map<UserId, number>();
  for (const balance of balances) {
    result.set(balance.userId, balance.netMinor);
  }

  for (const transfer of transfers) {
    // Paying down a debt moves the payer up towards zero and the recipient down.
    result.set(transfer.fromUserId, (result.get(transfer.fromUserId) ?? 0) + transfer.amountMinor);
    result.set(transfer.toUserId, (result.get(transfer.toUserId) ?? 0) - transfer.amountMinor);
  }

  return result;
}

export function totalOf(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}
