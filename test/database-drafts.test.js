import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import test from 'node:test';
import { getPool } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createIndividualDraft, createSchoolDraft, getPublicApplicationForEdit, getSlipReplacementStatus, listAllApplications, listMyApplications, reviewApplication, searchPublicApplicationStatuses, updateAdminApplication, updateOwnedApplicationProfile, updatePublicApplicationProfile, uploadCertificatePhoto } from '../server/applications.js';
import { loadCatalog } from '../server/catalog.js';
import { app } from '../server/index.js';
import { decryptQueuedEmailText, enqueueIntegrationJob, retryIntegrationJob } from '../server/integrationQueue.js';
import { processIntegrationJob } from '../server/integrationWorker.js';
import { completeGoogleWorkspaceAuthorization, createGoogleWorkspaceAuthorizationUrl, deleteGoogleDriveFile, downloadGoogleDriveFile, googleWorkspaceStatus, initializeGoogleDriveFolders, sendGoogleWorkspaceEmail, syncGoogleWorkspaceSheetItem, uploadGoogleDriveFile, GOOGLE_WORKSPACE_REQUIRED_SCOPES } from '../server/googleWorkspace.js';
import pg from 'pg';
import { applyFinalIds, generateExamNumbers, importFinalIds, importResultRows, listPublishedResults, publishResultBatch, resolveResultImportRow } from '../server/results.js';

const testUrl = process.env.TEST_DATABASE_URL;

