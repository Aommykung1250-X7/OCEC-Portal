import { FINAL_SHIRT_SIZES, FINAL_SHIRT_IMAGE_LABELS } from '../shared/finalShirts.js';
import { getPool, transaction } from './db.js';
import { decodeCenterPosterUpload } from './centerPoster.js';

const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const versionSql = "to_char(updated_at AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISSUS') AS version";

export async function saveFinalShirtSizes(applicationId, items, user) {
  if (!Array.isArray(items) || !items.length || items.length > 20
    || items.some(item => !item || !FINAL_SHIRT_SIZES.includes(item.shirtSize))
    || new Set(items.map(item => item.applicationItemId)).size !== items.length) {
    throw fail('กรุณาเลือกไซซ์เสื้อจากรายการที่กำหนดและไม่ส่งรายการสอบซ้ำ');
  }
  return transaction(async client => {
    const result = await client.query(`SELECT a.owner_user_id,a.status,ap.contact_email
      FROM applications a JOIN applicants ap ON ap.id=a.applicant_id WHERE a.id=$1 FOR UPDATE OF a`, [applicationId]);
    const application = result.rows[0];
    if (!application) throw fail('ไม่พบใบสมัคร',404);
    const isApplicant = Boolean(user.email) && String(application.contact_email).toLowerCase() === user.email.toLowerCase();
    if (!user.is_admin && application.owner_user_id !== user.id && !isApplicant) throw fail('ไม่มีสิทธิ์จัดการไซซ์เสื้อของใบสมัครนี้',403);
    if (!['pending','slip_issue','approved'].includes(application.status)) throw fail('ใบสมัครนี้ยังไม่เปิดให้เปลี่ยนไซซ์เสื้อ',409);
    const context = await client.query(`SELECT ai.id,ai.shirt_size,r.round_type
      FROM application_items ai JOIN exam_rounds r ON r.id=ai.exam_round_id
      WHERE ai.application_id=$1 ORDER BY ai.id FOR UPDATE OF ai`, [applicationId]);
    const byId = new Map(context.rows.map(row => [row.id,row]));
    if (items.some(item => !['FINAL','FINAL_X'].includes(byId.get(item.applicationItemId)?.round_type))) throw fail('เลือกไซซ์เสื้อได้เฉพาะรายการสอบรอบ Final ของใบสมัครนี้');
    for (const item of items) await client.query('UPDATE application_items SET shirt_size=$1 WHERE id=$2', [item.shirtSize,item.applicationItemId]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
      VALUES($1,'application',$2,'update_shirt_sizes',$3,$4)`, [user.id,applicationId,
      { items: items.map(item => ({ applicationItemId: item.applicationItemId,shirtSize: byId.get(item.applicationItemId).shirt_size })) }, { items }]);
    return { items };
  });
}

function assertImageKind(kind) {
  if (!Object.hasOwn(FINAL_SHIRT_IMAGE_LABELS,kind)) throw fail('ไม่พบประเภทภาพเสื้อ',404);
}

export async function getFinalShirtImage(kind) {
  assertImageKind(kind);
  const result = await getPool().query('SELECT mime_type,content_bytes FROM final_shirt_images WHERE kind=$1',[kind]);
  const row = result.rows[0];
  if (!row) throw fail('ยังไม่มีภาพเสื้อ',404);
  return { content: row.content_bytes,mimeType: row.mime_type };
}

export async function saveFinalShirtImage(kind, upload, actorId) {
  assertImageKind(kind);
  const content = decodeCenterPosterUpload(upload);
  return transaction(async client => {
    const saved = await client.query(`INSERT INTO final_shirt_images(kind,mime_type,content_bytes,updated_by)
      VALUES($1,$2,$3,$4) ON CONFLICT(kind) DO UPDATE SET mime_type=excluded.mime_type,
      content_bytes=excluded.content_bytes,updated_by=excluded.updated_by,updated_at=clock_timestamp()
      RETURNING ${versionSql}`, [kind,upload.mimeType,content,actorId]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data)
      VALUES($1,'application_asset',$2,'replace',$3)`, [actorId,`final-shirt-${kind}`,{ mimeType: upload.mimeType,byteLength: content.length }]);
    return { version: saved.rows[0].version };
  });
}

export async function removeFinalShirtImage(kind, actorId) {
  assertImageKind(kind);
  return transaction(async client => {
    await client.query('DELETE FROM final_shirt_images WHERE kind=$1',[kind]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action)
      VALUES($1,'application_asset',$2,'remove')`,[actorId,`final-shirt-${kind}`]);
    return { version: null };
  });
}
