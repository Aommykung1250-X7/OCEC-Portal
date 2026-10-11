import { createHash } from 'node:crypto';
import { getPool, transaction } from './db.js';

const normalize = (value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const duplicateKey = (applicant, roundId) => createHash('sha256').update([
  normalize(applicant.firstNameEn), normalize(applicant.middleNameEn), normalize(applicant.lastNameEn),
  applicant.dateOfBirth, normalize(applicant.schoolName), roundId,
].join('\u001f')).digest('hex');
const money = (satang) => satang / 100;

function invalid(message, statusCode = 400, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

async function resolveDraft(client, candidate, ownerId) {
  const itemIds = candidate.items.map((item) => item.roundId);
  if (new Set(itemIds).size !== itemIds.length) throw invalid('An exam round can only appear once per application');
  const centerIds = new Set(candidate.items.map((item) => item.centerId));
  if (centerIds.size !== 1) throw invalid('All exams for one applicant must use the same exam center');
  const result = await client.query(`SELECT r.*, c.short_name, c.name AS competition_name, g.id AS grade_id, g.label AS grade_label,
    ec.id AS center_id, ec.code AS center_code, ec.name AS center_name
    FROM exam_rounds r
    JOIN competitions c ON c.id=r.competition_id
    JOIN exam_round_grades rg ON rg.exam_round_id=r.id
    JOIN grade_catalog g ON g.id=rg.grade_id AND g.active=true
    JOIN exam_centers ec ON ec.id=$2 AND ec.active=true
    WHERE r.id=ANY($1::text[]) AND g.id=ANY($3::text[])`, [itemIds, [...centerIds][0], candidate.items.map((item) => item.gradeId)]);
  const resolved = [];
  for (const item of candidate.items) {
    const round = result.rows.find((row) => row.id === item.roundId && row.grade_id === item.gradeId);
    if (!round) throw invalid(`Exam round or grade unavailable: ${item.roundId}`);
    if (!round.is_open) throw invalid(`Exam round is closed: ${item.roundId}`);
    const date = await client.query("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today");
    const today = date.rows[0].today;
    if (round.open_date && today < round.open_date || round.close_date && today > round.close_date) throw invalid(`Exam round is outside registration dates: ${item.roundId}`);
    if (item.format === 'online') {
      if (round.center_code !== '500' || !item.examEmail) throw invalid('Online exams require center 500 and an exam email');
    } else {
      if (round.center_code === '500') throw invalid('Paper exams require an onsite center');
      const enabled = await client.query('SELECT 1 FROM exam_round_centers WHERE exam_round_id=$1 AND center_id=$2', [item.roundId, item.centerId]);
      if (!enabled.rowCount) throw invalid(`Exam center is not open for ${item.roundId}`);
    }
    const key = duplicateKey(candidate.applicant, item.roundId);
    const duplicate = await client.query(`SELECT ai.application_id, a.owner_user_id FROM application_items ai
      JOIN applications a ON a.id=ai.application_id WHERE ai.duplicate_key=$1`, [key]);
    if (duplicate.rowCount) throw invalid('Duplicate application', 409, { existingApplicationId: duplicate.rows[0].owner_user_id === ownerId ? duplicate.rows[0].application_id : null });
    const fee = item.format === 'online' ? round.online_price_satang : round.paper_price_satang;
    resolved.push({ input: item, round, fee, key });
  }
  const paperIds = candidate.pastPaperIds || [];
  if (new Set(paperIds).size !== paperIds.length) throw invalid('Past paper selected twice');
  const papers = paperIds.length ? await client.query('SELECT * FROM past_papers WHERE id=ANY($1::text[]) AND active=true', [paperIds]) : { rows: [] };
  if (papers.rows.length !== paperIds.length) throw invalid('Past paper unavailable');
  return { items: resolved, papers: papers.rows };
}

async function insertDraft(client, candidate, ownerId, source, batchId = null) {
  const { items, papers } = await resolveDraft(client, candidate, ownerId);
  const p = candidate.applicant;
  const applicant = await client.query(`INSERT INTO applicants(first_name_en,middle_name_en,last_name_en,first_name_th,last_name_th,date_of_birth,school_name,contact_email,contact_phone,address)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`, [p.firstNameEn.trim(), p.middleNameEn?.trim() || '', p.lastNameEn.trim(), p.firstNameTh || null, p.lastNameTh || null, p.dateOfBirth, p.schoolName.trim(), p.contactEmail.trim(), p.contactPhone.trim(), p.address || {}]);
  const registration = items.reduce((sum, item) => sum + item.fee, 0);
  const paperTotal = papers.reduce((sum, paper) => sum + paper.price_satang, 0);
  const application = await client.query(`INSERT INTO applications(applicant_id,owner_user_id,school_batch_id,source,status,registration_total_satang,paper_total_satang)
    VALUES($1,$2,$3,$4,'draft',$5,$6) RETURNING id`, [applicant.rows[0].id, ownerId, batchId, source, registration, paperTotal]);
  for (const { input, round, fee, key } of items) {
    const snapshot = { competitionId: round.competition_id, competition: round.competition_name, short: round.short_name, roundId: round.id, roundTitle: round.title, year: round.year, grade: round.grade_label, center: { id: round.center_id, code: round.center_code, name: round.center_name }, format: input.format, fee: money(fee) };
    await client.query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,online_exam_email,fee_satang,snapshot,duplicate_key)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [application.rows[0].id, input.roundId, input.gradeId, input.format, input.centerId, input.format === 'online' ? input.examEmail : null, fee, snapshot, key]);
  }
  for (const paper of papers) {
    await client.query('INSERT INTO application_past_papers(application_id,past_paper_id,price_satang,snapshot) VALUES($1,$2,$3,$4)', [application.rows[0].id, paper.id, paper.price_satang, { title: paper.title, detail: paper.detail, price: money(paper.price_satang) }]);
  }
  await client.query('INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data) VALUES($1,$2,$3,$4,$5)', [ownerId, 'application', application.rows[0].id, 'create_draft', { source, registration: money(registration), papers: money(paperTotal) }]);
  return { id: application.rows[0].id, total: money(registration + paperTotal) };
}

