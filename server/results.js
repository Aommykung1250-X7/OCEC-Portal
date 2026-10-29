import { isEligibleForNextRound, nextExamRoundType } from '../shared/examProgression.js';
import { getPool, transaction } from './db.js';

const clean = (value, length = 255) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, length);
const normalized = (value) => clean(value).toLocaleLowerCase('en');
const dateOnly = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? '').slice(0, 10);

function fail(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function isFinalEligible(award, competitionId, roundType = 'HEAT') {
  return isEligibleForNextRound(award, competitionId, roundType);
}

function mapImportRow(row) {
  return {
    id: row.id,
    rowNumber: row.row_number,
    candidateNo: row.candidate_no,
    examNumber: row.candidate_no,
    grade: row.grade,
    school: row.school_name,
    schoolName: row.school_name,
    candidate: row.candidate_name,
    candidateName: row.candidate_name,
    award: row.award || '',
    applicationItemId: row.application_item_id || '',
    applicationId: row.application_id || '',
    applicationCandidateName: row.application_candidate_name || '',
    applicationSchoolName: row.application_school_name || '',
    applicationGrade: row.application_grade || '',
    matchStatus: row.match_status,
    matchNote: row.match_note || '',
    result: isFinalEligible(row.award, row.competition_id, row.round_type) ? 'pass' : 'not-passed',
  };
}

async function readResultBatch(client, batchId) {
  const batch = await client.query(`SELECT b.*,r.competition_id,r.year,r.round_type,r.title,
      c.name AS competition_title,c.short_name
    FROM result_import_batches b JOIN exam_rounds r ON r.id=b.exam_round_id
    JOIN competitions c ON c.id=r.competition_id WHERE b.id=$1`, [batchId]);
  if (!batch.rowCount) return null;
  const rows = await client.query(`SELECT ir.*,a.id AS application_id,
      concat_ws(' ',ap.first_name_en,nullif(ap.middle_name_en,''),ap.last_name_en) AS application_candidate_name,
      ap.school_name AS application_school_name,g.label AS application_grade,r.competition_id,r.round_type
    FROM result_import_rows ir LEFT JOIN application_items ai ON ai.id=ir.application_item_id
    LEFT JOIN applications a ON a.id=ai.application_id LEFT JOIN applicants ap ON ap.id=a.applicant_id
    LEFT JOIN grade_catalog g ON g.id=ai.grade_id LEFT JOIN exam_rounds r ON r.id=ai.exam_round_id
    WHERE ir.batch_id=$1 ORDER BY ir.row_number`, [batchId]);
  return {
    id: batch.rows[0].id,
    examRoundId: batch.rows[0].exam_round_id,
    fileName: batch.rows[0].file_name,
    status: batch.rows[0].status,
    published: batch.rows[0].status === 'published',
    publishedAt: batch.rows[0].published_at,
    competitionId: batch.rows[0].competition_id,
    year: batch.rows[0].year,
    roundType: batch.rows[0].round_type,
    rows: rows.rows.map(mapImportRow),
  };
}

export async function listAdminResultWorkflows() {
  const batches = await getPool().query(`SELECT DISTINCT ON (exam_round_id) id,exam_round_id
    FROM result_import_batches ORDER BY exam_round_id,created_at DESC`);
  const workflows = {};
  for (const batch of batches.rows) workflows[batch.exam_round_id] = await readResultBatch(getPool(), batch.id);
  return workflows;
}

export async function importResultRows(examRoundId, fileName, inputRows, adminId) {
  if (!Array.isArray(inputRows) || !inputRows.length || inputRows.length > 20000) throw fail('จำนวนแถวผลสอบต้องอยู่ระหว่าง 1 ถึง 20,000 แถว');
  const rows = inputRows.map((row) => ({
    candidateNo: clean(row.candidateNo ?? row.examNumber, 80),
    grade: clean(row.grade, 120),
    school: clean(row.schoolName ?? row.school, 255),
    candidate: clean(row.candidateName ?? row.candidate, 255),
    award: clean(row.award, 80),
  }));
  if (rows.some((row) => !row.candidateNo || !row.grade || !row.school || !row.candidate || !row.award)) throw fail('ทุกแถวต้องมีข้อมูล CANDIDATE NO, GRADE, SCHOOL NAME, CANDIDATE NAME และ AWARD');
  return transaction(async (client) => {
    const round = await client.query(`SELECT id,competition_id,round_type FROM exam_rounds WHERE id=$1 AND active=true FOR UPDATE`, [examRoundId]);
    if (!round.rowCount) throw fail('ไม่พบรายการสอบรอบนี้', 404);
    const existingPublished = await client.query("SELECT 1 FROM result_import_batches WHERE exam_round_id=$1 AND status='published' LIMIT 1", [examRoundId]);
    if (existingPublished.rowCount) throw fail('รอบสอบนี้ประกาศผลแล้วและปิดการแก้ไขข้อมูล', 409);
    await client.query("DELETE FROM result_import_batches WHERE exam_round_id=$1 AND status='draft'", [examRoundId]);
    const batch = await client.query(`INSERT INTO result_import_batches(exam_round_id,file_name,imported_by)
      VALUES($1,$2,$3) RETURNING id`, [examRoundId, clean(fileName, 255) || 'results.xlsx', adminId]);
    const duplicateNumbers = new Set(rows.filter((row, index) => rows.findIndex((other) => other.candidateNo === row.candidateNo) !== index).map((row) => row.candidateNo));
    const candidateNumbers = [...new Set(rows.map((row) => row.candidateNo))];
    const found = await client.query(`SELECT ai.id AS application_item_id,ai.exam_number,g.label AS grade,
        ap.school_name,concat_ws(' ',ap.first_name_en,nullif(ap.middle_name_en,''),ap.last_name_en) AS candidate_name
      FROM application_items ai JOIN applications a ON a.id=ai.application_id
      JOIN applicants ap ON ap.id=a.applicant_id JOIN grade_catalog g ON g.id=ai.grade_id
      WHERE ai.exam_round_id=$1 AND ai.exam_number=ANY($2::text[]) AND a.status<>'draft'`, [examRoundId, candidateNumbers]);
    const byNumber = new Map();
    for (const item of found.rows) byNumber.set(item.exam_number, [...(byNumber.get(item.exam_number) || []), item]);
    const seenItems = new Set();
    for (const [index, row] of rows.entries()) {
      const matches = byNumber.get(row.candidateNo) || [];
      let item = matches.length === 1 ? matches[0] : null;
      let status = matches.length === 1 ? 'matched' : 'unmatched';
      let note = matches.length ? '' : 'ไม่พบเลขประจำตัวสอบในรอบนี้';
      if (duplicateNumbers.has(row.candidateNo) || matches.length > 1) {
        status = 'duplicate'; note = matches.length > 1 ? 'เลขประจำตัวสอบตรงกับหลายใบสมัคร' : 'เลขประจำตัวสอบซ้ำในไฟล์';
      } else if (item && seenItems.has(item.application_item_id)) {
        status = 'duplicate'; note = 'ใบสมัครเดียวกันปรากฏมากกว่าหนึ่งแถวในไฟล์';
      } else if (item) {
        const mismatches = [];
        if (normalized(row.grade) !== normalized(item.grade)) mismatches.push('ระดับชั้น');
        if (normalized(row.school) !== normalized(item.school_name)) mismatches.push('โรงเรียน');
        if (normalized(row.candidate) !== normalized(item.candidate_name)) mismatches.push('ชื่อผู้สมัคร');
        if (mismatches.length) { status = 'data_mismatch'; note = `ข้อมูลไม่ตรงกับใบสมัคร: ${mismatches.join(', ')}`; }
        seenItems.add(item.application_item_id);
      }
      await client.query(`INSERT INTO result_import_rows(batch_id,row_number,candidate_no,grade,school_name,candidate_name,award,application_item_id,match_status,match_note)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [batch.rows[0].id, index + 2, row.candidateNo, row.grade, row.school, row.candidate, row.award, item?.application_item_id || null, status, note]);
    }
    return readResultBatch(client, batch.rows[0].id);
  });
}

export async function resolveResultImportRow(rowId, action, applicationItemId, adminId) {
  return transaction(async (client) => {
    const found = await client.query(`SELECT ir.*,b.exam_round_id,b.status AS batch_status,r.competition_id
      FROM result_import_rows ir JOIN result_import_batches b ON b.id=ir.batch_id
      JOIN exam_rounds r ON r.id=b.exam_round_id WHERE ir.id=$1 FOR UPDATE OF ir,b`, [rowId]);
    if (!found.rowCount) throw fail('ไม่พบแถวผลสอบ', 404);
    const row = found.rows[0];
    if (row.batch_status !== 'draft') throw fail('ประกาศผลแล้ว จึงไม่สามารถแก้ไขข้อมูลได้', 409);
    let itemId = row.application_item_id;
    if (action === 'manual_match') {
      const item = await client.query(`SELECT ai.id,ai.exam_round_id FROM application_items ai JOIN applications a ON a.id=ai.application_id
        WHERE ai.id=$1 AND ai.exam_round_id=$2 AND a.status<>'draft'`, [applicationItemId, row.exam_round_id]);
      if (!item.rowCount) throw fail('ใบสมัครที่เลือกไม่อยู่ในรอบสอบนี้');
      itemId = item.rows[0].id;
    } else if (action !== 'confirm' && action !== 'use_application') throw fail('คำสั่งแก้ไขรายการไม่ถูกต้อง');
    if (!itemId) throw fail('โปรดเลือกใบสมัครที่ต้องการจับคู่ก่อน');
    const linked = await client.query(`SELECT ai.id,ai.grade_id,g.label AS grade,ap.school_name,
        concat_ws(' ',ap.first_name_en,nullif(ap.middle_name_en,''),ap.last_name_en) AS candidate_name
      FROM application_items ai JOIN applications a ON a.id=ai.application_id JOIN applicants ap ON ap.id=a.applicant_id
      JOIN grade_catalog g ON g.id=ai.grade_id WHERE ai.id=$1`, [itemId]);
    if (!linked.rowCount) throw fail('ไม่พบใบสมัครที่เชื่อมโยง');
    const actual = linked.rows[0];
    if (action === 'use_application') {
      await client.query(`UPDATE result_import_rows SET application_item_id=$1,grade=$2,school_name=$3,candidate_name=$4,match_status='matched',match_note=NULL WHERE id=$5`, [itemId, actual.grade, actual.school_name, actual.candidate_name, rowId]);
    } else {
      await client.query(`UPDATE result_import_rows SET application_item_id=$1,match_status='matched',match_note=NULL WHERE id=$2`, [itemId, rowId]);
    }
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
      VALUES($1,'result_import_row',$2,'resolve_conflict',$3,$4)`, [adminId,rowId,{ matchStatus: row.match_status, matchNote: row.match_note },{ action, applicationItemId: itemId }]);
    return readResultBatch(client, row.batch_id);
  });
}

export async function publishResultBatch(examRoundId, adminId) {
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`result:${examRoundId}`]);
    const batchResult = await client.query(`SELECT b.*,r.competition_id,r.round_type,r.year FROM result_import_batches b
      JOIN exam_rounds r ON r.id=b.exam_round_id WHERE b.exam_round_id=$1 AND b.status='draft'
      ORDER BY b.created_at DESC LIMIT 1 FOR UPDATE OF b`, [examRoundId]);
    if (!batchResult.rowCount) {
      const published = await client.query("SELECT 1 FROM result_import_batches WHERE exam_round_id=$1 AND status='published'", [examRoundId]);
      if (published.rowCount) throw fail('ประกาศผลรอบนี้แล้ว', 409);
      throw fail('ยังไม่มีผลสอบฉบับร่าง', 409);
    }
    const batch = batchResult.rows[0];
    const rows = await client.query('SELECT * FROM result_import_rows WHERE batch_id=$1 ORDER BY row_number FOR UPDATE', [batch.id]);
    const unresolved = rows.rows.filter((row) => row.match_status !== 'matched' || !row.application_item_id);
    if (!rows.rowCount || unresolved.length) throw fail(`แก้รายการจับคู่ไม่สำเร็จให้ครบก่อนประกาศ (${unresolved.length} รายการ)`, 409);
    const itemIds = rows.rows.map((row) => row.application_item_id);
    if (new Set(itemIds).size !== itemIds.length) throw fail('พบใบสมัครซ้ำในผลสอบ โปรดแก้ไขก่อนประกาศผล', 409);
    const eligibleRows = [];
    for (const row of rows.rows) {
      const eligible = isFinalEligible(row.award, batch.competition_id, batch.round_type);
      await client.query(`INSERT INTO results(application_item_id,award,eligible_for_final,published_at,published_by)
        VALUES($1,$2,$3,now(),$4) ON CONFLICT(application_item_id) DO UPDATE SET
          award=excluded.award,eligible_for_final=excluded.eligible_for_final,published_at=excluded.published_at,published_by=excluded.published_by`,
      [row.application_item_id,row.award,eligible,adminId]);
      if (eligible) eligibleRows.push(row.application_item_id);
    }
    await client.query("UPDATE result_import_batches SET status='published',published_by=$1,published_at=now() WHERE id=$2", [adminId,batch.id]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data)
      VALUES($1,'exam_round',$2,'publish_results',$3)`, [adminId,examRoundId,{ batchId: batch.id, rows: rows.rowCount, eligibleForFinal: eligibleRows.length }]);
    let openedFinalRounds = 0;
    const nextRoundType = nextExamRoundType(batch.competition_id, batch.round_type);
    if (nextRoundType && eligibleRows.length) {
      const finals = await client.query(`UPDATE exam_rounds final SET is_open=(NOT final.final_manually_closed AND final.open_date IS NOT NULL AND final.close_date IS NOT NULL
          AND (now() AT TIME ZONE 'Asia/Bangkok')::date BETWEEN final.open_date AND final.close_date),updated_at=now()
        WHERE final.active=true AND final.competition_id=$1 AND final.year=$2 AND final.round_type=$3
          AND final.close_date IS NOT NULL
          AND (now() AT TIME ZONE 'Asia/Bangkok')::date<=final.close_date
        RETURNING final.id,final.is_open`, [batch.competition_id,batch.year,nextRoundType]);
      openedFinalRounds = finals.rows.filter((final) => final.is_open).length;
      for (const heatItemId of eligibleRows) {
        for (const final of finals.rows) await client.query(`INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id)
          VALUES($1,$2) ON CONFLICT(heat_application_item_id,final_exam_round_id) DO NOTHING`, [heatItemId,final.id]);
      }
    }
    return { published: true, rows: rows.rowCount, eligibleForFinal: eligibleRows.length, openedFinalRounds };
  });
}

export async function listPublishedResults() {
  const result = await getPool().query(`SELECT a.id AS application_id,ai.id AS application_item_id,ai.exam_number AS candidate_no,
      g.label AS grade,ap.school_name,concat_ws(' ',ap.first_name_en,nullif(ap.middle_name_en,''),ap.last_name_en) AS candidate_name,
      res.award,res.eligible_for_final,res.published_at,r.id AS target_id,r.year,r.round_type,r.title AS competition_title,
      r.competition_id,c.short_name
    FROM results res JOIN application_items ai ON ai.id=res.application_item_id JOIN applications a ON a.id=ai.application_id
    JOIN applicants ap ON ap.id=a.applicant_id JOIN grade_catalog g ON g.id=ai.grade_id JOIN exam_rounds r ON r.id=ai.exam_round_id
    JOIN competitions c ON c.id=r.competition_id WHERE res.published_at IS NOT NULL ORDER BY res.published_at DESC,ap.last_name_en,ap.first_name_en`);
  return result.rows.map((row) => ({ applicationId: row.application_id, applicationItemId: row.application_item_id,
    targetId: row.target_id, competitionId: row.competition_id, competitionTitle: row.competition_title,
    roundType: row.round_type, round: row.round_type === 'HEAT' ? 'HEAT ROUND' : row.round_type === 'FINAL_X' ? 'FINAL X' : 'FINAL ROUND', year: row.year,
    publishedAt: row.published_at, examNumber: row.candidate_no || '', candidateNo: row.candidate_no || '',
    grade: row.grade, school: row.school_name, schoolName: row.school_name, candidate: row.candidate_name,
    candidateName: row.candidate_name, award: row.award, eligibleForFinal: row.eligible_for_final,
    result: row.eligible_for_final ? 'pass' : 'not-passed' }));
}

export async function generateExamNumbers(examRoundId, adminId) {
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['heat-exam-number-generation']);
    const round = await client.query('SELECT id,round_type,open_date,close_date,final_manually_closed,is_open FROM exam_rounds WHERE id=$1 AND active=true FOR UPDATE', [examRoundId]);
    if (!round.rowCount) throw fail('ไม่พบรายการสอบรอบนี้', 404);
    const exam = round.rows[0];
    if (exam.round_type !== 'HEAT') throw fail('สร้างเลขประจำตัวอัตโนมัติได้เฉพาะรอบ HEAT');
    const todayResult = await client.query("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today");
    const today = dateOnly(todayResult.rows[0].today);
    const openDate = exam.open_date ? String(exam.open_date).slice(0, 10) : '';
    const closeDate = exam.close_date ? String(exam.close_date).slice(0, 10) : '';
    const withinScheduledWindow = Boolean(openDate && closeDate && openDate <= today && today <= closeDate);
    const registrationEnded = Boolean(exam.final_manually_closed || (closeDate && today > closeDate) || (withinScheduledWindow && !exam.is_open));
    if (!registrationEnded) throw fail('โปรดปิดรับสมัครรายการสอบนี้ก่อนสร้างเลขประจำตัวสอบ', 409);
    const items = await client.query(`SELECT ai.id,ai.exam_number,ec.code,g.sort_order,ap.last_name_en,ap.first_name_en,ap.middle_name_en,
        ai.created_at
      FROM application_items ai JOIN applications a ON a.id=ai.application_id JOIN applicants ap ON ap.id=a.applicant_id
      JOIN exam_centers ec ON ec.id=ai.center_id JOIN grade_catalog g ON g.id=ai.grade_id
      WHERE ai.exam_round_id=$1 AND a.status<>'draft'
      ORDER BY ec.code,g.sort_order,ap.first_name_en,ap.middle_name_en,ap.last_name_en,ai.created_at,ai.id FOR UPDATE OF ai`, [examRoundId]);
    const counters = new Map();
    const priorHeatIds = await client.query(`SELECT ai.exam_number,ec.code FROM application_items ai
        JOIN exam_centers ec ON ec.id=ai.center_id WHERE ai.exam_round_id=$1 AND ai.exam_number IS NOT NULL
      UNION ALL
      SELECT h.exam_number,ec.code FROM application_item_exam_number_history h
        JOIN exam_centers ec ON ec.id=h.center_id WHERE h.exam_round_id=$1`, [examRoundId]);
    for (const item of priorHeatIds.rows) {
      const code = String(item.code).trim();
      const suffix = Number.parseInt(String(item.exam_number).slice(code.length), 10);
      if (String(item.exam_number).startsWith(code) && Number.isFinite(suffix)) counters.set(code, Math.max(counters.get(code) || 0, suffix));
    }
    const assigned = [];
    for (const item of items.rows.filter((entry) => !entry.exam_number)) {
      const code = String(item.code).trim();
      const next = (counters.get(code) || 0) + 1;
      counters.set(code, next);
      const examNumber = `${code}${String(next).padStart(4, '0')}`;
      await client.query('UPDATE application_items SET exam_number=$1 WHERE id=$2', [examNumber,item.id]);
      assigned.push({ applicationItemId: item.id, examNumber });
    }
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data)
      VALUES($1,'exam_round',$2,'generate_exam_numbers',$3)`, [adminId,examRoundId,{ assigned: assigned.length, alreadyAssigned: items.rowCount-assigned.length }]);
    return { examRoundId, assigned: assigned.length, alreadyAssigned: items.rowCount - assigned.length };
  });
}

