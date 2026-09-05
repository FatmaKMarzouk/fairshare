import type { Express } from 'express';
import request from 'supertest';

import { authHeader, buildApp, createGroup, registerUser, TestUser } from '../helpers/api';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/db';

let app: Express;
let alice: TestUser;
let bob: TestUser;
let carol: TestUser;
let groupId: string;

beforeAll(async () => {
  await connectTestDb();
  app = buildApp();
});

beforeEach(async () => {
  alice = await registerUser(app, { name: 'Alice' });
  bob = await registerUser(app, { name: 'Bob' });
  carol = await registerUser(app, { name: 'Carol' });
  groupId = await createGroup(app, alice, { members: [bob, carol] });
});

afterEach(clearTestDb);
afterAll(disconnectTestDb);

async function addExpense(
  payer: TestUser,
  amountMinor: number,
  participants: TestUser[],
): Promise<void> {
  const response = await request(app)
    .post(`/api/groups/${groupId}/expenses`)
    .set(authHeader(alice))
    .send({
      description: 'Shared cost',
      amountMinor,
      paidBy: payer.id,
      splitMode: 'EQUAL',
      participants: participants.map((participant) => ({ userId: participant.id })),
    });

  if (response.status !== 201) {
    throw new Error(`expected 201 but got ${response.status}: ${JSON.stringify(response.body)}`);
  }
}

function netFor(balances: { userId: string; netMinor: number }[], user: TestUser): number {
  const found = balances.find((balance) => balance.userId === user.id);
  if (!found) {
    throw new Error(`no balance returned for ${user.name}`);
  }
  return found.netMinor;
}

describe('GET /api/groups/:id/balances', () => {
  it('reports everyone at zero before anything is spent', async () => {
    const response = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(alice));

    expect(response.status).toBe(200);
    expect(response.body.balances).toHaveLength(3);
    expect(response.body.balances.every((b: { netMinor: number }) => b.netMinor === 0)).toBe(true);
  });

  it('credits the payer and debits the participants', async () => {
    await addExpense(alice, 3000, [alice, bob, carol]);

    const response = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(alice));

    expect(response.status).toBe(200);
    expect(netFor(response.body.balances, alice)).toBe(2000);
    expect(netFor(response.body.balances, bob)).toBe(-1000);
    expect(netFor(response.body.balances, carol)).toBe(-1000);
  });

  it('accumulates several expenses', async () => {
    await addExpense(alice, 3000, [alice, bob, carol]);
    await addExpense(bob, 1500, [alice, bob, carol]);

    const response = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(alice));

    expect(netFor(response.body.balances, alice)).toBe(1500);
    expect(netFor(response.body.balances, bob)).toBe(0);
    expect(netFor(response.body.balances, carol)).toBe(-1500);
  });

  it('always nets to zero across the group', async () => {
    await addExpense(alice, 1000, [alice, bob, carol]);
    await addExpense(bob, 777, [alice, bob]);
    await addExpense(carol, 3, [bob, carol]);

    const response = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(alice));

    const total = response.body.balances.reduce(
      (sum: number, balance: { netMinor: number }) => sum + balance.netMinor,
      0,
    );
    expect(total).toBe(0);
  });

  it('names each member, so the client need not resolve identifiers itself', async () => {
    const response = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(alice));

    expect(response.body.balances.map((b: { name: string }) => b.name).sort()).toEqual([
      'Alice',
      'Bob',
      'Carol',
    ]);
  });

  it('returns to zero when the only expense is deleted', async () => {
    await addExpense(alice, 3000, [alice, bob, carol]);

    const listed = await request(app)
      .get(`/api/groups/${groupId}/expenses`)
      .set(authHeader(alice));

    await request(app)
      .delete(`/api/expenses/${listed.body.expenses[0].id}`)
      .set(authHeader(alice));

    const response = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(alice));

    expect(response.body.balances.every((b: { netMinor: number }) => b.netMinor === 0)).toBe(true);
  });

  it('is hidden from people outside the group', async () => {
    const stranger = await registerUser(app);

    const response = await request(app)
      .get(`/api/groups/${groupId}/balances`)
      .set(authHeader(stranger));

    expect(response.status).toBe(404);
  });
});

describe('GET /api/groups/:id/settlement', () => {
  it('asks for nothing when nobody owes anything', async () => {
    const response = await request(app)
      .get(`/api/groups/${groupId}/settlement`)
      .set(authHeader(alice));

    expect(response.status).toBe(200);
    expect(response.body.transfers).toEqual([]);
  });

  it('settles a single shared expense with the fewest payments', async () => {
    await addExpense(alice, 3000, [alice, bob, carol]);

    const response = await request(app)
      .get(`/api/groups/${groupId}/settlement`)
      .set(authHeader(alice));

    expect(response.status).toBe(200);
    expect(response.body.transfers).toHaveLength(2);

    // Alice paid for everyone, so both debtors pay her directly. Bob paying
    // Carol who then pays Alice would settle too, but in one payment more.
    const payers = response.body.transfers
      .map((transfer: { fromUserId: string }) => transfer.fromUserId)
      .sort();
    expect(payers).toEqual([bob.id, carol.id].sort());

    for (const transfer of response.body.transfers) {
      expect(transfer.toUserId).toBe(alice.id);
      expect(transfer.amountMinor).toBe(1000);
    }
  });

  it('leaves a member who is already square out of the plan', async () => {
    await addExpense(alice, 3000, [alice, bob, carol]);
    await addExpense(bob, 1500, [alice, bob, carol]);

    const response = await request(app)
      .get(`/api/groups/${groupId}/settlement`)
      .set(authHeader(alice));

    expect(response.body.transfers).toEqual([
      { fromUserId: carol.id, toUserId: alice.id, amountMinor: 1500 },
    ]);
  });

  it('never needs more transfers than there are members, less one', async () => {
    await addExpense(alice, 1000, [alice, bob, carol]);
    await addExpense(bob, 777, [alice, bob]);
    await addExpense(carol, 3, [bob, carol]);

    const response = await request(app)
      .get(`/api/groups/${groupId}/settlement`)
      .set(authHeader(alice));

    expect(response.body.transfers.length).toBeLessThanOrEqual(2);
  });

  it('names both sides of each transfer', async () => {
    await addExpense(alice, 3000, [alice, bob, carol]);

    const response = await request(app)
      .get(`/api/groups/${groupId}/settlement`)
      .set(authHeader(alice));

    for (const transfer of response.body.transfers) {
      expect(typeof transfer.fromName).toBe('string');
      expect(typeof transfer.toName).toBe('string');
    }
  });

  it('is hidden from people outside the group', async () => {
    const stranger = await registerUser(app);

    const response = await request(app)
      .get(`/api/groups/${groupId}/settlement`)
      .set(authHeader(stranger));

    expect(response.status).toBe(404);
  });
});
