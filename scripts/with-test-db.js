import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);
const removedEnvironment = [
  'DATABASE_URL', 'TEST_DATABASE_URL', 'E2E_DATABASE_URL',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI',
  'GOOGLE_INTEGRATION_CLIENT_ID', 'GOOGLE_INTEGRATION_CLIENT_SECRET',
  'GOOGLE_INTEGRATION_REDIRECT_URI', 'GOOGLE_WORKSPACE_CLIENT_ID',
  'GOOGLE_WORKSPACE_CLIENT_SECRET', 'GOOGLE_WORKSPACE_REFRESH_TOKEN',
  'GOOGLE_OAUTH_MODE', 'ADMIN_EMAILS',
];

export function validateTestDatabaseAdminUrl(value) {
  if (!value) throw new Error('TEST_DATABASE_ADMIN_URL is required');
  let url;
  try { url = new URL(value); } catch { throw new Error('Invalid TEST_DATABASE_ADMIN_URL'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !localHosts.has(url.hostname)) {
    throw new Error('TEST_DATABASE_ADMIN_URL must be local PostgreSQL');
  }
  if (!url.pathname || url.pathname === '/') throw new Error('TEST_DATABASE_ADMIN_URL needs a maintenance database');
  return url;
}

export function isolatedTestEnvironment(databaseUrl) {
  const env = { ...process.env };
  const webPort = Number(process.env.E2E_WEB_PORT || 5173);
  for (const key of removedEnvironment) delete env[key];
  Object.assign(env, {
    NODE_ENV: 'test', DATABASE_URL: databaseUrl, TEST_DATABASE_URL: databaseUrl,
    GOOGLE_OAUTH_MODE: 'mock', APP_ORIGIN: `http://127.0.0.1:${webPort}`,
    GOOGLE_REDIRECT_URI: `http://127.0.0.1:${webPort}/api/auth/google/callback`,
    VITE_BACKEND_ENABLED: 'true',
    SESSION_SECRET: 'ocec-local-test-only-session-secret',
    GOOGLE_INTEGRATION_CLIENT_ID: 'ocec-mock-workspace-client',
    GOOGLE_INTEGRATION_CLIENT_SECRET: 'ocec-mock-workspace-secret',
    GOOGLE_INTEGRATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
    ADMIN_EMAILS: 'admin@ocec.test',
  });
  return env;
}

export async function withFreshTestDatabase(command, args = []) {
  if (!command) throw new Error('A test command is required');
  const adminUrl = validateTestDatabaseAdminUrl(process.env.TEST_DATABASE_ADMIN_URL);
  const databaseName = `ocec_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const databaseUrl = new URL(adminUrl);
    databaseUrl.pathname = `/${databaseName}`;
    const exitCode = await new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: 'inherit', env: isolatedTestEnvironment(databaseUrl.toString()) });
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve(signal ? 1 : code ?? 1));
    });
    return exitCode;
  } finally {
    if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  withFreshTestDatabase(process.argv[2], process.argv.slice(3))
    .then((code) => { process.exitCode = code; })
    .catch((error) => { console.error(error); process.exitCode = 1; });
}
