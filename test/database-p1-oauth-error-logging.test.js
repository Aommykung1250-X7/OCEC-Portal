import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { Writable } from 'node:stream';
import test from 'node:test';
import { getPool } from '../server/db.js';
import { buildApp, createLoggerOptions } from '../server/index.js';
import { seed } from '../server/seed.js';

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  test('OCEC-09 OAuth callback error log redaction tests require a disposable database', { skip: 'Use npm run test:db' }, () => {});
} else {
  const target = new URL(testUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || !target.pathname.includes('test') || process.env.DATABASE_URL !== testUrl) {
    throw new Error('Use a disposable local test database');
  }

  test.before(async () => {
    await seed();
  });

  test.after(async () => {
    await getPool().end();
  });

  async function seedOAuthAttempt(state) {
    const stateHash = createHash('sha256').update(state).digest('hex');
    await getPool().query(
      `INSERT INTO oauth_attempts(state_hash, nonce, code_verifier, return_path, expires_at)
       VALUES($1, 'test-nonce', 'test-verifier', '/apply', now() + interval '10 minutes')`,
      [stateHash],
    );
  }

  test('Google OAuth token exchange and ID token verification failures never leak secrets or raw library messages into logs or responses', async () => {
    const savedEnv = {
      GOOGLE_OAUTH_MODE: process.env.GOOGLE_OAUTH_MODE,
      GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    };
    process.env.GOOGLE_OAUTH_MODE = 'live';
    process.env.GOOGLE_CLIENT_ID = 'test-oauth-client-id';
    process.env.GOOGLE_CLIENT_SECRET = 'SUPER_SECRET_CLIENT_CREDENTIAL_XYZ';
    process.env.GOOGLE_REDIRECT_URI = `${process.env.APP_ORIGIN}/api/auth/google/callback`;

    const secretSentinelTokenHttp = 'SECRET_GOOGLE_UPSTREAM_BODY_9911';
    const secretSentinelNetwork = 'SECRET_NETWORK_ERR_CLIENT_SECRET_9922';
    const secretSentinelJwt = 'eyJhbGciOiJSUzI1NiJ9.SECRET_RAW_ID_TOKEN_PAYLOAD_9933.sig';
    const secretSentinelVerifyErr = 'Wrong recipient for token SECRET_VERIFY_ERR_9944';
    const fakeAuthCode = 'FAKE_AUTH_CODE_SECRET_9955';

    const logChunks = [];
    const stream = new Writable({
      write(chunk, _enc, cb) {
        logChunks.push(chunk.toString('utf8'));
        cb();
      },
    });

    let mode = 'http_error';
    const loggedApp = buildApp({
      logger: createLoggerOptions({ level: 'info', stream }),
      authDeps: {
        fetchImpl: async () => {
          if (mode === 'http_error') {
            return new Response(JSON.stringify({ error: 'invalid_grant', detail: secretSentinelTokenHttp }), { status: 400 });
          }
          if (mode === 'network_error') {
            throw new Error(`connect ETIMEDOUT ${secretSentinelNetwork}`);
          }
          return Response.json({ id_token: secretSentinelJwt });
        },
        verifyIdTokenImpl: async () => {
          throw new Error(`${secretSentinelVerifyErr} (${secretSentinelJwt})`);
        },
      },
    });

    try {
      // 1) Token exchange HTTP error
      mode = 'http_error';
      const state1 = `st1-${randomBytes(12).toString('base64url')}`;
      await seedOAuthAttempt(state1);
      const res1 = await loggedApp.inject({
        method: 'GET',
        url: `/api/auth/google/callback?code=${fakeAuthCode}&state=${state1}`,
        headers: { cookie: `ocec_oauth_state=${state1}` },
      });
      assert.equal(res1.statusCode, 502);
      assert.equal(res1.headers['cache-control'], 'no-store');
      assert.equal(res1.headers['referrer-policy'], 'no-referrer');
      assert.ok(!res1.body.includes(secretSentinelTokenHttp));

      // 2) Token exchange network throw
      mode = 'network_error';
      const state2 = `st2-${randomBytes(12).toString('base64url')}`;
      await seedOAuthAttempt(state2);
      const res2 = await loggedApp.inject({
        method: 'GET',
        url: `/api/auth/google/callback?code=${fakeAuthCode}&state=${state2}`,
        headers: { cookie: `ocec_oauth_state=${state2}` },
      });
      assert.equal(res2.statusCode, 502);
      assert.ok(!res2.body.includes(secretSentinelNetwork));

      // 3) verifyIdToken failure containing raw JWT & library error message
      mode = 'verify_error';
      const state3 = `st3-${randomBytes(12).toString('base64url')}`;
      await seedOAuthAttempt(state3);
      const res3 = await loggedApp.inject({
        method: 'GET',
        url: `/api/auth/google/callback?code=${fakeAuthCode}&state=${state3}`,
        headers: { cookie: `ocec_oauth_state=${state3}` },
      });
      assert.equal(res3.statusCode, 403);
      assert.ok(!res3.body.includes(secretSentinelJwt));
      assert.ok(!res3.body.includes(secretSentinelVerifyErr));

      // Inspect captured structured logs: must have errorCategory + requestId and ZERO secrets!
      const rawLogs = logChunks.join('');
      for (const secret of [
        secretSentinelTokenHttp,
        secretSentinelNetwork,
        secretSentinelJwt,
        secretSentinelVerifyErr,
        fakeAuthCode,
        state1,
        state2,
        state3,
        process.env.GOOGLE_CLIENT_SECRET,
      ]) {
        assert.ok(!rawLogs.includes(secret), `log output must not contain secret: ${secret}`);
      }
      const entries = rawLogs.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
      const oauthErrors = entries.filter((entry) => entry.event === 'google_oauth_error');
      assert.deepEqual(
        oauthErrors.map((entry) => entry.errorCategory),
        [
          'google_token_exchange_http_error',
          'google_token_exchange_network_error',
          'google_id_token_verification_failed',
        ],
      );
      assert.ok(oauthErrors.every((entry) => Boolean(entry.requestId)));
    } finally {
      await loggedApp.close();
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
}
