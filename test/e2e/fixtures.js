import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { decryptQueuedEmailText } from '../../server/integrationQueue.js';

let pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export async function withExamDates(changes, run) {
  const rows = await pool.query('SELECT id, exam_date FROM exam_rounds WHERE round_type=$1', ['HEAT']);
  try {
    for (const row of rows.rows) {
      const nextDate = Object.hasOwn(changes, row.id) ? changes[row.id] : Object.hasOwn(changes, 'all') ? changes.all : row.exam_date;
      await pool.query('UPDATE exam_rounds SET exam_date=$1 WHERE id=$2', [nextDate, row.id]);
    }
    return await run();
  } finally {
    for (const row of rows.rows) await pool.query('UPDATE exam_rounds SET exam_date=$1 WHERE id=$2', [row.exam_date, row.id]);
  }
}

export async function withHeatYear(year, run) {
  const rows = await pool.query("SELECT id,year FROM exam_rounds WHERE round_type='HEAT'");
  try {
    for (const row of rows.rows) await pool.query('UPDATE exam_rounds SET year=$1 WHERE id=$2', [year, row.id]);
    return await run();
  } finally {
    for (const row of rows.rows) await pool.query('UPDATE exam_rounds SET year=$1 WHERE id=$2', [row.year, row.id]);
  }
}

export async function closeFixtures() {
  await pool.end();
  // Playwright reuses its single worker across spec files. The next file needs a fresh pool.
  pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
}

export async function createReviewFixture() {
  const suffix = randomBytes(5).toString('hex');
  const firstName = `Review${suffix}`;
  const owner = await pool.query(`INSERT INTO users(google_sub,email,display_name)
    VALUES($1,$2,'Review Owner') RETURNING id`, [`review-${suffix}`, `review-owner-${suffix}@example.test`]);
  const applicant = await pool.query(`INSERT INTO applicants(first_name_en,last_name_en,date_of_birth,school_name,contact_email,contact_phone)
    VALUES($1,'Student','2017-01-01','Review School',$2,'0812345678') RETURNING id`, [firstName, `review-${suffix}@example.test`]);
  const application = await pool.query(`INSERT INTO applications(applicant_id,owner_user_id,source,status,registration_total_satang,submitted_at)
    VALUES($1,$2,'self','pending',75500,now()) RETURNING id`, [applicant.rows[0].id, owner.rows[0].id]);
  const grade = await pool.query("SELECT id FROM grade_catalog WHERE label='Primary 1'");
  const center = await pool.query("SELECT id FROM exam_centers WHERE code='554'");
  await pool.query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key)
    VALUES($1,'bbb-heat-2569',$2,'paper',$3,75500,'{}',$4)`, [application.rows[0].id, grade.rows[0].id, center.rows[0].id, `review-${suffix}`]);
  const payment = await pool.query(`INSERT INTO payments(application_id,expected_satang,status) VALUES($1,75500,'pending') RETURNING id`, [application.rows[0].id]);
  await pool.query(`INSERT INTO payment_slips(payment_id,file_name,mime_type,content_bytes) VALUES($1,'review.png','image/png',$2)`, [payment.rows[0].id, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])]);
  return { id: application.rows[0].id, name: `${firstName} Student`, firstName, email: `review-${suffix}@example.test`, paymentId: payment.rows[0].id };
}

export async function createSchoolFinalFixture() {
  const suffix = randomBytes(5).toString('hex');
  const firstName = `Browser${suffix}`;
  const lastName = 'Student';
  const name = `${firstName} ${lastName}`;
  const roundId = `bbb-final-browser-${suffix}`;
  const coordinator = await pool.query(`INSERT INTO users(google_sub,email,display_name)
    VALUES($1,$2,'Browser Coordinator') RETURNING id`, [`coordinator-${suffix}`, `coordinator-${suffix}@example.test`]);
  const batch = await pool.query(`INSERT INTO school_batches(coordinator_user_id,coordinator_email,school_name,source,total_satang,status)
    VALUES($1,$2,'Browser School','manual',75500,'approved') RETURNING id`, [coordinator.rows[0].id, `coordinator-${suffix}@example.test`]);
  const applicant = await pool.query(`INSERT INTO applicants(first_name_en,last_name_en,date_of_birth,school_name,contact_email,contact_phone)
    VALUES($1,$2,'2017-01-01','Browser School',$3,'0812345678') RETURNING id`, [firstName, lastName, `child-${suffix}@example.test`]);
  const application = await pool.query(`INSERT INTO applications(applicant_id,owner_user_id,school_batch_id,source,status,registration_total_satang)
    VALUES($1,$2,$3,'school','approved',75500) RETURNING id`, [applicant.rows[0].id, coordinator.rows[0].id, batch.rows[0].id]);
  const grade = await pool.query("SELECT id FROM grade_catalog WHERE label='Primary 1'");
  const center = await pool.query("SELECT id FROM exam_centers WHERE code='554'");
  const item = await pool.query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key)
    VALUES($1,'bbb-heat-2569',$2,'paper',$3,75500,'{}',$4) RETURNING id`, [application.rows[0].id, grade.rows[0].id, center.rows[0].id, `browser-${suffix}`]);
  await pool.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date,exam_date,is_open,active)
    VALUES($1,'bbb','Big Bay Bei (BBB)','2569','FINAL',(now() AT TIME ZONE 'Asia/Bangkok')::date-1,(now() AT TIME ZONE 'Asia/Bangkok')::date+1,(now() AT TIME ZONE 'Asia/Bangkok')::date+20,true,true)`, [roundId]);
  await pool.query('INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,$2)', [roundId, grade.rows[0].id]);
  await pool.query('INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,$2)', [roundId, center.rows[0].id]);
  await pool.query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,'1ST AWARD',true,now())", [item.rows[0].id]);
  await pool.query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2)', [item.rows[0].id, roundId]);
  return { name, firstName, lastName, roundId, heatApplicationId: application.rows[0].id, coordinatorId: coordinator.rows[0].id, gradeId: grade.rows[0].id, centerId: center.rows[0].id, contactEmail: `child-${suffix}@example.test` };
}

export async function finalClaimState(heatApplicationId) {
  const result = await pool.query(`SELECT a.id,a.owner_user_id,fi.claimed_application_id,fg.claimed_at
    FROM applications a JOIN final_invitations fi ON fi.claimed_application_id=a.id
    LEFT JOIN final_verification_grants fg ON fg.final_invitation_id=fi.id
    WHERE a.source_heat_application_id=$1`, [heatApplicationId]);
  return result.rows;
}

export async function makeHeatSelfOwned(heatApplicationId) {
  const owner = await pool.query("SELECT id FROM users WHERE google_sub='ocec-test-candidate'");
  if (!owner.rowCount) throw new Error('Sign in as the candidate before converting the fixture');
  await pool.query("UPDATE applications SET source='self',school_batch_id=NULL,owner_user_id=$2 WHERE id=$1", [heatApplicationId, owner.rows[0].id]);
  return owner.rows[0].id;
}

export async function replacementTokenFor(email) {
  const result = await pool.query("SELECT payload FROM integration_jobs WHERE kind='gmail.send' AND payload->>'to'=$1 ORDER BY id DESC LIMIT 1", [email]);
  if (!result.rowCount) throw new Error('Replacement email was not queued');
  const body = decryptQueuedEmailText(result.rows[0].payload.encryptedText);
  const link = body.match(/https?:\/\/\S*slip-replacement\?token=\S+/)?.[0];
  if (!link) throw new Error('Replacement email has no token URL');
  return new URL(link).searchParams.get('token');
}
