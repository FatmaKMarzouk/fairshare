import { HydratedDocument, model, Schema, Types } from 'mongoose';

export interface UserDocument {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    // Stored already lowercased, so a lookup is a plain equality match and
    // "Ada@..." and "ada@..." can never become two accounts.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: true },
);

export type User = HydratedDocument<UserDocument>;

export const UserModel = model<UserDocument>('User', userSchema);

export interface PublicUser {
  id: string;
  name: string;
  email: string;
}

/** The only shape a user is ever allowed to leave the process in. */
export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
  };
}
