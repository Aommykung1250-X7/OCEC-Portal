import { fileURLToPath } from 'node:url';
import { withFreshTestDatabase } from './with-test-db.js';

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  withFreshTestDatabase(process.execPath, ['scripts/run-e2e-in-database.js', ...process.argv.slice(2)])
    .then((code) => { process.exitCode = code; })
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
