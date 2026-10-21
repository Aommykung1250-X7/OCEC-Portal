import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { getPool } from './db.js';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SHEETS_API = 'https://sheets.googleapis.com/v4';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1';
const TOKEN_API = 'https://oauth2.googleapis.com/token';
const USERINFO_API = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/spreadsheets',
];
const ROOT_FOLDER_NAME = 'OCEC Portal';
const FOLDER_NAMES = {
  slips: 'Payment Slips',
  photos: 'Certificate Photos',
  sheets: 'Exam Sheets',
};
const SHEET_HEADERS = [
  'Application Item ID', 'Application ID', 'School Batch ID', 'Submitted At', 'Application Status', 'Source',
  'Competition', 'Exam Round', 'Academic Year', 'Exam Date', 'Grade', 'Exam Mode', 'Exam Center', 'Online Exam Email',
  'First Name (EN)', 'Middle Name (EN)', 'Last Name (EN)', 'First Name (TH)', 'Last Name (TH)', 'Date of Birth',
  'School', 'Contact Email', 'Contact Phone', 'Address', 'Past Papers', 'Registration Fee (THB)', 'Past Papers Total (THB)',
  'Invoice Total (THB)', 'Payment Status', 'Payment Account ID', 'Expected Amount (THB)', 'Confirmed Amount (THB)',
  'Transfer Time', 'Confirmed Account Number', 'Slip Drive File ID', 'Exam Number', 'Certificate Photo Drive File ID',
];

let cachedAccessToken = '';
let cachedAccessTokenExpiresAt = 0;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const money = (value) => Number(value || 0) / 100;

function integrationConfig() {
  return {
    clientId: process.env.GOOGLE_INTEGRATION_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_INTEGRATION_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_INTEGRATION_REDIRECT_URI || (process.env.APP_ORIGIN ? new URL('/api/admin/google-workspace/callback', process.env.APP_ORIGIN).toString() : ''),
    encryptionKey: process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY,
  };
}

export function googleWorkspaceConfigured() {
  const config = integrationConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri && config.encryptionKey);
}

function assertConfigured() {
  const config = integrationConfig();
  const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Google Workspace integration is missing configuration: ${missing.join(', ')}`);
  encryptionKey();
  return config;
}

function encryptionKey() {
  const raw = process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY || '';
  let key;
  try { key = Buffer.from(raw, 'base64'); } catch { key = Buffer.alloc(0); }
  if (key.length !== 32) throw new Error('GOOGLE_INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return key;
}

function encryptToken(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

function decryptToken(value) {
  const [ivPart, tagPart, dataPart] = String(value || '').split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Stored Google refresh token is invalid');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
}

async function getConnection() {
  const result = await getPool().query('SELECT * FROM google_workspace_connection WHERE singleton=true');
  return result.rows[0] || null;
}

export async function googleWorkspaceStatus() {
  const connection = await getConnection();
  const grantedScopes = connection?.granted_scopes || [];
  return {
    configured: googleWorkspaceConfigured(),
    connected: Boolean(connection),
    accountEmail: connection?.account_email || null,
    connectedAt: connection?.connected_at || null,
    foldersInitialized: Boolean(connection?.drive_root_folder_id && connection?.slip_root_folder_id && connection?.certificate_photo_root_folder_id && connection?.spreadsheet_root_folder_id),
    scopes: grantedScopes,
    missingScopes: GOOGLE_SCOPES.filter((scope) => scope.startsWith('https://') && !grantedScopes.includes(scope)),
  };
}

export async function createGoogleWorkspaceAuthorizationUrl(adminUserId) {
  const config = assertConfigured();
  const state = randomBytes(32).toString('base64url');
  await getPool().query(`INSERT INTO google_workspace_oauth_attempts(state_hash, admin_user_id, expires_at)
    VALUES($1,$2,now()+interval '10 minutes')`, [sha256(state), adminUserId]);
  const query = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent select_account',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${query}`;
}

async function postToken(values) {
  const config = assertConfigured();
  const body = new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...values });
  const response = await fetch(TOKEN_API, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error('Google authorization token exchange failed');
  return data;
}

