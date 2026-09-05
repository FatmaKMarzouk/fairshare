import { computeSplit } from '../../src/domain/split';
import { SplitMode, SplitParticipant } from '../../src/domain/types';
import { expectDomainError } from '../helpers/expect';
import { randomInt, seededRandom } from '../helpers/random';

const alice = 'alice';
const bob = 'bob';
const carol = 'carol';

function sumShares(shares: { shareMinor: number }[]): number {
  return shares.reduce((total, share) => total + share.shareMinor, 0);
}

describe('computeSplit', () => {
  describe('EQUAL', () => {
    it('divides evenly when the amount divides cleanly', () => {
      expect(computeSplit(900, 'EQUAL', [{ userId: alice }, { userId: bob }, { userId: carol }]))
        .toEqual([
          { userId: alice, shareMinor: 300 },
          { userId: bob, shareMinor: 300 },
          { userId: carol, shareMinor: 300 },
        ]);
    });

    it('gives the odd cent to the first participant rather than losing it', () => {
      expect(computeSplit(1000, 'EQUAL', [{ userId: alice }, { userId: bob }, { userId: carol }]))
        .toEqual([
          { userId: alice, shareMinor: 334 },
          { userId: bob, shareMinor: 333 },
          { userId: carol, shareMinor: 333 },
        ]);
    });

    it('charges a lone participant the whole amount', () => {
      expect(computeSplit(1234, 'EQUAL', [{ userId: alice }])).toEqual([
        { userId: alice, shareMinor: 1234 },
      ]);
    });

    it('ignores any values that happen to be supplied', () => {
      expect(
        computeSplit(1000, 'EQUAL', [
          { userId: alice, value: 9999 },
          { userId: bob, value: 1 },
        ]),
      ).toEqual([
        { userId: alice, shareMinor: 500 },
        { userId: bob, shareMinor: 500 },
      ]);
    });
  });

  describe('EXACT', () => {
    it('uses the supplied amounts as given', () => {
      expect(
        computeSplit(1000, 'EXACT', [
          { userId: alice, value: 500 },
          { userId: bob, value: 300 },
          { userId: carol, value: 200 },
        ]),
      ).toEqual([
        { userId: alice, shareMinor: 500 },
        { userId: bob, shareMinor: 300 },
        { userId: carol, shareMinor: 200 },
      ]);
    });

    it('allows a participant to owe nothing', () => {
      expect(
        computeSplit(1000, 'EXACT', [
          { userId: alice, value: 1000 },
          { userId: bob, value: 0 },
        ]),
      ).toEqual([
        { userId: alice, shareMinor: 1000 },
        { userId: bob, shareMinor: 0 },
      ]);
    });

    it('refuses amounts that add up to less than the expense', () => {
      expectDomainError(
        () =>
          computeSplit(1000, 'EXACT', [
            { userId: alice, value: 500 },
            { userId: bob, value: 300 },
          ]),
        'EXACT_SUM_MISMATCH',
      );
    });

    it('refuses amounts that add up to more than the expense', () => {
      expectDomainError(
        () =>
          computeSplit(1000, 'EXACT', [
            { userId: alice, value: 900 },
            { userId: bob, value: 300 },
          ]),
        'EXACT_SUM_MISMATCH',
      );
    });

    it('refuses a negative amount', () => {
      expectDomainError(
        () =>
          computeSplit(1000, 'EXACT', [
            { userId: alice, value: 1100 },
            { userId: bob, value: -100 },
          ]),
        'INVALID_AMOUNT',
      );
    });

    it('refuses a participant with no amount at all', () => {
      expectDomainError(
        () => computeSplit(1000, 'EXACT', [{ userId: alice, value: 1000 }, { userId: bob }]),
        'MISSING_PARTICIPANT_VALUE',
      );
    });
  });

  describe('PERCENTAGE', () => {
    it('splits by basis points', () => {
      expect(
        computeSplit(1000, 'PERCENTAGE', [
          { userId: alice, value: 4000 },
          { userId: bob, value: 3500 },
          { userId: carol, value: 2500 },
        ]),
      ).toEqual([
        { userId: alice, shareMinor: 400 },
        { userId: bob, shareMinor: 350 },
        { userId: carol, shareMinor: 250 },
      ]);
    });

    it('rounds so that the shares still add up to the expense', () => {
      // A third each, expressed in basis points, cannot be exact. The spare
      // cent must land on the largest remainder.
      expect(
        computeSplit(1000, 'PERCENTAGE', [
          { userId: alice, value: 3333 },
          { userId: bob, value: 3333 },
          { userId: carol, value: 3334 },
        ]),
      ).toEqual([
        { userId: alice, shareMinor: 333 },
        { userId: bob, shareMinor: 333 },
        { userId: carol, shareMinor: 334 },
      ]);
    });

    it('refuses percentages that do not add up to a whole', () => {
      expectDomainError(
        () =>
          computeSplit(1000, 'PERCENTAGE', [
            { userId: alice, value: 5000 },
            { userId: bob, value: 4000 },
          ]),
        'PERCENTAGE_SUM_MISMATCH',
      );
    });

    it('refuses a fraction of a basis point', () => {
      expectDomainError(
        () =>
          computeSplit(1000, 'PERCENTAGE', [
            { userId: alice, value: 3333.5 },
            { userId: bob, value: 6666.5 },
          ]),
        'INVALID_WEIGHT',
      );
    });

    it('refuses a negative percentage', () => {
      expectDomainError(
        () =>
          computeSplit(1000, 'PERCENTAGE', [
            { userId: alice, value: 11000 },
            { userId: bob, value: -1000 },
          ]),
        'INVALID_WEIGHT',
      );
    });

    it('refuses a participant with no percentage', () => {
      expectDomainError(
        () => computeSplit(1000, 'PERCENTAGE', [{ userId: alice, value: 10000 }, { userId: bob }]),
        'MISSING_PARTICIPANT_VALUE',
      );
    });
  });

  describe('SHARES', () => {
    it('splits in proportion to the weights', () => {
      expect(
        computeSplit(1000, 'SHARES', [
          { userId: alice, value: 2 },
          { userId: bob, value: 1 },
          { userId: carol, value: 1 },
        ]),
      ).toEqual([
        { userId: alice, shareMinor: 500 },
        { userId: bob, shareMinor: 250 },
        { userId: carol, shareMinor: 250 },
      ]);
    });

    it('rounds so that the shares still add up to the expense', () => {
      expect(
        computeSplit(100, 'SHARES', [
          { userId: alice, value: 1 },
          { userId: bob, value: 1 },
          { userId: carol, value: 1 },
        ]),
      ).toEqual([
        { userId: alice, shareMinor: 34 },
        { userId: bob, shareMinor: 33 },
        { userId: carol, shareMinor: 33 },
      ]);
    });

    it('refuses weights that are all zero', () => {
      expectDomainError(
        () =>
          computeSplit(1000, 'SHARES', [
            { userId: alice, value: 0 },
            { userId: bob, value: 0 },
          ]),
        'INVALID_WEIGHT',
      );
    });

    it('refuses a negative weight', () => {
      expectDomainError(
        () =>
          computeSplit(1000, 'SHARES', [
            { userId: alice, value: 3 },
            { userId: bob, value: -1 },
          ]),
        'INVALID_WEIGHT',
      );
    });
  });

  describe('rules that hold for every mode', () => {
    const modes: SplitMode[] = ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'];

    function participantsFor(mode: SplitMode): SplitParticipant[] {
      switch (mode) {
        case 'EXACT':
          return [
            { userId: alice, value: 600 },
            { userId: bob, value: 400 },
          ];
        case 'PERCENTAGE':
          return [
            { userId: alice, value: 6000 },
            { userId: bob, value: 4000 },
          ];
        case 'SHARES':
          return [
            { userId: alice, value: 3 },
            { userId: bob, value: 2 },
          ];
        default:
          return [{ userId: alice }, { userId: bob }];
      }
    }

    it.each(modes)('%s returns one share per participant, in order', (mode) => {
      const shares = computeSplit(1000, mode, participantsFor(mode));
      expect(shares.map((share) => share.userId)).toEqual([alice, bob]);
    });

    it.each(modes)('%s conserves the full amount', (mode) => {
      expect(sumShares(computeSplit(1000, mode, participantsFor(mode)))).toBe(1000);
    });

    it.each(modes)('%s rejects an empty participant list', (mode) => {
      expectDomainError(() => computeSplit(1000, mode, []), 'NO_PARTICIPANTS');
    });

    it.each(modes)('%s rejects the same person listed twice', (mode) => {
      const duplicated = participantsFor(mode).map((participant) => ({
        ...participant,
        userId: alice,
      }));
      expectDomainError(() => computeSplit(1000, mode, duplicated), 'DUPLICATE_PARTICIPANT');
    });

    it.each(modes)('%s rejects a fractional expense amount', (mode) => {
      expectDomainError(() => computeSplit(10.5, mode, participantsFor(mode)), 'INVALID_AMOUNT');
    });

    it.each(modes)('%s rejects a negative expense amount', (mode) => {
      expectDomainError(() => computeSplit(-100, mode, participantsFor(mode)), 'INVALID_AMOUNT');
    });

    it.each(modes)('%s rejects an expense of nothing', (mode) => {
      expectDomainError(() => computeSplit(0, mode, participantsFor(mode)), 'INVALID_AMOUNT');
    });

    it('rejects a mode it does not recognise', () => {
      expectDomainError(
        () => computeSplit(1000, 'HALVES' as SplitMode, [{ userId: alice }]),
        'UNKNOWN_SPLIT_MODE',
      );
    });
  });

  describe('conservation across many generated splits', () => {
    it('always produces shares summing to the expense', () => {
      const next = seededRandom(424242);

      for (let round = 0; round < 1000; round += 1) {
        const amount = randomInt(next, 1, 2_000_00);
        const count = randomInt(next, 1, 6);
        const ids = Array.from({ length: count }, (_unused, index) => `user-${index}`);

        const equal = computeSplit(
          amount,
          'EQUAL',
          ids.map((userId) => ({ userId })),
        );
        expect(sumShares(equal)).toBe(amount);

        const weights = ids.map(() => randomInt(next, 1, 9));
        const shares = computeSplit(
          amount,
          'SHARES',
          ids.map((userId, index) => ({ userId, value: weights[index] })),
        );
        expect(sumShares(shares)).toBe(amount);
        expect(shares.every((share) => share.shareMinor >= 0)).toBe(true);
      }
    });
  });
});
