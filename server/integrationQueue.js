import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getPool, transaction } from './db.js';

function integrationEncryptionKey() {
  const key = Buffer.from(process.env.GOOGLE_INTEGRATION_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('GOOGLE_INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return key;
}

export function encryptQueuedEmailText(text) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', integrationEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
}

export function decryptQueuedEmailText(encrypted) {
  const [ivPart, tagPart, dataPart] = String(encrypted || '').split('.');
  if (!ivPart || !tagPart || !dataPart) throw new Error('Queued email content is invalid');
  const decipher = createDecipheriv('aes-256-gcm', integrationEncryptionKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]).toString('utf8');
}

export async function enqueueIntegrationJob(client, kind, payload, dedupeKey = null) {
  const result = await client.query(`INSERT INTO integration_jobs(kind,payload,dedupe_key)
    VALUES($1,$2,$3)
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO UPDATE SET
      payload=CASE WHEN integration_jobs.status IN ('pending','failed') AND integration_jobs.attempts < 8 THEN excluded.payload ELSE integration_jobs.payload END,
      status=CASE WHEN integration_jobs.status='failed' AND integration_jobs.attempts < 8 THEN 'pending' ELSE integration_jobs.status END,
      next_attempt_at=CASE WHEN integration_jobs.status='failed' AND integration_jobs.attempts < 8 THEN now() ELSE integration_jobs.next_attempt_at END,
      updated_at=now()
    RETURNING id`, [kind, payload, dedupeKey]);
  return result.rows[0]?.id || null;
}

export async function integrationQueueStatus() {
  const [counts, jobs, sheets, workbooks] = await Promise.all([
    getPool().query(`SELECT status,kind,count(*)::integer AS count FROM integration_jobs GROUP BY status,kind ORDER BY kind,status`),
    getPool().query(`SELECT id,kind,status,attempts,last_error,created_at,updated_at,next_attempt_at
      FROM integration_jobs ORDER BY created_at DESC LIMIT 30`),
    getPool().query(`SELECT count(*)::integer AS approved_items,
        count(*) FILTER (WHERE row.application_item_id IS NOT NULL)::integer AS synced_items
      FROM application_items ai JOIN applications a ON a.id=ai.application_id AND a.status='approved'
      LEFT JOIN google_workspace_sheet_rows row ON row.application_item_id=ai.id`),
    getPool().query('SELECT academic_year,title,spreadsheet_url,updated_at FROM google_workspace_spreadsheets ORDER BY academic_year DESC'),
  ]);
  return {
    counts: counts.rows,
    jobs: jobs.rows.map((job) => ({ ...job, last_error: job.last_error ? String(job.last_error).slice(0, 300) : null })),
    sheets: sheets.rows[0] || { approved_items: 0, synced_items: 0 },
    workbooks: workbooks.rows,
  };
}

export async function retryIntegrationJob(jobId, adminUserId) {
  return transaction(async (client) => {
    const result = await client.query(`UPDATE integration_jobs SET status='pending',attempts=0,next_attempt_at=now(),
        locked_at=NULL,last_error=NULL,completed_at=NULL,updated_at=now()
      WHERE id=$1 AND status='failed' RETURNING id,kind,status`, [jobId]);
    if (!result.rowCount) return null;
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data)
      VALUES($1,'integration_job',$2,'retry',jsonb_build_object('kind',$3::text))`, [adminUserId, String(jobId), result.rows[0].kind]);
    return result.rows[0];
  });
}