if (!testUrl) {
  test('database workflow tests require TEST_DATABASE_URL', { skip: 'Use a disposable local PostgreSQL database' }, () => {});
} else {
  const parsed = new URL(testUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname) || !parsed.pathname.toLowerCase().includes('test')) {
    throw new Error('TEST_DATABASE_URL must point to a local database with "test" in its name');
  }
  if (process.env.DATABASE_URL && process.env.DATABASE_URL !== testUrl) {
    throw new Error('DATABASE_URL must match TEST_DATABASE_URL for database workflow tests');
  }
  process.env.DATABASE_URL = testUrl;

  const runId = randomUUID().slice(0, 8);
  let ownerId;
  let adminId;
  let gradeId;
  let publishedHeat;

  app.log.level = 'silent';

  test.before(async () => {
    await seed();
    const owner = await getPool().query(`INSERT INTO users(google_sub,email,display_name,is_admin)
      VALUES($1,$2,'Test Coordinator',false) RETURNING id`, [`test-${runId}`, `coordinator-${runId}@example.test`]);
    ownerId = owner.rows[0].id;
    const adminEmail = `admin-${runId}@example.test`;
    const admin = await getPool().query(`INSERT INTO users(google_sub,email,display_name,is_admin)
      VALUES($1,$2,'Test Admin',true) RETURNING id`, [`test-admin-${runId}`, adminEmail]);
    adminId = admin.rows[0].id;
    process.env.ADMIN_EMAILS = adminEmail;
    const grade = await getPool().query("SELECT id FROM grade_catalog WHERE label='Primary 1' LIMIT 1");
    gradeId = grade.rows[0].id;
    await getPool().query(`UPDATE exam_rounds SET open_date=(now() AT TIME ZONE 'Asia/Bangkok')::date - 1,
      close_date=(now() AT TIME ZONE 'Asia/Bangkok')::date + 1, active=true,
      final_manually_closed=false WHERE id='bbb-heat-2569'`);
  });

  test.after(async () => { await app.close(); await getPool().end(); });

  function candidate(suffix = 'One', roundId = 'bbb-heat-2569') {
    return {
      applicant: {
        firstNameEn: `Test${runId}${suffix}`, lastNameEn: 'Candidate', dateOfBirth: '2017-01-01',
        schoolName: 'Test School', contactEmail: `${suffix.toLowerCase()}-${runId}@example.test`,
        contactPhone: '0812345678',
      },
      items: [{ roundId, gradeId, format: 'paper', centerId: 'center-554' }],
      pastPaperIds: ['bbb-2026'],
    };
  }

  async function sessionFor(userId) {
    const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    const digest = createHash('sha256').update(token).digest('hex');
    await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [digest, userId]);
    return `ocec_session=${token}`;
  }

  test('seeded Heat round is shown as open in the catalog during its registration window', async () => {
    const catalog = await loadCatalog();
    const heat = catalog.exams.find(({ id }) => id === 'bbb-heat-2569');
    assert.ok(heat);
    assert.equal(heat.isOpen, true);
    assert.ok(heat.gradeOptions.includes('Primary 1'));
    assert.ok(heat.centerIds.includes('center-554'));
  });

  test('a logged-in non-admin is forbidden while configured admin can read admin results', async () => {
    const userCookie = await sessionFor(ownerId);
    const adminCookie = await sessionFor(adminId);
    const forbidden = await app.inject({ method: 'GET', url: '/api/admin/results', headers: { cookie: userCookie } });
    assert.equal(forbidden.statusCode, 403);
    const permitted = await app.inject({ method: 'GET', url: '/api/admin/results', headers: { cookie: adminCookie } });
    assert.equal(permitted.statusCode, 200, permitted.body);
  });

  test('Google login start stores a short-lived PKCE attempt and confines the return path to this site', async () => {
    const prior = Object.fromEntries(['APP_ORIGIN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REDIRECT_URI', 'GOOGLE_OAUTH_MODE']
      .map((key) => [key, process.env[key]]));
    Object.assign(process.env, {
      APP_ORIGIN: 'https://portal.example.test', GOOGLE_CLIENT_ID: 'test-client',
      GOOGLE_CLIENT_SECRET: 'test-secret', GOOGLE_REDIRECT_URI: 'https://portal.example.test/api/auth/google/callback',
    });
    delete process.env.GOOGLE_OAUTH_MODE;
    try {
      const response = await app.inject({ method: 'GET', url: '/api/auth/google/start?returnTo=https%3A%2F%2Fevil.example%2F' });
      assert.equal(response.statusCode, 302, response.body);
      const destination = new URL(response.headers.location);
      assert.equal(destination.hostname, 'accounts.google.com');
      assert.equal(destination.searchParams.get('code_challenge_method'), 'S256');
      assert.equal(destination.searchParams.get('redirect_uri'), process.env.GOOGLE_REDIRECT_URI);
      const browserState = response.headers['set-cookie'];
      assert.match(browserState, /ocec_oauth_state=/);
      assert.match(browserState, /HttpOnly/);
      assert.match(browserState, /SameSite=Lax/);
      assert.match(browserState, /Secure/);
      const state = browserState.match(/ocec_oauth_state=([^;]+)/)?.[1];
      const attempt = await getPool().query('SELECT return_path,code_verifier,expires_at FROM oauth_attempts WHERE state_hash=$1', [createHash('sha256').update(state).digest('hex')]);
      assert.equal(attempt.rows[0].return_path, '/');
      assert.ok(attempt.rows[0].code_verifier);
      const lifetime = new Date(attempt.rows[0].expires_at).getTime() - Date.now();
      assert.ok(lifetime > 9 * 60 * 1000 && lifetime <= 10 * 60 * 1000);
    } finally {
      for (const [key, value] of Object.entries(prior)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  test('logout revokes the database session and clears the browser cookie', async () => {
    const cookie = await sessionFor(ownerId);
    const before = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    assert.equal(before.json().user.id, ownerId);
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie } });
    assert.equal(logout.statusCode, 200);
    assert.match(logout.headers['set-cookie'], /Max-Age=0/);
    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { cookie } });
    assert.equal(after.json().user, null);
  });

  test('mock Google Workspace OAuth, Drive, and Gmail keep credentials private and use expected requests', async () => {
    const existing = await getPool().query('SELECT account_email FROM google_workspace_connection WHERE singleton=true');
    assert.equal(existing.rowCount, 0, 'provider mock requires an unconnected disposable database');
    const keys = ['GOOGLE_INTEGRATION_CLIENT_ID', 'GOOGLE_INTEGRATION_CLIENT_SECRET', 'GOOGLE_INTEGRATION_REDIRECT_URI', 'GOOGLE_INTEGRATION_ENCRYPTION_KEY'];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const originalFetch = globalThis.fetch;
    const testEmail = `workspace-${runId}@example.test`;
    const requests = [];
    let nextFolder = 1;
    Object.assign(process.env, {
      GOOGLE_INTEGRATION_CLIENT_ID: 'mock-workspace-client',
      GOOGLE_INTEGRATION_CLIENT_SECRET: 'mock-workspace-secret',
      GOOGLE_INTEGRATION_REDIRECT_URI: 'https://portal.example.test/api/admin/google-workspace/callback',
      GOOGLE_INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    });
    globalThis.fetch = async (url, options = {}) => {
      const target = new URL(url);
      requests.push({ url: target.toString(), method: options.method || 'GET', body: options.body });
      if (target.hostname === 'oauth2.googleapis.com') return Response.json({
        access_token: 'mock-access-token', refresh_token: 'mock-refresh-token', expires_in: 3600,
        scope: GOOGLE_WORKSPACE_REQUIRED_SCOPES.join(' '),
      });
      if (target.hostname === 'openidconnect.googleapis.com') return Response.json({ email: testEmail, email_verified: true });
      if (target.pathname === '/drive/v3/files' && options.method === 'POST') return Response.json({ id: `mock-folder-${nextFolder++}`, ...JSON.parse(options.body) });
      if (target.pathname === '/drive/v3/files') return Response.json({ files: [] });
      if (target.pathname === '/upload/drive/v3/files' && options.method === 'POST') return Response.json({ id: 'mock-slip-file', name: 'slip.png', mimeType: 'image/png' });
      if (target.pathname === '/drive/v3/files/mock-slip-file' && target.searchParams.get('alt') === 'media') return new Response(Buffer.from('mock slip bytes'));
      if (target.pathname === '/drive/v3/files/mock-slip-file' && options.method === 'DELETE') return new Response(null, { status: 204 });
      if (target.pathname === '/gmail/v1/users/me/messages/send') return Response.json({ id: 'mock-message' });
      throw new Error(`Unexpected mock Google request: ${options.method || 'GET'} ${target.pathname}`);
    };
    try {
      const authUrl = new URL(await createGoogleWorkspaceAuthorizationUrl(adminId));
      assert.equal(authUrl.hostname, 'accounts.google.com');
      assert.equal(authUrl.searchParams.get('access_type'), 'offline');
      for (const scope of GOOGLE_WORKSPACE_REQUIRED_SCOPES) assert.ok(authUrl.searchParams.get('scope').includes(scope));
      await assert.rejects(completeGoogleWorkspaceAuthorization(adminId, 'code', 'wrong-state'), /expired or does not match/);
      const connection = await completeGoogleWorkspaceAuthorization(adminId, 'mock-code', authUrl.searchParams.get('state'));
      assert.equal(connection.email, testEmail);
      await assert.rejects(completeGoogleWorkspaceAuthorization(adminId, 'mock-code', authUrl.searchParams.get('state')), /expired or does not match/);
      const stored = await getPool().query('SELECT account_email,encrypted_refresh_token,granted_scopes FROM google_workspace_connection WHERE singleton=true');
      assert.equal(stored.rows[0].account_email, testEmail);
      assert.ok(!stored.rows[0].encrypted_refresh_token.includes('mock-refresh-token'));
      assert.deepEqual(stored.rows[0].granted_scopes, GOOGLE_WORKSPACE_REQUIRED_SCOPES);
      assert.equal((await googleWorkspaceStatus()).missingScopes.length, 0);
      const folders = await initializeGoogleDriveFolders();
      assert.equal(folders.root.name, 'OCEC Portal');
      assert.equal(folders.slips.name, 'Payment Slips');
      const uploaded = await uploadGoogleDriveFile({ category: 'slips', folders: ['BBB - HEAT ROUND 2569'],
        name: 'slip.png', mimeType: 'image/png', buffer: Buffer.from('mock slip bytes') });
      assert.equal(uploaded.id, 'mock-slip-file');
      assert.deepEqual(await downloadGoogleDriveFile(uploaded.id), Buffer.from('mock slip bytes'));
      await deleteGoogleDriveFile(uploaded.id);
      await assert.rejects(uploadGoogleDriveFile({ category: 'slips', name: '../escape.png', mimeType: 'image/png', buffer: Buffer.from('x') }), /unsupported characters/);
      await assert.rejects(sendGoogleWorkspaceEmail({ to: 'bad\r\nBcc: outside@example.test', subject: 'Test', text: 'Hello' }), /valid recipient/);
      const sent = await sendGoogleWorkspaceEmail({ to: testEmail, subject: 'ทดสอบ OCEC', text: 'ข้อความทดสอบ', messageId: `test-${runId}@portal` });
      assert.equal(sent.id, 'mock-message');
      const mailRequest = requests.find(({ url }) => url.includes('/gmail/v1/users/me/messages/send'));
      const raw = Buffer.from(JSON.parse(mailRequest.body).raw, 'base64url').toString('utf8');
      assert.match(raw, new RegExp(`To: ${testEmail}`));
      assert.match(raw, new RegExp(`Message-ID: <test-${runId}@portal>`));
      assert.ok(requests.every(({ url }) => new URL(url).hostname.endsWith('googleapis.com')));
    } finally {
      globalThis.fetch = originalFetch;
      await getPool().query('DELETE FROM google_workspace_connection WHERE account_email=$1', [testEmail]);
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  test('integration outbox deduplicates pending work and admin retry requeues a failed job', async () => {
    const key = `test-sync-${runId}`;
    const firstId = await enqueueIntegrationJob(getPool(), 'sheets.sync_item', { applicationItemId: 'first' }, key);
    const secondId = await enqueueIntegrationJob(getPool(), 'sheets.sync_item', { applicationItemId: 'updated' }, key);
    assert.equal(secondId, firstId);
    const pending = await getPool().query('SELECT status,payload FROM integration_jobs WHERE id=$1', [firstId]);
    assert.equal(pending.rows[0].status, 'pending');
    assert.equal(pending.rows[0].payload.applicationItemId, 'updated');

    await getPool().query("UPDATE integration_jobs SET status='failed',attempts=8,last_error='Provider unavailable' WHERE id=$1", [firstId]);
    const retried = await retryIntegrationJob(firstId, adminId);
    assert.equal(retried.status, 'pending');
    const updated = await getPool().query('SELECT attempts,last_error FROM integration_jobs WHERE id=$1', [firstId]);
    assert.equal(updated.rows[0].attempts, 0);
    assert.equal(updated.rows[0].last_error, null);
    const audit = await getPool().query("SELECT count(*)::integer AS n FROM audit_logs WHERE entity_type='integration_job' AND entity_id=$1 AND action='retry' AND actor_user_id=$2", [String(firstId), adminId]);
    assert.equal(audit.rows[0].n, 1);
    assert.equal(await retryIntegrationJob(firstId, adminId), null, 'pending jobs cannot be manually retried again');
  });

  test('integration worker backs off failed jobs and stops automatically after eight attempts', async () => {
    const id = await enqueueIntegrationJob(getPool(), `test.unsupported.${runId}`, {}, `test-unsupported-${runId}`);
    assert.equal(await processIntegrationJob(), true);
    const first = await getPool().query('SELECT status,attempts,last_error,next_attempt_at FROM integration_jobs WHERE id=$1', [id]);
    assert.equal(first.rows[0].status, 'failed');
    assert.equal(first.rows[0].attempts, 1);
    assert.match(first.rows[0].last_error, /Unsupported integration job/);
    let waitSeconds = (new Date(first.rows[0].next_attempt_at).getTime() - Date.now()) / 1000;
    assert.ok(waitSeconds > 25 && waitSeconds <= 30);
    await getPool().query("UPDATE integration_jobs SET attempts=7,next_attempt_at=now()-interval '1 second' WHERE id=$1", [id]);
    assert.equal(await processIntegrationJob(), true);
    const exhausted = await getPool().query('SELECT status,attempts,next_attempt_at FROM integration_jobs WHERE id=$1', [id]);
    assert.equal(exhausted.rows[0].status, 'failed');
    assert.equal(exhausted.rows[0].attempts, 8);
    waitSeconds = (new Date(exhausted.rows[0].next_attempt_at).getTime() - Date.now()) / 1000;
    assert.ok(waitSeconds > 7195 && waitSeconds <= 7200);
    assert.equal(await processIntegrationJob(), false, 'exhausted jobs are not reclaimed automatically');
  });

  test('registration accepts an open round when PostgreSQL returns native date values', async () => {
    try {
      const draft = await createIndividualDraft(candidate('NativeDate'), ownerId);
      assert.ok(draft.id);
    } finally {
      // Keep downstream workflow checks useful while the native-date regression is red.
      pg.types.setTypeParser(1082, (value) => value);
    }
  });

  test('mock Google Sheets inserts one approved item and updates the same row after a web edit', async () => {
    const existing = await getPool().query('SELECT account_email FROM google_workspace_connection WHERE singleton=true');
    assert.equal(existing.rowCount, 0, 'Sheets mock requires an unconnected disposable database');
    const roundId = `bbb-sheets-test-${runId}`;
    const year = `test-${runId}`;
    await getPool().query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,edit_close_date,
      is_open,paper_price_satang,online_price_satang)
      VALUES($1,'bbb','BBB Sheets Test',$2,'HEAT',(now() AT TIME ZONE 'Asia/Bangkok')::date-1,
      (now() AT TIME ZONE 'Asia/Bangkok')::date+1,(now() AT TIME ZONE 'Asia/Bangkok')::date+1,true,75500,65500)`, [roundId, year]);
    await getPool().query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [roundId, gradeId]);
    await getPool().query("INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,'center-554')", [roundId]);
    const draft = await createIndividualDraft(candidate('Sheets', roundId), ownerId);
    await getPool().query("UPDATE applications SET status='approved',submitted_at=now(),approved_at=now() WHERE id=$1", [draft.id]);
    const item = await getPool().query('SELECT id FROM application_items WHERE application_id=$1', [draft.id]);

    const keys = ['GOOGLE_INTEGRATION_CLIENT_ID', 'GOOGLE_INTEGRATION_CLIENT_SECRET', 'GOOGLE_INTEGRATION_REDIRECT_URI', 'GOOGLE_INTEGRATION_ENCRYPTION_KEY'];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const originalFetch = globalThis.fetch;
    const testEmail = `sheets-${runId}@example.test`;
    const sheetRows = [];
    const requests = [];
    let folderNumber = 1;
    let sheetsUnavailable = false;
    Object.assign(process.env, {
      GOOGLE_INTEGRATION_CLIENT_ID: 'mock-sheets-client', GOOGLE_INTEGRATION_CLIENT_SECRET: 'mock-sheets-secret',
      GOOGLE_INTEGRATION_REDIRECT_URI: 'https://portal.example.test/api/admin/google-workspace/callback',
      GOOGLE_INTEGRATION_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    });
    globalThis.fetch = async (url, options = {}) => {
      const target = new URL(url);
      const pathname = decodeURIComponent(target.pathname);
      const method = options.method || 'GET';
      requests.push({ pathname, method, body: options.body });
      if (target.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'mock-sheets-access', refresh_token: 'mock-sheets-refresh', expires_in: 3600,
        scope: GOOGLE_WORKSPACE_REQUIRED_SCOPES.join(' ') });
      if (target.hostname === 'openidconnect.googleapis.com') return Response.json({ email: testEmail, email_verified: true });
      if (pathname === '/drive/v3/files' && method === 'POST') return Response.json({ id: `mock-sheets-folder-${folderNumber++}`, ...JSON.parse(options.body) });
      if (pathname === '/drive/v3/files') return Response.json({ files: [] });
      if (pathname === '/v4/spreadsheets' && method === 'POST') {
        const title = JSON.parse(options.body).sheets[0].properties.title;
        return Response.json({ spreadsheetId: `mock-workbook-${runId}`, spreadsheetUrl: `https://sheets.google.test/${runId}`,
          properties: { title: `OCEC Applications ${year}` }, sheets: [{ properties: { sheetId: 7, title } }] });
      }
      if (pathname === `/drive/v3/files/mock-workbook-${runId}` && method === 'GET') return Response.json({ id: `mock-workbook-${runId}`, parents: [] });
      if (pathname === `/drive/v3/files/mock-workbook-${runId}` && method === 'PATCH') return Response.json({ id: `mock-workbook-${runId}` });
      if (pathname.includes('/values/') && method === 'GET' && pathname.includes('!A1:')) return Response.json({ values: [] });
      if (pathname.includes('/values/') && method === 'GET' && pathname.includes('!A2:A')) return Response.json({ values: sheetRows.map((row) => [row[0]]) });
      if (pathname.includes('/values/') && method === 'PUT' && pathname.includes('!A1:')) return Response.json({ updatedRows: 1 });
      if (pathname.endsWith(':append') && method === 'POST') {
        sheetRows.push(JSON.parse(options.body).values[0]);
        return Response.json({ updates: { updatedRange: `'BBB - Heat ${year}'!A${sheetRows.length + 1}:AK${sheetRows.length + 1}` } });
      }
      if (pathname.includes('/values/') && method === 'PUT' && pathname.includes('!A2:')) {
        if (sheetsUnavailable) return new Response(null, { status: 503 });
        sheetRows[0] = JSON.parse(options.body).values[0];
        return Response.json({ updatedRows: 1 });
      }
      throw new Error(`Unexpected mock Sheets request: ${method} ${pathname}`);
    };
    try {
      const url = new URL(await createGoogleWorkspaceAuthorizationUrl(adminId));
      await completeGoogleWorkspaceAuthorization(adminId, 'mock-code', url.searchParams.get('state'));
      const inserted = await syncGoogleWorkspaceSheetItem(item.rows[0].id);
      assert.equal(inserted.outcome, 'inserted');
      assert.equal(sheetRows.length, 1);
      assert.equal(sheetRows[0][0], item.rows[0].id);
      await getPool().query("UPDATE applicants SET school_name='Updated Test School' WHERE id=(SELECT applicant_id FROM applications WHERE id=$1)", [draft.id]);
      const updated = await syncGoogleWorkspaceSheetItem(item.rows[0].id);
      assert.equal(updated.outcome, 'updated');
      assert.equal(sheetRows.length, 1, 'web edits update the existing Google row');
      assert.ok(sheetRows[0].includes('Updated Test School'));
      const mapping = await getPool().query('SELECT spreadsheet_row FROM google_workspace_sheet_rows WHERE application_item_id=$1', [item.rows[0].id]);
      assert.equal(mapping.rows[0].spreadsheet_row, 2);
      assert.equal(requests.filter(({ pathname }) => pathname.endsWith(':append')).length, 1);
      await getPool().query("UPDATE applicants SET school_name='Outage Test School' WHERE id=(SELECT applicant_id FROM applications WHERE id=$1)", [draft.id]);
      sheetsUnavailable = true;
      await assert.rejects(syncGoogleWorkspaceSheetItem(item.rows[0].id), (error) => error.statusCode === 502);
      assert.equal(sheetRows.length, 1);
      assert.ok(!sheetRows[0].includes('Outage Test School'));
      const webData = await getPool().query('SELECT school_name FROM applicants WHERE id=(SELECT applicant_id FROM applications WHERE id=$1)', [draft.id]);
      assert.equal(webData.rows[0].school_name, 'Outage Test School', 'provider outage cannot roll back the web edit');
      sheetsUnavailable = false;
      assert.equal((await syncGoogleWorkspaceSheetItem(item.rows[0].id)).outcome, 'updated');
      assert.ok(sheetRows[0].includes('Outage Test School'));
    } finally {
      globalThis.fetch = originalFetch;
      await getPool().query('DELETE FROM google_workspace_connection WHERE account_email=$1', [testEmail]);
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  });

  test('internal admin notes are private and editable/deletable with immutable revision history', async () => {
    const draft = await createIndividualDraft(candidate('InternalNote'), ownerId);
    const url = `/api/admin/applications/${draft.id}/notes`;
    const userCookie = await sessionFor(ownerId);
    const adminCookie = await sessionFor(adminId);
    const forbidden = await app.inject({ method: 'POST', url, headers: { cookie: userCookie }, payload: { body: 'ตรวจเอกสารเพิ่ม' } });
    assert.equal(forbidden.statusCode, 403);
    const created = await app.inject({ method: 'POST', url, headers: { cookie: adminCookie }, payload: { body: 'ตรวจเอกสารเพิ่ม' } });
    assert.equal(created.statusCode, 201, created.body);
    const note = created.json().note;
    assert.ok(note.id);
    assert.equal(note.body, 'ตรวจเอกสารเพิ่ม');
    const changed = await app.inject({ method: 'PATCH', url: `${url}/${note.id}`, headers: { cookie: adminCookie }, payload: { body: 'ตรวจเอกสารครบแล้ว' } });
    assert.equal(changed.statusCode, 200, changed.body);
    const removed = await app.inject({ method: 'DELETE', url: `${url}/${note.id}`, headers: { cookie: adminCookie } });
    assert.equal(removed.statusCode, 204, removed.body);
    const history = await app.inject({ method: 'GET', url: `${url}?includeHistory=true`, headers: { cookie: adminCookie } });
    assert.equal(history.statusCode, 200, history.body);
    assert.deepEqual(history.json().history.map(({ action }) => action), ['create', 'edit', 'delete']);
    assert.equal(history.json().history[1].before.body, 'ตรวจเอกสารเพิ่ม');
    assert.equal(history.json().history[1].after.body, 'ตรวจเอกสารครบแล้ว');
    assert.equal(history.json().history[2].before.body, 'ตรวจเอกสารครบแล้ว');
    const privateRead = await app.inject({ method: 'GET', url, headers: { cookie: userCookie } });
    assert.equal(privateRead.statusCode, 403);
    const mine = await listMyApplications(ownerId, `coordinator-${runId}@example.test`);
    assert.ok(!JSON.stringify(mine).includes('ตรวจเอกสาร'));
  });

  test('individual draft stores price and catalog snapshots without a payment', async () => {
    const draft = await createIndividualDraft(candidate('Individual'), ownerId);
    assert.ok(draft.id);
    assert.equal(draft.total, 1005);
    const result = await getPool().query(`SELECT a.status,a.registration_total_satang,a.paper_total_satang,
      ai.fee_satang,ai.snapshot,p.id AS payment_id
      FROM applications a JOIN application_items ai ON ai.application_id=a.id
      LEFT JOIN payments p ON p.application_id=a.id WHERE a.id=$1`, [draft.id]);
    assert.equal(result.rows.length, 1);
    assert.equal(result.rows[0].status, 'draft');
    assert.equal(result.rows[0].registration_total_satang, 75500);
    assert.equal(result.rows[0].paper_total_satang, 25000);
    assert.equal(result.rows[0].fee_satang, 75500);
    assert.equal(result.rows[0].snapshot.center.code, '554');
    assert.equal(result.rows[0].payment_id, null);
  });

  test('same applicant and exam round cannot create a duplicate draft', async () => {
    const input = candidate('Duplicate');
    const first = await createIndividualDraft(input, ownerId);
    await assert.rejects(createIndividualDraft(input, ownerId), (error) => {
      assert.equal(error.statusCode, 409);
      assert.equal(error.existingApplicationId, first.id);
      return true;
    });
    const count = await getPool().query('SELECT count(*)::integer AS n FROM applications WHERE id=$1', [first.id]);
    assert.equal(count.rows[0].n, 1);
  });

  test('admin cannot add a competition to an application after its registration round is closed', async () => {
    const before = await getPool().query('SELECT final_manually_closed,is_open FROM exam_rounds WHERE id=$1', ['hkico-heat-2569']);
    try {
      await getPool().query('UPDATE exam_rounds SET final_manually_closed=true,is_open=false WHERE id=$1', ['hkico-heat-2569']);
      const draft = await createIndividualDraft(candidate('ClosedRound'), ownerId);
      const currentItem = await getPool().query(`SELECT id,exam_round_id,grade_id,center_id FROM application_items WHERE application_id=$1`, [draft.id]);
      const closedGrade = await getPool().query("SELECT id FROM grade_catalog WHERE label='Primary 2 — Scratch'");
      await assert.rejects(updateAdminApplication(draft.id, {
        profile: { firstNameEn: `Test${runId}ClosedRound`, lastNameEn: 'Candidate', schoolName: 'Test School',
          contactEmail: `closedround-${runId}@example.test`, contactPhone: '0812345678', address: {} },
        items: [
          { applicationItemId: currentItem.rows[0].id, roundId: currentItem.rows[0].exam_round_id,
            gradeId: currentItem.rows[0].grade_id, centerId: currentItem.rows[0].center_id, format: 'paper' },
          { roundId: 'hkico-heat-2569', gradeId: closedGrade.rows[0].id, centerId: 'center-554', format: 'paper' },
        ],
      }, adminId), (error) => error.statusCode === 409 && /ปิดรับสมัครแล้ว/.test(error.message));
    } finally {
      if (before.rowCount) await getPool().query('UPDATE exam_rounds SET final_manually_closed=$1,is_open=$2 WHERE id=$3',
        [before.rows[0].final_manually_closed, before.rows[0].is_open, 'hkico-heat-2569']);
    }
  });

  test('public status search hides drafts, verifies edits, and shows rejected reason', async () => {
    const hidden = candidate('Hidden');
    await createIndividualDraft(hidden, ownerId);
    assert.deepEqual(await searchPublicApplicationStatuses(hidden.applicant.firstNameEn), []);

    const visible = candidate('Visible');
    const draft = await createIndividualDraft(visible, ownerId);
    await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE id=$1", [draft.id]);
    const matches = await searchPublicApplicationStatuses(visible.applicant.firstNameEn);
    assert.equal(matches.length, 1);
    assert.equal(matches[0].status, 'pending');
    assert.match(matches[0].candidate, /Candidate/);
    await assert.rejects(getPublicApplicationForEdit(`${visible.applicant.firstNameEn} Candidate`, '0000'), (error) => error.statusCode === 403);
    const permitted = await getPublicApplicationForEdit(`${visible.applicant.firstNameEn} Candidate`, '5678');
    assert.equal(permitted.id, draft.id);
    assert.equal(permitted.canEdit, false, 'pending applicant can view but cannot edit');
    await getPool().query("UPDATE applications SET status='approved' WHERE id=$1", [draft.id]);
    assert.equal((await searchPublicApplicationStatuses(visible.applicant.firstNameEn))[0].status, 'confirmed');
    await getPool().query("UPDATE applications SET status='rejected',review_note='ข้อมูลใบสมัครไม่ครบ' WHERE id=$1", [draft.id]);
    const rejected = (await searchPublicApplicationStatuses(visible.applicant.firstNameEn))[0];
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.reason, 'ข้อมูลใบสมัครไม่ครบ');
  });

  test('admin rejection stores a short reason and queues an email to the applicant', async () => {
    process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');
    const input = candidate('RejectedMail');
    const draft = await createIndividualDraft(input, ownerId);
    await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE id=$1", [draft.id]);
    const payment = await getPool().query('INSERT INTO payments(application_id,expected_satang) VALUES($1,$2) RETURNING id', [draft.id, 100500]);
    await getPool().query("INSERT INTO payment_slips(payment_id,file_name,mime_type) VALUES($1,'slip.png','image/png')", [payment.rows[0].id]);
    const reason = 'ข้อมูลใบสมัครไม่ครบ';
    const response = await app.inject({ method: 'PATCH', url: `/api/admin/applications/${draft.id}/review`,
      headers: { cookie: await sessionFor(adminId) }, payload: { decision: 'reject', reason } });
    assert.equal(response.statusCode, 200, response.body);
    assert.equal(response.json().status, 'rejected');
    const application = await getPool().query('SELECT status,review_note FROM applications WHERE id=$1', [draft.id]);
    assert.equal(application.rows[0].status, 'rejected');
    assert.equal(application.rows[0].review_note, reason);
    const email = await getPool().query("SELECT payload FROM integration_jobs WHERE kind='gmail.send' AND payload->>'to'=$1 ORDER BY id DESC LIMIT 1", [input.applicant.contactEmail]);
    assert.equal(email.rows[0].payload.to, input.applicant.contactEmail);
    const body = email.rows[0].payload.encryptedText
      ? decryptQueuedEmailText(email.rows[0].payload.encryptedText)
      : email.rows[0].payload.text;
    assert.match(body, new RegExp(reason));
  });

  test('reject accepts no reason and still queues a rejection email', async () => {
    const input = candidate('RejectValidation');
    const draft = await createIndividualDraft(input, ownerId);
    await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE id=$1", [draft.id]);
    const cookie = await sessionFor(adminId);
    const tooLong = await app.inject({ method: 'PATCH', url: `/api/admin/applications/${draft.id}/review`, headers: { cookie }, payload: { decision: 'reject', reason: 'x'.repeat(241) } });
    assert.equal(tooLong.statusCode, 400, tooLong.body);
    const response = await app.inject({ method: 'PATCH', url: `/api/admin/applications/${draft.id}/review`, headers: { cookie }, payload: { decision: 'reject' } });
    assert.equal(response.statusCode, 200, response.body);
    const application = await getPool().query('SELECT status,review_note FROM applications WHERE id=$1', [draft.id]);
    assert.equal(application.rows[0].status, 'rejected');
    assert.equal(application.rows[0].review_note, null);
    const messages = await getPool().query("SELECT count(*)::integer AS count FROM integration_jobs WHERE kind='gmail.send' AND payload->>'to'=$1", [input.applicant.contactEmail]);
    assert.equal(messages.rows[0].count, 1);
  });

  test('My Applications returns the owner’s applications and excludes another account’s data', async () => {
    const mine = await createIndividualDraft(candidate('Mine'), ownerId);
    const other = await getPool().query(`INSERT INTO users(google_sub,email,display_name,is_admin)
      VALUES($1,$2,'Another User',false) RETURNING id`, [`test-other-${runId}`, `other-${runId}@example.test`]);
    const theirs = await createIndividualDraft(candidate('Theirs'), other.rows[0].id);
    const owned = await listMyApplications(ownerId, `coordinator-${runId}@example.test`);
    assert.ok(owned.some(({ id }) => id === mine.id));
    assert.ok(!owned.some(({ id }) => id === theirs.id));
  });

  test('school draft totals all applicants while retaining one application per person', async () => {
    const batch = await createSchoolDraft({
      schoolName: 'Test School', source: 'excel',
      applicants: [candidate('SchoolA'), candidate('SchoolB')],
    }, ownerId, `coordinator-${runId}@example.test`);
    assert.equal(batch.applicationIds.length, 2);
    assert.equal(batch.total, 2010);
    const result = await getPool().query('SELECT count(*)::integer AS n FROM applications WHERE school_batch_id=$1', [batch.id]);
    assert.equal(result.rows[0].n, 2);
  });

  test('slip issue creates one link that expires after three days and hides its plaintext token', async () => {
    process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');
    const draft = await createIndividualDraft(candidate('SlipExpiry'), ownerId);
    await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE id=$1", [draft.id]);
    const payment = await getPool().query(`INSERT INTO payments(application_id,expected_satang)
      VALUES($1,$2) RETURNING id`, [draft.id, 100500]);
    const reviewed = await reviewApplication(draft.id, { decision: 'slip_issue', reason: 'ภาพสลิปไม่ชัด' }, adminId);
    assert.equal(reviewed.emailRecipient, 'applicant');
    const tokenRow = await getPool().query(`SELECT token_hash,recipient_email,expires_at,created_at,used_at
      FROM slip_replacement_tokens WHERE payment_id=$1`, [payment.rows[0].id]);
    assert.equal(tokenRow.rows.length, 1);
    assert.equal(tokenRow.rows[0].recipient_email, candidate('SlipExpiry').applicant.contactEmail);
    assert.equal(tokenRow.rows[0].used_at, null);
    const lifetime = new Date(tokenRow.rows[0].expires_at) - new Date(tokenRow.rows[0].created_at);
    const email = await getPool().query(`SELECT payload FROM integration_jobs
      WHERE kind='gmail.send' AND payload->>'to'=$1 ORDER BY id DESC LIMIT 1`, [tokenRow.rows[0].recipient_email]);
    const body = decryptQueuedEmailText(email.rows[0].payload.encryptedText);
    const token = new URL(body.match(/https?:\/\/\S*slip-replacement\?token=\S+/)?.[0]).searchParams.get('token');
    assert.equal(createHash('sha256').update(token).digest('hex'), tokenRow.rows[0].token_hash);
    assert.equal((await getSlipReplacementStatus(token)).valid, true);
    await getPool().query("UPDATE slip_replacement_tokens SET expires_at=now()-interval '1 second' WHERE token_hash=$1", [tokenRow.rows[0].token_hash]);
    await assert.rejects(getSlipReplacementStatus(token), (error) => error.statusCode === 410);
    await getPool().query("UPDATE slip_replacement_tokens SET expires_at=now()+interval '1 day',used_at=now() WHERE token_hash=$1", [tokenRow.rows[0].token_hash]);
    await assert.rejects(getSlipReplacementStatus(token), (error) => error.statusCode === 410);
    assert.ok(Math.abs(lifetime - 3 * 24 * 60 * 60 * 1000) < 5000, `expected a three-day link, got ${lifetime} ms`);
  });

  test('shared school slip issue sends one replacement link only to the coordinator', async () => {
    process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY ||= randomBytes(32).toString('base64');
    const coordinatorEmail = `coordinator-${runId}@example.test`;
    const batch = await createSchoolDraft({
      schoolName: 'Test School', source: 'excel',
      applicants: [candidate('SlipSchoolA'), candidate('SlipSchoolB')],
    }, ownerId, coordinatorEmail);
    await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE school_batch_id=$1", [batch.id]);
    const payment = await getPool().query(`INSERT INTO payments(school_batch_id,expected_satang)
      VALUES($1,$2) RETURNING id`, [batch.id, 201000]);
    const reviewed = await reviewApplication(batch.applicationIds[0], { decision: 'slip_issue', reason: 'ภาพสลิปไม่ชัด' }, adminId);
    assert.equal(reviewed.emailRecipient, 'coordinator');
    const token = await getPool().query('SELECT recipient_email FROM slip_replacement_tokens WHERE payment_id=$1', [payment.rows[0].id]);
    assert.deepEqual(token.rows.map((row) => row.recipient_email), [coordinatorEmail]);
    const email = await getPool().query("SELECT payload->>'to' AS recipient FROM integration_jobs WHERE kind='gmail.send' AND dedupe_key LIKE $1", [`slip-replacement:${payment.rows[0].id}:%`]);
    assert.deepEqual(email.rows.map((row) => row.recipient), [coordinatorEmail]);
    const statuses = await getPool().query('SELECT status FROM applications WHERE school_batch_id=$1', [batch.id]);
    assert.ok(statuses.rows.every((row) => row.status === 'slip_issue'));
  });

  test('invalid school batch rolls back previously inserted applicants and batch', async () => {
    const valid = candidate('RollbackA');
    const wrongSchool = candidate('RollbackB');
    wrongSchool.applicant.schoolName = 'Different School';
    const before = await getPool().query('SELECT count(*)::integer AS n FROM school_batches WHERE coordinator_user_id=$1', [ownerId]);
    await assert.rejects(createSchoolDraft({
      schoolName: 'Test School', source: 'excel', applicants: [valid, wrongSchool],
    }, ownerId, `coordinator-${runId}@example.test`), /School name must be the same/);
    const after = await getPool().query('SELECT count(*)::integer AS n FROM school_batches WHERE coordinator_user_id=$1', [ownerId]);
    assert.equal(after.rows[0].n, before.rows[0].n);
    const applicant = await getPool().query('SELECT count(*)::integer AS n FROM applicants WHERE first_name_en=$1', [valid.applicant.firstNameEn]);
    assert.equal(applicant.rows[0].n, 0);
  });

  test('approved owner can edit profile with audit and Sheets job; pending and other owners cannot', async () => {
    const input = candidate('Profile');
    const draft = await createIndividualDraft(input, ownerId);
    const profile = {
      firstNameEn: `Updated${runId}`, middleNameEn: '', lastNameEn: 'Candidate', schoolName: 'Test School',
      contactEmail: `updated-${runId}@example.test`, contactPhone: '0812345678', address: { city: 'Bangkok' },
    };
    await assert.rejects(updateOwnedApplicationProfile(draft.id, profile, ownerId), (error) => error.statusCode === 409);
    await getPool().query("UPDATE applications SET status='approved',approved_at=now() WHERE id=$1", [draft.id]);
    await getPool().query("UPDATE exam_rounds SET edit_close_date=(now() AT TIME ZONE 'Asia/Bangkok')::date + 1 WHERE id='bbb-heat-2569'");
    await assert.rejects(updateOwnedApplicationProfile(draft.id, profile, adminId), (error) => error.statusCode === 403);
    const updated = await updateOwnedApplicationProfile(draft.id, profile, ownerId);
    assert.equal(updated.status, 'approved');
    const row = await getPool().query(`SELECT a.status,a.version,ap.first_name_en,ap.contact_email,ai.snapshot
      FROM applications a JOIN applicants ap ON ap.id=a.applicant_id
      JOIN application_items ai ON ai.application_id=a.id WHERE a.id=$1`, [draft.id]);
    assert.equal(row.rows[0].status, 'approved');
    assert.equal(row.rows[0].first_name_en, `Updated${runId}`);
    assert.equal(row.rows[0].contact_email, profile.contactEmail);
    assert.equal(row.rows[0].snapshot.center.code, '554', 'locked exam choice remains unchanged');
    assert.ok(row.rows[0].version > 1);
    const audit = await getPool().query("SELECT count(*)::integer AS n FROM audit_logs WHERE entity_type='application' AND entity_id=$1 AND action='edit_profile'", [draft.id]);
    assert.equal(audit.rows[0].n, 1);
    const adminView = (await listAllApplications()).find(({ id }) => id === draft.id);
    assert.ok(adminView.changeHistory.some(({ changes }) => changes.some(({ label }) => label === 'ชื่อภาษาอังกฤษ')));
    const jobs = await getPool().query("SELECT count(*)::integer AS n FROM integration_jobs WHERE kind='sheets.sync_item' AND payload->>'applicationItemId' IN (SELECT id::text FROM application_items WHERE application_id=$1)", [draft.id]);
    assert.equal(jobs.rows[0].n, 1);

    await getPool().query("UPDATE exam_rounds SET edit_close_date=(now() AT TIME ZONE 'Asia/Bangkok')::date - 1 WHERE id='bbb-heat-2569'");
    await assert.rejects(updateOwnedApplicationProfile(draft.id, profile, ownerId), (error) => error.statusCode === 409);
  });

  test('public profile edit requires verified name and last four digits and records a public audit', async () => {
    const original = candidate('PublicEdit');
    const draft = await createIndividualDraft(original, ownerId);
    await getPool().query("UPDATE applications SET status='approved',approved_at=now() WHERE id=$1", [draft.id]);
    await getPool().query("UPDATE exam_rounds SET edit_close_date=(now() AT TIME ZONE 'Asia/Bangkok')::date + 1 WHERE id='bbb-heat-2569'");
    const profile = {
      firstNameEn: original.applicant.firstNameEn, middleNameEn: 'Middle', lastNameEn: 'Candidate',
      schoolName: 'Test School', contactEmail: `public-${runId}@example.test`,
      contactPhone: '0812345678', address: {},
    };
    const identity = { candidateName: `${original.applicant.firstNameEn} Candidate`, phoneLast4: '5678' };
    await assert.rejects(updatePublicApplicationProfile(draft.id, profile, { ...identity, phoneLast4: '0000' }), (error) => error.statusCode === 403);
    const updated = await updatePublicApplicationProfile(draft.id, profile, identity);
    assert.equal(updated.status, 'approved');
    const audit = await getPool().query("SELECT count(*)::integer AS n FROM audit_logs WHERE entity_type='application' AND entity_id=$1 AND action='edit_profile_public'", [draft.id]);
    assert.equal(audit.rows[0].n, 1);
    const current = await getPublicApplicationForEdit(`${original.applicant.firstNameEn} Middle Candidate`, '5678');
    assert.equal(current.id, draft.id);
    assert.equal(current.contactEmail, profile.contactEmail);
  });

  test('certificate photo upload checks file signature, ownership, approval, exam number, and deadline before Drive', async () => {
    const draft = await createIndividualDraft(candidate('Photo'), ownerId);
    const photo = { fileName: 'portrait.png', mimeType: 'image/png', dataBase64: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]).toString('base64') };
    await assert.rejects(uploadCertificatePhoto(draft.id, { ...photo, dataBase64: Buffer.from('not a PNG').toString('base64') }, ownerId, ''), (error) => error.statusCode === 400);
    await assert.rejects(uploadCertificatePhoto(draft.id, photo, adminId, ''), (error) => error.statusCode === 403);
    await assert.rejects(uploadCertificatePhoto(draft.id, photo, ownerId, ''), (error) => error.statusCode === 409);
    await getPool().query("UPDATE applications SET status='approved',approved_at=now() WHERE id=$1", [draft.id]);
    await getPool().query("UPDATE exam_rounds SET edit_close_date=(now() AT TIME ZONE 'Asia/Bangkok')::date + 1 WHERE id='bbb-heat-2569'");
    await assert.rejects(uploadCertificatePhoto(draft.id, photo, ownerId, ''), (error) => error.statusCode === 409);
    await getPool().query('UPDATE application_items SET exam_number=$2 WHERE application_id=$1', [draft.id, `PHOTO-${runId}`]);
    await getPool().query("UPDATE exam_rounds SET edit_close_date=(now() AT TIME ZONE 'Asia/Bangkok')::date - 1 WHERE id='bbb-heat-2569'");
    await assert.rejects(uploadCertificatePhoto(draft.id, photo, ownerId, ''), (error) => error.statusCode === 409);
  });

  test('result draft flags mismatches, blocks publication, resolves conflict, then locks published results', async () => {
    const roundId = `bbb-heat-test-${runId}`;
    const finalRoundId = `bbb-final-flow-${runId}`;
    await getPool().query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,edit_close_date,
      is_open,paper_price_satang,online_price_satang)
      VALUES($1,'bbb','BBB Test','2569','HEAT',(now() AT TIME ZONE 'Asia/Bangkok')::date-1,
      (now() AT TIME ZONE 'Asia/Bangkok')::date+1,(now() AT TIME ZONE 'Asia/Bangkok')::date+1,true,75500,65500)`, [roundId]);
    await getPool().query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [roundId, gradeId]);
    await getPool().query("INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,'center-554')", [roundId]);
    await getPool().query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,edit_close_date,
      is_open,paper_price_satang,online_price_satang)
      VALUES($1,'bbb','BBB Final Flow','2569','FINAL',(now() AT TIME ZONE 'Asia/Bangkok')::date-1,
      (now() AT TIME ZONE 'Asia/Bangkok')::date+1,(now() AT TIME ZONE 'Asia/Bangkok')::date+1,false,75500,65500)`, [finalRoundId]);
    await getPool().query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [finalRoundId, gradeId]);
    await getPool().query("INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,'center-554')", [finalRoundId]);
    const input = candidate('Result', roundId);
    const application = await createIndividualDraft(input, ownerId);
    await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE id=$1", [application.id]);
    const item = await getPool().query("UPDATE application_items SET exam_number='5549001' WHERE application_id=$1 RETURNING id", [application.id]);
    const rows = [{
      candidateNo: '5549001', grade: 'Primary 1', schoolName: 'Wrong School',
      candidateName: `${input.applicant.firstNameEn} Candidate`, award: '1ST AWARD',
    }];
    const imported = await importResultRows(roundId, 'results.xlsx', rows, adminId);
    assert.equal(imported.rows[0].matchStatus, 'data_mismatch');
    await assert.rejects(publishResultBatch(roundId, adminId), (error) => error.statusCode === 409);
    const resolved = await resolveResultImportRow(imported.rows[0].id, 'use_application', item.rows[0].id, adminId);
    assert.equal(resolved.rows[0].matchStatus, 'matched');
    assert.equal(resolved.rows[0].schoolName, 'Test School');
    const published = await publishResultBatch(roundId, adminId);
    assert.equal(published.published, true);
    assert.equal(published.eligibleForFinal, 1);
    assert.ok(published.openedFinalRounds >= 1);
    const invitation = await getPool().query('SELECT id FROM final_invitations WHERE heat_application_item_id=$1 AND final_exam_round_id=$2', [item.rows[0].id, finalRoundId]);
    assert.equal(invitation.rows.length, 1);
    publishedHeat = { applicationId: application.id, itemId: item.rows[0].id, finalRoundId, applicant: input.applicant };
    const publicRows = (await listPublishedResults()).filter(({ targetId }) => targetId === roundId);
    assert.equal(publicRows.length, 1);
    assert.equal(publicRows[0].eligibleForFinal, true);
    await assert.rejects(importResultRows(roundId, 'new.xlsx', rows, adminId), (error) => error.statusCode === 409);
    await assert.rejects(publishResultBatch(roundId, adminId), (error) => error.statusCode === 409);
  });

  test('eligible Heat result can receive a matched Final number without altering published Heat result', async () => {
    assert.ok(publishedHeat, 'the result publication fixture must run first');
    const input = candidate('Result', publishedHeat.finalRoundId);
    input.sourceHeatApplicationId = publishedHeat.applicationId;
    const finalApplication = await createIndividualDraft(input, ownerId);
    await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE id=$1", [finalApplication.id]);
    await getPool().query('UPDATE final_invitations SET claimed_application_id=$1 WHERE heat_application_item_id=$2 AND final_exam_round_id=$3', [finalApplication.id, publishedHeat.itemId, publishedHeat.finalRoundId]);
    const imported = await importFinalIds(publishedHeat.finalRoundId, 'final-matched.xlsx', [{
      candidateNo: 'F-5540001', grade: 'Primary 1', schoolName: 'Test School',
      candidateName: `${input.applicant.firstNameEn} Candidate`,
    }], adminId);
    assert.equal(imported.rows[0].matchStatus, 'matched');
    const applied = await applyFinalIds(publishedHeat.finalRoundId, adminId);
    assert.equal(applied.applied, true);
    const finalItem = await getPool().query('SELECT exam_number FROM application_items WHERE application_id=$1', [finalApplication.id]);
    assert.equal(finalItem.rows[0].exam_number, 'F-5540001');
    const heatResult = await getPool().query('SELECT award,eligible_for_final FROM results WHERE application_item_id=$1', [publishedHeat.itemId]);
    assert.equal(heatResult.rows[0].award, '1ST AWARD');
    assert.equal(heatResult.rows[0].eligible_for_final, true);
    await assert.rejects(importFinalIds(publishedHeat.finalRoundId, 'again.xlsx', [{ candidateNo: 'F-2', schoolName: 'Test School', candidateName: 'Other' }], adminId), (error) => error.statusCode === 409);
  });

  test('closed Heat round numbers pending and approved applicants once per center', async () => {
    const roundId = `bbb-number-test-${runId}`;
    await getPool().query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,edit_close_date,
      is_open,paper_price_satang,online_price_satang)
      VALUES($1,'bbb','BBB Number Test','2569','HEAT',(now() AT TIME ZONE 'Asia/Bangkok')::date-1,
      (now() AT TIME ZONE 'Asia/Bangkok')::date+1,(now() AT TIME ZONE 'Asia/Bangkok')::date+1,true,75500,65500)`, [roundId]);
    await getPool().query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [roundId, gradeId]);
    await getPool().query("INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,'center-554')", [roundId]);
    const zed = candidate('NumberA', roundId);
    zed.applicant.firstNameEn = `Zed${runId}`;
    zed.applicant.lastNameEn = 'Aaron';
    const ada = candidate('NumberB', roundId);
    ada.applicant.firstNameEn = `Ada${runId}`;
    ada.applicant.lastNameEn = 'Zebra';
    const middleAbel = candidate('NumberC', roundId);
    middleAbel.applicant.firstNameEn = `Mia${runId}`;
    middleAbel.applicant.middleNameEn = 'Abel';
    middleAbel.applicant.lastNameEn = 'Zebra';
    const middleZoe = candidate('NumberD', roundId);
    middleZoe.applicant.firstNameEn = `Mia${runId}`;
    middleZoe.applicant.middleNameEn = 'Zoe';
    middleZoe.applicant.lastNameEn = 'Aaron';
    const first = await createIndividualDraft(zed, ownerId);
    const second = await createIndividualDraft(ada, ownerId);
    const third = await createIndividualDraft(middleAbel, ownerId);
    const fourth = await createIndividualDraft(middleZoe, ownerId);
    await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE id=$1", [first.id]);
    await getPool().query("UPDATE applications SET status='approved',submitted_at=now(),approved_at=now() WHERE id=$1", [second.id]);
    await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE id IN ($1,$2)", [third.id, fourth.id]);
    await assert.rejects(generateExamNumbers(roundId, adminId), (error) => error.statusCode === 409);
    await getPool().query('UPDATE exam_rounds SET final_manually_closed=true,is_open=false WHERE id=$1', [roundId]);
    const generated = await generateExamNumbers(roundId, adminId);
    assert.equal(generated.assigned, 4);
    const numbers = await getPool().query(`SELECT ai.exam_number,ap.first_name_en,ap.middle_name_en
      FROM application_items ai JOIN applications a ON a.id=ai.application_id
      JOIN applicants ap ON ap.id=a.applicant_id WHERE ai.exam_round_id=$1 ORDER BY ai.exam_number`, [roundId]);
    assert.deepEqual(numbers.rows.map(({ exam_number }) => exam_number), ['5540001', '5540002', '5540003', '5540004']);
    assert.deepEqual(numbers.rows.map(({ first_name_en, middle_name_en }) => [first_name_en, middle_name_en || '']), [
      [ada.applicant.firstNameEn, ''], [middleAbel.applicant.firstNameEn, 'Abel'],
      [middleZoe.applicant.firstNameEn, 'Zoe'], [zed.applicant.firstNameEn, ''],
    ], 'first name and then middle name take precedence over surname');
    const repeated = await generateExamNumbers(roundId, adminId);
    assert.equal(repeated.assigned, 0);
    assert.equal(repeated.alreadyAssigned, 4);
  });

  test('one application receives a separate Heat number on each of its three competition items', async (t) => {
    const roundIds = ['bbb-heat-2569', 'hkiso-heat-2569', 'hkico-heat-2569'];
    const priorRounds = await getPool().query('SELECT id,final_manually_closed,is_open FROM exam_rounds WHERE id=ANY($1::text[])', [roundIds]);
    const labels = ['Primary 1', 'Primary 2', 'Primary 2 — Scratch'];
    const gradeRows = await getPool().query('SELECT id,label FROM grade_catalog WHERE label=ANY($1::text[])', [labels]);
    const gradeIds = Object.fromEntries(gradeRows.rows.map(({ id, label }) => [label, id]));
    assert.equal(priorRounds.rowCount, 3, 'all three seeded Heat rounds are available');
    assert.equal(gradeRows.rowCount, 3, 'each competition has a configured grade');
    try {
      const input = candidate('MultiItemNumbers');
      input.items = [
        { roundId: roundIds[0], gradeId: gradeIds['Primary 1'], format: 'paper', centerId: 'center-554' },
        { roundId: roundIds[1], gradeId: gradeIds['Primary 2'], format: 'paper', centerId: 'center-554' },
        { roundId: roundIds[2], gradeId: gradeIds['Primary 2 — Scratch'], format: 'paper', centerId: 'center-554' },
      ];
      input.pastPaperIds = [];
      const application = await createIndividualDraft(input, ownerId);
      await getPool().query("UPDATE applications SET status='pending',submitted_at=now() WHERE id=$1", [application.id]);
      await getPool().query('UPDATE exam_rounds SET final_manually_closed=true,is_open=false WHERE id=ANY($1::text[])', [roundIds]);

      for (const roundId of roundIds) {
        const generated = await generateExamNumbers(roundId, adminId);
        assert.ok(generated.assigned >= 1, `the selected round should assign at least the test application's item for ${roundId}`);
      }

      const assigned = await getPool().query(`SELECT c.short_name,ai.id AS item_id,ai.exam_number,ec.code AS center_code
        FROM application_items ai JOIN exam_rounds r ON r.id=ai.exam_round_id
        JOIN competitions c ON c.id=r.competition_id JOIN exam_centers ec ON ec.id=ai.center_id
        WHERE ai.application_id=$1 ORDER BY c.short_name`, [application.id]);
      assert.equal(assigned.rowCount, 3);
      assert.deepEqual(assigned.rows.map(({ short_name }) => short_name), ['BBB', 'HKICO', 'HKISO']);
      assert.equal(new Set(assigned.rows.map(({ item_id }) => item_id)).size, 3, 'each number belongs to its own application item');
      assert.ok(assigned.rows.every(({ exam_number, center_code }) => exam_number && exam_number.startsWith(center_code)),
        'every competition item should have an exam number matching its center');
      t.diagnostic(`Verified application item numbers: ${assigned.rows.map(({ short_name, exam_number }) => `${short_name} ${exam_number}`).join(' · ')}`);
    } finally {
      await getPool().query(`UPDATE exam_rounds AS r SET final_manually_closed=s.final_manually_closed,is_open=s.is_open
        FROM unnest($1::text[],$2::boolean[],$3::boolean[]) AS s(id,final_manually_closed,is_open) WHERE r.id=s.id`, [
        priorRounds.rows.map(({ id }) => id),
        priorRounds.rows.map(({ final_manually_closed }) => final_manually_closed),
        priorRounds.rows.map(({ is_open }) => is_open),
      ]);
    }
  });

  test('Final ID import pauses unmatched and duplicate rows and refuses to apply them', async () => {
    const roundId = `bbb-final-test-${runId}`;
    await getPool().query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,edit_close_date,
      is_open,paper_price_satang,online_price_satang)
      VALUES($1,'bbb','BBB Final Test','2569','FINAL',(now() AT TIME ZONE 'Asia/Bangkok')::date-1,
      (now() AT TIME ZONE 'Asia/Bangkok')::date+1,(now() AT TIME ZONE 'Asia/Bangkok')::date+1,true,75500,65500)`, [roundId]);
    const unknown = { candidateNo: 'F-001', schoolName: 'Unknown School', candidateName: 'Unknown Candidate' };
    const first = await importFinalIds(roundId, 'final.xlsx', [unknown], adminId);
    assert.equal(first.rows[0].matchStatus, 'unmatched');
    await assert.rejects(applyFinalIds(roundId, adminId), (error) => error.statusCode === 409);
    const duplicate = await importFinalIds(roundId, 'duplicate.xlsx', [unknown, { ...unknown, candidateName: 'Another Candidate' }], adminId);
    assert.deepEqual(duplicate.rows.map(({ matchStatus }) => matchStatus), ['duplicate', 'duplicate']);
    await assert.rejects(importFinalIds('bbb-heat-2569', 'wrong-round.xlsx', [unknown], adminId), (error) => error.statusCode === 404);
  });
}
