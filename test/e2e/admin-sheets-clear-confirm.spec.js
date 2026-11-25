import { expect, test } from '@playwright/test';
import { createHash, randomUUID } from 'node:crypto';
import { APPLICATION_HEADERS, APPLICATION_ITEM_METADATA_KEY } from '../../server/applicationSheetLayout.js';
import { getPool } from '../../server/db.js';
import { processIntegrationJob } from '../../server/integrationWorker.js';
import { migrate } from '../../server/migrate.js';
import { seed } from '../../server/seed.js';

async function createSessionContext(browser, baseURL, { googleSub, email, displayName, isAdmin }) {
  const user = (await getPool().query(
    `INSERT INTO users(google_sub,email,display_name,is_admin)
     VALUES($1,$2,$3,$4)
     ON CONFLICT (google_sub) DO UPDATE SET email=excluded.email,display_name=excluded.display_name,is_admin=excluded.is_admin
     RETURNING id`,
    [googleSub, email, displayName, isAdmin],
  )).rows[0];
  const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
  await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [
    createHash('sha256').update(token).digest('hex'),
    user.id,
  ]);
  const origin = new URL(baseURL);
  const context = await browser.newContext();
  await context.addCookies([{ name: 'ocec_session', value: token, domain: origin.hostname, path: '/', httpOnly: true, sameSite: 'Lax' }]);
  return { context, userId: user.id };
}

function createReadOnlyWorkerSheetsMock({ spreadsheetId, sheetId, sheetTitle, itemId, rowValues }) {
  const state = {
    headers: [...APPLICATION_HEADERS, 'Staff Note', 'Checked By'],
    rows: [[...rowValues, 'Keep UI Staff Note', 'Staff Officer']],
    metadata: [{
      metadataId: 501,
      metadataKey: APPLICATION_ITEM_METADATA_KEY,
      metadataValue: itemId,
      visibility: 'DOCUMENT',
      location: { dimensionRange: { sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 } },
    }],
    writeRequests: [],
    missingValueRangeOnce: false,
  };

  const fetchMock = async (url, options = {}) => {
    const target = new URL(url);
    if (target.hostname === 'oauth2.googleapis.com') {
      return Response.json({ access_token: 'mock-e2e-token', expires_in: 3600 });
    }
    const body = typeof options.body === 'string' && options.body.trim().startsWith('{') ? JSON.parse(options.body) : {};
    if (target.hostname === 'sheets.googleapis.com') {
      const path = decodeURIComponent(target.pathname);
      if (target.searchParams.get('fields')?.includes('sheets.properties')) {
        return Response.json({
          spreadsheetId,
          sheets: [{ properties: { sheetId, title: sheetTitle, gridProperties: { rowCount: 20, columnCount: state.headers.length } } }],
        });
      }
      if (path.includes('!A1:AK1')) {
        return Response.json({ values: [state.headers] });
      }
      if (path.endsWith('/developerMetadata:search')) {
        const lookup = body.dataFilters?.[0]?.developerMetadataLookup || {};
        const matched = state.metadata
          .filter((meta) => (!lookup.metadataKey || meta.metadataKey === lookup.metadataKey) && (!lookup.metadataValue || meta.metadataValue === lookup.metadataValue))
          .map((developerMetadata) => ({ developerMetadata: structuredClone(developerMetadata) }));
        return Response.json({ matchedDeveloperMetadata: matched });
      }
      if (path.endsWith('/values:batchGetByDataFilter')) {
        if (state.missingValueRangeOnce) {
          state.missingValueRangeOnce = false;
          return Response.json({ spreadsheetId, valueRanges: [{ dataFilters: body.dataFilters }] });
        }
        const row = state.rows[0];
        const trimmed = [...row];
        while (trimmed.length && trimmed[trimmed.length - 1] === '') trimmed.pop();
        return Response.json({
          spreadsheetId,
          valueRanges: [{
            dataFilters: body.dataFilters,
            valueRange: {
              range: `'${sheetTitle}'!A2:AB2`,
              majorDimension: 'ROWS',
              ...(trimmed.length ? { values: [trimmed] } : {}),
            },
          }],
        });
      }
      state.writeRequests.push({ method: options.method || 'GET', path, body });
      throw new Error(`Unexpected write request to Google Sheets during clear verification: ${path}`);
    }
    throw new Error(`Unexpected external fetch in worker mock: ${target.toString()}`);
  };

  return { state, fetchMock };
}

