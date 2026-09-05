import { computeBalances, simplifyDebts } from '../../src/domain/settlement';
import { Balance, LedgerEntry } from '../../src/domain/types';
import { expectDomainError } from '../helpers/expect';
import { applyTransfers, totalOf } from '../helpers/ledger';
import { randomInt, seededRandom } from '../helpers/random';

const alice = 'alice';
const bob = 'bob';
const carol = 'carol';
const dave = 'dave';

function equalEntry(paidBy: string, amountMinor: number, members: string[]): LedgerEntry {
  const base = Math.floor(amountMinor / members.length);
  const remainder = amountMinor - base * members.length;
  return {
    paidBy,
    amountMinor,
    shares: members.map((userId, index) => ({
      userId,
      shareMinor: base + (index < remainder ? 1 : 0),
    })),
  };
}

describe('computeBalances', () => {
  it('credits the payer and debits every participant', () => {
    const members = [alice, bob, carol];

    expect(computeBalances(members, [equalEntry(alice, 3000, members)])).toEqual([
      { userId: alice, netMinor: 2000 },
      { userId: bob, netMinor: -1000 },
      { userId: carol, netMinor: -1000 },
    ]);
  });

  it('accumulates across several expenses', () => {
    const members = [alice, bob, carol];
    const entries = [equalEntry(alice, 3000, members), equalEntry(bob, 1500, members)];

    expect(computeBalances(members, entries)).toEqual([
      { userId: alice, netMinor: 1500 },
      { userId: bob, netMinor: 0 },
      { userId: carol, netMinor: -1500 },
    ]);
  });

  it('reports a member who took no part at zero rather than omitting them', () => {
    const balances = computeBalances(
      [alice, bob, dave],
      [
        {
          paidBy: alice,
          amountMinor: 1000,
          shares: [
            { userId: alice, shareMinor: 500 },
            { userId: bob, shareMinor: 500 },
          ],
        },
      ],
    );

    expect(balances).toContainEqual({ userId: dave, netMinor: 0 });
  });

  it('returns balances in the order the members were given', () => {
    const balances = computeBalances([carol, alice, bob], []);
    expect(balances.map((balance) => balance.userId)).toEqual([carol, alice, bob]);
  });

  it('returns every member at zero when there are no expenses', () => {
    expect(computeBalances([alice, bob], [])).toEqual([
      { userId: alice, netMinor: 0 },
      { userId: bob, netMinor: 0 },
    ]);
  });

  it('always produces balances that sum to zero', () => {
    const members = [alice, bob, carol];
    const balances = computeBalances(members, [
      equalEntry(alice, 1000, members),
      equalEntry(bob, 777, members),
      equalEntry(carol, 3, members),
    ]);

    expect(totalOf(balances.map((balance) => balance.netMinor))).toBe(0);
  });

  it('rejects a payer who is not a member of the group', () => {
    expectDomainError(
      () =>
        computeBalances(
          [alice, bob],
          [{ paidBy: dave, amountMinor: 100, shares: [{ userId: alice, shareMinor: 100 }] }],
        ),
      'UNKNOWN_MEMBER',
    );
  });

  it('rejects a share belonging to someone outside the group', () => {
    expectDomainError(
      () =>
        computeBalances(
          [alice, bob],
          [{ paidBy: alice, amountMinor: 100, shares: [{ userId: dave, shareMinor: 100 }] }],
        ),
      'UNKNOWN_MEMBER',
    );
  });

  it('rejects an expense whose shares do not add up to what was paid', () => {
    expectDomainError(
      () =>
        computeBalances(
          [alice, bob],
          [
            {
              paidBy: alice,
              amountMinor: 1000,
              shares: [
                { userId: alice, shareMinor: 400 },
                { userId: bob, shareMinor: 400 },
              ],
            },
          ],
        ),
      'UNBALANCED_LEDGER',
    );
  });
});

