import type { Express } from 'express';
import request from 'supertest';

import { buildApp, registerUser } from '../helpers/api';
import { clearTestDb, connectTestDb, disconnectTestDb } from '../helpers/db';

let app: Express;

beforeAll(async () => {
  await connectTestDb();
  app = buildApp();
});

afterEach(clearTestDb);
afterAll(disconnectTestDb);

describe('GET /health', () => {
  it('reports the service as up', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'ok' });
  });
});

describe('POST /api/auth/register', () => {
  const validPayload = {
    name: 'Ada Lovelace',
    email: 'ada@example.test',
    password: 'analytical engine',
  };

  it('creates an account and returns a token', async () => {
    const response = await request(app).post('/api/auth/register').send(validPayload);

    expect(response.status).toBe(201);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.token.length).toBeGreaterThan(0);
    expect(response.body.user).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.test',
    });
    expect(typeof response.body.user.id).toBe('string');
  });

  it('never returns the password or its hash', async () => {
    const response = await request(app).post('/api/auth/register').send(validPayload);

    const serialised = JSON.stringify(response.body);
    expect(serialised).not.toContain('analytical engine');
    expect(response.body.user).not.toHaveProperty('password');
    expect(response.body.user).not.toHaveProperty('passwordHash');
  });

  it('treats the email address as case insensitive', async () => {
    await request(app).post('/api/auth/register').send(validPayload);

    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validPayload, email: 'ADA@example.test' });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('refuses an email that is already registered', async () => {
    await request(app).post('/api/auth/register').send(validPayload);
    const response = await request(app).post('/api/auth/register').send(validPayload);

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('EMAIL_TAKEN');
  });

  it.each([
    ['a missing name', { ...validPayload, name: undefined }],
    ['a blank name', { ...validPayload, name: '   ' }],
    ['an email that is not an address', { ...validPayload, email: 'not-an-address' }],
    ['a password that is too short', { ...validPayload, password: 'short' }],
    ['no body at all', {}],
  ])('rejects %s', async (_label, payload) => {
    const response = await request(app).post('/api/auth/register').send(payload);

    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_FAILED');
    expect(Array.isArray(response.body.error.details)).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  it('exchanges correct credentials for a token', async () => {
    const user = await registerUser(app, {
      email: 'grace@example.test',
      password: 'nanoseconds are short',
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'nanoseconds are short' });

    expect(response.status).toBe(200);
    expect(typeof response.body.token).toBe('string');
    expect(response.body.user.id).toBe(user.id);
  });

  it('accepts the email in a different case', async () => {
    const user = await registerUser(app, {
      email: 'grace@example.test',
      password: 'nanoseconds are short',
    });

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'GRACE@EXAMPLE.TEST', password: 'nanoseconds are short' });

    expect(response.status).toBe(200);
    expect(response.body.user.id).toBe(user.id);
  });

  it('rejects a wrong password', async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'not the password' });

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('gives the same answer for an unknown account as for a wrong password', async () => {
    const user = await registerUser(app);

    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: user.email, password: 'not the password' });

    const unknownAccount = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.test', password: 'not the password' });

    // Distinguishing the two would let anyone enumerate registered addresses.
    expect(unknownAccount.status).toBe(wrongPassword.status);
    expect(unknownAccount.body.error.code).toBe(wrongPassword.body.error.code);
  });
});

describe('GET /api/auth/me', () => {
  it('returns the caller when given a valid token', async () => {
    const user = await registerUser(app);

    const response = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user.token}`);

    expect(response.status).toBe(200);
    expect(response.body.user).toMatchObject({ id: user.id, email: user.email });
  });

  it.each([
    ['no Authorization header', undefined],
    ['a token that is not a token', 'Bearer nonsense'],
    ['a header missing the Bearer scheme', 'just-a-token'],
  ])('rejects a request with %s', async (_label, header) => {
    const pending = request(app).get('/api/auth/me');
    if (header) {
      pending.set('Authorization', header);
    }

    const response = await pending;

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});
