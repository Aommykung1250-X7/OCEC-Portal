import { getPool, transaction } from './db.js';

const date = (value) => value ? value.toISOString().slice(0, 10) : '';
const time = (value) => value ? String(value).slice(0, 5) : '';

export async function loadCatalog() {
  const [rounds, grades, centers, links, pastPapers, accounts, competitions] = await Promise.all([
    getPool().query('SELECT * FROM exam_rounds ORDER BY year DESC, title'),
    getPool().query('SELECT * FROM grade_catalog ORDER BY sort_order, label'),
    getPool().query('SELECT * FROM exam_centers ORDER BY code'),
    getPool().query('SELECT exam_round_id, grade_id, NULL::text AS center_id FROM exam_round_grades UNION ALL SELECT exam_round_id, NULL::text, center_id FROM exam_round_centers'),
    getPool().query('SELECT * FROM past_papers ORDER BY group_name, id'),
    getPool().query('SELECT * FROM payment_accounts ORDER BY id'),
    getPool().query('SELECT * FROM competitions ORDER BY id'),
  ]);
  const gradeById = new Map(grades.rows.map((grade) => [grade.id, grade.label]));
  return {
    competitions: competitions.rows.map((row) => ({ id: row.id, short: row.short_name, name: row.name, subject: row.subject, active: row.active })),
    exams: rounds.rows.map((row) => ({ id: row.id, competitionId: row.competition_id, title: row.title, year: row.year, roundType: row.round_type, round: row.round_type === 'HEAT' ? 'HEAT ROUND' : row.round_type === 'FINAL' ? 'FINAL ROUND' : 'FINAL X', openDate: date(row.open_date), closeDate: date(row.close_date), editCloseDate: date(row.edit_close_date), examDate: date(row.exam_date), examStartTime: time(row.exam_start_time), examEndTime: time(row.exam_end_time), isOpen: row.is_open, accent: row.accent, prices: { paperBased: row.paper_price_satang / 100, onlineExam: row.online_price_satang / 100 }, description: row.description, gradeOptions: links.rows.filter((item) => item.exam_round_id === row.id && item.grade_id).map((item) => gradeById.get(item.grade_id)).filter(Boolean), centerIds: links.rows.filter((item) => item.exam_round_id === row.id && item.center_id).map((item) => item.center_id) })),
    grades: grades.rows.map((row) => ({ id: row.id, label: row.label, sortOrder: row.sort_order, active: row.active })),
    centers: centers.rows.map((row) => ({ id: row.id, code: row.code, name: row.name, active: row.active })),
    pastPapers: pastPapers.rows.map((row) => ({ id: row.id, group: row.group_name, title: row.title, detail: row.detail, name: `${row.title} — ${row.detail}`, price: row.price_satang / 100, active: row.active })),
    paymentAccounts: accounts.rows.map((row) => ({ id: row.id, bankName: row.bank_name, accountName: row.account_name, accountNumber: row.account_number, category: row.category, showInForm: row.show_in_form, active: row.active })),
  };
}

export async function updateExamRound(id, patch, actorId) {
  const allowed = { title: 'title', openDate: 'open_date', closeDate: 'close_date', editCloseDate: 'edit_close_date', examDate: 'exam_date', examStartTime: 'exam_start_time', examEndTime: 'exam_end_time', isOpen: 'is_open', accent: 'accent', description: 'description' };
  return transaction(async (client) => {
    const prior = await client.query('SELECT * FROM exam_rounds WHERE id=$1 FOR UPDATE', [id]);
    if (!prior.rowCount) return null;
    if (Array.isArray(patch.gradeOptions)) {
      const found = await client.query('SELECT label FROM grade_catalog WHERE label=ANY($1::text[]) AND active=true', [patch.gradeOptions]);
      if (found.rowCount !== patch.gradeOptions.length) { const error = new Error('Unknown or inactive grade'); error.statusCode = 400; throw error; }
    }
    if (Array.isArray(patch.centerIds)) {
      const found = await client.query("SELECT id FROM exam_centers WHERE id=ANY($1::text[]) AND active=true AND code <> '500'", [patch.centerIds]);
      if (found.rowCount !== patch.centerIds.length) { const error = new Error('Unknown or inactive exam center'); error.statusCode = 400; throw error; }
    }
    if ((patch.isOpen ?? prior.rows[0].is_open) && Array.isArray(patch.gradeOptions) && !patch.gradeOptions.length) {
      const error = new Error('Open exam rounds require at least one grade'); error.statusCode = 400; throw error;
    }
    const assignments = [];
    const values = [];
    for (const [key, column] of Object.entries(allowed)) if (Object.hasOwn(patch, key)) {
      values.push(patch[key]);
      assignments.push(`${column}=$${values.length}`);
    }
    if (Object.hasOwn(patch, 'prices')) {
      if (patch.prices?.paperBased !== undefined) { values.push(Math.round(Number(patch.prices.paperBased) * 100)); assignments.push(`paper_price_satang=$${values.length}`); }
      if (patch.prices?.onlineExam !== undefined) { values.push(Math.round(Number(patch.prices.onlineExam) * 100)); assignments.push(`online_price_satang=$${values.length}`); }
    }
    if (assignments.length) {
      values.push(id);
      await client.query(`UPDATE exam_rounds SET ${assignments.join(', ')}, updated_at=now() WHERE id=$${values.length}`, values);
    }
    if (Array.isArray(patch.gradeOptions)) {
      await client.query('DELETE FROM exam_round_grades WHERE exam_round_id=$1', [id]);
      for (const label of patch.gradeOptions) await client.query('INSERT INTO exam_round_grades(exam_round_id, grade_id) SELECT $1,id FROM grade_catalog WHERE label=$2', [id, label]);
    }
    if (Array.isArray(patch.centerIds)) {
      await client.query('DELETE FROM exam_round_centers WHERE exam_round_id=$1', [id]);
      for (const centerId of patch.centerIds) await client.query('INSERT INTO exam_round_centers(exam_round_id, center_id) VALUES($1,$2)', [id, centerId]);
    }
    if (patch.isOpen && !Array.isArray(patch.gradeOptions)) {
      const available = await client.query('SELECT 1 FROM exam_round_grades WHERE exam_round_id=$1 LIMIT 1', [id]);
      if (!available.rowCount) { const error = new Error('Open exam rounds require at least one grade'); error.statusCode = 400; throw error; }
    }
    const after = await client.query('SELECT * FROM exam_rounds WHERE id=$1', [id]);
    await client.query('INSERT INTO audit_logs(actor_user_id, entity_type, entity_id, action, before_data, after_data) VALUES($1,$2,$3,$4,$5,$6)', [actorId, 'exam_round', id, 'update', prior.rows[0], after.rows[0]]);
    return after.rows[0];
  });
}
