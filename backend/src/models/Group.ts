import { HydratedDocument, model, Schema, Types } from 'mongoose';

import { PublicUser, toPublicUser, UserDocument } from './User';

export interface GroupDocument {
  _id: Types.ObjectId;
  name: string;
  currency: string;
  members: Types.ObjectId[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const groupSchema = new Schema<GroupDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    members: [{ type: Schema.Types.ObjectId, ref: 'User', required: true }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Every read is "the groups this person belongs to", so that is what is indexed.
groupSchema.index({ members: 1, createdAt: -1 });

export type Group = HydratedDocument<GroupDocument>;

export const GroupModel = model<GroupDocument>('Group', groupSchema);

export interface PublicGroup {
  id: string;
  name: string;
  currency: string;
  members: PublicUser[];
  createdAt: string;
}

export function toPublicGroup(group: GroupDocument, members: UserDocument[]): PublicGroup {
  return {
    id: group._id.toString(),
    name: group.name,
    currency: group.currency,
    members: members.map(toPublicUser),
    createdAt: group.createdAt.toISOString(),
  };
}
