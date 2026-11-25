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

function queueError(message, statusCode = 409) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function sheetTabUrl(spreadsheetUrl, sheetId) {
  if (!spreadsheetUrl) return null;
  if (!Number.isInteger(Number(sheetId))) return spreadsheetUrl;
  return `${String(spreadsheetUrl).split('#')[0]}#gid=${Number(sheetId)}`;
}

function buildClearReviewSummary(job, tabByRoundId) {
  if (job.kind !== 'sheets.clear_row') return null;
  const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
  const applicationItemId = payload.applicationItemId ? String(payload.applicationItemId).trim() : null;
  const examRoundId = payload.examRoundId ? String(payload.examRoundId).trim() : null;
  const tab = examRoundId ? tabByRoundId.get(examRoundId) || null : null;
  const payloadSpreadsheetId = payload.spreadsheetId ? String(payload.spreadsheetId).trim() : null;
  const payloadSheetId = payload.sheetId != null && Number.isFinite(Number(payload.sheetId)) ? Number(payload.sheetId) : null;
  const spreadsheetId = tab?.drive_file_id || payloadSpreadsheetId || null;
  const sheetId = tab?.sheet_id != null ? Number(tab.sheet_id) : payloadSheetId;
  const sheetTitle = tab?.title || (payload.sheetTitle ? String(payload.sheetTitle).trim() : null);
  const spreadsheetMatches = !payloadSpreadsheetId || (tab && payloadSpreadsheetId === tab.drive_file_id);
  const sheetMatches = payloadSheetId == null || (tab && Number(tab.sheet_id) === payloadSheetId);
  const identity = payload.expectedRowIdentity && typeof payload.expectedRowIdentity === 'object' ? payload.expectedRowIdentity : {};
  const applicantName = [identity.firstNameEn, identity.lastNameEn].filter(Boolean).join(' ') || null;
  const manualReviewRequired = Boolean(job.last_error && String(job.last_error).startsWith('MANUAL_REVIEW_REQUIRED:'));

  return {
    applicationItemId,
    examRoundId,
    spreadsheetId,
    sheetId,
    sheetTitle,
    sheetUrl: sheetTabUrl(tab?.spreadsheet_url || null, sheetId),
    applicantName,
    competition: identity.competition ? String(identity.competition).trim() : null,
    grade: identity.grade ? String(identity.grade).trim() : null,
    contactEmail: identity.contactEmail ? String(identity.contactEmail).trim() : null,
    canConfirmManualClear: Boolean(
      manualReviewRequired
      && job.status === 'failed'
      && applicationItemId
      && examRoundId
      && tab
      && spreadsheetMatches
      && sheetMatches
      && Number.isInteger(sheetId),
    ),
  };
}

