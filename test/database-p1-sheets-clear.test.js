import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import test from 'node:test';
import { APPLICATION_HEADERS, APPLICATION_ITEM_METADATA_KEY } from '../server/applicationSheetLayout.js';
import { createIndividualDraft, updateAdminApplication } from '../server/applications.js';
import { getPool } from '../server/db.js';
import { clearGoogleWorkspaceSheetRow, syncGoogleWorkspaceSheetItem } from '../server/googleWorkspace.js';
import { enqueueIntegrationJob, integrationQueueStatus } from '../server/integrationQueue.js';
import { processIntegrationJob } from '../server/integrationWorker.js';
import { seed } from '../server/seed.js';

const testUrl = process.env.TEST_DATABASE_URL;

function encryptToken(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY, 'base64'), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
}

function createStatefulSheetsMock() {
  const state = {
    spreadsheetId: 'mock-sheet-workbook-1',
    sheetId: 42,
    otherSheetId: 99,
    sheetTitle: 'BBB - Heat Round',
    headers: [...APPLICATION_HEADERS, 'Staff Note', 'Checked By'],
    rows: [],
    metadata: [],
    nextMetadataId: 100,
    clearUpdateCellRequests: [],
  };

  const fetchMock = async (url, options = {}) => {
    const target = new URL(url);
    if (target.hostname === 'oauth2.googleapis.com') {
      return Response.json({ access_token: 'mock-access-token', expires_in: 3600 });
    }
    const body = typeof options.body === 'string' && options.body.trim().startsWith('{') ? JSON.parse(options.body) : {};
    if (target.hostname === 'sheets.googleapis.com') {
      const path = decodeURIComponent(target.pathname);
      if (target.searchParams.get('fields') === 'sheets.properties') {
        return Response.json({
          sheets: [
            { properties: { sheetId: state.sheetId, title: state.sheetTitle, gridProperties: { rowCount: Math.max(100, state.rows.length + 5), columnCount: state.headers.length } } },
            { properties: { sheetId: state.otherSheetId, title: 'Other Tab', gridProperties: { rowCount: 100, columnCount: 28 } } },
          ],
        });
      }
      if (path.endsWith('/developerMetadata:search')) {
        const lookup = body.dataFilters?.[0]?.developerMetadataLookup || {};
        const matched = state.metadata.filter((meta) => {
          if (lookup.metadataKey && meta.metadataKey !== lookup.metadataKey) return false;
          if (lookup.metadataValue && meta.metadataValue !== lookup.metadataValue) return false;
          return true;
        });
        return Response.json({ matchedDeveloperMetadata: matched.map((developerMetadata) => ({ developerMetadata })) });
      }
      if (path.endsWith(':batchUpdate')) {
        for (const req of body.requests || []) {
          if (req.updateCells && req.updateCells.range && !req.updateCells.rows) {
            state.clearUpdateCellRequests.push(req.updateCells);
            const { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex } = req.updateCells.range;
            if (sheetId === state.sheetId) {
              for (let rowIndex = startRowIndex; rowIndex < endRowIndex; rowIndex += 1) {
                const row = state.rows[rowIndex - 1];
                if (!row) continue;
                for (let col = startColumnIndex; col < Math.min(endColumnIndex, row.length); col += 1) {
                  row[col] = '';
                }
              }
            }
          } else if (req.updateCells && req.updateCells.start) {
            const rowIndex = req.updateCells.start.rowIndex;
            const values = req.updateCells.rows[0].values.map((cell) => cell.userEnteredValue.stringValue ?? cell.userEnteredValue.numberValue ?? '');
            if (rowIndex === 0) state.headers = values;
            else {
              while (state.rows.length < rowIndex) state.rows.push(Array(state.headers.length).fill(''));
              const existingStaffCols = state.rows[rowIndex - 1].slice(APPLICATION_HEADERS.length);
              state.rows[rowIndex - 1] = [...values, ...existingStaffCols];
            }
          }
          if (req.createDeveloperMetadata) {
            state.metadata.push({
              metadataId: state.nextMetadataId++,
              ...req.createDeveloperMetadata.developerMetadata,
            });
          }
          if (req.deleteDeveloperMetadata) {
            const lookup = req.deleteDeveloperMetadata.dataFilter?.developerMetadataLookup || {};
            state.metadata = state.metadata.filter((meta) => !(
              (!lookup.metadataKey || meta.metadataKey === lookup.metadataKey)
              && (!lookup.metadataValue || meta.metadataValue === lookup.metadataValue)
              && (lookup.metadataId == null || meta.metadataId === lookup.metadataId)
            ));
          }
        }
        return Response.json({});
      }
      if (path.includes('!A1:AK1')) return Response.json({ values: [state.headers] });
      if (path.includes('!A:Z')) return Response.json({ values: [state.headers.slice(0, 26), ...state.rows.map((row) => row.slice(0, 26))] });
      const singleRowMatch = path.match(/!A(\d+):Z(\d+)$/);
      if (singleRowMatch && (options.method || 'GET') === 'GET') {
        const rowNum = Number(singleRowMatch[1]);
        return Response.json({ values: state.rows[rowNum - 2] ? [state.rows[rowNum - 2].slice(0, 26)] : [] });
      }
      if (singleRowMatch && options.method === 'PUT') {
        const rowNum = Number(singleRowMatch[1]);
        const existingStaffCols = (state.rows[rowNum - 2] || []).slice(APPLICATION_HEADERS.length);
        state.rows[rowNum - 2] = [...body.values[0], ...existingStaffCols];
        return Response.json({});
      }
    }
    throw new Error(`Unexpected mock Google request: ${options.method || 'GET'} ${target.toString()}`);
  };

  function sortRowsDescendingByFirstName() {
    const combined = state.rows.map((values, idx) => ({
      values,
      metas: state.metadata.filter((meta) => meta.location.dimensionRange.sheetId === state.sheetId && meta.location.dimensionRange.startIndex === idx + 1),
    }));
    combined.sort((a, b) => String(b.values[11] || '').localeCompare(String(a.values[11] || '')));
    state.rows = combined.map((entry) => entry.values);
    combined.forEach((entry, idx) => {
      for (const meta of entry.metas) {
        meta.location.dimensionRange.startIndex = idx + 1;
        meta.location.dimensionRange.endIndex = idx + 2;
      }
    });
  }

  function insertRowAtTop() {
    state.rows.unshift([...Array(APPLICATION_HEADERS.length).fill('Inserted-Note-Row'), 'Top Staff Note', 'Staff X']);
    for (const meta of state.metadata) {
      if (meta.location.dimensionRange.sheetId === state.sheetId) {
        meta.location.dimensionRange.startIndex += 1;
        meta.location.dimensionRange.endIndex += 1;
      }
    }
  }

  return { state, fetchMock, sortRowsDescendingByFirstName, insertRowAtTop };
}

