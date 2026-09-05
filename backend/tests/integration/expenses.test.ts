import type { Express } from 'express';
import request from 'supertest';

import { authHeader, buildApp, createGroup, registerUser, TestUser } from '../helpers/api';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/db';

let app: Express;
let owner: TestUser;
let friend: TestUser;
let groupId: string;

beforeAll(async () => {
  await connectTestDb();
  app = buildApp();
});

beforeEach(async () => {
  owner = await registerUser(app);
  friend = await registerUser(app);
  groupId = await createGroup(app, owner, { members: [friend] });
});

afterEach(clearTestDb);
afterAll(disconnectTestDb);

function equalExpense(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    description: 'Groceries',
    amountMinor: 3000,
    paidBy: owner.id,
    splitMode: 'EQUAL',
    participants: [{ userId: owner.id }, { userId: friend.id }],
    ...overrides,
  };
}

describe('POST /api/groups/:id/expenses', () => {
  it('records an expense and returns the computed shares', async () => {
    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(equalExpense());

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      description: 'Groceries',
      amountMinor: 3000,
      paidBy: owner.id,
      splitMode: 'EQUAL',
    });
    expect(response.body.shares).toEqual([
      { userId: owner.id, shareMinor: 1500 },
      { userId: friend.id, shareMinor: 1500 },
    ]);
  });

  it('gives the odd cent to the first participant rather than losing it', async () => {
    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(equalExpense({ amountMinor: 1001 }));

    expect(response.status).toBe(201);
    expect(response.body.shares.map((s: { shareMinor: number }) => s.shareMinor)).toEqual([
      501, 500,
    ]);
  });

  it('accepts an exact split', async () => {
    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(
        equalExpense({
          splitMode: 'EXACT',
          amountMinor: 1000,
          participants: [
            { userId: owner.id, value: 700 },
            { userId: friend.id, value: 300 },
          ],
        }),
      );

    expect(response.status).toBe(201);
    expect(response.body.shares).toEqual([
      { userId: owner.id, shareMinor: 700 },
      { userId: friend.id, shareMinor: 300 },
    ]);
  });

  it('accepts a percentage split expressed in basis points', async () => {
    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(
        equalExpense({
          splitMode: 'PERCENTAGE',
          amountMinor: 1000,
          participants: [
            { userId: owner.id, value: 7500 },
            { userId: friend.id, value: 2500 },
          ],
        }),
      );

    expect(response.status).toBe(201);
    expect(response.body.shares).toEqual([
      { userId: owner.id, shareMinor: 750 },
      { userId: friend.id, shareMinor: 250 },
    ]);
  });

  it('surfaces a domain rejection as a 422 carrying the domain code', async () => {
    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(
        equalExpense({
          splitMode: 'EXACT',
          amountMinor: 1000,
          participants: [
            { userId: owner.id, value: 700 },
            { userId: friend.id, value: 100 },
          ],
        }),
      );

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('EXACT_SUM_MISMATCH');
  });

  it.each([
    ['a fractional amount', { amountMinor: 10.5 }],
    ['a negative amount', { amountMinor: -100 }],
    ['an amount of nothing', { amountMinor: 0 }],
    ['a blank description', { description: '   ' }],
    ['no participants', { participants: [] }],
    ['a split mode that does not exist', { splitMode: 'HALVES' }],
  ])('rejects %s', async (_label, overrides) => {
    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(equalExpense(overrides));

    expect(response.status).toBe(422);
  });

  it('refuses a payer who is not in the group', async () => {
    const stranger = await registerUser(app);

    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(equalExpense({ paidBy: stranger.id }));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_MEMBER');
  });

  it('refuses a participant who is not in the group', async () => {
    const stranger = await registerUser(app);

    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(
        equalExpense({
          participants: [{ userId: owner.id }, { userId: stranger.id }],
        }),
      );

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('UNKNOWN_MEMBER');
  });

  it('does not let a non-member post an expense to the group', async () => {
    const stranger = await registerUser(app);

    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(stranger))
      .send(equalExpense());

    expect(response.status).toBe(404);
  });

  it('requires authentication', async () => {
    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .send(equalExpense());

    expect(response.status).toBe(401);
  });
});

describe('GET /api/groups/:id/expenses', () => {
  it('returns an empty list for a new group', async () => {
    const response = await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner));

    expect(response.status).toBe(200);
    expect(response.body.expenses).toEqual([]);
  });

  it('returns the most recently recorded expense first', async () => {
    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(equalExpense({ description: 'First' }));

    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(equalExpense({ description: 'Second' }));

    const response = await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner));

    expect(response.status).toBe(200);
    expect(response.body.expenses.map((e: { description: string }) => e.description)).toEqual([
      'Second',
      'First',
    ]);
  });

  it('is visible to every member of the group', async () => {
    await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(equalExpense());

    const response = await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set(authHeader(friend));

    expect(response.status).toBe(200);
    expect(response.body.expenses).toHaveLength(1);
  });

  it('is hidden from everyone else', async () => {
    const stranger = await registerUser(app);

    const response = await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set(authHeader(stranger));

    expect(response.status).toBe(404);
  });
});

describe('DELETE /api/expenses/:id', () => {
  async function recordExpense(): Promise<string> {
    const response = await request(app)
      .post(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner))
      .send(equalExpense());

    return response.body.id;
  }

  it('removes the expense', async () => {
    const expenseId = await recordExpense();

    const deleted = await request(app)
      .delete(`/api/expenses/${expenseId}`)
      .set(authHeader(owner));

    expect(deleted.status).toBe(204);

    const remaining = await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set(authHeader(owner));

    expect(remaining.body.expenses).toEqual([]);
  });

  it('lets any member of the group remove it', async () => {
    const expenseId = await recordExpense();

    const deleted = await request(app)
      .delete(`/api/expenses/${expenseId}`)
      .set(authHeader(friend));

    expect(deleted.status).toBe(204);
  });

  it('does not let an outsider remove it', async () => {
    const stranger = await registerUser(app);
    const expenseId = await recordExpense();

    const deleted = await request(app)
      .delete(`/api/expenses/${expenseId}`)
      .set(authHeader(stranger));

    expect(deleted.status).toBe(404);
  });

  it('reports a missing expense as not found', async () => {
    const response = await request(app)
      .delete('/api/expenses/64b7f1d2e4a3c21a8f0b1234')
      .set(authHeader(owner));

    expect(response.status).toBe(404);
  });
});
