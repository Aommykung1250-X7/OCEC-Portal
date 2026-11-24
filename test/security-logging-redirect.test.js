import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import test from 'node:test';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import writeXlsxFile from 'write-excel-file/browser';
import { readWorkbook, worksheetRows } from '../src/excel.js';
import { resolveSafeReturnUrl, returnPath } from '../server/auth.js';
import { buildApp, createLoggerOptions, sanitizeRequestPath } from '../server/index.js';

const origin = 'https://portal.ocec.example';

test('OCEC-09 OAuth return URL allows only same-origin known portal routes and rejects bypass encodings', () => {
  assert.equal(resolveSafeReturnUrl('/', origin), `${origin}/`);
  assert.equal(resolveSafeReturnUrl('/apply', origin), `${origin}/apply`);
  assert.equal(resolveSafeReturnUrl('/final/confirm?step=2', origin), `${origin}/final/confirm?step=2`);
  assert.equal(resolveSafeReturnUrl('/portal-admin/review', origin), `${origin}/portal-admin/review`);
  assert.equal(resolveSafeReturnUrl('/applications/app-123', origin), `${origin}/applications/app-123`);
  assert.equal(returnPath('/results?year=2569', origin), '/results?year=2569');

  const malicious = [
    'https://evil.example/apply',
    'http://portal.ocec.example/apply',
    '//evil.example/apply',
    '///evil.example/apply',
    '/\\evil.example/apply',
    '/%2f%2fevil.example/apply',
    '/%5cevil.example/apply',
    '/..//evil.example/apply',
    '/@evil.example/apply',
    '/apply\r\nSet-Cookie: a=b',
    '/javascript:alert(1)',
    'javascript:alert(1)',
    '/api/auth/logout',
    '/unknown-unregistered-route',
    '',
    null,
  ];
  for (const input of malicious) {
    const resolved = resolveSafeReturnUrl(input, origin);
    assert.equal(resolved, `${origin}/`, `malicious returnTo ${JSON.stringify(input)} must fall back to root`);
    assert.equal(new URL(resolved).origin, origin);
  }
});

test('OCEC-09 request logs keep route and requestId while excluding query strings, OAuth code/state, session cookies, and slip tokens', async () => {
  const lines = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString('utf8'));
      callback();
    },
  });
  const loggedApp = buildApp({ logger: createLoggerOptions({ level: 'info', stream }) });

  const fakeOAuthCode = 'FAKE_OAUTH_CODE_SECRET_111';
  const fakeOAuthState = 'FAKE_OAUTH_STATE_SECRET_222';
  const fakeSession = 'FAKE_SESSION_TOKEN_SECRET_333333333333333333';
  const fakeSlipToken = 'FAKE_SLIP_TOKEN_SECRET_44444444444444444444';
  const fakeQueryToken = 'FAKE_SLIP_PAGE_TOKEN_5555555555555555555555';

  try {
    const cb = await loggedApp.inject({
      method: 'GET',
      url: `/api/auth/google/callback?code=${fakeOAuthCode}&state=${fakeOAuthState}`,
      headers: { cookie: `ocec_session=${fakeSession}` },
    });
    assert.equal(cb.statusCode, 400);
    assert.equal(cb.headers['cache-control'], 'no-store');
    assert.equal(cb.headers['referrer-policy'], 'no-referrer');

    const start = await loggedApp.inject({ method: 'GET', url: '/api/auth/google/start?returnTo=/apply' });
    assert.equal(start.headers['cache-control'], 'no-store');
    assert.equal(start.headers['referrer-policy'], 'no-referrer');

    const slipValidate = await loggedApp.inject({
      method: 'POST',
      url: '/api/slip-replacements/validate',
      payload: { token: 'short-invalid-token' },
    });
    assert.equal(slipValidate.statusCode, 400);
    assert.equal(slipValidate.headers['cache-control'], 'no-store');
    assert.equal(slipValidate.headers['referrer-policy'], 'no-referrer');

    // Trigger query-bearing SPA request when dist is built, or 404 route when unbuilt
    const slipPage = await loggedApp.inject({
      method: 'GET',
      url: `/slip-replacement?token=${fakeQueryToken}`,
      headers: { cookie: `ocec_session=${fakeSession}`, authorization: `Bearer ${fakeSlipToken}` },
    });
    const distIndex = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.html');
    if (existsSync(distIndex)) {
      assert.equal(slipPage.statusCode, 200);
      assert.equal(slipPage.headers['cache-control'], 'no-store');
      assert.equal(slipPage.headers['referrer-policy'], 'no-referrer');
    }

    const combinedLogs = lines.join('');
    assert.ok(combinedLogs.length > 0, 'expected Fastify to emit request logs');
    for (const secret of [fakeOAuthCode, fakeOAuthState, fakeSession, fakeSlipToken, fakeQueryToken, 'code=', 'state=', 'token=']) {
      assert.ok(!combinedLogs.includes(secret), `request log must not contain sensitive value: ${secret}`);
    }
    const parsedEntries = combinedLogs.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
    const reqEntries = parsedEntries.filter((entry) => entry.req);
    assert.ok(reqEntries.length >= 3);
    assert.ok(reqEntries.every((entry) => Boolean(entry.req.route) && Boolean(entry.req.requestId || entry.reqId)));
    assert.ok(reqEntries.some((entry) => entry.req.route === '/api/auth/google/callback'));
  } finally {
    await loggedApp.close();
  }
});

test('OCEC-09 sanitizeRequestPath strips query and hash components cleanly', () => {
  assert.equal(sanitizeRequestPath('/slip-replacement?token=abc#frag'), '/slip-replacement');
  assert.equal(sanitizeRequestPath('/api/auth/google/callback?code=1&state=2'), '/api/auth/google/callback');
  assert.equal(sanitizeRequestPath('/results'), '/results');
});

test('OCEC-15 updated dependencies keep static serving, schema validation, and Excel round-trip working', async () => {
  // Excel write + read round-trip through Portal's own src/excel.js import path
  const generated = await writeXlsxFile([
    {
      sheet: 'Results',
      data: [
        ['Candidate Name', 'Award'],
        ['Ada Lovelace', 'GOLD AWARD'],
      ],
    },
  ]);
  const blob = await generated.toBlob();
  const xlsxFile = new File([blob], 'results-check.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const workbook = await readWorkbook(xlsxFile);
  assert.deepEqual(workbook.SheetNames, ['Results']);
  assert.deepEqual(worksheetRows(workbook, 'Results'), [
    ['Candidate Name', 'Award'],
    ['Ada Lovelace', 'GOLD AWARD'],
  ]);

  // Fastify schema validation & static serving
  const testApp = buildApp({ logger: false });
  try {
    const invalidValidation = await testApp.inject({
      method: 'POST',
      url: '/api/public/final-eligibility/verify',
      payload: { candidateName: 'Ada Lovelace', finalRoundId: 'round-1', phoneLast4: 'bad' },
    });
    assert.equal(invalidValidation.statusCode, 400);

    const distIndex = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'index.html');
    if (existsSync(distIndex)) {
      const home = await testApp.inject({ method: 'GET', url: '/' });
      assert.equal(home.statusCode, 200);
      assert.match(home.headers['content-type'] || '', /text\/html/);
    }
  } finally {
    await testApp.close();
  }
});