export async function completeGoogleWorkspaceAuthorization(adminUserId, code, state) {
  assertConfigured();
  if (typeof code !== 'string' || typeof state !== 'string') throw new Error('Google authorization response is incomplete');
  const attempt = await getPool().query(`DELETE FROM google_workspace_oauth_attempts
    WHERE state_hash=$1 AND admin_user_id=$2 AND expires_at>now() RETURNING state_hash`, [sha256(state), adminUserId]);
  if (!attempt.rowCount) throw new Error('Google authorization expired or does not match the current administrator');

  const config = integrationConfig();
  const tokens = await postToken({ code, redirect_uri: config.redirectUri, grant_type: 'authorization_code' });
  if (!tokens.access_token) throw new Error('Google did not return an access token');
  const userResponse = await fetch(USERINFO_API, { headers: { authorization: `Bearer ${tokens.access_token}` } });
  const profile = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !profile.email || profile.email_verified !== true) throw new Error('Google account email could not be verified');

  let encryptedRefreshToken;
  if (tokens.refresh_token) encryptedRefreshToken = encryptToken(tokens.refresh_token);
  else {
    const prior = await getConnection();
    if (!prior || prior.account_email.toLowerCase() !== profile.email.toLowerCase()) {
      throw new Error('Google did not return a refresh token. Revoke the app in Google Account permissions and reconnect with consent.');
    }
    encryptedRefreshToken = prior.encrypted_refresh_token;
  }
  const scopes = typeof tokens.scope === 'string' ? tokens.scope.split(' ').filter(Boolean) : GOOGLE_SCOPES;
  await getPool().query(`INSERT INTO google_workspace_connection(singleton, account_email, encrypted_refresh_token, granted_scopes, connected_by)
    VALUES(true,$1,$2,$3,$4)
    ON CONFLICT (singleton) DO UPDATE SET
      drive_root_folder_id=CASE WHEN google_workspace_connection.account_email=excluded.account_email THEN google_workspace_connection.drive_root_folder_id ELSE NULL END,
      slip_root_folder_id=CASE WHEN google_workspace_connection.account_email=excluded.account_email THEN google_workspace_connection.slip_root_folder_id ELSE NULL END,
      certificate_photo_root_folder_id=CASE WHEN google_workspace_connection.account_email=excluded.account_email THEN google_workspace_connection.certificate_photo_root_folder_id ELSE NULL END,
      spreadsheet_root_folder_id=CASE WHEN google_workspace_connection.account_email=excluded.account_email THEN google_workspace_connection.spreadsheet_root_folder_id ELSE NULL END,
      account_email=excluded.account_email, encrypted_refresh_token=excluded.encrypted_refresh_token,
      granted_scopes=excluded.granted_scopes, connected_by=excluded.connected_by,
      connected_at=now(), updated_at=now()`, [profile.email, encryptedRefreshToken, scopes, adminUserId]);
  cachedAccessToken = tokens.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(0, Number(tokens.expires_in || 3600) - 90) * 1000;
  return { email: profile.email };
}

async function accessToken() {
  if (cachedAccessToken && cachedAccessTokenExpiresAt > Date.now()) return cachedAccessToken;
  const connection = await getConnection();
  if (!connection) throw new Error('Connect a Google account before using Drive, Sheets, or Gmail');
  const refreshToken = decryptToken(connection.encrypted_refresh_token);
  const tokens = await postToken({ refresh_token: refreshToken, grant_type: 'refresh_token' });
  if (!tokens.access_token) throw new Error('Google did not return an access token');
  cachedAccessToken = tokens.access_token;
  cachedAccessTokenExpiresAt = Date.now() + Math.max(0, Number(tokens.expires_in || 3600) - 90) * 1000;
  return cachedAccessToken;
}

async function googleRequest(url, options = {}) {
  const token = await accessToken();
  const response = await fetch(url, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.body && !(options.body instanceof Buffer) ? { 'content-type': 'application/json' } : {}), ...options.headers },
  });
  if (!response.ok) {
    const error = new Error(`Google API request failed (${response.status})`);
    error.statusCode = response.status === 404 ? 404 : 502;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json().catch(() => null);
}