test('admin reviews manual-review sheets.clear_row queue item, confirms clear via UI, and worker closes job only when A:Z is empty with zero Google writes', async ({ browser, baseURL }) => {
  await migrate({ silent: true });
  await seed();

  const db = getPool();
  const runId = randomUUID().slice(0, 8);
  const roundId = `e2e-clear-bbb-${runId}`;
  const spreadsheetId = `e2e-workbook-${runId}`;
  const sheetId = 42;
  const sheetTitle = `BBB - Heat ${runId}`;
  const itemId = randomUUID();
  const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

  await db.query(
    `INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,exam_date,is_open,active)
     VALUES($1,'bbb','BBB E2E Clear','2571','HEAT',current_date-1,current_date+1,current_date+10,true,true)`,
    [roundId],
  );
  await db.query(
    `INSERT INTO google_workspace_spreadsheets(academic_year,drive_file_id,title,spreadsheet_url)
     VALUES('2571',$1,'OCEC Applications 2571',$2)
     ON CONFLICT (academic_year) DO UPDATE SET drive_file_id=excluded.drive_file_id,spreadsheet_url=excluded.spreadsheet_url`,
    [spreadsheetId, spreadsheetUrl],
  );
  await db.query(
    `INSERT INTO google_workspace_sheet_tabs(exam_round_id,academic_year,sheet_id,title)
     VALUES($1,'2571',$2,$3)`,
    [roundId, sheetId, sheetTitle],
  );

  // Clear older pending jobs so processIntegrationJob runs deterministically on our job
  await db.query("UPDATE integration_jobs SET status='completed' WHERE status IN ('pending','failed')");

  const clearJobId = (await db.query(
    `INSERT INTO integration_jobs(kind,payload,dedupe_key,status,attempts,last_error)
     VALUES('sheets.clear_row',$1,$2,'failed',8,$3) RETURNING id`,
    [
      {
        applicationItemId: itemId,
        examRoundId: roundId,
        academicYear: '2571',
        spreadsheetId,
        sheetId,
        sheetTitle,
        expectedRowIdentity: {
          competition: 'BBB',
          grade: 'Primary 1',
          firstNameEn: `AliceUI${runId}`,
          lastNameEn: 'ClearTarget',
          contactEmail: `alice-ui-${runId}@example.test`,
          contactPhone: '0812345678',
        },
      },
      `e2e-clear-${runId}`,
      'MANUAL_REVIEW_REQUIRED: Manual inspection required before clearing row 2 columns A:Z',
    ],
  )).rows[0].id;

  const legacyJobId = (await db.query(
    `INSERT INTO integration_jobs(kind,payload,dedupe_key,status,attempts,last_error)
     VALUES('sheets.clear_row',$1,$2,'failed',8,$3) RETURNING id`,
    [
      { examRoundId: roundId, spreadsheetRow: 9 },
      `e2e-legacy-clear-${runId}`,
      'MANUAL_REVIEW_REQUIRED: Legacy Google Sheets clear job has no Application Item ID',
    ],
  )).rows[0].id;

  const syncFailedJobId = (await db.query(
    `INSERT INTO integration_jobs(kind,payload,dedupe_key,status,attempts,next_attempt_at,last_error)
     VALUES('sheets.sync_item',$1,$2,'failed',1,now()+interval '1 hour','Temporary Sheets sync error') RETURNING id`,
    [{ applicationItemId: randomUUID() }, `e2e-sync-fail-${runId}`],
  )).rows[0].id;

  const adminSession = await createSessionContext(browser, baseURL, {
    googleSub: 'ocec-test-admin',
    email: 'admin@ocec.test',
    displayName: 'Test Admin',
    isAdmin: true,
  });
  const nonAdminSession = await createSessionContext(browser, baseURL, {
    googleSub: `e2e-non-admin-${runId}`,
    email: `non-admin-${runId}@example.test`,
    displayName: 'Regular User',
    isAdmin: false,
  });

  const rowValues = APPLICATION_HEADERS.map((_, i) => (
    i === 3 ? 'BBB'
      : i === 7 ? 'Primary 1'
        : i === 11 ? `AliceUI${runId}`
          : i === 12 ? 'ClearTarget'
            : i === 17 ? `alice-ui-${runId}@example.test`
              : i === 18 ? '0812345678'
                : `val-${i}`
  ));
  const mock = createReadOnlyWorkerSheetsMock({ spreadsheetId, sheetId, sheetTitle, itemId, rowValues });
  const originalFetch = globalThis.fetch;

  try {
    // Non-admin user cannot call confirm endpoint (403)
    const forbiddenRes = await nonAdminSession.context.request.post(`/api/admin/integration-jobs/${clearJobId}/confirm-sheet-clear`, {
      data: { confirmed: true },
    });
    expect(forbiddenRes.status()).toBe(403);

    // Admin opens Google Sheets queue page
    const page = await adminSession.context.newPage();
    await page.goto('/portal-admin/integrations/sheets');
    await expect(page.getByRole('heading', { name: 'สถานะการเชื่อมต่อ Google Sheets' })).toBeVisible();

    // Target clear job shows applicant details, Item ID, sheet link, retry button, and "ยืนยันว่าล้างข้อมูลแล้ว" button
    const clearRow = page.locator('.activity-row').filter({ hasText: itemId });
    await expect(clearRow).toBeVisible();
    await expect(clearRow).toContainText(`AliceUI${runId} ClearTarget`);
    await expect(clearRow).toContainText('รอเจ้าหน้าที่ตรวจสอบ');
    const sheetLink = clearRow.getByRole('link', { name: 'เปิดชีตเพื่อตรวจ' });
    await expect(sheetLink).toHaveAttribute('href', `${spreadsheetUrl}#gid=${sheetId}`);
    await expect(clearRow.getByRole('button', { name: 'ยืนยันว่าล้างข้อมูลแล้ว' })).toBeVisible();
    await expect(clearRow.getByRole('button', { name: 'ดำเนินการอีกครั้ง' })).toBeVisible();

    // Legacy row-only job and normal failed sync job MUST NOT expose "ยืนยันว่าล้างข้อมูลแล้ว"
    const legacyRow = page.locator('.activity-row').filter({ hasText: 'ไม่มี Application Item ID' });
    await expect(legacyRow).toBeVisible();
    await expect(legacyRow.getByRole('button', { name: 'ยืนยันว่าล้างข้อมูลแล้ว' })).toHaveCount(0);

    const syncRow = page.locator('.activity-row').filter({ hasText: 'Temporary Sheets sync error' });
    await expect(syncRow).toBeVisible();
    await expect(syncRow.getByRole('button', { name: 'ยืนยันว่าล้างข้อมูลแล้ว' })).toHaveCount(0);
    await expect(syncRow.getByRole('button', { name: 'ดำเนินการอีกครั้ง' })).toBeVisible();

    // Admin clicks "ยืนยันว่าล้างข้อมูลแล้ว" -> confirmation dialog opens -> admin confirms
    await clearRow.getByRole('button', { name: 'ยืนยันว่าล้างข้อมูลแล้ว' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(`AliceUI${runId} ClearTarget`);
    await expect(dialog).toContainText(itemId);
    await dialog.getByRole('button', { name: 'ยืนยันว่าล้างข้อมูลแล้ว' }).click();

    await expect(page.getByRole('status').filter({ hasText: 'บันทึกการยืนยันว่าล้างข้อมูลแล้ว' })).toBeVisible();
    await expect(clearRow).toContainText('รอดำเนินการ');

    // Verify audit recorded confirming admin & NO duplicate job created
    const auditRows = (await db.query(
      "SELECT actor_user_id,after_data FROM audit_logs WHERE entity_type='google_sheet_row_clear' AND entity_id=$1 AND action='manual_clear_confirmed'",
      [itemId],
    )).rows;
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0].actor_user_id).toBe(adminSession.userId);
    expect(auditRows[0].after_data.spreadsheetId).toBe(spreadsheetId);
    expect(auditRows[0].after_data.sheetId).toBe(sheetId);

    // Run worker while mocked sheet STILL has Alice's data -> job MUST go back to MANUAL_REVIEW_REQUIRED with 0 writes!
    globalThis.fetch = mock.fetchMock;
    expect(await processIntegrationJob()).toBe(true);
    globalThis.fetch = originalFetch;
    expect(mock.state.writeRequests).toHaveLength(0);

    await page.getByRole('button', { name: 'ปรับปรุงสถานะ' }).click();
    await expect(clearRow).toContainText('รอเจ้าหน้าที่ตรวจสอบ');
    await expect(clearRow.getByRole('button', { name: 'ยืนยันว่าล้างข้อมูลแล้ว' })).toBeVisible();

    // Now staff clears A:Z in Google Sheets (preserving staff columns AA:AB), then confirms again in UI
    for (let col = 0; col < APPLICATION_HEADERS.length; col += 1) mock.state.rows[0][col] = '';
    await clearRow.getByRole('button', { name: 'ยืนยันว่าล้างข้อมูลแล้ว' }).click();
    const dialog2 = page.getByRole('dialog');
    await expect(dialog2).toBeVisible();
    await dialog2.getByRole('button', { name: 'ยืนยันว่าล้างข้อมูลแล้ว' }).click();
    await expect(clearRow).toContainText('รอดำเนินการ');

    // Run worker -> verifies single target row covering A:Z is empty -> closes job as completed with ZERO writes!
    globalThis.fetch = mock.fetchMock;
    expect(await processIntegrationJob()).toBe(true);
    globalThis.fetch = originalFetch;
    expect(mock.state.writeRequests).toHaveLength(0);
    expect(mock.state.rows[0].slice(APPLICATION_HEADERS.length)).toEqual(['Keep UI Staff Note', 'Staff Officer']);

    await page.getByRole('button', { name: 'ปรับปรุงสถานะ' }).click();
    await expect(clearRow).toContainText('ล้างแถว Google Sheets · ดำเนินการสำเร็จ');
    await expect(clearRow.getByRole('button', { name: 'ยืนยันว่าล้างข้อมูลแล้ว' })).toHaveCount(0);

    const jobCount = (await db.query("SELECT count(*)::integer AS count FROM integration_jobs WHERE id=$1", [clearJobId])).rows[0].count;
    expect(jobCount).toBe(1);
    const sameItemJobs = (await db.query("SELECT count(*)::integer AS count FROM integration_jobs WHERE kind='sheets.clear_row' AND payload->>'applicationItemId'=$1", [itemId])).rows[0].count;
    expect(sameItemJobs).toBe(1);
    // Keep legacy job untouched
    const legacyState = (await db.query('SELECT status FROM integration_jobs WHERE id=$1', [legacyJobId])).rows[0].status;
    expect(legacyState).toBe('failed');
    const syncState = (await db.query('SELECT status FROM integration_jobs WHERE id=$1', [syncFailedJobId])).rows[0].status;
    expect(syncState).toBe('failed');
  } finally {
    globalThis.fetch = originalFetch;
    await adminSession.context.close();
    await nonAdminSession.context.close();
  }
});
