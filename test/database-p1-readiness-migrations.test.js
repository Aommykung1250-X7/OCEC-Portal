import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import test from 'node:test';
import pg from 'pg';
import { app } from '../server/index.js';
import { validateStartupConfig } from '../server/config.js';
import { getPool } from '../server/db.js';
import { checkDatabaseReadiness, migrate } from '../server/migrate.js';
import { LATEST_RELEASE_MIGRATION, listDiskMigrations, migrationsDir, RELEASE_MIGRATIONS, verifyReleaseMigrationsManifest } from '../server/migrationsManifest.js';

const testUrl = process.env.TEST_DATABASE_URL;

test('release migration manifest matches disk SQL files in exact order', async () => {
  const verified = await verifyReleaseMigrationsManifest(migrationsDir);
  const onDisk = await listDiskMigrations(migrationsDir);
  assert.deepEqual(verified, onDisk);
  assert.deepEqual(verified, [...RELEASE_MIGRATIONS]);
  assert.equal(LATEST_RELEASE_MIGRATION, onDisk[onDisk.length - 1]);
});

test('startup config validation enforces required production settings without leaking secrets', () => {
  const validProd = {
    NODE_ENV: 'production',
    PORT: '8080',
    HOST: '0.0.0.0',
    DATABASE_URL: 'postgresql://user:super-secret-db-pass@db.example.internal:5432/portal',
    APP_ORIGIN: 'https://portal.ocec.example',
    GOOGLE_CLIENT_ID: 'client-id-123',
    GOOGLE_CLIENT_SECRET: 'TOP-SECRET-CLIENT-VALUE',
    GOOGLE_REDIRECT_URI: 'https://portal.ocec.example/api/auth/google/callback',
    GOOGLE_INTEGRATION_REDIRECT_URI: 'https://portal.ocec.example/api/admin/google-workspace/callback',
    GOOGLE_INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
    ADMIN_EMAILS: 'admin@ocec.example',
  };
  assert.equal(validateStartupConfig(validProd).port, 8080);

  const secretValue = 'DO-NOT-LEAK-SECRET-9999';
  let caught;
  try {
    validateStartupConfig({
      NODE_ENV: 'production',
      PORT: '0',
      DATABASE_URL: `http://${secretValue}@bad-host/db`,
      APP_ORIGIN: 'http://portal.ocec.example/extra',
      GOOGLE_OAUTH_MODE: 'mock',
      GOOGLE_CLIENT_SECRET: secretValue,
      GOOGLE_INTEGRATION_ENCRYPTION_KEY: secretValue,
      ADMIN_EMAILS: '',
    });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, 'expected startup config validation to fail');
  assert.equal(caught.code, 'INVALID_STARTUP_CONFIG');
  assert.ok(!caught.message.includes(secretValue), 'error message must never include secret values');
  assert.match(caught.message, /DATABASE_URL/);
  assert.match(caught.message, /APP_ORIGIN/);
  assert.match(caught.message, /GOOGLE_OAUTH_MODE/);
  assert.match(caught.message, /GOOGLE_INTEGRATION_ENCRYPTION_KEY/);
});

