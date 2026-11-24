import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import test from 'node:test';
import { APPLICATION_HEADERS, APPLICATION_ITEM_METADATA_KEY } from '../server/applicationSheetLayout.js';
import { createIndividualDraft, updateAdminApplication } from '../server/applications.js';
import { getPool } from '../server/db.js';
import { clearGoogleWorkspaceSheetRow, syncGoogleWorkspaceSheetItem } from '../server/googleWorkspace.js';
import { enqueueIntegrationJob } from '../server/integrationQueue.js';
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
    sheetTitle: 'BBB - Heat Round',
    headers: [...APPLICATION_HEADERS],
    rows: [],
    metadata: [],
    nextMetadataId: 100,
    clearByDataFilterCalls: 0,
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
          sheets: [{ properties: { sheetId: state.sheetId, title: state.sheetTitle, gridProperties: { rowCount: Math.max(100, state.rows.length + 5), columnCount: state.headers.length } } }],
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
      if (path.endsWith('/values:batchClearByDataFilter')) {
        state.clearByDataFilterCalls += 1;
        const clearedRanges = [];
        for (const filter of body.dataFilters || []) {
          const lookup = filter.developerMetadataLookup || {};
          for (const meta of state.metadata) {
            if (meta.metadataKey === lookup.metadataKey && meta.metadataValue === lookup.metadataValue && meta.location.dimensionRange.sheetId === state.sheetId) {
              const rowIdx = meta.location.dimensionRange.startIndex - 1;
              if (rowIdx >= 0 && rowIdx < state.rows.length) {
                state.rows[rowIdx] = Array(APPLICATION_HEADERS.length).fill('');
                clearedRanges.push(`'${state.sheetTitle}'!A${rowIdx + 2}:Z${rowIdx + 2}`);
              }
            }
          }
        }
        return Response.json({ spreadsheetId: state.spreadsheetId, clearedRanges });
      }
      if (path.endsWith(':batchUpdate')) {
        for (const req of body.requests || []) {
          if (req.updateCells) {
            const rowIndex = req.updateCells.start.rowIndex;
            const values = req.updateCells.rows[0].values.map((cell) => cell.userEnteredValue.stringValue ?? cell.userEnteredValue.numberValue ?? '');
            if (rowIndex === 0) state.headers = values;
            else {
              while (state.rows.length < rowIndex) state.rows.push(Array(APPLICATION_HEADERS.length).fill(''));
              state.rows[rowIndex - 1] = values;
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
      if (path.includes('!A:Z')) return Response.json({ values: [state.headers, ...state.rows] });
      const singleRowMatch = path.match(/!A(\d+):Z(\d+)$/);
      if (singleRowMatch && (options.method || 'GET') === 'GET') {
        const rowNum = Number(singleRowMatch[1]);
        return Response.json({ values: state.rows[rowNum - 2] ? [state.rows[rowNum - 2]] : [] });
      }
      if (singleRowMatch && options.method === 'PUT') {
        const rowNum = Number(singleRowMatch[1]);
        state.rows[rowNum - 2] = body.values[0];
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

  function insertBlankRowAtTop() {
    state.rows.unshift(Array(APPLICATION_HEADERS.length).fill('Inserted-Note-Row'));
    for (const meta of state.metadata) {
      if (meta.location.dimensionRange.sheetId === state.sheetId) {
        meta.location.dimensionRange.startIndex += 1;
        meta.location.dimensionRange.endIndex += 1;
      }
    }
  }

  return { state, fetchMock, sortRowsDescendingByFirstName, insertBlankRowAtTop };
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

  test('worker clears only the target item after sorting and row insertion, handles legacy jobs safely, stops on duplicate metadata or target mismatch, and is idempotent', async () => {
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
      // Sync all 3 items onto the sheet -> rows 2 (Alpha), 3 (Bravo), 4 (Charlie)
      await syncGoogleWorkspaceSheetItem(appA.item1);
      await syncGoogleWorkspaceSheetItem(appB.item1);
      await syncGoogleWorkspaceSheetItem(appC.item1);
      assert.equal(mock.state.rows.length, 3);
      assert.equal(mock.state.rows[1][11], `Bravo${runId}`);

      // Admin removes round1 item from appB (keeping round2) -> enqueues metadata-aware sheets.clear_row job
      await updateAdminApplication(appB.appId, {
        profile: { firstNameEn: `Bravo${runId}`, middleNameEn: '', lastNameEn: 'Tester', schoolName: 'Sheet School', contactEmail: `bravo${runId.toLowerCase()}-${runId}@example.test`, contactPhone: '0812345678', address: {} },
        items: [{ applicationItemId: appB.item2, roundId: round2, gradeId, format: 'paper', centerId }],
      }, adminId);

      const clearJob = (await db.query("SELECT id,payload FROM integration_jobs WHERE kind='sheets.clear_row' ORDER BY id DESC LIMIT 1")).rows[0];
      assert.equal(clearJob.payload.applicationItemId, appB.item1);
      assert.equal(clearJob.payload.spreadsheetId, mock.state.spreadsheetId);
      assert.equal(clearJob.payload.sheetId, mock.state.sheetId);
      assert.equal(clearJob.payload.sheetTitle, mock.state.sheetTitle);

      // Before worker executes: admin sorts descending AND inserts a new row at the top!
      // Row order becomes: [Inserted-Note-Row, Charlie, Bravo, Alpha]
      mock.sortRowsDescendingByFirstName();
      mock.insertBlankRowAtTop();
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`);
      assert.equal(mock.state.rows[2][11], `Bravo${runId}`);
      assert.equal(mock.state.rows[3][11], `Alpha${runId}`);

      // Process only our clear job (complete any non-clear sync jobs first or run directly)
      await db.query("UPDATE integration_jobs SET status='completed' WHERE id <> $1", [clearJob.id]);
      const processed = await processIntegrationJob();
      assert.equal(processed, true);
      const finishedJob = (await db.query('SELECT status,last_error FROM integration_jobs WHERE id=$1', [clearJob.id])).rows[0];
      assert.equal(finishedJob.status, 'completed', finishedJob.last_error || '');
      assert.equal(mock.state.clearByDataFilterCalls, 1, 'must clear via values:batchClearByDataFilter');

      // Verify ONLY Bravo was cleared; Inserted row, Charlie, and Alpha are 100% intact!
      assert.equal(mock.state.rows[0][0], 'Inserted-Note-Row');
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`);
      assert.ok(mock.state.rows[2].every((cell) => cell === ''), 'Bravo row must be cleared');
      assert.equal(mock.state.rows[3][11], `Alpha${runId}`);

      // Re-running the same clear payload is an idempotent no-op and touches zero other rows
      const rerun = await clearGoogleWorkspaceSheetRow(clearJob.payload);
      assert.equal(rerun.alreadyCleared, true);
      assert.equal(rerun.cleared, false);
      assert.equal(mock.state.clearByDataFilterCalls, 1);
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`);
      assert.equal(mock.state.rows[3][11], `Alpha${runId}`);

      // Target mismatch stops and records error reason without clearing
      await assert.rejects(
        clearGoogleWorkspaceSheetRow({ ...clearJob.payload, applicationItemId: appA.item1, spreadsheetId: 'wrong-spreadsheet-id' }),
        /target mismatch/i,
      );
      assert.equal(mock.state.rows[3][11], `Alpha${runId}`);

      // Duplicate metadata for target item stops without clearing any row
      const alphaMeta = mock.state.metadata.find((m) => m.metadataValue === appA.item1);
      mock.state.metadata.push({
        metadataId: 9999,
        metadataKey: APPLICATION_ITEM_METADATA_KEY,
        metadataValue: appA.item1,
        visibility: 'DOCUMENT',
        location: { dimensionRange: { ...alphaMeta.location.dimensionRange } },
      });
      await assert.rejects(
        clearGoogleWorkspaceSheetRow({ applicationItemId: appA.item1, examRoundId: round1, spreadsheetId: mock.state.spreadsheetId, sheetId: mock.state.sheetId, sheetTitle: mock.state.sheetTitle }),
        /Duplicate application row metadata/,
      );
      assert.equal(mock.state.rows[3][11], `Alpha${runId}`);
      mock.state.metadata = mock.state.metadata.filter((m) => m.metadataId !== 9999);

      // Legacy queued job ({ examRoundId, spreadsheetRow } without applicationItemId):
      // Case 1: row index now points to LIVE active item Charlie (row 3 = index 1 in state.rows) -> MUST STOP and preserve Charlie!
      const legacyLiveJobId = await enqueueIntegrationJob(db, 'sheets.clear_row', { examRoundId: round1, spreadsheetRow: 3 }, `legacy-live-${runId}`);
      await processIntegrationJob();
      const legacyLiveResult = (await db.query('SELECT status,last_error FROM integration_jobs WHERE id=$1', [legacyLiveJobId])).rows[0];
      assert.equal(legacyLiveResult.status, 'failed');
      assert.match(legacyLiveResult.last_error, /belongs to active application item/);
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`, 'active applicant row must remain untouched');

      // Case 2: row index points to a deleted item (simulate Alpha deleted from DB before legacy job runs) -> safely resolves metadata and clears ONLY Alpha!
      await db.query('DELETE FROM application_items WHERE id=$1', [appA.item1]);
      const legacyDeletedOutcome = await clearGoogleWorkspaceSheetRow({ examRoundId: round1, spreadsheetRow: 5 });
      assert.equal(legacyDeletedOutcome.cleared, true);
      assert.ok(mock.state.rows[3].every((cell) => cell === ''), 'deleted Alpha row must be cleared');
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`, 'Charlie must still be intact');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
