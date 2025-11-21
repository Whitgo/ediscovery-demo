/**
 * Regression Tests for Audit Logging
 * Ensures audit_logs entries use integer user FK, proper values on success/failure,
 * and foreign key behavior (SET NULL) after user deletion.
 */

const knexLib = require('knex');
const bcrypt = require('bcrypt');
const request = require('supertest');
const express = require('express');

// Use development connection (simpler than isolated test DB for regression)
const knex = knexLib({
  client: 'pg',
  connection: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ediscovery_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres'
  }
});

// Ensure JWT secret set for signing
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

// Import auth router directly
const authRouter = require('../src/api/auth');

// Helper to create minimal Express app with knex injection
function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.knex = knex; next(); });
  app.use('/api/auth', authRouter);
  return app;
}

// Insert a disposable user for tests
async function createUser({ id, name, email, role, password }) {
  const password_hash = await bcrypt.hash(password, 10);
  await knex('users').insert({ id, name, email, role, password_hash });
  return id;
}

describe('Audit Logging Regression', () => {
  const app = makeApp();
  const TEST_USER_ID = 9100;
  const TEST_USER_EMAIL = 'audit-user@test.com';
  const TEST_PASSWORD = 'demo123';

  beforeAll(async () => {
    // Ensure migrations applied (idempotent)
    // (Assumes migrations already run outside tests; skip if fails)
    try { await knex.migrate.latest({ directory: '../migrations' }); } catch (_) {}
    // Clean conflicting remnants if any
    await knex('audit_logs').where({ user: TEST_USER_ID }).del();
    await knex('users').where({ id: TEST_USER_ID }).del();
    await createUser({ id: TEST_USER_ID, name: 'Audit Test', email: TEST_USER_EMAIL, role: 'user', password: TEST_PASSWORD });
  });

  afterAll(async () => {
    await knex('audit_logs').where({ user: TEST_USER_ID }).del();
    await knex('users').where({ id: TEST_USER_ID }).del();
    await knex.destroy();
  });

  // Helper safe JSON extraction (column is jsonb so knex may return object)
  function toObject(value) {
    if (!value) return {};
    if (typeof value === 'string') {
      try { return JSON.parse(value); } catch { return {}; }
    }
    return value; // already object
  }

  test('Successful login creates audit_logs row with integer user FK', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_USER_EMAIL, password: TEST_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');

    const row = await knex('audit_logs')
      .where({ action: 'successful_login', user: TEST_USER_ID })
      .orderBy('timestamp', 'desc')
      .first();

    expect(row).toBeTruthy();
    expect(typeof row.user).toBe('number');
    expect(row.user).toBe(TEST_USER_ID);
    const details = toObject(row.details);
    expect(details.email).toBe(TEST_USER_EMAIL);
    expect(row.action).toBe('successful_login');
  });

  test('Failed login inserts row with null user and email in details', async () => {
    const badEmail = 'missing-user@test.com';
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: badEmail, password: 'wrongpass' });

    expect(res.status).toBe(401);

    const row = await knex('audit_logs')
      .where({ action: 'failed_login', user: null })
      .orderBy('timestamp', 'desc')
      .first();

    expect(row).toBeTruthy();
    expect(row.user).toBeNull();
    const details = toObject(row.details);
    expect(details.email).toBe(badEmail);
    expect(details.reason).toMatch(/Invalid/i);
    expect(row.action).toBe('failed_login');
  });

  test('Foreign key ON DELETE SET NULL behavior - user deletion nullifies user field', async () => {
    // Create an extra user to test deletion effect
    const deleteUserId = 9200;
    const email = 'to-delete@test.com';
    // Cleanup remnants from prior runs if any
    await knex('audit_logs').where({ user: deleteUserId }).del();
    await knex('users').where({ id: deleteUserId }).del();
    await knex('users').where({ email }).del();
    await createUser({ id: deleteUserId, name: 'To Delete', email, role: 'user', password: TEST_PASSWORD });

    // Trigger a successful login to create audit log referencing this user
    await request(app).post('/api/auth/login').send({ email, password: TEST_PASSWORD });
    const before = await knex('audit_logs')
      .where({ action: 'successful_login', user: deleteUserId })
      .first();
    expect(before).toBeTruthy();

    // Delete user
    await knex('users').where({ id: deleteUserId }).del();

    // Row should remain but user column becomes null due to ON DELETE SET NULL
    const after = await knex('audit_logs')
      .where({ id: before.id })
      .first();
    // Row should remain and be null; if undefined this indicates unexpected cascade
    expect(after).toBeTruthy();
    expect(after.user).toBeNull();
  });

  test('Audit log insertion with invalid user ID should fail FK constraint', async () => {
    // Attempt to insert with non-existent user ID
    let errorCaught = null;
    try {
      await knex('audit_logs').insert({
        user: 999999, // unlikely to exist
        action: 'manual_test',
        object_type: 'auth',
        details: JSON.stringify({ test: true }),
        timestamp: new Date()
      });
    } catch (e) {
      errorCaught = e;
    }
    expect(errorCaught).toBeTruthy();
    expect(String(errorCaught.message)).toMatch(/insert|foreign/i);
  });
});
