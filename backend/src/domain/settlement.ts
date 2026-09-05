import { assertMinorAmount } from './money';
import { Balance, DomainError, LedgerEntry, Transfer, UserId } from './types';

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
  memberIds: readonly UserId[],
  entries: readonly LedgerEntry[],
): Balance[] {
  const positionOf = new Map<UserId, number>();
  memberIds.forEach((userId, index) => positionOf.set(userId, index));

  const nets: number[] = memberIds.map(() => 0);

  for (const entry of entries) {
    assertMinorAmount(entry.amountMinor, 'amountMinor');

    const payerPosition = positionOf.get(entry.paidBy);
    if (payerPosition === undefined) {
      throw new DomainError(
        'UNKNOWN_MEMBER',
        `${entry.paidBy} paid for an expense but is not a member of the group`,
      );
    }

    // Validate the whole entry before touching the running totals, so a
    // rejected entry cannot leave half of itself applied.
    let shareTotal = 0;
    for (const share of entry.shares) {
      assertMinorAmount(share.shareMinor, `the share for ${share.userId}`);

      if (!positionOf.has(share.userId)) {
        throw new DomainError(
          'UNKNOWN_MEMBER',
          `${share.userId} has a share of an expense but is not a member of the group`,
        );
      }

      shareTotal += share.shareMinor;
    }

    if (shareTotal !== entry.amountMinor) {
      throw new DomainError(
        'UNBALANCED_LEDGER',
        `the shares of this expense add up to ${shareTotal}, but ${entry.amountMinor} was paid`,
      );
    }

    nets[payerPosition] += entry.amountMinor;
    for (const share of entry.shares) {
      nets[positionOf.get(share.userId) as number] -= share.shareMinor;
    }
  }

  return memberIds.map((userId, index) => ({ userId, netMinor: nets[index] }));
}

interface Position {
  userId: UserId;
  amount: number;
}

/** Largest amount first; ties broken by identifier so the order is stable. */
function byAmountThenId(a: Position, b: Position): number {
  return b.amount - a.amount || a.userId.localeCompare(b.userId);
}

/**
 * Reduces a set of balances to the shortest list of payments that settles them.
 *
 * Both sides are sorted by size and walked together, always pairing the largest
 * remaining debt against the largest remaining credit. Every payment clears at
 * least one of the two parties completely, so `n` people with a non-zero
 * balance settle in at most `n - 1` transfers.
 *
 * The result is sorted largest payment first, which is both stable across
 * identical requests and the order a person would want to read it in.
 */
export function simplifyDebts(balances: readonly Balance[]): Transfer[] {
  const seen = new Set<UserId>();
  let total = 0;

  for (const balance of balances) {
    if (seen.has(balance.userId)) {
      throw new DomainError(
        'DUPLICATE_PARTICIPANT',
        `${balance.userId} appears more than once in the balances`,
      );
    }
    seen.add(balance.userId);

    assertMinorAmount(balance.netMinor, `the balance for ${balance.userId}`);
    total += balance.netMinor;
  }

  if (total !== 0) {
    throw new DomainError(
      'UNBALANCED_LEDGER',
      `balances must net to zero across the group, but they net to ${total}`,
    );
  }

  const debtors: Position[] = balances
    .filter((balance) => balance.netMinor < 0)
    .map((balance) => ({ userId: balance.userId, amount: -balance.netMinor }))
    .sort(byAmountThenId);

  const creditors: Position[] = balances
    .filter((balance) => balance.netMinor > 0)
    .map((balance) => ({ userId: balance.userId, amount: balance.netMinor }))
    .sort(byAmountThenId);

  const transfers: Transfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amountMinor = Math.min(debtor.amount, creditor.amount);

    transfers.push({
      fromUserId: debtor.userId,
      toUserId: creditor.userId,
      amountMinor,
    });

    debtor.amount -= amountMinor;
    creditor.amount -= amountMinor;

    if (debtor.amount === 0) {
      debtorIndex += 1;
    }
    if (creditor.amount === 0) {
      creditorIndex += 1;
    }
  }

  return transfers.sort(
    (a, b) =>
      b.amountMinor - a.amountMinor ||
      a.fromUserId.localeCompare(b.fromUserId) ||
      a.toUserId.localeCompare(b.toUserId),
  );
}
