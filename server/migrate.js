import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { getPool } from './db.js';
import { LATEST_RELEASE_MIGRATION, migrationsDir, RELEASE_MIGRATIONS, verifyReleaseMigrationsManifest } from './migrationsManifest.js';

const MIGRATION_LOCK_KEY = 'ocec-portal-schema-migrations';

export async function migrate({ pool = getPool(), silent = false } = {}) {
  const files = await verifyReleaseMigrationsManifest(migrationsDir);
  const client = await pool.connect();
  const appliedNow = [];
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [MIGRATION_LOCK_KEY]);
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
    const existingResult = await client.query('SELECT version FROM schema_migrations');
    const applied = new Set(existingResult.rows.map((row) => row.version));

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      }
      applied.add(file);
      appliedNow.push(file);
      if (!silent) process.stdout.write(`Applied ${file}\n`);
    }
    return { applied: appliedNow, totalRequired: files.length, latestMigration: LATEST_RELEASE_MIGRATION };
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [MIGRATION_LOCK_KEY]).catch(() => {});
    client.release();
  }
}

export async function checkDatabaseReadiness(pool = getPool()) {
  const required = [...RELEASE_MIGRATIONS];
  await pool.query('SELECT 1');
  const tableCheck = await pool.query("SELECT to_regclass('public.schema_migrations') AS table_name");
  if (!tableCheck.rows[0]?.table_name) {
    return {
      ready: false,
      service: 'ocec-portal-api',
      reason: 'database_migrations_incomplete',
      latestMigration: null,
      expectedLatestMigration: LATEST_RELEASE_MIGRATION,
      requiredMigrationCount: required.length,
      appliedMigrationCount: 0,
      missingMigrations: required,
    };
  }
  const appliedResult = await pool.query('SELECT version FROM schema_migrations ORDER BY version ASC');
  const applied = new Set(appliedResult.rows.map((row) => row.version));
  const missingMigrations = required.filter((version) => !applied.has(version));
  const latestMigration = appliedResult.rows.length ? appliedResult.rows[appliedResult.rows.length - 1].version : null;
  if (missingMigrations.length) {
    return {
      ready: false,
      service: 'ocec-portal-api',
      reason: 'database_migrations_incomplete',
      latestMigration,
      expectedLatestMigration: LATEST_RELEASE_MIGRATION,
      requiredMigrationCount: required.length,
      appliedMigrationCount: applied.size,
      missingMigrations,
    };
  }
  return {
    ready: true,
    service: 'ocec-portal-api',
    latestMigration,
    expectedLatestMigration: LATEST_RELEASE_MIGRATION,
    requiredMigrationCount: required.length,
    appliedMigrationCount: applied.size,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate().then(() => getPool().end()).catch((error) => { console.error(error); process.exitCode = 1; getPool().end().catch(() => {}); });
}
