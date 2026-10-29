import { createHash, randomBytes } from 'node:crypto';
import { getPool } from './db.js';

const normalizeName = (value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const hash = (value) => createHash('sha256').update(value).digest('hex');
const grantCookieName = 'ocec_final_verification';
const genericError = () => Object.assign(new Error('ไม่สามารถยืนยันสิทธิ์ Final ได้'), { statusCode: 403 });

export function finalGrantTokenFromRequest(request) {
  const raw = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${grantCookieName}=`));
  const token = raw?.slice(grantCookieName.length + 1);
  return token && /^[A-Za-z0-9_-]{32,100}$/.test(token) ? token : null;
}

export function finalGrantCookie(token, maxAge = 600) {
  return `${grantCookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.APP_ORIGIN?.startsWith('https://') ? '; Secure' : ''}`;
}

export function finalGrantHash(token) { return token ? hash(token) : null; }

const eligibleInvitations = `SELECT fi.id AS invitation_id, fi.heat_application_item_id, fi.final_exam_round_id,
    heat_application.id AS heat_application_id, heat_application.owner_user_id, heat_application.source AS heat_source,
    heat_item.exam_number AS source_exam_number, heat_item.grade_id, heat_item.format, heat_item.center_id, heat_item.online_exam_email,
    ap.first_name_en, ap.middle_name_en, ap.last_name_en, ap.first_name_th, ap.last_name_th,
    ap.date_of_birth, ap.school_name, ap.contact_email, ap.contact_phone, ap.address,
    final_round.title AS competition, final_round.year, final_round.round_type,
    c.id AS competition_id, c.short_name
  FROM final_invitations fi
  JOIN application_items heat_item ON heat_item.id=fi.heat_application_item_id
  JOIN applications heat_application ON heat_application.id=heat_item.application_id
  JOIN applicants ap ON ap.id=heat_application.applicant_id
  JOIN results res ON res.application_item_id=heat_item.id AND res.eligible_for_final=true AND res.published_at IS NOT NULL
  JOIN exam_rounds final_round ON final_round.id=fi.final_exam_round_id
  JOIN exam_rounds heat_round ON heat_round.id=heat_item.exam_round_id
  JOIN competitions c ON c.id=final_round.competition_id
  WHERE fi.claimed_application_id IS NULL AND final_round.active=true
    AND ((heat_round.round_type='HEAT' AND final_round.round_type='FINAL')
      OR (heat_round.round_type='FINAL' AND final_round.round_type='FINAL_X' AND final_round.competition_id='bbb'
        AND upper(trim(res.award)) ~ '^(GOLD|SILVER|BRONZE)( (MEDAL|AWARD))?$'))
    AND heat_round.year=final_round.year AND final_round.final_manually_closed=false
    AND (now() AT TIME ZONE 'Asia/Bangkok')::date BETWEEN final_round.open_date AND final_round.close_date
    AND heat_round.competition_id=final_round.competition_id`;

export async function searchSchoolFinalEligibility(candidateName) {
  const name = normalizeName(candidateName);
  if (name.length < 3) return [];
  await ensureFinalXInvitations();
  const result = await getPool().query(`${eligibleInvitations} AND heat_application.source='school'
    AND lower(regexp_replace(trim(concat_ws(' ',ap.first_name_en,nullif(ap.middle_name_en,''),ap.last_name_en)), '[[:space:]]+', ' ', 'g'))=$1
    ORDER BY final_round.year,final_round.title`, [name]);
  const seen = new Set();
  return result.rows.filter((row) => {
    if (seen.has(row.final_exam_round_id)) return false;
    seen.add(row.final_exam_round_id);
    return true;
  }).map((row) => ({ finalRoundId: row.final_exam_round_id, competition: row.competition, round: row.round_type === 'FINAL_X' ? 'FINAL X' : 'FINAL ROUND', year: row.year }));
}

export async function createFinalVerificationGrant({ candidateName, finalRoundId, phoneLast4 }) {
  const name = normalizeName(candidateName);
  if (name.length < 3 || !/^[0-9]{4}$/.test(String(phoneLast4)) || !finalRoundId) throw genericError();
  await ensureFinalXInvitations();
  const matches = await getPool().query(`${eligibleInvitations} AND heat_application.source='school'
    AND final_round.id=$2
    AND lower(regexp_replace(trim(concat_ws(' ',ap.first_name_en,nullif(ap.middle_name_en,''),ap.last_name_en)), '[[:space:]]+', ' ', 'g'))=$1
    AND right(regexp_replace(ap.contact_phone, '[^0-9]', '', 'g'),4)=$3`, [name, finalRoundId, phoneLast4]);
  if (matches.rowCount !== 1) throw genericError();
  const row = matches.rows[0];
  const token = randomBytes(32).toString('base64url');
  await getPool().query(`INSERT INTO final_verification_grants(token_hash,final_invitation_id,heat_application_id,heat_application_item_id,expires_at)
    VALUES($1,$2,$3,$4,now()+interval '10 minutes')`, [hash(token), row.invitation_id, row.heat_application_id, row.heat_application_item_id]);
  return token;
}

export async function findLiveFinalGrant(token) {
  if (!token) return null;
  const result = await getPool().query(`SELECT id,verified_user_id FROM final_verification_grants
    WHERE token_hash=$1 AND expires_at>now() AND claimed_at IS NULL`, [hash(token)]);
  return result.rows[0] || null;
}

export async function bindFinalGrantToUser(grantId, userId) {
  const result = await getPool().query(`UPDATE final_verification_grants SET verified_user_id=$2
    WHERE id=$1 AND expires_at>now() AND claimed_at IS NULL
      AND (verified_user_id IS NULL OR verified_user_id=$2) RETURNING id`, [grantId, userId]);
  if (!result.rowCount) throw genericError();
}

function toChoice(row) {
  return {
    sourceHeatApplicationId: row.heat_application_id,
    schoolGrant: row.heat_source === 'school',
    applicant: {
      firstNameEn: row.first_name_en, middleNameEn: row.middle_name_en, lastNameEn: row.last_name_en,
      firstNameTh: row.first_name_th || '', lastNameTh: row.last_name_th || '', dateOfBirth: row.date_of_birth,
      schoolName: row.school_name, contactEmail: row.contact_email, contactPhone: row.contact_phone,
      address: row.address || {},
    },
    item: {
      roundId: row.final_exam_round_id, roundType: row.round_type, sourceExamNumber: row.source_exam_number || "", gradeId: row.grade_id, format: row.format,
      centerId: row.center_id, examEmail: row.online_exam_email || '',
      competition: row.competition, year: row.year,
    },
  };
}

export async function listFinalEligibilityForUser(userId, token) {
  await ensureFinalXInvitations();
  const owned = await getPool().query(`${eligibleInvitations} AND heat_application.source='self'
    AND heat_application.owner_user_id=$1
    ORDER BY final_round.year,final_round.title`, [userId]);
  let school = [];
  if (token) {
    const verified = await getPool().query(`${eligibleInvitations} AND heat_application.source='school'
      AND fi.id=(SELECT fg.final_invitation_id FROM final_verification_grants fg
        WHERE fg.token_hash=$2 AND fg.verified_user_id=$1
          AND fg.expires_at>now() AND fg.claimed_at IS NULL)
      ORDER BY final_round.year,final_round.title`, [userId, hash(token)]);
    school = verified.rows;
  }
  return [...owned.rows, ...school].map(toChoice);
}

export async function ensureFinalXInvitations(db = getPool()) {
  await db.query(`INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id)
    SELECT ai.id,target.id FROM results res
    JOIN application_items ai ON ai.id=res.application_item_id
    JOIN exam_rounds source ON source.id=ai.exam_round_id
    JOIN exam_rounds target ON target.competition_id=source.competition_id AND target.year=source.year
      AND target.round_type='FINAL_X' AND target.active=true
    WHERE source.competition_id='bbb' AND source.round_type='FINAL' AND res.published_at IS NOT NULL
      AND res.eligible_for_final=true AND upper(trim(res.award)) ~ '^(GOLD|SILVER|BRONZE)( (MEDAL|AWARD))?$'
    ON CONFLICT(heat_application_item_id,final_exam_round_id) DO NOTHING`);
}
