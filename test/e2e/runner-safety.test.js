import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import pg from 'pg';
import { isolatedTestEnvironment, validateTestDatabaseAdminUrl, withFreshTestDatabase } from '../../scripts/with-test-db.js';

test('rejects a non-local database before creating one', () => {
  for (const url of [undefined, 'postgres://db.example.com/postgres', 'https://localhost/postgres', 'postgres://localhost/']) {
    assert.throws(() => validateTestDatabaseAdminUrl(url));
  }
  assert.equal(validateTestDatabaseAdminUrl('postgres://localhost/postgres').hostname, 'localhost');
});

test('refuses mock OAuth in production', () => {
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', "import { registerAuthRoutes } from './server/auth.js'; registerAuthRoutes({ get() {} });"], {
    cwd: new URL('../..', import.meta.url), encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', GOOGLE_OAUTH_MODE: 'mock' },
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /only in test mode/);
});

test('creates and drops only its fresh test database', { skip: !process.env.TEST_DATABASE_ADMIN_URL }, async () => {
  const admin = new pg.Client({ connectionString: process.env.TEST_DATABASE_ADMIN_URL });
  await admin.connect();
  try {
    const existing = await admin.query("SELECT datname FROM pg_database WHERE datname LIKE 'ocec_test_%'");
    const prior = new Set(existing.rows.map((row) => row.datname));
    assert.ok(prior.has(new URL(process.env.TEST_DATABASE_URL).pathname.slice(1)));
    const code = await withFreshTestDatabase(process.execPath, ['--input-type=module', '-e', "if (!/^ocec_test_[0-9a-f]{16}$/.test(new URL(process.env.DATABASE_URL).pathname.slice(1))) process.exit(1)"]);
    assert.equal(code, 0);
    const after = await admin.query("SELECT datname FROM pg_database WHERE datname LIKE 'ocec_test_%'");
    assert.deepEqual(new Set(after.rows.map((row) => row.datname)), prior);
  } finally { await admin.end(); }
});

test('test environment excludes inherited Google credentials', () => {
  const previous = process.env.GOOGLE_INTEGRATION_CLIENT_SECRET;
  process.env.GOOGLE_INTEGRATION_CLIENT_SECRET = 'must-not-leak';
  try {
    const env = isolatedTestEnvironment('postgres://localhost/ocec_test_abc');
    assert.equal(env.GOOGLE_INTEGRATION_CLIENT_SECRET, 'ocec-mock-workspace-secret');
    assert.notEqual(env.GOOGLE_INTEGRATION_CLIENT_SECRET, 'must-not-leak');
    assert.equal(env.GOOGLE_OAUTH_MODE, 'mock');
    assert.equal(env.NODE_ENV, 'test');
  } finally {
    if (previous === undefined) delete process.env.GOOGLE_INTEGRATION_CLIENT_SECRET;
    else process.env.GOOGLE_INTEGRATION_CLIENT_SECRET = previous;
  }
});