export async function integrationQueueStatus() {
  const [counts, jobs, sheets, workbooks, tabs] = await Promise.all([
    getPool().query(`SELECT status,kind,count(*)::integer AS count FROM integration_jobs GROUP BY status,kind ORDER BY kind,status`),
    getPool().query(`SELECT id,kind,status,attempts,last_error,created_at,updated_at,next_attempt_at,
        CASE WHEN kind='sheets.clear_row' THEN payload ELSE NULL END AS payload
      FROM integration_jobs ORDER BY created_at DESC LIMIT 30`),
    getPool().query(`SELECT count(*)::integer AS approved_items,
        count(*) FILTER (WHERE row.application_item_id IS NOT NULL)::integer AS synced_items
      FROM application_items ai JOIN applications a ON a.id=ai.application_id AND a.status='approved'
      LEFT JOIN google_workspace_sheet_rows row ON row.application_item_id=ai.id`),
    getPool().query('SELECT academic_year,title,spreadsheet_url,updated_at FROM google_workspace_spreadsheets ORDER BY academic_year DESC'),
    getPool().query(`SELECT t.exam_round_id,t.sheet_id,t.title,s.drive_file_id,s.spreadsheet_url
      FROM google_workspace_sheet_tabs t JOIN google_workspace_spreadsheets s ON s.academic_year=t.academic_year`),
  ]);
  const tabByRoundId = new Map(tabs.rows.map((row) => [row.exam_round_id, row]));
  return {
    counts: counts.rows,
    jobs: jobs.rows.map((job) => {
      const lastError = job.last_error ? String(job.last_error).slice(0, 300) : null;
      const clearReview = buildClearReviewSummary(job, tabByRoundId);
      return {
        id: job.id,
        kind: job.kind,
        status: job.status,
        attempts: job.attempts,
        last_error: lastError,
        created_at: job.created_at,
        updated_at: job.updated_at,
        next_attempt_at: job.next_attempt_at,
        manualReviewRequired: Boolean(lastError?.startsWith('MANUAL_REVIEW_REQUIRED:')),
        ...(clearReview ? { clearReview } : {}),
      };
    }),
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

export async function confirmManualSheetRowClearJob(jobId, adminUserId, { note = '' } = {}) {
  const normalizedAdminId = String(adminUserId || '').trim();
  if (!normalizedAdminId) throw queueError('Authentication required', 401);

  return transaction(async (client) => {
    const found = await client.query(
      `SELECT id, kind, status, attempts, payload, last_error
       FROM integration_jobs WHERE id = $1 FOR UPDATE`,
      [jobId],
    );
    if (!found.rowCount) return null;
    const job = found.rows[0];
    if (job.kind !== 'sheets.clear_row') {
      throw queueError('ใช้ยืนยันการล้างข้อมูลได้เฉพาะงานล้างแถว Google Sheets เท่านั้น', 400);
    }

    const payload = job.payload && typeof job.payload === 'object' ? job.payload : {};
    const applicationItemId = String(payload.applicationItemId || '').trim();
    const examRoundId = String(payload.examRoundId || '').trim();
    const payloadSpreadsheetId = payload.spreadsheetId ? String(payload.spreadsheetId).trim() : '';
    const payloadSheetId = payload.sheetId != null ? Number(payload.sheetId) : null;

    if (!applicationItemId || !examRoundId) {
      throw queueError('ไม่สามารถยืนยันเป้าหมายได้เนื่องจากงานนี้ไม่มี Application Item ID หรือรอบสอบ โปรดตรวจสอบในชีตด้วยตนเอง', 409);
    }

    const location = await client.query(
      `SELECT t.sheet_id, t.title, s.drive_file_id, s.spreadsheet_url, s.academic_year
       FROM google_workspace_sheet_tabs t
       JOIN google_workspace_spreadsheets s ON s.academic_year = t.academic_year
       WHERE t.exam_round_id = $1`,
      [examRoundId],
    );
    if (!location.rowCount) {
      throw queueError('ไม่พบข้อมูลไฟล์หรือแท็บ Google Sheets ของรอบสอบนี้ จึงไม่สามารถยืนยันเป้าหมายได้ โปรดตรวจสอบในชีตด้วยตนเอง', 409);
    }
    const tab = location.rows[0];
    if (payloadSpreadsheetId && payloadSpreadsheetId !== tab.drive_file_id) {
      throw queueError('รหัสไฟล์ Google Sheets ของงานไม่ตรงกับไฟล์ที่ลงทะเบียนไว้ จึงคงงานไว้ให้เจ้าหน้าที่ตรวจสอบ', 409);
    }
    if (payloadSheetId != null && Number.isFinite(payloadSheetId) && Number(tab.sheet_id) !== payloadSheetId) {
      throw queueError('รหัสแท็บ Google Sheets (sheetId) ของงานไม่ตรงกับแท็บที่ลงทะเบียนไว้ จึงคงงานไว้ให้เจ้าหน้าที่ตรวจสอบ', 409);
    }

    const spreadsheetId = tab.drive_file_id;
    const sheetId = Number(tab.sheet_id);
    const sheetTitle = tab.title;
    if (!spreadsheetId || !Number.isInteger(sheetId)) {
      throw queueError('ข้อมูลปลายทาง Google Sheets ไม่สมบูรณ์ จึงคงงานไว้ให้เจ้าหน้าที่ตรวจสอบ', 409);
    }

    // Idempotent handling when the job is already queued, running, or completed after an earlier confirmation.
    if (job.status !== 'failed') {
      const existingConfirmation = await client.query(
        `SELECT id FROM audit_logs
         WHERE entity_type = 'google_sheet_row_clear'
           AND entity_id = $1
           AND action = 'manual_clear_confirmed'
           AND actor_user_id IS NOT NULL
           AND after_data->>'proofSource' = 'manual_staff_confirmation'
           AND after_data->>'applicationItemId' = $1
           AND after_data->>'spreadsheetId' = $2
           AND after_data->>'sheetId' = $3
           AND after_data->>'confirmedCleared' = 'true'
         LIMIT 1`,
        [applicationItemId, spreadsheetId, String(sheetId)],
      );
      if (existingConfirmation.rowCount) {
        return {
          job: { id: job.id, kind: job.kind, status: job.status },
          alreadyConfirmed: true,
          target: { applicationItemId, examRoundId, spreadsheetId, sheetId, sheetTitle },
        };
      }
      throw queueError('งานนี้ไม่ได้อยู่ในสถานะรอเจ้าหน้าที่ตรวจสอบ (MANUAL_REVIEW_REQUIRED)', 409);
    }

    if (!String(job.last_error || '').startsWith('MANUAL_REVIEW_REQUIRED:')) {
      throw queueError('งานนี้ไม่ได้อยู่ในสถานะรอเจ้าหน้าที่ตรวจสอบ (MANUAL_REVIEW_REQUIRED)', 409);
    }

    const auditPayload = {
      verificationVersion: 2,
      proofSource: 'manual_staff_confirmation',
      jobId: Number(job.id),
      applicationItemId,
      examRoundId,
      spreadsheetId,
      sheetId,
      sheetTitle,
      note: String(note || '').trim().slice(0, 500),
      confirmedCleared: true,
    };
    const audit = await client.query(
      `INSERT INTO audit_logs(actor_user_id, entity_type, entity_id, action, after_data)
       VALUES($1, 'google_sheet_row_clear', $2, 'manual_clear_confirmed', $3)
       RETURNING id, created_at`,
      [normalizedAdminId, applicationItemId, auditPayload],
    );

    const updated = await client.query(
      `UPDATE integration_jobs
       SET status = 'pending',
           attempts = 0,
           next_attempt_at = now(),
           locked_at = NULL,
           last_error = NULL,
           completed_at = NULL,
           updated_at = now()
       WHERE id = $1
       RETURNING id, kind, status`,
      [job.id],
    );

    return {
      job: updated.rows[0],
      alreadyConfirmed: false,
      confirmedBy: normalizedAdminId,
      auditId: audit.rows[0].id,
      target: { applicationItemId, examRoundId, spreadsheetId, sheetId, sheetTitle },
    };
  });
}
