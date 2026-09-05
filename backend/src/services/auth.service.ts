import bcrypt from 'bcryptjs';

import { Config } from '../config';
import { signToken } from '../http/auth';
import { ApiError, conflict, unauthenticated } from '../http/errors';
import { PublicUser, toPublicUser, UserModel } from '../models/User';

export interface Credentials {
  email: string;
  password: string;
}

export interface Registration extends Credentials {
  name: string;
}

export interface AuthResult {
  token: string;
  user: PublicUser;
}

/**
 * A hash of a value nobody will ever supply.
 *
 * Compared against when an account does not exist, so that a login attempt on
 * an unknown address costs the same time as one on a real address. Without it,
 * response timing alone reveals which addresses are registered.
 */
const DECOY_HASH = bcrypt.hashSync('a password that is not anybody\'s', 4);

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function register(config: Config, input: Registration): Promise<AuthResult> {
  const email = normaliseEmail(input.email);

  const existing = await UserModel.findOne({ email }).lean();
  if (existing) {
    throw conflict('EMAIL_TAKEN', 'That email address is already registered');
  }

  const passwordHash = await bcrypt.hash(input.password, config.bcryptRounds);

  try {
    const user = await UserModel.create({ name: input.name.trim(), email, passwordHash });
    return { token: signToken(config, user._id.toString()), user: toPublicUser(user) };
  } catch (error) {
    // Two simultaneous registrations of the same address get past the check
    // above; the unique index is what actually guarantees it.
    if (isDuplicateKey(error)) {
      throw conflict('EMAIL_TAKEN', 'That email address is already registered');
    }
    throw error;
  }
}

export async function login(config: Config, input: Credentials): Promise<AuthResult> {
  const email = normaliseEmail(input.email);
  const user = await UserModel.findOne({ email });

  const matches = await bcrypt.compare(input.password, user ? user.passwordHash : DECOY_HASH);

  if (!user || !matches) {
    // One code for both cases. A distinct "no such account" would make the API
    // a way of checking which addresses are registered.
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Those credentials are not valid');
  }

  return { token: signToken(config, user._id.toString()), user: toPublicUser(user) };
}

export async function currentUser(userId: string): Promise<PublicUser> {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw unauthenticated('That account no longer exists');
  }

  return toPublicUser(user);
}

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: number }).code === 11000
  );
}
