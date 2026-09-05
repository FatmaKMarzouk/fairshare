import { Types } from 'mongoose';

import { ApiError, conflict, notFound } from '../http/errors';
import { Group, GroupModel, PublicGroup, toPublicGroup } from '../models/Group';
import { UserDocument, UserModel } from '../models/User';

/**
 * Loads a group, but only for someone who belongs to it.
 *
 * A group the caller is not a member of is reported as missing rather than
 * forbidden. Answering 403 would confirm the group exists to somebody with no
 * business knowing that, and turn the endpoint into a way of probing for them.
 */
export async function loadGroupForMember(groupId: string, userId: string): Promise<Group> {
  const group = await GroupModel.findOne({
    _id: new Types.ObjectId(groupId),
    members: new Types.ObjectId(userId),
  });

  if (!group) {
    throw notFound('No such group');
  }

  return group;
}

async function membersOf(group: Group): Promise<UserDocument[]> {
  const users = await UserModel.find({ _id: { $in: group.members } }).lean<UserDocument[]>();
  const byId = new Map(users.map((user) => [user._id.toString(), user]));

  // Preserve the group's own member order rather than the database's.
  return group.members
    .map((memberId) => byId.get(memberId.toString()))
    .filter((user): user is UserDocument => Boolean(user));
}

export async function createGroup(
  userId: string,
  input: { name: string; currency: string },
): Promise<PublicGroup> {
  const owner = new Types.ObjectId(userId);

  const group = await GroupModel.create({
    name: input.name.trim(),
    currency: input.currency,
    members: [owner],
    createdBy: owner,
  });

  return toPublicGroup(group, await membersOf(group));
}

export async function listGroups(userId: string): Promise<PublicGroup[]> {
  const groups = await GroupModel.find({ members: new Types.ObjectId(userId) }).sort({
    createdAt: -1,
    _id: -1,
  });

  return Promise.all(groups.map(async (group) => toPublicGroup(group, await membersOf(group))));
}

export async function getGroup(groupId: string, userId: string): Promise<PublicGroup> {
  const group = await loadGroupForMember(groupId, userId);
  return toPublicGroup(group, await membersOf(group));
}

export async function addMember(
  groupId: string,
  userId: string,
  email: string,
): Promise<PublicGroup> {
  const group = await loadGroupForMember(groupId, userId);

  const invitee = await UserModel.findOne({ email: email.trim().toLowerCase() });
  if (!invitee) {
    // Distinct from NOT_FOUND: the group was found, the person was not, and the
    // client needs to tell those apart to say anything useful.
    throw new ApiError(404, 'USER_NOT_FOUND', 'Nobody is registered with that email address');
  }

  if (group.members.some((member) => member.equals(invitee._id))) {
    throw conflict('ALREADY_MEMBER', 'They are already in this group');
  }

  group.members.push(invitee._id);
  await group.save();

  return toPublicGroup(group, await membersOf(group));
}