function driveQueryString(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

async function getDriveFile(fileId) {
  if (!fileId) return null;
  try {
    const file = await googleRequest(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,parents,trashed,webViewLink`);
    return file?.trashed ? null : file;
  } catch (error) {
    if (error.statusCode === 404 || String(error.message).includes('(404)')) return null;
    throw error;
  }
}

async function findDriveFolder(parentId, name) {
  const query = [`name='${driveQueryString(name)}'`, "mimeType='application/vnd.google-apps.folder'", 'trashed=false'];
  query.push(parentId ? `'${driveQueryString(parentId)}' in parents` : "'root' in parents");
  const params = new URLSearchParams({ q: query.join(' and '), pageSize: '100', fields: 'files(id,name,mimeType,parents,webViewLink)' });
  const result = await googleRequest(`${DRIVE_API}/files?${params}`);
  return result?.files?.[0] || null;
}

async function createDriveFolder(parentId, name) {
  const body = { name, mimeType: 'application/vnd.google-apps.folder', ...(parentId ? { parents: [parentId] } : {}) };
  const params = new URLSearchParams({ fields: 'id,name,mimeType,parents,webViewLink' });
  return googleRequest(`${DRIVE_API}/files?${params}`, { method: 'POST', body: JSON.stringify(body) });
}

async function ensureDriveFolder(parentId, name, preferredId = '') {
  const existing = await getDriveFile(preferredId);
  if (existing && existing.mimeType === 'application/vnd.google-apps.folder') return existing;
  return await findDriveFolder(parentId, name) || await createDriveFolder(parentId, name);
}

export async function initializeGoogleDriveFolders() {
  const connection = await getConnection();
  if (!connection) throw new Error('Connect a Google account before initializing Drive folders');
  const root = await ensureDriveFolder('', ROOT_FOLDER_NAME, connection.drive_root_folder_id);
  const [slips, photos, sheets] = await Promise.all([
    ensureDriveFolder(root.id, FOLDER_NAMES.slips, connection.slip_root_folder_id),
    ensureDriveFolder(root.id, FOLDER_NAMES.photos, connection.certificate_photo_root_folder_id),
    ensureDriveFolder(root.id, FOLDER_NAMES.sheets, connection.spreadsheet_root_folder_id),
  ]);
  await getPool().query(`UPDATE google_workspace_connection SET drive_root_folder_id=$1, slip_root_folder_id=$2,
    certificate_photo_root_folder_id=$3, spreadsheet_root_folder_id=$4, updated_at=now() WHERE singleton=true`, [root.id, slips.id, photos.id, sheets.id]);
  return { root, slips, photos, sheets };
}

function safeFolderName(value) {
  const name = String(value || '').normalize('NFKC').trim().replace(/[\\/\x00-\x1f]/g, '-').replace(/\s+/g, ' ').slice(0, 100);
  if (!name || name === '.' || name === '..') throw new Error('A valid Drive folder name is required');
  return name;
}

export async function uploadGoogleDriveFile({ category, folders = [], name, mimeType, buffer, existingFileId = '' }) {
  if (!['slips', 'photos'].includes(category)) throw new Error('Drive upload category must be slips or photos');
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new Error('A non-empty file is required');
  if (buffer.length > 12 * 1024 * 1024) throw new Error('File exceeds the 12 MB upload limit');
  const fileName = String(name || '').normalize('NFKC').trim();
  if (!fileName || fileName.length > 180 || /[\\/\x00-\x1f]/.test(fileName) || !/\.[A-Za-z0-9]{1,8}$/.test(fileName)) throw new Error('File name contains unsupported characters');
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(String(mimeType || ''))) throw new Error('Unsupported file type');
  const connection = await getConnection();
  if (!connection) throw new Error('Connect a Google account before uploading files');
  let parentId = category === 'slips' ? connection.slip_root_folder_id : connection.certificate_photo_root_folder_id;
  if (!parentId) {
    const initialized = await initializeGoogleDriveFolders();
    parentId = category === 'slips' ? initialized.slips.id : initialized.photos.id;
  }
  for (const part of folders.map(safeFolderName)) parentId = (await (async () => {
    const folder = await findDriveFolder(parentId, part);
    return folder || createDriveFolder(parentId, part);
  })()).id;

  const metadata = { name: fileName, mimeType, ...(parentId && !existingFileId ? { parents: [parentId] } : {}) };
  const boundary = `ocec_${randomBytes(18).toString('hex')}`;
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ]);
  const path = existingFileId ? `/${encodeURIComponent(existingFileId)}` : '';
  const params = new URLSearchParams({ uploadType: 'multipart', fields: 'id,name,mimeType,size,webViewLink,webContentLink,parents' });
  return googleRequest(`${DRIVE_UPLOAD_API}/files${path}?${params}`, {
    method: existingFileId ? 'PATCH' : 'POST',
    body,
    headers: { 'content-type': `multipart/related; boundary=${boundary}` },
  });
}

export async function downloadGoogleDriveFile(fileId) {
  if (!fileId) throw Object.assign(new Error('Payment slip is no longer available in Drive'), { statusCode: 404 });
  const token = await accessToken();
  const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { authorization: `Bearer ${token}` } });
  if (response.status === 404 || response.status === 410) throw Object.assign(new Error('Payment slip is no longer available in Drive'), { statusCode: 404 });
  if (!response.ok) throw Object.assign(new Error(`Google Drive download failed (${response.status})`), { statusCode: 502 });
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 15 * 1024 * 1024) throw Object.assign(new Error('Payment slip download is empty or exceeds the allowed size'), { statusCode: 502 });
  return buffer;
}

export async function deleteGoogleDriveFile(fileId) {
  if (!fileId) return;
  const token = await accessToken();
  const response = await fetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  if (!response.ok && response.status !== 404) throw new Error(`Google Drive delete failed (${response.status})`);
}

function encodeHeader(value) {
  const safe = String(value || '').replace(/[\r\n]/g, ' ').trim();
  return `=?UTF-8?B?${Buffer.from(safe, 'utf8').toString('base64')}?=`;
}

export async function sendGoogleWorkspaceEmail({ to, subject, text, html, messageId }) {
  const recipient = String(to || '').trim();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(recipient) || /[\r\n]/.test(recipient)) throw new Error('A valid recipient email is required');
  if (!String(subject || '').trim() || /[\r\n]/.test(String(subject))) throw new Error('A valid email subject is required');
  if (!String(text || html || '').trim()) throw new Error('Email content is required');
  const connection = await getConnection();
  if (!connection) throw new Error('Connect a Google account before sending email');
  const textPart = Buffer.from(String(text || ''), 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n');
  const boundary = `ocec_alt_${randomBytes(12).toString('hex')}`;
  const parts = [
    `From: ${encodeHeader('OCEC Portal')} <${connection.account_email}>`,
    `To: ${recipient}`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    ...(messageId ? [`Message-ID: <${String(messageId).replace(/[<>\s\r\n]/g, '')}>`] : []),
  ];
  if (html) {
    const htmlPart = Buffer.from(String(html), 'utf8').toString('base64').replace(/.{1,76}/g, '$&\r\n');
    parts.push(`Content-Type: multipart/alternative; boundary="${boundary}"`, '', `--${boundary}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', textPart, `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', htmlPart, `--${boundary}--`);
  } else {
    parts.push('Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', textPart);
  }
  const raw = Buffer.from(parts.join('\r\n'), 'utf8').toString('base64url');
  return googleRequest(`${GMAIL_API}/users/me/messages/send`, { method: 'POST', body: JSON.stringify({ raw }) });
}

async function createSpreadsheet(title, firstSheetTitle, sheetsRootId) {
  const response = await googleRequest(`${SHEETS_API}/spreadsheets?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`, {
    method: 'POST',
    body: JSON.stringify({ properties: { title }, sheets: [{ properties: { title: firstSheetTitle } }] }),
  });
  const spreadsheetId = response.spreadsheetId;
  const file = await googleRequest(`${DRIVE_API}/files/${encodeURIComponent(spreadsheetId)}?fields=id,parents`);
  const params = new URLSearchParams({ addParents: sheetsRootId, fields: 'id,parents' });
  if (file.parents?.length) params.set('removeParents', file.parents.join(','));
  await googleRequest(`${DRIVE_API}/files/${encodeURIComponent(spreadsheetId)}?${params}`, { method: 'PATCH', body: JSON.stringify({}) });
  return response;
}

function sheetTabTitle(round) {
  const type = round.round_type === 'HEAT' ? 'Heat' : round.round_type === 'FINAL' ? 'Final' : 'Final X';
  const title = `${round.short_name} - ${type} ${round.year}`.replace(/[\\/?*\[\]:]/g, '-').slice(0, 95);
  return title || `Exam ${round.id}`.slice(0, 95);
}

async function ensureSpreadsheetAndTab(round) {
  let tabResult = await getPool().query(`SELECT t.sheet_id, t.title, s.drive_file_id, s.spreadsheet_url
    FROM google_workspace_sheet_tabs t JOIN google_workspace_spreadsheets s ON s.academic_year=t.academic_year
    WHERE t.exam_round_id=$1`, [round.id]);
  if (tabResult.rowCount) return { ...tabResult.rows[0], spreadsheetId: tabResult.rows[0].drive_file_id };

  const initialized = await initializeGoogleDriveFolders();
  const title = sheetTabTitle(round);
  const existingWorkbook = await getPool().query('SELECT * FROM google_workspace_spreadsheets WHERE academic_year=$1', [round.year]);
  let workbook = existingWorkbook.rows[0];
  if (!workbook) {
    const created = await createSpreadsheet(`OCEC Applications ${round.year}`, title, initialized.sheets.id);
    const saved = await getPool().query(`INSERT INTO google_workspace_spreadsheets(academic_year,drive_file_id,title,spreadsheet_url)
      VALUES($1,$2,$3,$4) ON CONFLICT(academic_year) DO UPDATE SET academic_year=excluded.academic_year
      RETURNING *`, [round.year, created.spreadsheetId, created.properties?.title || `OCEC Applications ${round.year}`, created.spreadsheetUrl]);
    workbook = saved.rows[0];
    const first = created.sheets?.[0]?.properties;
    if (first) await getPool().query(`INSERT INTO google_workspace_sheet_tabs(exam_round_id,academic_year,sheet_id,title)
      VALUES($1,$2,$3,$4) ON CONFLICT(exam_round_id) DO UPDATE SET academic_year=excluded.academic_year,sheet_id=excluded.sheet_id,title=excluded.title`, [round.id, round.year, first.sheetId, first.title]);
    return { spreadsheetId: workbook.drive_file_id, spreadsheet_url: workbook.spreadsheet_url, sheet_id: first?.sheetId, title: first?.title };
  }

  const metadata = await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(workbook.drive_file_id)}?fields=sheets.properties`);
  const match = metadata.sheets?.find((sheet) => sheet.properties?.title === title)?.properties;
  let sheetId = match?.sheetId;
  if (sheetId === undefined) {
    const result = await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(workbook.drive_file_id)}:batchUpdate`, {
      method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
    });
    sheetId = result.replies?.[0]?.addSheet?.properties?.sheetId;
  }
  if (!Number.isInteger(sheetId)) throw new Error('Google Sheets did not return a worksheet ID');
  await getPool().query(`INSERT INTO google_workspace_sheet_tabs(exam_round_id,academic_year,sheet_id,title)
    VALUES($1,$2,$3,$4) ON CONFLICT(exam_round_id) DO UPDATE SET academic_year=excluded.academic_year,sheet_id=excluded.sheet_id,title=excluded.title`, [round.id, round.year, sheetId, title]);
  return { spreadsheetId: workbook.drive_file_id, spreadsheet_url: workbook.spreadsheet_url, sheet_id: sheetId, title };
}

