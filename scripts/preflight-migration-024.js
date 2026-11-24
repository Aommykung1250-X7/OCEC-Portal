import { fileURLToPath } from 'node:url';
import { getPool } from '../server/db.js';
import { inspectResultMigrationPreflight } from '../server/resultMigrationPreflight.js';

async function main() {
  try {
    const report = await inspectResultMigrationPreflight();
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    if (!report.safeToApply) {
      process.stderr.write('\nPreflight blocked: duplicate published result batches exist. Reconcile with Result Owner approval before applying migration 024.\n');
      process.exitCode = 2;
    }
  } finally {
    await getPool().end().catch(() => {});
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
