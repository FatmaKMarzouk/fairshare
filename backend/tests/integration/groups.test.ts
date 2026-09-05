import type { Express } from 'express';
import request from 'supertest';

import { authHeader, buildApp, createGroup, registerUser, TestUser } from '../helpers/api';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/db';

let app: Express;
let owner: TestUser;

beforeAll(async () => {
  await connectTestDb();
  app = buildApp();
});

beforeEach(async () => {
  owner = await registerUser(app);
});

afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('POST /api/groups', () => {
  it('creates a group with the caller already a member', async () => {
    const response = await request(app)
      .post('/api/groups')
      .set(authHeader(owner))
      .send({ name: 'Ski trip', currency: 'CHF' });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ name: 'Ski trip', currency: 'CHF' });
    expect(typeof response.body.id).toBe('string');
    expect(response.body.members).toHaveLength(1);
    expect(response.body.members[0]).toMatchObject({ id: owner.id, email: owner.email });
  });

  it('requires authentication', async () => {
    const response = await request(app).post('/api/groups').send({ name: 'Ski trip' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each([
    ['a blank name', { name: '  ', currency: 'CHF' }],
    ['no name', { currency: 'CHF' }],
    ['a currency that is not three letters', { name: 'Ski trip', currency: 'francs' }],
  ])('rejects %s', async (_label, payload) => {
    const response = await request(app).post('/api/groups').set(authHeader(owner)).send(payload);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('GET /api/groups', () => {
  it('lists only the groups the caller belongs to', async () => {
    const stranger = await registerUser(app);
    await createGroup(app, owner, { name: 'Mine' });
    await createGroup(app, stranger, { name: 'Not mine' });

    const response = await request(app).get('/api/groups').set(authHeader(owner));

    expect(response.status).toBe(200);
    expect(response.body.groups).toHaveLength(1);
    expect(response.body.groups[0].name).toBe('Mine');
  });

  it('returns an empty list rather than an error when there are none', async () => {
    const response = await request(app).get('/api/groups').set(authHeader(owner));

    expect(response.status).toBe(200);
    expect(response.body.groups).toEqual([]);
  });
});

describe('GET /api/groups/:id', () => {
  it('returns the group with its members', async () => {
    const friend = await registerUser(app);
    const groupId = await createGroup(app, owner, { members: [friend] });

    const response = await request(app).get(`/api/groups/${groupId}`).set(authHeader(owner));

    expect(response.status).toBe(200);
    expect(response.body.id).toBe(groupId);
    expect(response.body.members.map((member: { id: string }) => member.id).sort()).toEqual(
      [owner.id, friend.id].sort(),
    );
  });

  it('hides a group the caller does not belong to behind a 404', async () => {
    const stranger = await registerUser(app);
    const groupId = await createGroup(app, owner);

    const response = await request(app).get(`/api/groups/${groupId}`).set(authHeader(stranger));

    // A 403 here would confirm the group exists to someone with no business
    // knowing that, so non-members get the same answer as for a missing group.
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for a well formed id that does not exist', async () => {
    const response = await request(app)
      .get('/api/groups/64b7f1d2e4a3c21a8f0b1234')
      .set(authHeader(owner));

    expect(response.status).toBe(404);
  });

  it('returns 422 for an id that is not an identifier at all', async () => {
    const response = await request(app).get('/api/groups/not-an-id').set(authHeader(owner));

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /api/groups/:id/members', () => {
  it('adds an existing user by email address', async () => {
    const friend = await registerUser(app);
    const groupId = await createGroup(app, owner);

    const response = await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(owner))
      .send({ email: friend.email });

    expect(response.status).toBe(200);
    expect(response.body.members).toHaveLength(2);
  });

  it('matches the email address regardless of case', async () => {
    const friend = await registerUser(app, { email: 'joan@example.test' });
    const groupId = await createGroup(app, owner);

    const response = await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(owner))
      .send({ email: 'JOAN@EXAMPLE.TEST' });

    expect(response.status).toBe(200);
    expect(response.body.members.map((m: { id: string }) => m.id)).toContain(friend.id);
  });

  it('refuses to add the same person twice', async () => {
    const friend = await registerUser(app);
    const groupId = await createGroup(app, owner, { members: [friend] });

    const response = await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(owner))
      .send({ email: friend.email });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('ALREADY_MEMBER');
  });

  it('reports an unknown email address', async () => {
    const groupId = await createGroup(app, owner);

    const response = await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(owner))
      .send({ email: 'nobody@example.test' });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('USER_NOT_FOUND');
  });

  it('does not let a non-member add people to a group', async () => {
    const stranger = await registerUser(app);
    const friend = await registerUser(app);
    const groupId = await createGroup(app, owner);

    const response = await request(app)
      .post(`/api/groups/${groupId}/members`)
      .set(authHeader(stranger))
      .send({ email: friend.email });

    expect(response.status).toBe(404);
  });
});