export async function createIndividualDraft(candidate, ownerId) {
  try { return await transaction((client) => insertDraft(client, candidate, ownerId, 'self')); }
  catch (error) { throw await clarifyDuplicate(error, [candidate], ownerId); }
}

export async function createSchoolDraft(batch, ownerId, coordinatorEmail) {
  try { return await transaction(async (client) => {
    const result = await client.query(`INSERT INTO school_batches(coordinator_user_id,coordinator_email,school_name,source,total_satang,status)
      VALUES($1,$2,$3,$4,0,'draft') RETURNING id`, [ownerId, coordinatorEmail, batch.schoolName, batch.source]);
    const applicationIds = [];
    let total = 0;
    for (const candidate of batch.applicants) {
      if (normalize(candidate.applicant.schoolName) !== normalize(batch.schoolName)) throw invalid('School name must be the same for all applicants in a batch');
      const draft = await insertDraft(client, candidate, ownerId, 'school', result.rows[0].id);
      applicationIds.push(draft.id);
      total += Math.round(draft.total * 100);
    }
    await client.query('UPDATE school_batches SET total_satang=$1 WHERE id=$2', [total, result.rows[0].id]);
    return { id: result.rows[0].id, applicationIds, total: money(total) };
  }); }
  catch (error) { throw await clarifyDuplicate(error, batch.applicants, ownerId); }
}

async function clarifyDuplicate(error, candidates, ownerId) {
  if (error.code !== '23505' || error.constraint !== 'application_items_duplicate_key_key') return error;
  const keys = candidates.flatMap((candidate) => candidate.items.map((item) => duplicateKey(candidate.applicant, item.roundId)));
  const result = await getPool().query('SELECT a.id FROM application_items ai JOIN applications a ON a.id=ai.application_id WHERE ai.duplicate_key=ANY($1::text[]) AND a.owner_user_id=$2 LIMIT 1', [keys, ownerId]);
  return invalid('Duplicate application', 409, { existingApplicationId: result.rows[0]?.id || null });
}

export async function listMyApplications(userId) {
  const result = await getPool().query(`SELECT a.id, a.source, a.status, a.submitted_at, a.total_satang, a.school_batch_id,
    p.first_name_en, p.middle_name_en, p.last_name_en, p.school_name,
    COALESCE(json_agg(json_build_object('id', ai.id, 'roundId', ai.exam_round_id, 'gradeId', ai.grade_id, 'format', ai.format, 'centerId', ai.center_id, 'snapshot', ai.snapshot) ORDER BY ai.id) FILTER (WHERE ai.id IS NOT NULL), '[]'::json) AS items
    FROM applications a JOIN applicants p ON p.id=a.applicant_id
    LEFT JOIN application_items ai ON ai.application_id=a.id
    WHERE a.owner_user_id=$1 GROUP BY a.id,p.id ORDER BY a.submitted_at DESC`, [userId]);
  return result.rows.map((row) => ({ id: row.id, source: row.source, status: row.status, submittedAt: row.submitted_at, schoolBatchId: row.school_batch_id, total: money(row.total_satang), candidate: [row.first_name_en, row.middle_name_en, row.last_name_en].filter(Boolean).join(' '), school: row.school_name, items: row.items }));
}