describe('simplifyDebts', () => {
  describe('produces a plan that settles the group', () => {
    it('returns nothing when nobody owes anything', () => {
      expect(simplifyDebts([])).toEqual([]);
      expect(
        simplifyDebts([
          { userId: alice, netMinor: 0 },
          { userId: bob, netMinor: 0 },
        ]),
      ).toEqual([]);
    });

    it('settles a single debt directly', () => {
      expect(
        simplifyDebts([
          { userId: alice, netMinor: -1000 },
          { userId: bob, netMinor: 1000 },
        ]),
      ).toEqual([{ fromUserId: alice, toUserId: bob, amountMinor: 1000 }]);
    });

    it('pays one creditor from two debtors', () => {
      expect(
        simplifyDebts([
          { userId: alice, netMinor: -1000 },
          { userId: bob, netMinor: -1000 },
          { userId: carol, netMinor: 2000 },
        ]),
      ).toEqual([
        { fromUserId: alice, toUserId: carol, amountMinor: 1000 },
        { fromUserId: bob, toUserId: carol, amountMinor: 1000 },
      ]);
    });

    it('splits one debtor across two creditors, largest first', () => {
      expect(
        simplifyDebts([
          { userId: alice, netMinor: -500 },
          { userId: bob, netMinor: 200 },
          { userId: carol, netMinor: 300 },
        ]),
      ).toEqual([
        { fromUserId: alice, toUserId: carol, amountMinor: 300 },
        { fromUserId: alice, toUserId: bob, amountMinor: 200 },
      ]);
    });

    it('leaves a member who is already square out of the plan entirely', () => {
      const transfers = simplifyDebts([
        { userId: alice, netMinor: 1500 },
        { userId: bob, netMinor: 0 },
        { userId: carol, netMinor: -1500 },
      ]);

      expect(transfers).toEqual([
        { fromUserId: carol, toUserId: alice, amountMinor: 1500 },
      ]);
      expect(transfers.some((t) => t.fromUserId === bob || t.toUserId === bob)).toBe(false);
    });

    it('settles a four person group in three transfers, not six', () => {
      expect(
        simplifyDebts([
          { userId: alice, netMinor: 700 },
          { userId: bob, netMinor: 300 },
          { userId: carol, netMinor: -400 },
          { userId: dave, netMinor: -600 },
        ]),
      ).toEqual([
        { fromUserId: dave, toUserId: alice, amountMinor: 600 },
        { fromUserId: carol, toUserId: bob, amountMinor: 300 },
        { fromUserId: carol, toUserId: alice, amountMinor: 100 },
      ]);
    });
  });

  describe('rejects input that cannot be settled', () => {
    it('rejects balances that do not net to zero', () => {
      expectDomainError(
        () =>
          simplifyDebts([
            { userId: alice, netMinor: -1000 },
            { userId: bob, netMinor: 900 },
          ]),
        'UNBALANCED_LEDGER',
      );
    });

    it('rejects a fractional balance', () => {
      expectDomainError(
        () =>
          simplifyDebts([
            { userId: alice, netMinor: -10.5 },
            { userId: bob, netMinor: 10.5 },
          ]),
        'INVALID_AMOUNT',
      );
    });

    it('rejects the same member appearing twice', () => {
      expectDomainError(
        () =>
          simplifyDebts([
            { userId: alice, netMinor: -1000 },
            { userId: alice, netMinor: 1000 },
          ]),
        'DUPLICATE_PARTICIPANT',
      );
    });
  });

  describe('invariants across many generated groups', () => {
    function zeroSumBalances(next: () => number, size: number): Balance[] {
      const balances: Balance[] = [];
      let running = 0;

      for (let index = 0; index < size - 1; index += 1) {
        const net = randomInt(next, -50_000, 50_000);
        running += net;
        balances.push({ userId: `user-${index}`, netMinor: net });
      }
      balances.push({ userId: `user-${size - 1}`, netMinor: -running });

      return balances;
    }

    it('settles everybody to exactly zero', () => {
      const next = seededRandom(31337);

      for (let round = 0; round < 500; round += 1) {
        const balances = zeroSumBalances(next, randomInt(next, 2, 9));
        const settled = applyTransfers(balances, simplifyDebts(balances));

        for (const [, net] of settled) {
          expect(net).toBe(0);
        }
      }
    });

    it('never needs more than one transfer fewer than there are active members', () => {
      const next = seededRandom(999);

      for (let round = 0; round < 500; round += 1) {
        const balances = zeroSumBalances(next, randomInt(next, 2, 9));
        const active = balances.filter((balance) => balance.netMinor !== 0).length;
        const transfers = simplifyDebts(balances);

        if (active === 0) {
          expect(transfers).toHaveLength(0);
        } else {
          expect(transfers.length).toBeLessThanOrEqual(active - 1);
        }
      }
    });

    it('only ever asks for positive whole amounts', () => {
      const next = seededRandom(2024);

      for (let round = 0; round < 500; round += 1) {
        const transfers = simplifyDebts(zeroSumBalances(next, randomInt(next, 2, 9)));

        for (const transfer of transfers) {
          expect(Number.isSafeInteger(transfer.amountMinor)).toBe(true);
          expect(transfer.amountMinor).toBeGreaterThan(0);
          expect(transfer.fromUserId).not.toBe(transfer.toUserId);
        }
      }
    });

    it('gives the same plan for the same input every time', () => {
      const next = seededRandom(5);
      const balances = zeroSumBalances(next, 7);

      expect(simplifyDebts(balances)).toEqual(simplifyDebts(balances));
    });
  });
});