async function latestFinalBatch(roundId, batchId = null, client = getPool()) {
  const result = await client.query(`SELECT b.*,r.competition_id,r.year,r.title,c.name AS competition_title
    FROM final_id_import_batches b JOIN exam_rounds r ON r.id=b.exam_round_id JOIN competitions c ON c.id=r.competition_id
    WHERE ($1::text IS NULL OR b.exam_round_id=$1) AND ($2::uuid IS NULL OR b.id=$2) ORDER BY b.created_at DESC LIMIT 1`, [roundId || null,batchId]);
  if (!result.rowCount) return null;
  const batch = result.rows[0];
  const rows = await client.query(`SELECT ir.*,a.id AS application_id,
      concat_ws(' ',ap.first_name_en,nullif(ap.middle_name_en,''),ap.last_name_en) AS application_candidate_name,
      ap.school_name AS application_school_name,g.label AS application_grade
    FROM final_id_import_rows ir LEFT JOIN application_items ai ON ai.id=ir.application_item_id
    LEFT JOIN applications a ON a.id=ai.application_id LEFT JOIN applicants ap ON ap.id=a.applicant_id
    LEFT JOIN grade_catalog g ON g.id=ai.grade_id WHERE ir.batch_id=$1 ORDER BY ir.row_number`, [batch.id]);
  return { id: batch.id, examRoundId: batch.exam_round_id, fileName: batch.file_name, status: batch.status,
    applied: batch.status === 'applied', year: batch.year, competitionId: batch.competition_id, competitionTitle: batch.competition_title,
    rows: rows.rows.map(mapImportRow) };
}

