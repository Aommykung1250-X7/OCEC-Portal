import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { withFreshTestDatabase } from './with-test-db.js';

function runNodeTests(files, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--test', '--test-concurrency=1', ...files], {
      stdio: 'inherit',
      env: { ...process.env, ...extraEnv },
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(signal ? 1 : code ?? 1));
  });
}

async function main() {
  const testDir = fileURLToPath(new URL('../test', import.meta.url));
  const entries = (await readdir(testDir)).filter((name) => name.endsWith('.test.js')).sort();
  const unitTests = entries.filter((name) => !name.startsWith('database-')).map((name) => `test/${name}`);
  const dbSuites = [
    ...entries.filter((name) => name.startsWith('database-')).map((name) => `test/${name}`),
    'test/e2e/runner-safety.test.js',
  ];

  console.log(`\n==> Running ${unitTests.length} unit & contract test files (with strict traceability)...`);
  const unitCode = await runNodeTests(unitTests, { TRACEABILITY_REQUIRE_IMPLEMENTED: '1' });
  if (unitCode !== 0) return unitCode;

  for (const suite of dbSuites) {
    console.log(`\n==> Running ${suite} in a fresh isolated PostgreSQL database...`);
    const code = await withFreshTestDatabase(process.execPath, ['--test', '--test-concurrency=1', suite]);
    if (code !== 0) return code;
  }

  console.log(`\nAll ${unitTests.length} unit test files and ${dbSuites.length} isolated database suites passed.`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .then((code) => { process.exitCode = code; })
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
