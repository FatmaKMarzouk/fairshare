import { allocate, assertMinorAmount, isMinorAmount, sumMinor } from '../../src/domain/money';
import { DomainError } from '../../src/domain/types';
import { expectDomainError } from '../helpers/expect';
import { randomInt, seededRandom } from '../helpers/random';

describe('isMinorAmount', () => {
  it.each([0, 1, -1, 1234, Number.MAX_SAFE_INTEGER])('accepts the integer %p', (value) => {
    expect(isMinorAmount(value)).toBe(true);
  });

  it.each([
    ['a fractional value', 1.5],
    ['a value that only looks whole', 0.1 + 0.2],
    ['not a number', ' 12'],
    ['null', null],
    ['undefined', undefined],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['beyond safe integers', Number.MAX_SAFE_INTEGER + 2],
  ])('rejects %s', (_label, value) => {
    expect(isMinorAmount(value)).toBe(false);
  });
});

describe('assertMinorAmount', () => {
  it('passes a valid cent count through silently', () => {
    expect(() => assertMinorAmount(500, 'amount')).not.toThrow();
  });

  it('throws INVALID_AMOUNT naming the offending field', () => {
    expect(() => assertMinorAmount(5.5, 'amountMinor')).toThrow(DomainError);

    try {
      assertMinorAmount(5.5, 'amountMinor');
      throw new Error('expected assertMinorAmount to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect((error as DomainError).code).toBe('INVALID_AMOUNT');
      // The message has to say which field was wrong, or a validation failure
      // three layers down is untraceable from an API response.
      expect((error as DomainError).message).toContain('amountMinor');
    }
  });
});

describe('sumMinor', () => {
  it('is zero for an empty list', () => {
    expect(sumMinor([])).toBe(0);
  });

  it('adds positive and negative amounts', () => {
    expect(sumMinor([100, -30, 5])).toBe(75);
  });

  it('rejects a list containing a non-integer', () => {
    expect(() => sumMinor([100, 1.5])).toThrow(DomainError);
  });
});

describe('allocate', () => {
  describe('the sum is always preserved exactly', () => {
    it('splits a clean amount evenly', () => {
      expect(allocate(1000, [1, 1, 1, 1])).toEqual([250, 250, 250, 250]);
    });

    it('hands the leftover cent to the earliest position when weights tie', () => {
      // 1000 / 3 is 333.33 each. Three lots of 333 leaves one cent over.
      expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    });

    it('hands out two leftover cents to the first two positions', () => {
      // 1001 / 3 is 333.67 each. Three lots of 333 leaves two cents over.
      expect(allocate(1001, [1, 1, 1])).toEqual([334, 334, 333]);
    });

    it('gives the leftover to the largest remainder, not the largest weight', () => {
      // Exact shares are 33.33, 33.33 and 33.34, so the third position has the
      // largest remainder and takes the spare cent.
      expect(allocate(100, [3333, 3333, 3334])).toEqual([33, 33, 34]);
    });

    it('respects unequal weights', () => {
      expect(allocate(1000, [2, 1, 1])).toEqual([500, 250, 250]);
    });

    it('allocates nothing to a zero weight', () => {
      expect(allocate(900, [1, 0, 2])).toEqual([300, 0, 600]);
    });

    it('allocates a total of zero as all zeroes', () => {
      expect(allocate(0, [1, 2, 3])).toEqual([0, 0, 0]);
    });

    it('handles a single recipient', () => {
      expect(allocate(777, [1])).toEqual([777]);
    });
  });

  describe('rejects input it cannot allocate', () => {
    it('rejects an empty weight list', () => {
      expectDomainError(() => allocate(100, []), 'INVALID_WEIGHT');
    });

    it('rejects weights that are all zero', () => {
      expectDomainError(() => allocate(100, [0, 0]), 'INVALID_WEIGHT');
    });

    it('rejects a negative weight', () => {
      expectDomainError(() => allocate(100, [3, -1]), 'INVALID_WEIGHT');
    });

    it('rejects a fractional weight', () => {
      expectDomainError(() => allocate(100, [1.5, 1]), 'INVALID_WEIGHT');
    });

    it('rejects a negative total', () => {
      expectDomainError(() => allocate(-100, [1, 1]), 'INVALID_AMOUNT');
    });

    it('rejects a fractional total', () => {
      expectDomainError(() => allocate(10.5, [1, 1]), 'INVALID_AMOUNT');
    });
  });

  describe('invariants across many generated inputs', () => {
    it('never creates or destroys a cent', () => {
      const next = seededRandom(20260905);

      for (let round = 0; round < 2000; round += 1) {
        const total = randomInt(next, 0, 5_000_00);
        const count = randomInt(next, 1, 8);
        const weights: number[] = Array.from({ length: count }, () => randomInt(next, 0, 20));
        if (weights.reduce((a, b) => a + b, 0) === 0) {
          weights[0] = 1;
        }

        const parts = allocate(total, weights);

        expect(parts).toHaveLength(count);
        expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
        expect(parts.every((part) => Number.isSafeInteger(part) && part >= 0)).toBe(true);
      }
    });

    it('keeps every part within one cent of its exact share', () => {
      const next = seededRandom(7);

      for (let round = 0; round < 500; round += 1) {
        const total = randomInt(next, 0, 100_000);
        const weights = Array.from({ length: randomInt(next, 1, 6) }, () =>
          randomInt(next, 1, 10),
        );
        const weightTotal = weights.reduce((a, b) => a + b, 0);

        const parts = allocate(total, weights);

        parts.forEach((part, index) => {
          const exact = (total * weights[index]) / weightTotal;
          expect(Math.abs(part - exact)).toBeLessThan(1);
        });
      }
    });

    it('is deterministic', () => {
      expect(allocate(1000, [1, 1, 1])).toEqual(allocate(1000, [1, 1, 1]));
    });
  });
});
