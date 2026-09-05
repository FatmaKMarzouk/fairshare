/**
 * Domain vocabulary.
 *
 * Every monetary value in this module is an integer number of minor units
 * (cents). There are no floating point amounts anywhere below this line, and
 * nothing here performs I/O.
 */

export type UserId = string;

export const SPLIT_MODES = ['EQUAL', 'EXACT', 'PERCENTAGE', 'SHARES'] as const;

export type SplitMode = (typeof SPLIT_MODES)[number];

/**
 * One person taking part in an expense.
 *
 * The meaning of `value` depends on the split mode:
 *
 * | mode         | `value` means                        |
 * |--------------|--------------------------------------|
 * | `EQUAL`      | ignored                              |
 * | `EXACT`      | the exact number of cents they owe   |
 * | `PERCENTAGE` | basis points, so 2500 is 25 percent  |
 * | `SHARES`     | a relative weight, any positive int  |
 */
export interface SplitParticipant {
  userId: UserId;
  value?: number;
}

/** What one participant ends up owing for one expense. */
export interface SplitShare {
  userId: UserId;
  shareMinor: number;
}

/**
 * A member's net position.
 *
 * Positive means the group owes them; negative means they owe the group.
 */
export interface Balance {
  userId: UserId;
  netMinor: number;
}

/** A single payment that moves the group closer to settled. */
export interface Transfer {
  fromUserId: UserId;
  toUserId: UserId;
  amountMinor: number;
}

/** One recorded expense, reduced to only what the ledger needs. */
export interface LedgerEntry {
  paidBy: UserId;
  amountMinor: number;
  shares: SplitShare[];
}

/** Basis points in a whole. 10000 basis points is 100 percent. */
export const BASIS_POINTS_TOTAL = 10000;

export type DomainErrorCode =
  | 'INVALID_AMOUNT'
  | 'NO_PARTICIPANTS'
  | 'DUPLICATE_PARTICIPANT'
  | 'MISSING_PARTICIPANT_VALUE'
  | 'EXACT_SUM_MISMATCH'
  | 'PERCENTAGE_SUM_MISMATCH'
  | 'INVALID_WEIGHT'
  | 'UNKNOWN_SPLIT_MODE'
  | 'UNKNOWN_MEMBER'
  | 'UNBALANCED_LEDGER';

/**
 * Raised when the domain is handed input it cannot make sense of.
 *
 * Carries a stable machine-readable code so the HTTP layer can translate it
 * without string matching on the message.
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    Object.setPrototypeOf(this, DomainError.prototype);
  }
}