if (!testUrl) {
  test('OCEC-05 Sheets clear worker tests require a disposable database', { skip: 'Use npm run test:db' }, () => {});
} else {
  const target = new URL(testUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || !target.pathname.includes('test') || process.env.DATABASE_URL !== testUrl) {
    throw new Error('Use a disposable local test database');
  }

  test.before(async () => {
    await seed();
  });

  test.after(async () => {
    await getPool().query("DELETE FROM google_workspace_connection WHERE account_email='sheets-clear@ocec.test'").catch(() => {});
    await getPool().end();
  });

  test('worker clears only Portal columns on target row after sorting/insertion, preserves staff columns, stops for manual review on cross-tab duplicates or ambiguous legacy jobs, and is idempotent', async () => {
    const db = getPool();
    const runId = randomBytes(4).toString('hex');
    const mock = createStatefulSheetsMock();
    const originalFetch = globalThis.fetch;

    const users = await db.query(`INSERT INTO users(google_sub,email,display_name,is_admin)
      VALUES($1,$2,'Sheets Owner',false),($3,$4,'Sheets Admin',true) RETURNING id`, [
      `sh-owner-${runId}`, `sh-owner-${runId}@example.test`,
      `sh-admin-${runId}`, `sh-admin-${runId}@example.test`,
    ]);
    const [ownerId, adminId] = users.rows.map((row) => row.id);
    const gradeId = (await db.query("SELECT id FROM grade_catalog WHERE label='Primary 1'")).rows[0].id;
    const centerId = (await db.query("SELECT id FROM exam_centers WHERE code='554'")).rows[0].id;
    const round1 = `oc05-bbb-${runId}`;
    const round2 = `oc05-hkiso-${runId}`;
    await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,exam_date,is_open,active)
      VALUES
        ($1,'bbb','BBB Sheets Clear','2569','HEAT',current_date-1,current_date+1,current_date+10,true,true),
        ($2,'hkiso','HKISO Keep Round','2569','HEAT',current_date-1,current_date+1,current_date+10,true,true)`, [round1, round2]);
    await db.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$3),($2,$3)', [round1, round2, gradeId]);
    await db.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$3),($2,$3)', [round1, round2, centerId]);

    await db.query(`INSERT INTO google_workspace_connection(singleton,account_email,encrypted_refresh_token,granted_scopes,
        drive_root_folder_id,slip_root_folder_id,certificate_photo_root_folder_id,spreadsheet_root_folder_id)
      VALUES(true,'sheets-clear@ocec.test',$1,$2,'r','s','p','sh')
      ON CONFLICT (singleton) DO UPDATE SET
        account_email=excluded.account_email,encrypted_refresh_token=excluded.encrypted_refresh_token,granted_scopes=excluded.granted_scopes`,
    [encryptToken('mock-refresh'), ['openid', 'email', 'https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/spreadsheets']]);
    await db.query(`INSERT INTO google_workspace_spreadsheets(academic_year,drive_file_id,title,spreadsheet_url)
      VALUES('2569',$1,'OCEC Applications 2569','https://docs.google.com/spreadsheets/d/mock-sheet-workbook-1')
      ON CONFLICT (academic_year) DO UPDATE SET drive_file_id=excluded.drive_file_id`, [mock.state.spreadsheetId]);
    await db.query(`INSERT INTO google_workspace_sheet_tabs(exam_round_id,academic_year,sheet_id,title)
      VALUES($1,'2569',$2,$3) ON CONFLICT (exam_round_id) DO UPDATE SET sheet_id=excluded.sheet_id,title=excluded.title`,
    [round1, mock.state.sheetId, mock.state.sheetTitle]);

    const makeApprovedApp = async (firstName, extraRound = false) => {
      const items = [{ roundId: round1, gradeId, format: 'paper', centerId }];
      if (extraRound) items.push({ roundId: round2, gradeId, format: 'paper', centerId });
      const draft = await createIndividualDraft({
        applicant: { firstNameEn: firstName, middleNameEn: '', lastNameEn: 'Tester', dateOfBirth: '2017-01-01', schoolName: 'Sheet School', contactEmail: `${firstName.toLowerCase()}-${runId}@example.test`, contactPhone: '0812345678' },
        items,
        pastPaperIds: [],
      }, ownerId);
      await db.query("UPDATE applications SET status='approved',approved_at=now() WHERE id=$1", [draft.id]);
      const itemRows = (await db.query('SELECT id,exam_round_id FROM application_items WHERE application_id=$1 ORDER BY exam_round_id', [draft.id])).rows;
      return { appId: draft.id, item1: itemRows.find((r) => r.exam_round_id === round1).id, item2: itemRows.find((r) => r.exam_round_id === round2)?.id };
    };

    const appA = await makeApprovedApp(`Alpha${runId}`);
    const appB = await makeApprovedApp(`Bravo${runId}`, true);
    const appC = await makeApprovedApp(`Charlie${runId}`);

    globalThis.fetch = mock.fetchMock;
    try {
      // Sync all 3 items -> rows 2 (Alpha), 3 (Bravo), 4 (Charlie) and add staff custom columns (AA, AB)
      await syncGoogleWorkspaceSheetItem(appA.item1);
      await syncGoogleWorkspaceSheetItem(appB.item1);
      await syncGoogleWorkspaceSheetItem(appC.item1);
      mock.state.rows[0][26] = 'Alpha Staff Note';
      mock.state.rows[0][27] = 'Officer 1';
      mock.state.rows[1][26] = 'Bravo Staff Note';
      mock.state.rows[1][27] = 'Officer 2';
      mock.state.rows[2][26] = 'Charlie Staff Note';
      mock.state.rows[2][27] = 'Officer 3';

      // Admin removes round1 item from appB -> enqueues metadata-aware sheets.clear_row job
      await updateAdminApplication(appB.appId, {
        profile: { firstNameEn: `Bravo${runId}`, middleNameEn: '', lastNameEn: 'Tester', schoolName: 'Sheet School', contactEmail: `bravo${runId.toLowerCase()}-${runId}@example.test`, contactPhone: '0812345678', address: {} },
        items: [{ applicationItemId: appB.item2, roundId: round2, gradeId, format: 'paper', centerId }],
      }, adminId);

      const clearJob = (await db.query("SELECT id,payload FROM integration_jobs WHERE kind='sheets.clear_row' ORDER BY id DESC LIMIT 1")).rows[0];
      assert.equal(clearJob.payload.applicationItemId, appB.item1);
      assert.equal(clearJob.payload.spreadsheetId, mock.state.spreadsheetId);
      assert.equal(clearJob.payload.sheetId, mock.state.sheetId);
      assert.equal(clearJob.payload.sheetTitle, mock.state.sheetTitle);

      // Before worker runs: admin sorts descending AND inserts a row at top!
      // Row order becomes: [Inserted, Charlie, Bravo, Alpha]
      mock.sortRowsDescendingByFirstName();
      mock.insertRowAtTop();

      await db.query("UPDATE integration_jobs SET status='completed' WHERE id <> $1", [clearJob.id]);
      assert.equal(await processIntegrationJob(), true);
      const finishedJob = (await db.query('SELECT status,last_error FROM integration_jobs WHERE id=$1', [clearJob.id])).rows[0];
      assert.equal(finishedJob.status, 'completed', finishedJob.last_error || '');

      // Verify exact bounded GridRange (row 4 = index 3, columns 0..26 ONLY!)
      assert.equal(mock.state.clearUpdateCellRequests.length, 1);
      assert.deepEqual(mock.state.clearUpdateCellRequests[0].range, {
        sheetId: mock.state.sheetId,
        startRowIndex: 3,
        endRowIndex: 4,
        startColumnIndex: 0,
        endColumnIndex: APPLICATION_HEADERS.length,
      });

      // Bravo's Portal columns (A:Z) are cleared, while Bravo's staff columns (AA, AB) AND all other rows are 100% intact!
      assert.ok(mock.state.rows[2].slice(0, APPLICATION_HEADERS.length).every((cell) => cell === ''), 'Bravo Portal columns must be cleared');
      assert.deepEqual(mock.state.rows[2].slice(APPLICATION_HEADERS.length), ['Bravo Staff Note', 'Officer 2'], 'staff columns on cleared row must stay intact');
      assert.equal(mock.state.rows[0][0], 'Inserted-Note-Row');
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`);
      assert.equal(mock.state.rows[1][26], 'Charlie Staff Note');
      assert.equal(mock.state.rows[3][11], `Alpha${runId}`);
      assert.equal(mock.state.rows[3][26], 'Alpha Staff Note');

      // Re-running the same clear job is an idempotent no-op and touches ZERO rows/columns
      const rerun = await clearGoogleWorkspaceSheetRow(clearJob.payload);
      assert.equal(rerun.alreadyCleared, true);
      assert.equal(rerun.cleared, false);
      assert.equal(mock.state.clearUpdateCellRequests.length, 1);
      assert.deepEqual(mock.state.rows[2].slice(APPLICATION_HEADERS.length), ['Bravo Staff Note', 'Officer 2']);

      // Cross-tab duplicate metadata (Alpha appears on BOTH sheetId 42 and sheetId 99) -> worker stops with MANUAL_REVIEW_REQUIRED (attempts=8)
      const alphaMeta = mock.state.metadata.find((m) => m.metadataValue === appA.item1);
      mock.state.metadata.push({
        metadataId: 9999,
        metadataKey: APPLICATION_ITEM_METADATA_KEY,
        metadataValue: appA.item1,
        visibility: 'DOCUMENT',
        location: { dimensionRange: { sheetId: mock.state.otherSheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 } },
      });
      const dupJobId = await enqueueIntegrationJob(db, 'sheets.clear_row', {
        applicationItemId: appA.item1,
        examRoundId: round1,
        spreadsheetId: mock.state.spreadsheetId,
        sheetId: mock.state.sheetId,
        sheetTitle: mock.state.sheetTitle,
      }, `dup-cross-tab-${runId}`);
      await processIntegrationJob();
      const dupJob = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [dupJobId])).rows[0];
      assert.equal(dupJob.status, 'failed');
      assert.equal(dupJob.attempts, 8, 'manual-review job must not auto-retry');
      assert.match(dupJob.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(dupJob.last_error, /Duplicate application row metadata/);
      assert.equal(mock.state.rows[3][11], `Alpha${runId}`, 'Alpha row must stay intact');
      mock.state.metadata = mock.state.metadata.filter((m) => m.metadataId !== 9999);

      // Legacy row-only job with NO reliable DB tracking (ambiguous/unverifiable row number) -> stops with MANUAL_REVIEW_REQUIRED
      const ambiguousLegacyId = await enqueueIntegrationJob(db, 'sheets.clear_row', { examRoundId: round1, spreadsheetRow: 99 }, `legacy-ambiguous-${runId}`);
      await processIntegrationJob();
      const ambiguousLegacy = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [ambiguousLegacyId])).rows[0];
      assert.equal(ambiguousLegacy.status, 'failed');
      assert.equal(ambiguousLegacy.attempts, 8);
      assert.match(ambiguousLegacy.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      const queueStatus = await integrationQueueStatus();
      assert.equal(queueStatus.jobs.find((j) => Number(j.id) === Number(ambiguousLegacyId))?.manualReviewRequired, true);

      // Legacy row-only job pointing to an active approved item in DB tracking -> MUST STOP with MANUAL_REVIEW_REQUIRED
      const activeLegacyId = await enqueueIntegrationJob(db, 'sheets.clear_row', { examRoundId: round1, spreadsheetRow: 4 }, `legacy-active-${runId}`);
      await processIntegrationJob();
      const activeLegacy = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [activeLegacyId])).rows[0];
      assert.equal(activeLegacy.status, 'failed');
      assert.equal(activeLegacy.attempts, 8);
      assert.match(activeLegacy.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`, 'Charlie must stay intact');

      // Legacy row-only job when reliable DB tracking identifies a rejected/non-approved item -> resolves item ID and clears ONLY A:Z on Alpha's moved row!
      await db.query("UPDATE applications SET status='rejected' WHERE id=$1", [appA.appId]);
      const validLegacyOutcome = await clearGoogleWorkspaceSheetRow({ examRoundId: round1, spreadsheetRow: 2 });
      assert.equal(validLegacyOutcome.cleared, true);
      assert.equal(validLegacyOutcome.itemId, appA.item1);
      assert.ok(mock.state.rows[3].slice(0, APPLICATION_HEADERS.length).every((cell) => cell === ''), 'Alpha Portal columns cleared');
      assert.deepEqual(mock.state.rows[3].slice(APPLICATION_HEADERS.length), ['Alpha Staff Note', 'Officer 1'], 'Alpha staff columns preserved');
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`, 'Charlie still untouched');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