export async function getFinalIdImport(roundId) { return latestFinalBatch(roundId); }

export async function importFinalIds(examRoundId, fileName, inputRows, adminId) {
  if (!Array.isArray(inputRows) || !inputRows.length || inputRows.length > 20000) throw fail('จำนวนแถวเลขประจำตัวสอบ Final ต้องอยู่ระหว่าง 1 ถึง 20,000 แถว');
  const rows = inputRows.map((row) => ({ candidateNo: clean(row.candidateNo ?? row.examNumber, 80), grade: clean(row.grade, 120), school: clean(row.schoolName ?? row.school, 255), candidate: clean(row.candidateName ?? row.candidate, 255) }));
  if (rows.some((row) => !row.candidateNo || !row.school || !row.candidate)) throw fail('ทุกแถวต้องมี CANDIDATE NO, SCHOOL NAME และ CANDIDATE NAME');
  return transaction(async (client) => {
    const round = await client.query("SELECT id FROM exam_rounds WHERE id=$1 AND active=true AND (round_type='FINAL' OR (round_type='FINAL_X' AND competition_id='bbb')) FOR UPDATE", [examRoundId]);
    if (!round.rowCount) throw fail('เลือกได้เฉพาะรายการสอบรอบ FINAL', 404);
    const used = await client.query(`SELECT 1 FROM final_id_import_batches WHERE exam_round_id=$1 AND status='applied'`, [examRoundId]);
    if (used.rowCount) throw fail('นำเข้าและบันทึกเลขประจำตัวสอบ Final ของรอบนี้แล้ว', 409);
    await client.query("DELETE FROM final_id_import_batches WHERE exam_round_id=$1 AND status='draft'", [examRoundId]);
    const batch = await client.query(`INSERT INTO final_id_import_batches(exam_round_id,file_name,imported_by) VALUES($1,$2,$3) RETURNING id`, [examRoundId,clean(fileName,255) || 'final-ids.xlsx',adminId]);
    const duplicateIds = new Set(rows.filter((row,index) => rows.findIndex((other) => other.candidateNo === row.candidateNo) !== index).map((row) => row.candidateNo));
    const existingIds = await client.query(`SELECT exam_number FROM application_items WHERE exam_round_id=$1 AND exam_number=ANY($2::text[])`, [examRoundId,[...new Set(rows.map((row) => row.candidateNo))]]);
    const alreadyUsed = new Set(existingIds.rows.map((row) => row.exam_number));
    const candidates = await client.query(`SELECT ai.id AS application_item_id,g.label AS grade,ap.school_name,
        concat_ws(' ',ap.first_name_en,nullif(ap.middle_name_en,''),ap.last_name_en) AS candidate_name
      FROM application_items ai JOIN applications a ON a.id=ai.application_id JOIN applicants ap ON ap.id=a.applicant_id
      JOIN grade_catalog g ON g.id=ai.grade_id JOIN exam_rounds fr ON fr.id=ai.exam_round_id
      WHERE ai.exam_round_id=$1 AND a.status<>'draft' AND EXISTS (
        SELECT 1 FROM final_invitations fi
        JOIN application_items heat_item ON heat_item.id=fi.heat_application_item_id
        JOIN results heat_result ON heat_result.application_item_id=heat_item.id AND heat_result.eligible_for_final=true
        WHERE fi.final_exam_round_id=fr.id AND fi.claimed_application_id=a.id AND heat_item.grade_id=ai.grade_id
      )`, [examRoundId]);
    const claimed = new Set();
    for (const [index,row] of rows.entries()) {
      const matches = candidates.rows.filter((item) => normalized(item.candidate_name) === normalized(row.candidate) && normalized(item.school_name) === normalized(row.school) && (!row.grade || normalized(item.grade) === normalized(row.grade)));
      let item = matches.length === 1 ? matches[0] : null;
      let status = matches.length === 1 ? 'matched' : matches.length > 1 ? 'duplicate' : 'unmatched';
      let note = matches.length > 1 ? 'พบผู้สมัครมากกว่าหนึ่งใบสมัคร' : matches.length ? '' : 'ไม่พบชื่อ โรงเรียน และระดับชั้นที่ตรงกัน';
      if (duplicateIds.has(row.candidateNo) || alreadyUsed.has(row.candidateNo)) { status = 'duplicate'; note = alreadyUsed.has(row.candidateNo) ? 'เลขนี้ถูกใช้ในใบสมัครรอบนี้แล้ว' : 'เลขประจำตัวซ้ำในไฟล์'; }
      if (item && claimed.has(item.application_item_id)) { status = 'duplicate'; note = 'ผู้สมัครเดียวกันปรากฏมากกว่าหนึ่งแถว'; }
      if (item) claimed.add(item.application_item_id);
      await client.query(`INSERT INTO final_id_import_rows(batch_id,row_number,candidate_no,grade,school_name,candidate_name,application_item_id,match_status,match_note)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [batch.rows[0].id,index+2,row.candidateNo,row.grade,row.school,row.candidate,item?.application_item_id || null,status,note]);
    }
    return latestFinalBatch(null,batch.rows[0].id,client);
  });
}

export async function resolveFinalIdImportRow(rowId, action, applicationItemId, adminId) {
  return transaction(async (client) => {
    const found = await client.query(`SELECT ir.*,b.exam_round_id,b.status AS batch_status,b.id AS batch_id
      FROM final_id_import_rows ir JOIN final_id_import_batches b ON b.id=ir.batch_id WHERE ir.id=$1 FOR UPDATE OF ir,b`, [rowId]);
    if (!found.rowCount) throw fail('ไม่พบแถวเลข Final',404);
    const row = found.rows[0];
    if (row.batch_status !== 'draft') throw fail('บันทึกรายการนี้แล้ว จึงไม่สามารถแก้ไขได้',409);
    let itemId = row.application_item_id;
    if (action === 'manual_match') {
      const target = await client.query(`SELECT ai.id FROM application_items ai JOIN applications a ON a.id=ai.application_id
        JOIN exam_rounds fr ON fr.id=ai.exam_round_id WHERE ai.id=$1 AND ai.exam_round_id=$2 AND a.status<>'draft'
        AND EXISTS (SELECT 1 FROM final_invitations fi JOIN application_items heat_item ON heat_item.id=fi.heat_application_item_id
          JOIN results heat_result ON heat_result.application_item_id=heat_item.id AND heat_result.eligible_for_final=true
          WHERE fi.final_exam_round_id=fr.id AND fi.claimed_application_id=a.id AND heat_item.grade_id=ai.grade_id)`, [applicationItemId,row.exam_round_id]);
      if (!target.rowCount) throw fail('ใบสมัครที่เลือกไม่อยู่ในรอบนี้');
      itemId = target.rows[0].id;
    } else if (action !== 'confirm' && action !== 'use_application') throw fail('คำสั่งแก้ไขรายการไม่ถูกต้อง');
    if (!itemId) throw fail('โปรดเลือกใบสมัครที่ต้องการจับคู่ก่อน');
    const linked = await client.query(`SELECT g.label AS grade,ap.school_name,concat_ws(' ',ap.first_name_en,nullif(ap.middle_name_en,''),ap.last_name_en) AS candidate_name
      FROM application_items ai JOIN applications a ON a.id=ai.application_id JOIN applicants ap ON ap.id=a.applicant_id JOIN grade_catalog g ON g.id=ai.grade_id WHERE ai.id=$1`, [itemId]);
    if (action === 'use_application') await client.query(`UPDATE final_id_import_rows SET application_item_id=$1,grade=$2,school_name=$3,candidate_name=$4,match_status='matched',match_note=NULL WHERE id=$5`, [itemId,linked.rows[0].grade,linked.rows[0].school_name,linked.rows[0].candidate_name,rowId]);
    else await client.query("UPDATE final_id_import_rows SET application_item_id=$1,match_status='matched',match_note=NULL WHERE id=$2", [itemId,rowId]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data) VALUES($1,'final_id_import_row',$2,'resolve_conflict',$3)`, [adminId,rowId,{ action,applicationItemId:itemId }]);
    return latestFinalBatch(null,row.batch_id,client);
  });
}

export async function applyFinalIds(examRoundId, adminId) {
  return transaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`final-ids:${examRoundId}`]);
    const batch = await client.query(`SELECT * FROM final_id_import_batches WHERE exam_round_id=$1 AND status='draft' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [examRoundId]);
    if (!batch.rowCount) throw fail('ยังไม่มีฉบับร่างเลขประจำตัวสอบ Final',409);
    const rows = await client.query('SELECT * FROM final_id_import_rows WHERE batch_id=$1 ORDER BY row_number FOR UPDATE', [batch.rows[0].id]);
    if (!rows.rowCount || rows.rows.some((row) => row.match_status !== 'matched' || !row.application_item_id)) throw fail('โปรดแก้ไขรายการจับคู่ให้ครบก่อนบันทึก',409);
    if (new Set(rows.rows.map((row) => row.application_item_id)).size !== rows.rowCount || new Set(rows.rows.map((row) => row.candidate_no)).size !== rows.rowCount) throw fail('พบเลขประจำตัวสอบหรือใบสมัครซ้ำในไฟล์',409);
    for (const row of rows.rows) {
      const updated = await client.query(`UPDATE application_items ai SET exam_number=$1 FROM applications a,exam_rounds fr
        WHERE ai.id=$2 AND ai.exam_round_id=$3 AND a.id=ai.application_id AND fr.id=ai.exam_round_id
          AND EXISTS (SELECT 1 FROM final_invitations fi JOIN application_items heat_item ON heat_item.id=fi.heat_application_item_id
            JOIN results heat_result ON heat_result.application_item_id=heat_item.id AND heat_result.eligible_for_final=true
            WHERE fi.final_exam_round_id=fr.id AND fi.claimed_application_id=a.id AND heat_item.grade_id=ai.grade_id)
        RETURNING ai.id`, [row.candidate_no,row.application_item_id,examRoundId]);
      if (!updated.rowCount) throw fail('ไม่สามารถบันทึกเลขประจำตัวสอบ Final ให้ใบสมัครที่เลือกได้');
    }
    await client.query("UPDATE final_id_import_batches SET status='applied',applied_by=$1,applied_at=now() WHERE id=$2", [adminId,batch.rows[0].id]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data) VALUES($1,'exam_round',$2,'import_final_ids',$3)`, [adminId,examRoundId,{ batchId:batch.rows[0].id,rows:rows.rowCount }]);
    return { applied: true, rows: rows.rowCount };
  });
}