function sheetRange(title, range) {
  return `${encodeURIComponent(`'${title.replaceAll("'", "''")}'!${range}`)}`;
}

async function initializeSheetHeaders(spreadsheetId, title) {
  const range = sheetRange(title, `A1:${columnName(SHEET_HEADERS.length)}1`);
  const result = await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`);
  if (!result.values?.length) {
    await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ values: [SHEET_HEADERS] }),
    });
  }
}

function columnName(number) {
  let value = number;
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

async function applicationRowsForSheets(applicationItemId = null, filters = {}) {
  const result = await getPool().query(`SELECT ai.id AS application_item_id, a.id AS application_id, a.school_batch_id,
      a.submitted_at, a.status AS application_status, a.source, a.registration_total_satang,
      a.paper_total_satang, a.total_satang, ap.first_name_en, ap.middle_name_en, ap.last_name_en,
      ap.first_name_th, ap.last_name_th, ap.date_of_birth, ap.school_name, ap.contact_email,
      ap.contact_phone, ap.address, ai.format, ai.online_exam_email, ai.fee_satang, ai.snapshot,
      ai.exam_number, r.id AS exam_round_id, r.year AS academic_year, r.round_type, r.title AS round_title,
      r.exam_date, c.short_name, g.label AS grade_label, coalesce(ai.snapshot->'center'->>'name', ec.name) AS center_name,
      coalesce(ai.snapshot->'center'->>'code', ec.code) AS center_code,
      (SELECT coalesce(json_agg(p.snapshot ORDER BY p.past_paper_id), '[]'::json)
        FROM application_past_papers p WHERE p.application_id=a.id) AS past_papers,
      a.owner_user_id, sb.coordinator_email,
      pay.id AS payment_id, pay.status AS payment_status, pay.payment_account_id,
      pay.expected_satang, pay.confirmed_satang, pay.confirmed_transfer_at, pay.confirmed_account_number,
      slip.drive_file_id AS slip_drive_file_id, cp.drive_file_id AS certificate_photo_drive_file_id
    FROM application_items ai
    JOIN applications a ON a.id=ai.application_id
    JOIN applicants ap ON ap.id=a.applicant_id
    JOIN exam_rounds r ON r.id=ai.exam_round_id
    JOIN competitions c ON c.id=r.competition_id
    JOIN grade_catalog g ON g.id=ai.grade_id
    JOIN exam_centers ec ON ec.id=ai.center_id
    LEFT JOIN school_batches sb ON sb.id=a.school_batch_id
    LEFT JOIN LATERAL (
      SELECT p.* FROM payments p WHERE p.application_id=a.id OR (a.school_batch_id IS NOT NULL AND p.school_batch_id=a.school_batch_id)
      ORDER BY p.created_at DESC LIMIT 1
    ) pay ON true
    LEFT JOIN LATERAL (
      SELECT ps.drive_file_id FROM payment_slips ps WHERE ps.payment_id=pay.id ORDER BY ps.uploaded_at DESC LIMIT 1
    ) slip ON true
    LEFT JOIN certificate_photos cp ON cp.application_item_id=ai.id
    WHERE a.status = 'approved' AND ($1::uuid IS NULL OR ai.id=$1)
      AND ($2::text IS NULL OR r.year=$2)
      AND ($3::text IS NULL OR c.short_name=$3)
      AND ($4::text IS NULL OR g.label=$4)
      AND ($5::date IS NULL OR (a.submitted_at AT TIME ZONE 'Asia/Bangkok')::date >= $5::date)
      AND ($6::date IS NULL OR (a.submitted_at AT TIME ZONE 'Asia/Bangkok')::date <= $6::date)
    ORDER BY r.year DESC, c.short_name, r.round_type, ap.last_name_en, ap.first_name_en`,
  [applicationItemId, filters.year || null, filters.competition || null, filters.grade || null, filters.startDate || null, filters.endDate || null]);
  return result.rows;
}

function rowValues(row) {
  const fullAddress = row.address && typeof row.address === 'object' ? Object.values(row.address).filter(Boolean).join(', ') : String(row.address || '');
  const papers = (row.past_papers || []).map((paper) => [paper.title, paper.detail].filter(Boolean).join(' — ')).join(' | ');
  return [
    row.application_item_id, row.application_id, row.school_batch_id || '', row.submitted_at?.toISOString?.() || row.submitted_at || '',
    row.application_status, row.source, row.short_name, row.round_title || row.round_type, row.academic_year,
    row.exam_date?.toISOString?.().slice(0, 10) || row.exam_date || '', row.grade_label,
    row.format === 'online' ? 'Online Exam' : 'Paper-Based', row.center_name, row.online_exam_email || '',
    row.first_name_en, row.middle_name_en, row.last_name_en, row.first_name_th || '', row.last_name_th || '',
    row.date_of_birth?.toISOString?.().slice(0, 10) || row.date_of_birth || '', row.school_name, row.contact_email, row.contact_phone,
    fullAddress, papers, money(row.fee_satang), money(row.paper_total_satang), money(row.total_satang),
    row.payment_status || 'unpaid', row.payment_account_id || '', money(row.expected_satang),
    row.confirmed_satang == null ? '' : money(row.confirmed_satang),
    row.confirmed_transfer_at?.toISOString?.() || row.confirmed_transfer_at || '', row.confirmed_account_number || '',
    row.slip_drive_file_id || '', row.exam_number || '', row.certificate_photo_drive_file_id || '',
  ];
}

async function findApplicationItemRow(spreadsheetId, title, applicationItemId) {
  const range = sheetRange(title, 'A2:A');
  const result = await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}`);
  const index = result.values?.findIndex((entry) => entry?.[0] === applicationItemId) ?? -1;
  return index < 0 ? null : index + 2;
}

