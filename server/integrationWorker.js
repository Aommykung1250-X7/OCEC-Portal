import { getPool } from './db.js';
import { clearGoogleWorkspaceSheetRow, sendGoogleWorkspaceEmail, syncGoogleWorkspaceSheetItem } from './googleWorkspace.js';
import { decryptQueuedEmailText } from './integrationQueue.js';

const RETRY_DELAYS_SECONDS = [30, 60, 120, 300, 600, 1800, 7200];

async function claimJob() {
  const result = await getPool().query(`WITH candidate AS (
      SELECT id FROM integration_jobs
      WHERE status IN ('pending','failed') AND next_attempt_at<=now() AND attempts<8
        AND (kind NOT IN ('gmail.send','sheets.sync_item','sheets.clear_row') OR EXISTS (
          SELECT 1 FROM google_workspace_connection c WHERE c.singleton=true AND (
            (integration_jobs.kind='gmail.send' AND c.granted_scopes @> ARRAY['https://www.googleapis.com/auth/gmail.send']::text[])
            OR (integration_jobs.kind IN ('sheets.sync_item','sheets.clear_row') AND c.granted_scopes @> ARRAY['https://www.googleapis.com/auth/spreadsheets']::text[])
          )
        ))
      ORDER BY next_attempt_at,id
      FOR UPDATE SKIP LOCKED LIMIT 1
    )
    UPDATE integration_jobs j SET status='running',attempts=j.attempts+1,locked_at=now(),updated_at=now()
    FROM candidate WHERE j.id=candidate.id
    RETURNING j.id,j.kind,j.payload,j.attempts`);
  return result.rows[0] || null;
}

async function execute(job) {
  if (job.kind === 'gmail.send') {
    const payload = { ...job.payload, messageId: `ocec-job-${job.id}@portal` };
    if (payload.encryptedText) {
      payload.text = decryptQueuedEmailText(payload.encryptedText);
      delete payload.encryptedText;
    }
    if (payload.encryptedHtml) {
      payload.html = decryptQueuedEmailText(payload.encryptedHtml);
      delete payload.encryptedHtml;
    }
    return sendGoogleWorkspaceEmail(payload);
  }
  if (job.kind === 'sheets.sync_item') return syncGoogleWorkspaceSheetItem(job.payload.applicationItemId);
  if (job.kind === 'sheets.clear_row') return clearGoogleWorkspaceSheetRow(job.payload.examRoundId, job.payload.spreadsheetRow);
  throw new Error(`Unsupported integration job: ${job.kind}`);
}

export async function processIntegrationJob() {
  const job = await claimJob();
  if (!job) return false;
  try {
    await execute(job);
    await getPool().query(`UPDATE integration_jobs SET status='completed',locked_at=NULL,completed_at=now(),last_error=NULL,updated_at=now() WHERE id=$1`, [job.id]);
  } catch (error) {
    const delay = RETRY_DELAYS_SECONDS[Math.min(job.attempts - 1, RETRY_DELAYS_SECONDS.length - 1)];
    await getPool().query(`UPDATE integration_jobs SET status='failed',locked_at=NULL,
      next_attempt_at=now()+($2::integer * interval '1 second'),last_error=$3,updated_at=now() WHERE id=$1`,
    [job.id, delay, String(error?.message || 'Integration request failed').slice(0, 500)]);
  }
  return true;
}

export function startIntegrationWorker(logger = console) {
  let active = false;
  const timer = setInterval(async () => {
    if (active) return;
    active = true;
    try {
      await getPool().query(`UPDATE integration_jobs SET status='failed',locked_at=NULL,next_attempt_at=now(),
          last_error=coalesce(last_error,'Worker lease expired'),updated_at=now()
        WHERE status='running' AND locked_at < now()-interval '10 minutes'`);
      await processIntegrationJob();
    } catch (error) {
      logger.error?.({ err: error }, 'Integration worker cycle failed');
    } finally {
      active = false;
    }
  }, 3000);
  timer.unref?.();
  logger.info?.('PostgreSQL integration worker started');
  return () => clearInterval(timer);
}