if (!testUrl) {
  test('OCEC-07 readiness and migration lock tests require a disposable PostgreSQL database', { skip: 'Use npm run test:db' }, () => {});
} else {
  const target = new URL(testUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || !target.pathname.includes('test') || process.env.DATABASE_URL !== testUrl) {
    throw new Error('Use a disposable local test database');
  }
  app.log.level = 'silent';

  async function withScratchDatabase(work) {
    const adminUrl = new URL(testUrl);
    adminUrl.pathname = '/postgres';
    const dbName = `ocec_ready_${randomBytes(6).toString('hex')}`;
    const admin = new pg.Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const scratchUrl = new URL(testUrl);
    scratchUrl.pathname = `/${dbName}`;
    const pool = new pg.Pool({ connectionString: scratchUrl.toString(), max: 6 });
    try {
      return await work({ pool, databaseUrl: scratchUrl.toString() });
    } finally {
      await pool.end().catch(() => {});
      await admin.query(`DROP DATABASE "${dbName}" WITH (FORCE)`).catch(() => {});
      await admin.end().catch(() => {});
    }
  }

  test.after(async () => {
    await app.close();
    await getPool().end();
  });

  test('liveness stays 200 while /api/ready rejects empty, 022, and middle-gap schemas, and passes when aligned', async () => {
    await withScratchDatabase(async ({ pool }) => {
      // 1) Empty database
      const empty = await checkDatabaseReadiness(pool);
      assert.equal(empty.ready, false);
      assert.equal(empty.reason, 'database_migrations_incomplete');
      assert.equal(empty.missingMigrations.length, RELEASE_MIGRATIONS.length);

      // 2) Apply only through migration 022 (simulating current Railway deployment)
      await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
      const upTo022 = RELEASE_MIGRATIONS.filter((file) => file <= '022_final_overseas_center.sql');
      for (const file of upTo022) {
        const sql = await readFile(join(migrationsDir, file), 'utf8');
        await pool.query(sql);
        await pool.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
      }
      const at022 = await checkDatabaseReadiness(pool);
      assert.equal(at022.ready, false);
      assert.equal(at022.latestMigration, '022_final_overseas_center.sql');
      assert.ok(at022.missingMigrations.includes('023_payment_slip_inspections.sql'));
      assert.ok(at022.missingMigrations.includes('024_result_publication_snapshots.sql'));
      assert.ok(at022.missingMigrations.includes('025_catalog_revision.sql'));

      // 3) Upgrade cleanly to full release
      await migrate({ pool, silent: true });
      const aligned = await checkDatabaseReadiness(pool);
      assert.equal(aligned.ready, true);
      assert.equal(aligned.latestMigration, LATEST_RELEASE_MIGRATION);
      assert.equal(aligned.appliedMigrationCount, RELEASE_MIGRATIONS.length);

      // 4) Delete a middle migration while keeping the latest migration present -> must still fail readiness!
      await pool.query("DELETE FROM schema_migrations WHERE version='015_mock_delivery_sheets.sql'");
      const middleGap = await checkDatabaseReadiness(pool);
      assert.equal(middleGap.ready, false);
      assert.equal(middleGap.latestMigration, LATEST_RELEASE_MIGRATION);
      assert.deepEqual(middleGap.missingMigrations, ['015_mock_delivery_sheets.sql']);
    });

    // Verify HTTP endpoints on the main test DB as well
    await migrate({ silent: true });
    const liveRes = await app.inject({ method: 'GET', url: '/api/live' });
    assert.equal(liveRes.statusCode, 200);
    assert.equal(liveRes.json().alive, true);
    const healthRes = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(healthRes.statusCode, 200);
    assert.equal(healthRes.json().ok, true);

    const readyOk = await app.inject({ method: 'GET', url: '/api/ready' });
    assert.equal(readyOk.statusCode, 200, readyOk.body);
    assert.equal(readyOk.json().ready, true);
    assert.equal(readyOk.json().latestMigration, LATEST_RELEASE_MIGRATION);

    // Temporarily delete middle migration row to test HTTP 503
    await getPool().query("DELETE FROM schema_migrations WHERE version='015_mock_delivery_sheets.sql'");
    try {
      const readyGap = await app.inject({ method: 'GET', url: '/api/ready' });
      assert.equal(readyGap.statusCode, 503, readyGap.body);
      assert.equal(readyGap.json().ready, false);
      assert.deepEqual(readyGap.json().missingMigrations, ['015_mock_delivery_sheets.sql']);
      // Liveness still responds 200 even when DB readiness is 503
      assert.equal((await app.inject({ method: 'GET', url: '/api/live' })).statusCode, 200);
    } finally {
      await getPool().query("INSERT INTO schema_migrations(version) VALUES('015_mock_delivery_sheets.sql') ON CONFLICT DO NOTHING");
    }
  });

  test('two concurrent migration runners serialize via PostgreSQL advisory lock and finish cleanly', async () => {
    await withScratchDatabase(async ({ pool, databaseUrl }) => {
      const runChild = () => new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['server/migrate.js'], {
          env: { ...process.env, DATABASE_URL: databaseUrl },
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
        child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
        child.once('error', reject);
        child.once('exit', (code) => resolve({ code, stdout, stderr }));
      });

      const [first, second] = await Promise.all([runChild(), runChild()]);
      assert.equal(first.code, 0, `first runner failed: ${first.stderr}`);
      assert.equal(second.code, 0, `second runner failed: ${second.stderr}`);

      const appliedLines = (output) => output.split('\n').filter((line) => line.startsWith('Applied '));
      assert.equal(appliedLines(first.stdout).length + appliedLines(second.stdout).length, RELEASE_MIGRATIONS.length);
      assert.equal((await checkDatabaseReadiness(pool)).ready, true);
    });
  });
}
