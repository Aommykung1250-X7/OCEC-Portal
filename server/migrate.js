import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, transaction } from './db.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export async function migrate() {
  await getPool().query('CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  const files = (await readdir(migrationsDir)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
  for (const file of files) {
    const done = await getPool().query('SELECT 1 FROM schema_migrations WHERE version = $1', [file]);
    if (done.rowCount) continue;
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    await transaction(async (client) => {
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
    });
    process.stdout.write(`Applied ${file}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  migrate().then(() => getPool().end()).catch((error) => { console.error(error); process.exitCode = 1; getPool().end().catch(() => {}); });
}