async function writeApplicationItem(spreadsheetId, title, row) {
  await initializeSheetHeaders(spreadsheetId, title);
  const existingRow = await findApplicationItemRow(spreadsheetId, title, row.application_item_id);
  const endColumn = columnName(SHEET_HEADERS.length);
  if (existingRow) {
    const range = sheetRange(title, `A${existingRow}:${endColumn}${existingRow}`);
    await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`, {
      method: 'PUT', body: JSON.stringify({ values: [rowValues(row)] }),
    });
    await getPool().query(`INSERT INTO google_workspace_sheet_rows(application_item_id,exam_round_id,spreadsheet_row)
      VALUES($1,$2,$3) ON CONFLICT(application_item_id) DO UPDATE SET exam_round_id=excluded.exam_round_id,spreadsheet_row=excluded.spreadsheet_row,synced_at=now()`, [row.application_item_id, row.exam_round_id, existingRow]);
    return 'updated';
  }
  const range = sheetRange(title, `A:${endColumn}`);
  const result = await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: 'POST', body: JSON.stringify({ values: [rowValues(row)] }),
  });
  const updatedRange = result.updates?.updatedRange || '';
  const rowNumber = Number(updatedRange.match(/![A-Z]+(\d+):/i)?.[1] || updatedRange.match(/![A-Z]+(\d+)/i)?.[1]);
  if (Number.isInteger(rowNumber) && rowNumber >= 2) {
    await getPool().query(`INSERT INTO google_workspace_sheet_rows(application_item_id,exam_round_id,spreadsheet_row)
      VALUES($1,$2,$3) ON CONFLICT(application_item_id) DO UPDATE SET exam_round_id=excluded.exam_round_id,spreadsheet_row=excluded.spreadsheet_row,synced_at=now()`, [row.application_item_id, row.exam_round_id, rowNumber]);
  }
  return 'inserted';
}

async function withSheetYearLock(year, work) {
  const client = await getPool().connect();
  const key = `ocec-google-sheet-year-${year}`;
  try {
    await client.query('SELECT pg_advisory_lock(hashtext($1))', [key]);
    return await work();
  } finally {
    await client.query('SELECT pg_advisory_unlock(hashtext($1))', [key]).catch(() => {});
    client.release();
  }
}

async function syncSheetRow(row) {
  return withSheetYearLock(row.academic_year, async () => {
    const workbook = await ensureSpreadsheetAndTab({ id: row.exam_round_id, year: row.academic_year, short_name: row.short_name, round_type: row.round_type });
    const outcome = await writeApplicationItem(workbook.spreadsheetId, workbook.title, row);
    await getPool().query('UPDATE google_workspace_spreadsheets SET updated_at=now() WHERE drive_file_id=$1', [workbook.spreadsheetId]);
    return { outcome, spreadsheetUrl: workbook.spreadsheet_url, tab: workbook.title };
  });
}

export async function syncGoogleWorkspaceSheetItem(applicationItemId) {
  const connection = await getConnection();
  if (!connection) throw new Error('Connect a Google account before syncing Sheets');
  const rows = await applicationRowsForSheets(applicationItemId);
  if (!rows.length) return { skipped: true, reason: 'Application item is not approved or no longer exists' };
  const result = await syncSheetRow(rows[0]);
  return { applicationItemId, ...result };
}

export async function clearGoogleWorkspaceSheetRow(examRoundId, spreadsheetRow) {
  const rowNumber = Number(spreadsheetRow);
  if (!Number.isInteger(rowNumber) || rowNumber < 2) throw new Error('A valid Google Sheets row is required');
  const location = await getPool().query(`SELECT t.title,s.drive_file_id,s.academic_year,s.spreadsheet_url
    FROM google_workspace_sheet_tabs t JOIN google_workspace_spreadsheets s ON s.academic_year=t.academic_year
    WHERE t.exam_round_id=$1`, [examRoundId]);
  if (!location.rowCount) return { skipped: true, reason: 'Exam round does not have a Google Sheets tab' };
  const tab = location.rows[0];
  return withSheetYearLock(tab.academic_year, async () => {
    const range = sheetRange(tab.title, `A${rowNumber}:${columnName(SHEET_HEADERS.length)}${rowNumber}`);
    await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(tab.drive_file_id)}/values/${range}:clear`, {
      method: 'POST', body: JSON.stringify({}),
    });
    await getPool().query('UPDATE google_workspace_spreadsheets SET updated_at=now() WHERE academic_year=$1', [tab.academic_year]);
    return { cleared: true, examRoundId, spreadsheetRow: rowNumber, spreadsheetUrl: tab.spreadsheet_url };
  });
}

