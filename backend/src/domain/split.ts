import { allocate, assertMinorAmount } from './money';
import {
  BASIS_POINTS_TOTAL,
  DomainError,
  SplitMode,
  SplitParticipant,
  SplitShare,
} from './types';

function pair(
  participants: readonly SplitParticipant[],
  amounts: readonly number[],
): SplitShare[] {
  return participants.map((participant, index) => ({
    userId: participant.userId,
    shareMinor: amounts[index],
  }));
}

/**
 * Pulls the `value` off every participant, insisting each one has it.
 *
 * A participant with no value in a mode that needs one is a client bug, and
 * quietly defaulting it to zero would produce a split that looks plausible and
 * charges the wrong people.
 */
function requiredValues(participants: readonly SplitParticipant[], mode: SplitMode): number[] {
  return participants.map((participant) => {
    if (participant.value === undefined || participant.value === null) {
      throw new DomainError(
        'MISSING_PARTICIPANT_VALUE',
        `a ${mode} split needs a value for every participant, and ${participant.userId} has none`,
      );
    }
    return participant.value;
  });
}

/**
 * Works out what each participant owes for a single expense.
 *
 * The result always sums to exactly `amountMinor`, whatever the mode, and comes
 * back in the same order the participants were given.
 */
export function computeSplit(
  amountMinor: number,
  mode: SplitMode,
  participants: readonly SplitParticipant[],
): SplitShare[] {
  assertMinorAmount(amountMinor, 'amountMinor');

  if (amountMinor <= 0) {
    throw new DomainError(
      'INVALID_AMOUNT',
      `an expense must be for a positive amount, received ${amountMinor}`,
    );
  }

  if (participants.length === 0) {
    throw new DomainError('NO_PARTICIPANTS', 'an expense needs at least one participant');
  }

  const seen = new Set<string>();
  for (const participant of participants) {
    if (seen.has(participant.userId)) {
      throw new DomainError(
        'DUPLICATE_PARTICIPANT',
        `${participant.userId} appears more than once in the same expense`,
      );
    }
    seen.add(participant.userId);
  }

  switch (mode) {
    case 'EQUAL':
      return pair(
        participants,
        allocate(
          amountMinor,
          participants.map(() => 1),
        ),
      );

    case 'EXACT': {
      const values = requiredValues(participants, mode);

      values.forEach((value, index) => {
        assertMinorAmount(value, `the amount for ${participants[index].userId}`);
        if (value < 0) {
          throw new DomainError(
            'INVALID_AMOUNT',
            `${participants[index].userId} cannot owe a negative amount`,
          );
        }
      });

      const total = values.reduce((running, value) => running + value, 0);
      if (total !== amountMinor) {
        throw new DomainError(
          'EXACT_SUM_MISMATCH',
          `the exact amounts add up to ${total}, but the expense is ${amountMinor}`,
        );
      }

      return pair(participants, values);
    }

    case 'PERCENTAGE': {
      const values = requiredValues(participants, mode);

      values.forEach((value, index) => {
        if (!Number.isSafeInteger(value) || value < 0) {
          throw new DomainError(
            'INVALID_WEIGHT',
            `the share for ${participants[index].userId} must be a whole number of basis points`,
          );
        }
      });

      const total = values.reduce((running, value) => running + value, 0);
      if (total !== BASIS_POINTS_TOTAL) {
        throw new DomainError(
          'PERCENTAGE_SUM_MISMATCH',
          `the percentages add up to ${total} basis points, and must add up to ${BASIS_POINTS_TOTAL}`,
        );
      }

      return pair(participants, allocate(amountMinor, values));
    }

    case 'SHARES':
      // allocate already insists the weights are whole, non-negative and not
      // all zero, which is exactly the rule for shares.
      return pair(participants, allocate(amountMinor, requiredValues(participants, mode)));

    default:
      throw new DomainError('UNKNOWN_SPLIT_MODE', `${mode} is not a split mode`);
  }
}
