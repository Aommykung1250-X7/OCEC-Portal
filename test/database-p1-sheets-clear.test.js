import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import test from 'node:test';
import {
  APPLICATION_HEADERS,
  APPLICATION_HEADERS_WITH_MIDDLE,
  APPLICATION_ITEM_METADATA_KEY,
  LEGACY_APPLICATION_HEADERS,
} from '../server/applicationSheetLayout.js';
import { createIndividualDraft, updateAdminApplication } from '../server/applications.js';
import { getPool } from '../server/db.js';
import { syncGoogleWorkspaceSheetItem } from '../server/googleWorkspace.js';
import { enqueueIntegrationJob, integrationQueueStatus, retryIntegrationJob } from '../server/integrationQueue.js';
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
    dataFilterUpdates: [],
    staticClearUpdateCells: [],
    formatMutations: [],
    onAfterMetadataSearch: null,
    onAfterBatchGet: null,
    batchGetResponseOverride: null,
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
        if (state.batchGetResponseOverride) {
          const override = state.batchGetResponseOverride;
          state.batchGetResponseOverride = null;
          return Response.json(typeof override === 'function' ? override(body) : override);
        }
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
            const trimmed = [...row];
            while (trimmed.length && trimmed[trimmed.length - 1] === '') trimmed.pop();
            valueRanges.push({
              dataFilters: [filter],
              valueRange: {
                range: `'${state.sheetTitle}'!A${rowNumber}:${columnLetter(row.length)}${rowNumber}`,
                majorDimension: 'ROWS',
                ...(trimmed.length ? { values: [trimmed] } : {}),
              },
            });
          }
        }
        if (state.onAfterBatchGet) {
          const hook = state.onAfterBatchGet;
          state.onAfterBatchGet = null;
          hook({ body, valueRanges });
        }
        return Response.json({ spreadsheetId: state.spreadsheetId, valueRanges });
      }
      if (path.endsWith('/values:batchUpdateByDataFilter')) {
        state.writeRequests.push({ method: options.method || 'POST', path, body: structuredClone(body) });
        state.dataFilterUpdates.push(structuredClone(body));
        const responses = [];
        let totalUpdatedRows = 0;
        let totalUpdatedColumns = 0;
        let totalUpdatedCells = 0;
        for (const entry of body.data || []) {
          const lookup = entry.dataFilter?.developerMetadataLookup || {};
          const values = entry.values?.[0] || [];
          for (const meta of state.metadata) {
            if (!matchesDeveloperMetadata(meta, lookup)) continue;
            const dim = meta.location.dimensionRange;
            if (dim.sheetId !== state.sheetId) continue;
            const row = state.rows[dim.startIndex - 1];
            if (!row) continue;
            for (let col = 0; col < values.length; col += 1) {
              row[col] = values[col];
            }
            const rowNumber = dim.startIndex + 1;
            const updatedColumns = values.length;
            responses.push({
              spreadsheetId: state.spreadsheetId,
              updatedRange: `'${state.sheetTitle}'!A${rowNumber}:${columnLetter(updatedColumns)}${rowNumber}`,
              updatedRows: 1,
              updatedColumns,
              updatedCells: updatedColumns,
              dataFilter: entry.dataFilter,
            });
            totalUpdatedRows += 1;
            totalUpdatedColumns = Math.max(totalUpdatedColumns, updatedColumns);
            totalUpdatedCells += updatedColumns;
          }
        }
        return Response.json({
          spreadsheetId: state.spreadsheetId,
          totalUpdatedRows,
          totalUpdatedColumns,
          totalUpdatedCells,
          totalUpdatedSheets: responses.length ? 1 : 0,
          responses,
        });
      }
      if (path.endsWith('/values:batchClearByDataFilter')) {
        state.writeRequests.push({ method: options.method || 'POST', path, body: structuredClone(body) });
        throw new Error(`Unexpected batchClearByDataFilter request (would wipe staff columns AA+): ${path}`);
      }
      if (path.endsWith(':batchUpdate')) {
        state.writeRequests.push({ method: 'POST', path, body: structuredClone(body) });
        for (const req of body.requests || []) {
          if (req.repeatCell || req.updateSheetProperties || req.setBasicFilter || req.updateDimensionProperties || req.deleteDimension) {
            state.formatMutations.push(structuredClone(req));
          }
          if (req.updateCells && req.updateCells.start) {
            const rowIndex = req.updateCells.start.rowIndex;
            const values = req.updateCells.rows[0].values.map((cell) => cell.userEnteredValue.stringValue ?? cell.userEnteredValue.numberValue ?? '');
            if (rowIndex > 0 && values.every((v) => v === '')) {
              state.staticClearUpdateCells.push(structuredClone(req));
            }
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

  function swapRowsWithMetadata(indexA, indexB) {
    const metasA = state.metadata.filter((m) => m.location.dimensionRange.sheetId === state.sheetId && m.location.dimensionRange.startIndex === indexA + 1);
    const metasB = state.metadata.filter((m) => m.location.dimensionRange.sheetId === state.sheetId && m.location.dimensionRange.startIndex === indexB + 1);
    [state.rows[indexA], state.rows[indexB]] = [state.rows[indexB], state.rows[indexA]];
    for (const m of metasA) {
      m.location.dimensionRange.startIndex = indexB + 1;
      m.location.dimensionRange.endIndex = indexB + 2;
    }
    for (const m of metasB) {
      m.location.dimensionRange.startIndex = indexA + 1;
      m.location.dimensionRange.endIndex = indexA + 2;
    }
  }

  return { state, fetchMock, sortRowsDescendingByFirstName, insertRowAtTop, swapRowsWithMetadata };
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

  test('worker stops read-only on target/header/duplicate/Sort-range/legacy-job mismatches, automatically clears ONLY target A:Z via metadata-bound batchUpdateByDataFilter even after mid-flight sort and row insertion, preserves header/formatting/other applicants/AA+ staff columns, and is idempotent on re-run', async () => {
    const db = getPool();
    const runId = randomBytes(4).toString('hex');
    const mock = createStatefulSheetsMock();
    mock.state.spreadsheetId = `mock-sheet-workbook-oc05-${runId}`;
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
      const expectedHeaders = [...mock.state.headers];

      // Admin removes round1 item from appA -> enqueues sheets.clear_row with target & expectedRowIdentity
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
      mock.state.writeRequests.length = 0;
      mock.state.dataFilterUpdates.length = 0;
      mock.state.staticClearUpdateCells.length = 0;
      mock.state.formatMutations.length = 0;

      // 1) Pre-write Sort range in-place row swap (Bravo -> row 2, Alpha -> row 3) while DeveloperMetadata stays on row 2 ->
      //    detected BEFORE any write -> MANUAL_REVIEW_REQUIRED, ZERO writes, all data & AA:AB intact!
      let searchSawRow2 = false;
      mock.state.onAfterMetadataSearch = ({ matched }) => {
        searchSawRow2 = matched.length === 1 && matched[0].developerMetadata.location.dimensionRange.startIndex === 1;
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
      assert.equal(mock.state.rows[0][11], `Bravo${runId}`);
      assert.deepEqual(mock.state.rows[0].slice(APPLICATION_HEADERS.length), ['Bravo Staff Note', 'Officer 2']);
      assert.equal(mock.state.rows[1][11], `Alpha${runId}`);
      assert.deepEqual(mock.state.rows[1].slice(APPLICATION_HEADERS.length), ['Alpha Staff Note', 'Officer 1']);
      assert.equal(mock.state.rows[2][11], `Charlie${runId}`);
      assert.deepEqual(mock.state.rows[2].slice(APPLICATION_HEADERS.length), ['Charlie Staff Note', 'Officer 3']);

      // Restore Alpha to row 2, Bravo to row 3
      [mock.state.rows[0], mock.state.rows[1]] = [mock.state.rows[1], mock.state.rows[0]];

      // 2) Empty metadata row while Applicant A's data moved to row 3 (no prior clear record) -> MANUAL_REVIEW_REQUIRED, ZERO writes!
      const savedRowsBeforeMove = structuredClone(mock.state.rows);
      mock.state.rows = [
        [...Array(APPLICATION_HEADERS.length).fill(''), 'Row 2 Staff Note', 'Officer 0'],
        structuredClone(savedRowsBeforeMove[0]),
        structuredClone(savedRowsBeforeMove[1]),
        structuredClone(savedRowsBeforeMove[2]),
      ];
      const movedDataEmptyMetaRowJobId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `moved-data-empty-meta-row-${runId}`);
      await processIntegrationJob();
      const movedDataEmptyMetaRowJob = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [movedDataEmptyMetaRowJobId])).rows[0];
      assert.equal(movedDataEmptyMetaRowJob.status, 'failed');
      assert.equal(movedDataEmptyMetaRowJob.attempts, 8);
      assert.match(movedDataEmptyMetaRowJob.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(movedDataEmptyMetaRowJob.last_error, /without a prior clear record/);
      assert.equal(mock.state.writeRequests.length, 0);
      assert.equal(mock.state.rows[1][11], `Alpha${runId}`);
      mock.state.rows = savedRowsBeforeMove;

      // 3) Same tab title, different sheetId (777 with legacy headers) -> read-only target check catches it -> MANUAL_REVIEW_REQUIRED, ZERO writes!
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
      assert.equal(mock.state.writeRequests.length, 0);
      assert.deepEqual(mock.state.headers, LEGACY_APPLICATION_HEADERS);
      mock.state.sheetId = savedSheetId;

      // 4) Legacy 37-column headers on matching sheetId -> MANUAL_REVIEW_REQUIRED, ZERO writes!
      const legacy37JobId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `legacy-37-headers-${runId}`);
      await processIntegrationJob();
      const legacy37Job = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [legacy37JobId])).rows[0];
      assert.equal(legacy37Job.status, 'failed');
      assert.equal(legacy37Job.attempts, 8);
      assert.match(legacy37Job.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(legacy37Job.last_error, /Legacy 37-column/);
      assert.equal(mock.state.writeRequests.length, 0);

      // 5) Legacy 27-column headers -> MANUAL_REVIEW_REQUIRED, ZERO writes!
      mock.state.headers = [...APPLICATION_HEADERS_WITH_MIDDLE];
      const legacy27JobId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `legacy-27-headers-${runId}`);
      await processIntegrationJob();
      const legacy27Job = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [legacy27JobId])).rows[0];
      assert.equal(legacy27Job.status, 'failed');
      assert.equal(legacy27Job.attempts, 8);
      assert.match(legacy27Job.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(legacy27Job.last_error, /Legacy 27-column/);
      assert.equal(mock.state.writeRequests.length, 0);
      mock.state.headers = savedHeaders;

      // 6) Cross-tab duplicate metadata -> MANUAL_REVIEW_REQUIRED, ZERO writes!
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

      // 7) Legacy row-only jobs (no applicationItemId) MUST ALWAYS stop as MANUAL_REVIEW_REQUIRED with ZERO writes!
      const legacyRowOnlyJobId = await enqueueIntegrationJob(db, 'sheets.clear_row', { examRoundId: round1, spreadsheetRow: 2 }, `legacy-row-only-${runId}`);
      await processIntegrationJob();
      const legacyRowOnlyJob = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [legacyRowOnlyJobId])).rows[0];
      assert.equal(legacyRowOnlyJob.status, 'failed');
      assert.equal(legacyRowOnlyJob.attempts, 8);
      assert.match(legacyRowOnlyJob.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      const queueStatus = await integrationQueueStatus();
      assert.equal(queueStatus.jobs.find((j) => Number(j.id) === Number(legacyRowOnlyJobId))?.manualReviewRequired, true);
      assert.equal(mock.state.writeRequests.length, 0);

      // 8) Missing metadata WITHOUT a matching (applicationItemId, spreadsheetId, sheetId) cleared audit
      //    (even if a legacy status='completed' job, legacy 'verified_empty' audit, or wrong-tab 'cleared' audit exists!) -> MANUAL_REVIEW_REQUIRED, ZERO writes!
      await db.query(
        `INSERT INTO integration_jobs(kind,payload,dedupe_key,status,completed_at)
         VALUES('sheets.clear_row',$1,$2,'completed',now())`,
        [clearJob.payload, `legacy-completed-no-audit-${runId}`],
      );
      await db.query(
        `INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data)
         VALUES
           (NULL,'google_sheet_row_clear',$1,'verified_empty',$2),
           (NULL,'google_sheet_row_clear',$1,'cleared',$3)`,
        [
          appA.item1,
          { applicationItemId: appA.item1, spreadsheetId: mock.state.spreadsheetId, sheetId: mock.state.sheetId, verifiedEmpty: true },
          { applicationItemId: appA.item1, spreadsheetId: mock.state.spreadsheetId, sheetId: mock.state.otherSheetId, cleared: true },
        ],
      );
      const savedAlphaMeta = mock.state.metadata.find((m) => m.metadataValue === appA.item1);
      mock.state.metadata = mock.state.metadata.filter((m) => m.metadataValue !== appA.item1);
      const missingMetaBlockedId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `missing-meta-blocked-${runId}`);
      await processIntegrationJob();
      const missingMetaBlocked = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [missingMetaBlockedId])).rows[0];
      assert.equal(missingMetaBlocked.status, 'failed');
      assert.equal(missingMetaBlocked.attempts, 8);
      assert.match(missingMetaBlocked.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(missingMetaBlocked.last_error, /metadata was not found/);
      assert.equal(mock.state.writeRequests.length, 0);
      mock.state.metadata.push(savedAlphaMeta);

      // 9) Metadata disappears between search and pre-write read -> MANUAL_REVIEW_REQUIRED, ZERO writes!
      mock.state.onAfterMetadataSearch = () => {
        mock.state.metadata = mock.state.metadata.filter((m) => m.metadataValue !== appA.item1);
      };
      const vanishedMetaJobId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `vanished-meta-mid-read-${runId}`);
      await processIntegrationJob();
      const vanishedMetaJob = (await db.query('SELECT status,attempts,last_error FROM integration_jobs WHERE id=$1', [vanishedMetaJobId])).rows[0];
      assert.equal(vanishedMetaJob.status, 'failed');
      assert.equal(vanishedMetaJob.attempts, 8);
      assert.match(vanishedMetaJob.last_error, /^MANUAL_REVIEW_REQUIRED:/);
      assert.match(vanishedMetaJob.last_error, /metadata disappeared or could not be read/);
      assert.equal(mock.state.writeRequests.length, 0);
      mock.state.metadata.push(savedAlphaMeta);

      // 10) AUTOMATIC CLEAR succeeds accurately even when SORT + ROW INSERTION occur AFTER search/read and BEFORE write!
      //     Before retry: Row 2 = Alpha, Row 3 = Bravo, Row 4 = Charlie.
      //     After batchGetByDataFilter (which sees Alpha on Row 2) and BEFORE values:batchUpdateByDataFilter:
      //       sortRowsDescendingByFirstName() + insertRowAtTop()
      //       => Row 2 = Inserted, Row 3 = Charlie, Row 4 = Bravo, Row 5 = Alpha (metadata moves with rows).
      const retried = await retryIntegrationJob(clearJob.id, adminId);
      assert.equal(retried?.status, 'pending');
      mock.state.onAfterBatchGet = () => {
        mock.sortRowsDescendingByFirstName();
        mock.insertRowAtTop();
      };
      assert.equal(await processIntegrationJob(), true);
      const completedClearJob = (await db.query('SELECT status,last_error,completed_at FROM integration_jobs WHERE id=$1', [clearJob.id])).rows[0];
      assert.equal(completedClearJob.status, 'completed', completedClearJob.last_error || '');
      assert.equal(completedClearJob.last_error, null);
      assert.ok(completedClearJob.completed_at);

      // Verify write mechanics: 1 metadata-bound batchUpdateByDataFilter (26 empty cells), 0 static-row clears, 0 format mutations
      assert.equal(mock.state.dataFilterUpdates.length, 1);
      assert.equal(mock.state.dataFilterUpdates[0].data[0].dataFilter.developerMetadataLookup.metadataValue, appA.item1);
      assert.equal(mock.state.dataFilterUpdates[0].data[0].values[0].length, APPLICATION_HEADERS.length);
      assert.equal(mock.state.staticClearUpdateCells.length, 0);
      assert.equal(mock.state.formatMutations.length, 0);
      assert.deepEqual(mock.state.headers, expectedHeaders, 'header row must remain untouched');

      // Row 2 (Inserted — Alpha's old row!), Row 3 (Charlie), Row 4 (Bravo) and ALL staff cols AA:AB are 100% intact:
      assert.equal(mock.state.rows[0][0], 'Inserted-Note-Row');
      assert.deepEqual(mock.state.rows[0].slice(APPLICATION_HEADERS.length), ['Top Staff Note', 'Staff X']);
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`);
      assert.deepEqual(mock.state.rows[1].slice(APPLICATION_HEADERS.length), ['Charlie Staff Note', 'Officer 3']);
      assert.equal(mock.state.rows[2][11], `Bravo${runId}`);
      assert.deepEqual(mock.state.rows[2].slice(APPLICATION_HEADERS.length), ['Bravo Staff Note', 'Officer 2']);
      // Row 5 (Alpha's moved row) has ONLY A:Z cleared while Alpha's staff columns AA:AB are preserved!
      assert.deepEqual(mock.state.rows[3].slice(0, APPLICATION_HEADERS.length), Array(APPLICATION_HEADERS.length).fill(''));
      assert.deepEqual(mock.state.rows[3].slice(APPLICATION_HEADERS.length), ['Alpha Staff Note', 'Officer 1']);
      assert.equal(mock.state.metadata.some((m) => m.metadataValue === appA.item1), false);
      assert.equal((await db.query('SELECT 1 FROM google_workspace_sheet_rows WHERE application_item_id=$1', [appA.item1])).rowCount, 0);

      // Audit log records explicit target-bound automatic clear evidence
      const clearAudit = (await db.query(
        `SELECT after_data FROM audit_logs
         WHERE entity_type='google_sheet_row_clear' AND entity_id=$1 AND action='cleared'
           AND after_data->>'sheetId' = $2
         ORDER BY id DESC LIMIT 1`,
        [appA.item1, String(mock.state.sheetId)],
      )).rows[0];
      assert.ok(clearAudit, 'must record cleared audit log bound to exact spreadsheetId + sheetId');
      assert.equal(clearAudit.after_data.cleared, true);
      assert.equal(clearAudit.after_data.spreadsheetId, mock.state.spreadsheetId);
      assert.equal(clearAudit.after_data.sheetId, mock.state.sheetId);
      assert.equal(clearAudit.after_data.rowNumber, 5);
      assert.equal(clearAudit.after_data.clearedColumnCount, APPLICATION_HEADERS.length);

      // 11) Idempotent re-run of appA.item1 after confirmed clear -> COMPLETED, ZERO extra Google writes, other rows untouched!
      const writesBeforeIdempotent = mock.state.writeRequests.length;
      const rerunJobId = await enqueueIntegrationJob(db, 'sheets.clear_row', clearJob.payload, `idempotent-rerun-${runId}`);
      assert.equal(await processIntegrationJob(), true);
      const rerunJob = (await db.query('SELECT status,last_error FROM integration_jobs WHERE id=$1', [rerunJobId])).rows[0];
      assert.equal(rerunJob.status, 'completed', rerunJob.last_error || '');
      assert.equal(mock.state.writeRequests.length, writesBeforeIdempotent, 'idempotent re-run must send ZERO Google writes');
      assert.equal(mock.state.rows[1][11], `Charlie${runId}`);
      assert.equal(mock.state.rows[2][11], `Bravo${runId}`);
      assert.deepEqual(mock.state.rows[3].slice(APPLICATION_HEADERS.length), ['Alpha Staff Note', 'Officer 1']);

      // 12) Direct swap test: Admin removes round1 from Bravo (currently Row 4), and between read and write
      //     Charlie (Row 3) swaps DIRECTLY into Bravo's old Row 4 while Bravo moves to Row 3 ->
      //     ONLY Bravo's moved Row 3 A:Z is cleared; Charlie (now sitting in Bravo's old Row 4!) stays 100% intact!
      await updateAdminApplication(appB.appId, {
        profile: { firstNameEn: `Bravo${runId}`, middleNameEn: '', lastNameEn: 'Tester', schoolName: 'Sheet School', contactEmail: `bravo${runId.toLowerCase()}-${runId}@example.test`, contactPhone: '0812345678', address: {} },
        items: [{ applicationItemId: appB.item2, roundId: round2, gradeId, format: 'paper', centerId }],
      }, adminId);
      const clearBravoJob = (await db.query("SELECT id FROM integration_jobs WHERE kind='sheets.clear_row' AND status='pending' ORDER BY id DESC LIMIT 1")).rows[0];
      await db.query("UPDATE integration_jobs SET status='completed' WHERE status='pending' AND id <> $1", [clearBravoJob.id]);
      mock.state.onAfterBatchGet = () => {
        mock.swapRowsWithMetadata(1, 2); // Charlie moves into Bravo's old Row 4 (index 2); Bravo moves to Row 3 (index 1)
      };
      assert.equal(await processIntegrationJob(), true);
      const completedBravoJob = (await db.query('SELECT status,last_error FROM integration_jobs WHERE id=$1', [clearBravoJob.id])).rows[0];
      assert.equal(completedBravoJob.status, 'completed', completedBravoJob.last_error || '');
      // Row 3 (index 1, Bravo's moved row): A:Z cleared, AA:AB preserved
      assert.deepEqual(mock.state.rows[1].slice(0, APPLICATION_HEADERS.length), Array(APPLICATION_HEADERS.length).fill(''));
      assert.deepEqual(mock.state.rows[1].slice(APPLICATION_HEADERS.length), ['Bravo Staff Note', 'Officer 2']);
      // Row 4 (index 2, Bravo's OLD row, now occupied by Charlie!): 100% intact!
      assert.equal(mock.state.rows[2][11], `Charlie${runId}`, 'Applicant Charlie moved into Bravo old row must stay 100% intact');
      assert.deepEqual(mock.state.rows[2].slice(APPLICATION_HEADERS.length), ['Charlie Staff Note', 'Officer 3']);
      assert.equal(mock.state.staticClearUpdateCells.length, 0);
      assert.equal(mock.state.formatMutations.length, 0);
      assert.deepEqual(mock.state.headers, expectedHeaders);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