export async function syncGoogleWorkspaceSheets() {
  const connection = await getConnection();
  if (!connection) throw new Error('Connect a Google account before syncing Sheets');
  const rows = await applicationRowsForSheets();
  const counters = { inserted: 0, updated: 0, spreadsheets: {}, tabs: {} };
  for (const row of rows) {
    const result = await syncSheetRow(row);
    counters.spreadsheets[row.academic_year] = result.spreadsheetUrl;
    counters.tabs[row.exam_round_id] = result.tab;
    counters[result.outcome] += 1;
  }
  return { ...counters, processed: rows.length };
}

const MOCK_HEADERS = ['วันที่ส่งใบสมัคร', 'ชื่อ', 'อีเมล', 'เบอร์โทร', 'รายการสอบ', 'ระดับชั้น', 'สถานะ', 'Application Item ID'];

function bangkokDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Application submission date is invalid');
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function configureMockTab(spreadsheetId, sheetId, title) {
  const range = sheetRange(title, 'A1:H1');
  await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range}?valueInputOption=RAW`, {
    method: 'PUT', body: JSON.stringify({ values: [MOCK_HEADERS] }),
  });
  await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: 'POST', body: JSON.stringify({ requests: [
      { updateSheetProperties: { properties: { sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
      { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 7 }, cell: {
        userEnteredFormat: { backgroundColor: { red: 0.13, green: 0.25, blue: 0.42 }, textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true } },
      }, fields: 'userEnteredFormat' } },
      { updateDimensionProperties: { range: { sheetId, dimension: 'COLUMNS', startIndex: 7, endIndex: 8 }, properties: { hiddenByUser: true }, fields: 'hiddenByUser' } },
      { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: 8 } } } },
      { setDataValidation: { range: { sheetId, startRowIndex: 1, startColumnIndex: 6, endColumnIndex: 7 }, rule: {
        condition: { type: 'ONE_OF_LIST', values: ['รอส่ง', 'ส่งแล้ว', 'อีเมลมีปัญหา'].map((userEnteredValue) => ({ userEnteredValue })) },
        strict: true, showCustomUi: true,
      } } },
    ] }),
  });
}

async function ensureMockSpreadsheetAndTab(year, competition) {
  const tabResult = await getPool().query(`SELECT t.sheet_id,t.title,s.drive_file_id,s.spreadsheet_url
    FROM google_workspace_mock_sheet_tabs t JOIN google_workspace_mock_spreadsheets s USING(academic_year)
    WHERE t.academic_year=$1 AND t.competition=$2`, [year, competition]);
  if (tabResult.rowCount) return { ...tabResult.rows[0], spreadsheetId: tabResult.rows[0].drive_file_id };

  const title = `${competition} - Mock`.replace(/[\\/?*\[\]:]/g, '-').slice(0, 95);
  const initialized = await initializeGoogleDriveFolders();
  let workbook = (await getPool().query('SELECT * FROM google_workspace_mock_spreadsheets WHERE academic_year=$1', [year])).rows[0];
  let sheetId;
  if (!workbook) {
    const created = await createSpreadsheet(`OCEC Mock ${year}`, title, initialized.sheets.id);
    sheetId = created.sheets?.[0]?.properties?.sheetId;
    workbook = (await getPool().query(`INSERT INTO google_workspace_mock_spreadsheets(academic_year,drive_file_id,title,spreadsheet_url)
      VALUES($1,$2,$3,$4) RETURNING *`, [year, created.spreadsheetId, created.properties?.title || `OCEC Mock ${year}`, created.spreadsheetUrl])).rows[0];
  } else {
    const metadata = await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(workbook.drive_file_id)}?fields=sheets.properties`);
    sheetId = metadata.sheets?.find((sheet) => sheet.properties?.title === title)?.properties?.sheetId;
    if (!Number.isInteger(sheetId)) {
      const added = await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(workbook.drive_file_id)}:batchUpdate`, {
        method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title } } }] }),
      });
      sheetId = added.replies?.[0]?.addSheet?.properties?.sheetId;
    }
  }
  if (!Number.isInteger(sheetId)) throw new Error('Google Sheets did not return a Mock worksheet ID');
  await configureMockTab(workbook.drive_file_id, sheetId, title);
  await getPool().query(`INSERT INTO google_workspace_mock_sheet_tabs(academic_year,competition,sheet_id,title)
    VALUES($1,$2,$3,$4) ON CONFLICT(academic_year,competition) DO NOTHING`, [year, competition, sheetId, title]);
  return { spreadsheetId: workbook.drive_file_id, spreadsheet_url: workbook.spreadsheet_url, sheet_id: sheetId, title };
}

async function sourceSheetRowsForMock(rows) {
  const byRound = new Map();
  for (const row of rows) {
    if (!byRound.has(row.exam_round_id)) byRound.set(row.exam_round_id, []);
    byRound.get(row.exam_round_id).push(row);
  }
  const sourceRows = new Map();
  for (const [roundId, roundRows] of byRound) {
    for (const row of roundRows) await syncSheetRow(row);
    const location = await getPool().query(`SELECT t.title,s.drive_file_id FROM google_workspace_sheet_tabs t
      JOIN google_workspace_spreadsheets s USING(academic_year) WHERE t.exam_round_id=$1`, [roundId]);
    if (!location.rowCount) throw new Error('Application source sheet is not available');
    const tab = location.rows[0];
    const sourceUrl = `${SHEETS_API}/spreadsheets/${encodeURIComponent(tab.drive_file_id)}/values/${sheetRange(tab.title, 'A2:AK')}`;
    let result = await googleRequest(sourceUrl);
    for (const values of result.values || []) if (values[0]) sourceRows.set(values[0], values);
    const missing = roundRows.filter((row) => !sourceRows.has(row.application_item_id));
    if (missing.length) {
      for (const row of missing) await syncSheetRow(row);
      result = await googleRequest(sourceUrl);
      for (const values of result.values || []) if (values[0]) sourceRows.set(values[0], values);
    }
  }
  return sourceRows;
}

export async function addFilteredApplicationsToMockSheet({ year, competition, grade, startDate, endDate }) {
  if (!(await getConnection())) throw Object.assign(new Error('Connect Google Workspace before adding Mock applicants'), { statusCode: 400 });
  const selected = await applicationRowsForSheets(null, { year, competition, grade, startDate, endDate });
  if (!selected.length) return { selected: 0, inserted: 0, updated: 0, spreadsheetUrl: null };
  const sourceRows = await sourceSheetRowsForMock(selected);
  return withSheetYearLock(`mock-${year}`, async () => {
    const tab = await ensureMockSpreadsheetAndTab(year, competition);
    const idRange = sheetRange(tab.title, 'H2:H');
    const ids = await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(tab.spreadsheetId)}/values/${idRange}`);
    const existingRows = new Map((ids.values || []).map((entry, index) => [entry?.[0], index + 2]).filter(([id]) => id));
    const updates = [];
    const additions = [];
    for (const row of selected) {
      const source = sourceRows.get(row.application_item_id);
      if (!source) throw new Error(`Application item ${row.application_item_id} is missing from its source sheet`);
      const values = [bangkokDate(source[3]), [source[14], source[15], source[16]].filter(Boolean).join(' '), source[21] || '',
        source[22] || '', `${row.short_name} ${row.round_type}`, source[10] || '', 'รอส่ง', row.application_item_id];
      const existingRow = existingRows.get(row.application_item_id);
      if (existingRow) {
        updates.push({ range: decodeURIComponent(sheetRange(tab.title, `A${existingRow}:F${existingRow}`)), values: [values.slice(0, 6)] });
      } else {
        additions.push(values);
      }
    }
    if (updates.length) await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(tab.spreadsheetId)}/values:batchUpdate`, {
      method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW', data: updates }),
    });
    if (additions.length) await googleRequest(`${SHEETS_API}/spreadsheets/${encodeURIComponent(tab.spreadsheetId)}/values/${sheetRange(tab.title, 'A:H')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
      method: 'POST', body: JSON.stringify({ values: additions }),
    });
    await getPool().query('UPDATE google_workspace_mock_spreadsheets SET updated_at=now() WHERE academic_year=$1', [year]);
    return { selected: selected.length, inserted: additions.length, updated: updates.length, spreadsheetUrl: `${tab.spreadsheet_url}#gid=${tab.sheet_id}`, tab: tab.title };
  });
}

export const GOOGLE_WORKSPACE_REQUIRED_SCOPES = GOOGLE_SCOPES;
