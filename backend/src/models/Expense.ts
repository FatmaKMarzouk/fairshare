import { HydratedDocument, model, Schema, Types } from 'mongoose';

import { SPLIT_MODES, SplitMode } from '../domain/types';

export interface ExpenseParticipant {
  userId: Types.ObjectId;
  value?: number;
}

export interface ExpenseShare {
  userId: Types.ObjectId;
  shareMinor: number;
}

export interface ExpenseDocument {
  _id: Types.ObjectId;
  group: Types.ObjectId;
  description: string;
  /** Always an integer count of minor units. Never a float, never a string. */
  amountMinor: number;
  paidBy: Types.ObjectId;
  splitMode: SplitMode;
  participants: ExpenseParticipant[];
  /**
   * The split as it was calculated when the expense was recorded.
   *
   * Stored rather than recomputed on read, so that changing the rounding rules
   * later cannot silently rewrite what people already agreed they owed.
   */
  shares: ExpenseShare[];
  occurredAt: Date;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const expenseSchema = new Schema<ExpenseDocument>(
  {
    group: { type: Schema.Types.ObjectId, ref: 'Group', required: true },
    description: { type: String, required: true, trim: true, maxlength: 200 },
    amountMinor: { type: Number, required: true, min: 1 },
    paidBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    splitMode: { type: String, required: true, enum: SPLIT_MODES },
    participants: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        value: { type: Number, required: false },
      },
    ],
    shares: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        shareMinor: { type: Number, required: true },
      },
    ],
    occurredAt: { type: Date, required: true, default: (): Date => new Date() },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Listing a group's expenses newest first is the only read pattern there is.
expenseSchema.index({ group: 1, createdAt: -1, _id: -1 });

export type Expense = HydratedDocument<ExpenseDocument>;

export const ExpenseModel = model<ExpenseDocument>('Expense', expenseSchema);

export interface PublicExpense {
  id: string;
  description: string;
  amountMinor: number;
  paidBy: string;
  splitMode: SplitMode;
  participants: { userId: string; value?: number }[];
  shares: { userId: string; shareMinor: number }[];
  occurredAt: string;
  createdAt: string;
}

export function toPublicExpense(expense: ExpenseDocument): PublicExpense {
  return {
    id: expense._id.toString(),
    description: expense.description,
    amountMinor: expense.amountMinor,
    paidBy: expense.paidBy.toString(),
    splitMode: expense.splitMode,
    participants: expense.participants.map((participant) =>
      participant.value === undefined || participant.value === null
        ? { userId: participant.userId.toString() }
        : { userId: participant.userId.toString(), value: participant.value },
    ),
    shares: expense.shares.map((share) => ({
      userId: share.userId.toString(),
      shareMinor: share.shareMinor,
    })),
    occurredAt: expense.occurredAt.toISOString(),
    createdAt: expense.createdAt.toISOString(),
  };
}
