import { Types } from 'mongoose';

import { computeBalances, simplifyDebts } from '../domain/settlement';
import { computeSplit } from '../domain/split';
import { DomainError, SplitMode } from '../domain/types';
import { notFound } from '../http/errors';
import { ExpenseModel, PublicExpense, toPublicExpense } from '../models/Expense';
import { Group, GroupModel } from '../models/Group';
import { UserModel } from '../models/User';
import { loadGroupForMember } from './group.service';

export interface ExpenseInput {
  description: string;
  amountMinor: number;
  paidBy: string;
  splitMode: SplitMode;
  participants: { userId: string; value?: number }[];
  occurredAt?: string;
}

export interface PublicBalance {
  userId: string;
  name: string;
  netMinor: number;
}

export interface PublicTransfer {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amountMinor: number;
}

function assertMember(group: Group, userId: string, role: string): void {
  const isMember = group.members.some((member) => member.toString() === userId);

  if (!isMember) {
    throw new DomainError('UNKNOWN_MEMBER', `The ${role} is not a member of this group`);
  }
}

export async function recordExpense(
  groupId: string,
  callerId: string,
  input: ExpenseInput,
): Promise<PublicExpense> {
  const group = await loadGroupForMember(groupId, callerId);

  assertMember(group, input.paidBy, 'payer');
  for (const participant of input.participants) {
    assertMember(group, participant.userId, `participant ${participant.userId}`);
  }

  // The domain decides the split, and rejects anything it cannot divide
  // exactly. Its error travels out as a 422 carrying its own code.
  const shares = computeSplit(input.amountMinor, input.splitMode, input.participants);

  const expense = await ExpenseModel.create({
    group: group._id,
    description: input.description.trim(),
    amountMinor: input.amountMinor,
    paidBy: new Types.ObjectId(input.paidBy),
    splitMode: input.splitMode,
    participants: input.participants.map((participant) => ({
      userId: new Types.ObjectId(participant.userId),
      value: participant.value,
    })),
    shares: shares.map((share) => ({
      userId: new Types.ObjectId(share.userId),
      shareMinor: share.shareMinor,
    })),
    occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
    createdBy: new Types.ObjectId(callerId),
  });

  return toPublicExpense(expense);
}

export async function listExpenses(groupId: string, callerId: string): Promise<PublicExpense[]> {
  const group = await loadGroupForMember(groupId, callerId);

  const expenses = await ExpenseModel.find({ group: group._id }).sort({
    createdAt: -1,
    _id: -1,
  });

  return expenses.map(toPublicExpense);
}

export async function deleteExpense(expenseId: string, callerId: string): Promise<void> {
  const expense = await ExpenseModel.findById(expenseId);

  if (!expense) {
    throw notFound('No such expense');
  }

  // Membership of the owning group is what grants the right to remove it, so
  // an outsider gets the same answer as for an expense that does not exist.
  const group = await GroupModel.findOne({
    _id: expense.group,
    members: new Types.ObjectId(callerId),
  });

  if (!group) {
    throw notFound('No such expense');
  }

  await expense.deleteOne();
}

/** Members, their names, and the ledger, which every read below needs. */
async function loadLedger(
  groupId: string,
  callerId: string,
): Promise<{ memberIds: string[]; nameOf: Map<string, string>; balances: PublicBalance[] }> {
  const group = await loadGroupForMember(groupId, callerId);

  const members = await UserModel.find({ _id: { $in: group.members } }).lean();
  const nameOf = new Map(members.map((member) => [member._id.toString(), member.name]));

  const memberIds = group.members.map((member) => member.toString());

  const expenses = await ExpenseModel.find({ group: group._id }).lean();
  const entries = expenses.map((expense) => ({
    paidBy: expense.paidBy.toString(),
    amountMinor: expense.amountMinor,
    shares: expense.shares.map((share) => ({
      userId: share.userId.toString(),
      shareMinor: share.shareMinor,
    })),
  }));

  const balances = computeBalances(memberIds, entries).map((balance) => ({
    userId: balance.userId,
    name: nameOf.get(balance.userId) ?? 'Unknown',
    netMinor: balance.netMinor,
  }));

  return { memberIds, nameOf, balances };
}

export async function getBalances(groupId: string, callerId: string): Promise<PublicBalance[]> {
  const { balances } = await loadLedger(groupId, callerId);
  return balances;
}

export async function getSettlement(
  groupId: string,
  callerId: string,
): Promise<PublicTransfer[]> {
  const { nameOf, balances } = await loadLedger(groupId, callerId);

  return simplifyDebts(
    balances.map((balance) => ({ userId: balance.userId, netMinor: balance.netMinor })),
  ).map((transfer) => ({
    fromUserId: transfer.fromUserId,
    fromName: nameOf.get(transfer.fromUserId) ?? 'Unknown',
    toUserId: transfer.toUserId,
    toName: nameOf.get(transfer.toUserId) ?? 'Unknown',
    amountMinor: transfer.amountMinor,
  }));
}
