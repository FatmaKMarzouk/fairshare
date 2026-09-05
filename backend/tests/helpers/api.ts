import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '../../src/app';

export interface TestUser {
  token: string;
  id: string;
  name: string;
  email: string;
}

let sequence = 0;

export function buildApp(): Express {
  return createApp();
}

/** Registers a fresh user and returns their token and identity. */
export async function registerUser(
  app: Express,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
): Promise<TestUser> {
  sequence += 1;

  const payload = {
    name: overrides.name ?? `Test User ${sequence}`,
    email: overrides.email ?? `user${sequence}@example.test`,
    password: overrides.password ?? 'correct horse battery',
  };

  const response = await request(app).post('/api/auth/register').send(payload);

  if (response.status !== 201) {
    throw new Error(
      `registerUser expected 201 but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  return {
    token: response.body.token,
    id: response.body.user.id,
    name: payload.name,
    email: payload.email,
  };
}

export function authHeader(user: TestUser): Record<string, string> {
  return { Authorization: `Bearer ${user.token}` };
}

/** Creates a group owned by `owner`, optionally adding further members. */
export async function createGroup(
  app: Express,
  owner: TestUser,
  options: { name?: string; currency?: string; members?: TestUser[] } = {},
): Promise<string> {
  const response = await request(app)
    .post('/api/groups')
    .set(authHeader(owner))
    .send({ name: options.name ?? 'Flat share', currency: options.currency ?? 'CHF' });

  if (response.status !== 201) {
    throw new Error(
      `createGroup expected 201 but got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  const groupId: string = response.body.id;

  for (const member of options.members ?? []) {
    const added = await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(owner))
      .send({ email: member.email });

    if (added.status !== 200) {
      throw new Error(
        `adding a member expected 200 but got ${added.status}: ${JSON.stringify(added.body)}`,
      );
    }
  }

  return groupId;
}
