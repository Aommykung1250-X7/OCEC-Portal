import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { app } from '../server/index.js';

app.log.level = 'silent';
after(async () => { await app.close(); });

test('admin and account data routes reject anonymous requests', async () => {
  const routes = [
    ['GET', '/api/applications/mine'],
    ['GET', '/api/admin/applications'],
    ['GET', '/api/admin/results'],
    ['GET', '/api/admin/final-ids'],
    ['GET', '/api/admin/google-workspace/status'],
    ['GET', '/api/admin/integrations/status'],
    ['PUT', '/api/admin/payment-accounts', { paymentAccounts: [] }],
    ['POST', '/api/admin/google-workspace/connect'],
    ['POST', '/api/admin/google-workspace/initialize-drive'],
    ['POST', '/api/admin/mock-sheets/add', { year: '2569', competition: 'BBB', grade: 'Primary 1', startDate: '2026-10-01', endDate: '2026-10-21' }],
    ['POST', '/api/admin/exams/heat-2026/exam-numbers', { confirm: true }],
    ['POST', '/api/admin/exams/heat-2026/results/publish', { confirm: true }],
    ['POST', '/api/admin/exams/final-2026/final-ids/apply', { confirm: true }],
  ];
  for (const [method, url, payload] of routes) {
    const response = await app.inject({ method, url, ...(payload ? { payload } : {}) });
    assert.equal(response.statusCode, 401, `${method} ${url}: ${response.body}`);
    assert.equal(response.json().error, 'Authentication required');
  }
});

test('public lookup validates input before querying private application data', async () => {
  const requests = [
    ['/api/public/applications/status', {}],
    ['/api/public/applications/status', { name: 'Al' }],
    ['/api/public/applications/edit-access', { candidateName: 'Alice', phoneLast4: '123' }],
    ['/api/public/applications/edit-access', { candidateName: 'Alice', phoneLast4: '12AB' }],
  ];
  for (const [url, payload] of requests) {
    const response = await app.inject({ method: 'POST', url, payload });
    assert.equal(response.statusCode, 400, `${url}: ${response.body}`);
  }
});

test('one-time slip endpoints reject malformed tokens and file metadata', async () => {
  const requests = [
    ['/api/slip-replacements/validate', { token: 'short' }],
    ['/api/slip-replacements/validate', { token: 'x'.repeat(31) + '!' }],
    ['/api/slip-replacements/submit', { token: 'x'.repeat(32), slip: { fileName: 'x.gif', mimeType: 'image/gif', dataBase64: 'AAAA' } }],
  ];
  for (const [url, payload] of requests) {
    const response = await app.inject({ method: 'POST', url, payload });
    assert.equal(response.statusCode, 400, `${url}: ${response.body}`);
  }
});

test('registration API rejects incomplete applicants and invalid exam selections', async () => {
  const validApplicant = {
    firstNameEn: 'Ada', lastNameEn: 'Lovelace', dateOfBirth: '2017-01-01',
    schoolName: 'Example School', contactEmail: 'ada@example.com', contactPhone: '0812345678',
  };
  const validItem = { roundId: 'bbb-heat', gradeId: 'g1', format: 'paper', centerId: 'center-554' };
  const cases = [
    { applicant: { ...validApplicant, contactEmail: 'invalid' }, items: [validItem] },
    { applicant: validApplicant, items: [] },
    { applicant: validApplicant, items: [{ ...validItem, format: 'postal' }] },
    { applicant: { ...validApplicant, dateOfBirth: '2017-99-99' }, items: [validItem] },
  ];
  for (const payload of cases) {
    const response = await app.inject({ method: 'POST', url: '/api/application-drafts', payload });
    assert.equal(response.statusCode, 400, response.body);
  }
});

test('result import API bounds file size by row count and required fields', async () => {
  const url = '/api/admin/exams/bbb-heat/results/draft';
  const invalid = [
    { fileName: 'results.xlsx', rows: [] },
    { fileName: 'results.xlsx', rows: [{ candidateNo: '5540001', grade: 'G1', schoolName: 'Example', candidateName: 'Ada' }] },
    { fileName: '', rows: [{ candidateNo: '5540001', grade: 'G1', schoolName: 'Example', candidateName: 'Ada', award: '1ST AWARD' }] },
  ];
  for (const payload of invalid) {
    const response = await app.inject({ method: 'POST', url, payload });
    assert.equal(response.statusCode, 400, response.body);
  }
});

test('Google login callback rejects missing authorization data and mismatched browser state', async () => {
  const missing = await app.inject({ method: 'GET', url: '/api/auth/google/callback' });
  assert.equal(missing.statusCode, 400);
  const cancelled = await app.inject({ method: 'GET', url: '/api/auth/google/callback?error=access_denied' });
  assert.equal(cancelled.statusCode, 400);
  const mismatched = await app.inject({ method: 'GET', url: '/api/auth/google/callback?code=code&state=state' });
  assert.equal(mismatched.statusCode, 400);
  assert.match(mismatched.json().error, /state mismatch/);
});
