import { spawnSync } from 'node:child_process';
import { seed } from '../server/seed.js';
import { getPool } from '../server/db.js';

try {
  await seed();
  await getPool().end();
  const cli = new URL('../node_modules/@playwright/test/cli.js', import.meta.url);
  const result = spawnSync(process.execPath, [cli.pathname, 'test', ...process.argv.slice(2)], {
    env: process.env, stdio: 'inherit',
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
