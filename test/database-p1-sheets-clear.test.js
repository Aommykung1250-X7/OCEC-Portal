import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import test from 'node:test';
import { APPLICATION_HEADERS, APPLICATION_HEADERS_WITH_MIDDLE, APPLICATION_ITEM_METADATA_KEY, LEGACY_APPLICATION_HEADERS } from '../server/applicationSheetLayout.js';
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

function columnLetter(count) {
  let value = count;
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function matchesDeveloperMetadata(meta, lookup = {}) {
  if (lookup.metadataId != null && meta.metadataId !== lookup.metadataId) return false;
  if (lookup.metadataKey && meta.metadataKey !== lookup.metadataKey) return false;
  if (lookup.metadataValue && meta.metadataValue !== lookup.metadataValue) return false;
  if (lookup.visibility && meta.visibility !== lookup.visibility) return false;
  const dim = meta.location?.dimensionRange;
  if (lookup.locationType === 'ROW' && dim?.dimension !== 'ROWS') return false;
  if (lookup.metadataLocation?.sheetId != null && Number(dim?.sheetId) !== Number(lookup.metadataLocation.sheetId)) return false;
  return true;
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
    writeRequests: [],
    onAfterMetadataSearch: null,
  };

  const fetchMock = async (url, options = {}) => {
    const target = new URL(url);
    if (target.hostname === 'oauth2.googleapis.com') {
      return Response.json({ access_token: 'mock-access-token', expires_in: 3600 });
    }
    const body = typeof options.body === 'string' && options.body.trim().startsWith('{') ? JSON.parse(options.body) : {};
    if (target.hostname === 'sheets.googleapis.com') {
      const path = decodeURIComponent(target.pathname);
      if (target.searchParams.get('fields')?.includes('sheets.properties')) {
        return Response.json({
          spreadsheetId: state.spreadsheetId,
          sheets: [
            { properties: { sheetId: state.sheetId, title: state.sheetTitle, gridProperties: { rowCount: Math.max(100, state.rows.length + 5), columnCount: state.headers.length } } },
            { properties: { sheetId: state.otherSheetId, title: 'Other Tab', gridProperties: { rowCount: 100, columnCount: 28 } } },
          ],
        });
      }
      if (path.endsWith('/developerMetadata:search')) {
        const lookup = body.dataFilters?.[0]?.developerMetadataLookup || {};
        const matched = state.metadata
          .filter((meta) => matchesDeveloperMetadata(meta, lookup))
          .map((developerMetadata) => ({ developerMetadata: structuredClone(developerMetadata) }));
        if (state.onAfterMetadataSearch) {
          const hook = state.onAfterMetadataSearch;
          state.onAfterMetadataSearch = null;
          hook({ lookup, matched });
        }
        return Response.json({ matchedDeveloperMetadata: matched });
      }
      if (path.endsWith('/values:batchGetByDataFilter')) {
        const valueRanges = [];
        for (const filter of body.dataFilters || []) {
          const lookup = filter.developerMetadataLookup || {};
          for (const meta of state.metadata) {
            if (!matchesDeveloperMetadata(meta, lookup)) continue;
            const dim = meta.location.dimensionRange;
            if (dim.sheetId !== state.sheetId) continue;
            const row = state.rows[dim.startIndex - 1];
            if (!row) continue;
            const rowNumber = dim.startIndex + 1;
            valueRanges.push({
              dataFilters: [filter],
              valueRange: {
                range: `'${state.sheetTitle}'!A${rowNumber}:${columnLetter(row.length)}${rowNumber}`,
                majorDimension: 'ROWS',
                values: [structuredClone(row)],
              },
            });
          }
        }
        return Response.json({ spreadsheetId: state.spreadsheetId, valueRanges });
      }
      if (path.endsWith('/values:batchUpdateByDataFilter') || path.endsWith('/values:batchClearByDataFilter')) {
        state.writeRequests.push({ method: options.method || 'POST', path, body: structuredClone(body) });
        throw new Error(`Unexpected destructive write request during fail-closed clear: ${path}`);
      }
      if (path.endsWith(':batchUpdate')) {
        state.writeRequests.push({ method: 'POST', path, body: structuredClone(body) });
        for (const req of body.requests || []) {
          if (req.updateCells && req.updateCells.start) {
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
            state.metadata = state.metadata.filter((meta) => !matchesDeveloperMetadata(meta, lookup));
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
        state.writeRequests.push({ method: 'PUT', path, body: structuredClone(body) });
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

  test('worker performs read-only target/header/identity checks, stops as MANUAL_REVIEW_REQUIRED with zero Google writes on same-name/different-sheetId, legacy headers, Sort-range row swap, mid-flight row insertion, duplicates, and legacy row-only jobs, and is idempotent once cleared', async () => {
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

    const appA = await makeApprovedApp(`Alpha${runId}`, true);
    const appB = await makeApprovedApp(`Bravo${runId}`);
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

      // Admin removes round1 item from appA -> enqueues sheets.clear_row with expectedRowIdentity
      await updateAdminApplication(appA.appId, {
        profile: { firstNameEn: `Alpha${runId}`, middleNameEn: '', lastNameEn: 'Tester', schoolName: 'Sheet School', contactEmail: `alpha${runId.toLowerCase()}-${runId}@example.test`, contactPhone: '0812345678', address: {} },
        items: [{ applicationItemId: appA.item2, roundId: round2, gradeId, format: 'paper', centerId }],
      }, adminId);

      const clearJob = (await db.query("SELECT id,payload FROM integration_jobs WHERE kind='sheets.clear_row' ORDER BY id DESC LIMIT 1")).rows[0];
      assert.equal(clearJob.payload.applicationItemId, appA.item1);
      assert.equal(clearJob.payload.spreadsheetId, mock.state.spreadsheetId);
      assert.equal(clearJob.payload.sheetId, mock.state.sheetId);
      assert.equal(clearJob.payload.sheetTitle, mock.state.sheetTitle);
      assert.equal(clearJob.payload.expectedRowIdentity.firstNameEn, `Alpha${runId}`);
      assert.equal(clearJob.payload.expectedRowIdentity.competition, 'BBB');
      assert.equal(clearJob.payload.expectedRowIdentity.grade, 'Primary 1');

      await db.query("UPDATE integration_jobs SET status='completed' WHERE id <> $1", [clearJob.id]);
      mock.state.writeRequests.length = 0; // Track ONLY writes triggered by clear jobs from here on!

      // 1) Sort range swaps row data IN PLACE (Bravo -> row 2, Alpha -> row 3) while DeveloperMetadata stays on row 2
      //    right after developerMetadata:search returns row 2 -> detected BEFORE any write -> MANUAL_REVIEW_REQUIRED, 0 writes!
      let searchSawRow2 = false;
      mock.state.onAfterMetadataSearch = ({ matched }) => {
        searchSawRow2 = matched.length === 1 && matched[0].developerMetadata.location.dimensionRange.startIndex === 1;
        // Swap row 2 (Alpha) and row 3 (Bravo) cell values WITHOUT moving DeveloperMetadata!
        [mock.state.rows[0], mock.state.rows[1]] = [mock.state.rows[1], mock.state.rows[0]];
      };
      assert.equal(await processIntegrationJob(), true);
      const sortSwapJob = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [clearJob.id])).rows[0];
      assert.equal(searchSawRow2, true);
      assert.equal(sortSwapJob.status, 'failed');
      assert.equal(sortSwapJob.attempts, 8, 'manual-review job must not auto-retry');
      assert.match(sortSwapJob.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(sortSwapJob.last_error, /possible Sort range row swap/);
      assert.equal(mock.state.writeRequests.length, 0, 'Sort range swap must send ZERO writes to Google');
      // Bravo (now row 2), Alpha (now row 3), Charlie (row 4), and ALL staff columns AA:AB are 100% intact!
      assert.equal(mock.state.rows[0][11], `Bravo${runId}`);
      assert.deepEqual(mock.state.rows[0].slice(APPLICATION_HEADERS.length), ['Bravo Staff Note', 'Officer 2']);
      assert.equal(mock.state.rows[1][11], `Alpha${runId}`);
      assert.deepEqual(mock.state.rows[1].slice(APPLICATION_HEADERS.length), ['Alpha Staff Note', 'Officer 1']);
      assert.equal(mock.state.rows[2][11], `Charlie${runId}`);
      assert.deepEqual(mock.state.rows[2].slice(APPLICATION_HEADERS.length), ['Charlie Staff Note', 'Officer 3']);

      // Restore Alpha to row 2, Bravo to row 3
      [mock.state.rows[0], mock.state.rows[1]] = [mock.state.rows[1], mock.state.rows[0]];

      // 2) Same tab title, different sheetId (tab recreated as sheetId 777 with legacy headers) ->
      //    read-only target check catches it -> MANUAL_REVIEW_REQUIRED, ZERO writes (no migration!)
      const savedSheetId = mock.state.sheetId;
      const savedHeaders = [...mock.state.headers];
      mock.state.sheetId = 777;
      mock.state.headers = [...LEGACY_APPLICATION_HEADERS];
      const diffSheetIdJobId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `same-name-diff-id-${runId}`);
      await processIntegrationJob();
      const diffSheetIdJob = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [diffSheetIdJobId])).rows[0];
      assert.equal(diffSheetIdJob.status, 'failed');
      assert.equal(diffSheetIdJob.attempts, 8);
      assert.match(diffSheetIdJob.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(diffSheetIdJob.last_error, /expected sheetId 42, found 777/);
      assert.equal(mock.state.writeRequests.length, 0, 'different sheetId must send ZERO writes to Google');
      assert.deepEqual(mock.state.headers, LEGACY_APPLICATION_HEADERS, 'legacy headers must remain untouched');
      mock.state.sheetId = savedSheetId;

      // 3) Legacy 37-column headers on matching sheetId -> MANUAL_REVIEW_REQUIRED, ZERO writes!
      const legacy37JobId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `legacy-37-headers-${runId}`);
      await processIntegrationJob();
      const legacy37Job = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [legacy37JobId])).rows[0];
      assert.equal(legacy37Job.status, 'failed');
      assert.equal(legacy37Job.attempts, 8);
      assert.match(legacy37Job.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(legacy37Job.last_error, /Legacy 37-column/);
      assert.equal(mock.state.writeRequests.length, 0, 'legacy 37-col headers must send ZERO writes to Google');

      // 4) Legacy 27-column headers (with middle name) -> MANUAL_REVIEW_REQUIRED, ZERO writes!
      mock.state.headers = [...APPLICATION_HEADERS_WITH_MIDDLE];
      const legacy27JobId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `legacy-27-headers-${runId}`);
      await processIntegrationJob();
      const legacy27Job = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [legacy27JobId])).rows[0];
      assert.equal(legacy27Job.status, 'failed');
      assert.equal(legacy27Job.attempts, 8);
      assert.match(legacy27Job.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(legacy27Job.last_error, /Legacy 27-column/);
      assert.equal(mock.state.writeRequests.length, 0, 'legacy 27-col headers must send ZERO writes to Google');
      mock.state.headers = savedHeaders;

      // 5) Row insertion + sort after search and before clear -> fail-closed BEFORE any write -> MANUAL_REVIEW_REQUIRED, ZERO writes!
      mock.state.onAfterMetadataSearch = () => {
        mock.sortRowsDescendingByFirstName();
        mock.insertRowAtTop();
      };
      const midFlightInsertJobId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `midflight-insert-${runId}`);
      await processIntegrationJob();
      const midFlightInsertJob = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [midFlightInsertJobId])).rows[0];
      assert.equal(midFlightInsertJob.status, 'failed');
      assert.equal(midFlightInsertJob.attempts, 8);
      assert.match(midFlightInsertJob.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(midFlightInsertJob.last_error, /no write was sent to Google/);
      assert.equal(mock.state.writeRequests.length, 0, 'fail-closed clear must send ZERO writes to Google');
      // Row order is now [Inserted (row 2), Charlie (row 3), Bravo (row 4), Alpha (row 5)] — ALL data & staff cols intact!
      assert.equal(mock.state.rows[0][0], 'Inserted-Note-Row');
      assert.deepEqual(mock.state.rows[0].slice(APPLICATION_HEADERS.length), ['Top Staff Note', 'Staff X']);
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`);
      assert.deepEqual(mock.state.rows[1].slice(APPLICATION_HEADERS.length), ['Charlie Staff Note', 'Officer 3']);
      assert.equal(mock.state.rows[2][11], `Bravo${runId}`);
      assert.deepEqual(mock.state.rows[2].slice(APPLICATION_HEADERS.length), ['Bravo Staff Note', 'Officer 2']);
      assert.equal(mock.state.rows[3][11], `Alpha${runId}`);
      assert.deepEqual(mock.state.rows[3].slice(APPLICATION_HEADERS.length), ['Alpha Staff Note', 'Officer 1']);

      // 6) Cross-tab duplicate metadata (Charlie on sheetId 42 AND sheetId 99) -> MANUAL_REVIEW_REQUIRED, ZERO writes!
      mock.state.metadata.push({
        metadataId: 9999,
        metadataKey: APPLICATION_ITEM_METADATA_KEY,
        metadataValue: appC.item1,
        visibility: 'DOCUMENT',
        location: { dimensionRange: { sheetId: mock.state.otherSheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 } },
      });
      const dupJobId = await enqueueIntegrationJob(db, 'sheets.clear_row', {
        applicationItemId: appC.item1,
        examRoundId: round1,
        spreadsheetId: mock.state.spreadsheetId,
        sheetId: mock.state.sheetId,
        sheetTitle: mock.state.sheetTitle,
      }, `dup-cross-tab-${runId}`);
      await processIntegrationJob();
      const dupJob = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [dupJobId])).rows[0];
      assert.equal(dupJob.status, 'failed');
      assert.equal(dupJob.attempts, 8);
      assert.match(dupJob.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(dupJob.last_error, /Duplicate application row metadata/);
      assert.equal(mock.state.writeRequests.length, 0);
      mock.state.metadata = mock.state.metadata.filter((m) => m.metadataId !== 9999);

      // 7) Legacy row-only jobs (no applicationItemId, no independent evidence) MUST ALWAYS go to MANUAL_REVIEW_REQUIRED with ZERO writes!
      const ambiguousLegacyId = await enqueueIntegrationJob(db, 'sheets.clear_row', { examRoundId: round1, spreadsheetRow: 99 }, `legacy-ambiguous-${runId}`);
      await processIntegrationJob();
      const ambiguousLegacy = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [ambiguousLegacyId])).rows[0];
      assert.equal(ambiguousLegacy.status, 'failed');
      assert.equal(ambiguousLegacy.attempts, 8);
      assert.match(ambiguousLegacy.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      const queueStatus = await integrationQueueStatus();
      assert.equal(queueStatus.jobs.find((j) => Number(j.id) === Number(ambiguousLegacyId))?.manualReviewRequired, true);

      const activeLegacyId = await enqueueIntegrationJob(db, 'sheets.clear_row', { examRoundId: round1, spreadsheetRow: 4 }, `legacy-active-${runId}`);
      await processIntegrationJob();
      const activeLegacy = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [activeLegacyId])).rows[0];
      assert.equal(activeLegacy.status, 'failed');
      assert.equal(activeLegacy.attempts, 8);
      assert.match(activeLegacy.last_error, /^MANUAL_REVIEW_REQUIRED:/);

      await db.query("UPDATE applications SET status='rejected' WHERE id=$1", [appB.appId]);
      const rejectedLegacyId = await enqueueIntegrationJob(db, 'sheets.clear_row', { examRoundId: round1, spreadsheetRow: 3 }, `legacy-rejected-row-only-${runId}`);
      await processIntegrationJob();
      const rejectedLegacy = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [rejectedLegacyId])).rows[0];
      assert.equal(rejectedLegacy.status, 'failed');
      assert.equal(rejectedLegacy.attempts, 8);
      assert.match(rejectedLegacy.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.equal(mock.state.writeRequests.length, 0, 'legacy row-only jobs must send ZERO writes to Google');

      // 8) Idempotent re-run after staff clears A:Z on Alpha's row (preserving staff cols AA:AB) -> completes cleanly with ZERO writes!
      for (let col = 0; col < APPLICATION_HEADERS.length; col += 1) mock.state.rows[3][col] = '';
      const rerunAfterBlank = await clearGoogleWorkspaceSheetRow(clearJob.payload);
      assert.equal(rerunAfterBlank.alreadyCleared, true);
      assert.equal(rerunAfterBlank.cleared, false);
      assert.equal(mock.state.writeRequests.length, 0);
      assert.deepEqual(mock.state.rows[3].slice(APPLICATION_HEADERS.length), ['Alpha Staff Note', 'Officer 1']);
      assert.equal(mock.state.rows[2][11], `Bravo${runId}`);
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`);

      // Idempotent re-run after metadata is also deleted -> completes cleanly with ZERO writes!
      mock.state.metadata = mock.state.metadata.filter((m) => m.metadataValue !== appA.item1);
      const rerunAfterMetaRemoved = await clearGoogleWorkspaceSheetRow(clearJob.payload);
      assert.equal(rerunAfterMetaRemoved.alreadyCleared, true);
      assert.equal(rerunAfterMetaRemoved.cleared, false);
      assert.equal(mock.state.writeRequests.length, 0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
