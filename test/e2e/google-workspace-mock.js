import { createCipheriv, randomBytes } from 'node:crypto';
import { getPool } from '../../server/db.js';

function encryptedToken(value) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY, 'base64'), iv);
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64url')).join('.');
}

export async function installMockGoogleWorkspace() {
  if (process.env.NODE_ENV !== 'test' || process.env.GOOGLE_OAUTH_MODE !== 'mock') throw new Error('Mock Workspace requires test mode');
  const originalFetch = globalThis.fetch;
  let nextFile = 1;
  globalThis.fetch = async (url, options = {}) => {
    const target = new URL(url);
    if (!target.hostname.endsWith('.googleapis.com')) {
      if (['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) return originalFetch(url, options);
      throw new Error(`External request blocked in browser tests: ${target.hostname}`);
    }
    if (target.hostname === 'oauth2.googleapis.com') return Response.json({ access_token: 'ocec-mock-access-token', expires_in: 3600 });
    if (target.pathname === '/drive/v3/files' && options.method === 'POST') return Response.json({ id: `mock-folder-${nextFile++}`, name: JSON.parse(options.body).name, mimeType: 'application/vnd.google-apps.folder' });
    if (target.pathname === '/drive/v3/files') return Response.json({ files: [] });
    if (target.pathname === '/upload/drive/v3/files' && options.method === 'POST') return Response.json({ id: `mock-upload-${nextFile++}` });
    if (target.pathname.startsWith('/drive/v3/files/') && options.method === 'DELETE') return new Response(null, { status: 204 });
    if (target.pathname.startsWith('/drive/v3/files/') && target.searchParams.get('alt') === 'media') return new Response(Buffer.from('mock file'));
    if (target.pathname.startsWith('/drive/v3/files/')) return Response.json({ id: target.pathname.split('/').at(-1), mimeType: 'application/vnd.google-apps.folder' });
    if (target.pathname.includes('/gmail/v1/users/me/messages/send')) return Response.json({ id: `mock-mail-${nextFile++}` });
    if (target.hostname === 'sheets.googleapis.com') return Response.json({ spreadsheetId: `mock-sheet-${nextFile++}`, values: [] });
    throw new Error(`Unexpected mock Google request: ${target.pathname}`);
  };
  await getPool().query(`INSERT INTO google_workspace_connection(singleton,account_email,encrypted_refresh_token,granted_scopes,
    drive_root_folder_id,slip_root_folder_id,certificate_photo_root_folder_id,spreadsheet_root_folder_id)
    VALUES(true,'workspace@ocec.test',$1,$2,'mock-root','mock-slip-root','mock-photo-root','mock-sheet-root')`,
  [encryptedToken('mock-refresh-token'), [
    'openid', 'email', 'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/spreadsheets',
  ]]);
}
