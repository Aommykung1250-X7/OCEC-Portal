/**
 * Shared server-side authorization policy for account-scoped application access
 * (OCEC-12):
 * - Viewing applications in an account (`/api/applications/mine`)
 * - Managing & downloading certificate photos (`/api/applications/:id/certificate-photo`, `/api/certificate-photos/:itemId`)
 * - Updating Final shirt sizes (`/api/applications/:id/shirt-sizes`)
 *
 * Authorization is granted strictly by:
 * 1. Administrator role (`user.is_admin === true`)
 * 2. Application owner (`application.owner_user_id === user.id`)
 *
 * Strictly enforced boundaries:
 * - Sharing or matching `applicants.contact_email` or `applicants.contact_phone`
 *   NEVER grants automatic account access to another user's application.
 * - `final_verification_grants` are scoped EXCLUSIVELY to the Final confirmation
 *   and Final submission workflow (for the matched application + Final round
 *   within TTL). Starting Final verification or holding an expired grant NEVER
 *   opens Heat application view, Heat photo management, or shirt-size access in
 *   the account portal.
 * - Whether a non-owner account that successfully submits Final should later
 *   access the original Heat application, or whether school students may upload
 *   Heat photos before Final, remains pending Process Owner sign-off (BR-OPEN-05).
 */

export const ACCOUNT_APPLICATION_ACCESS_SQL = '($1::uuid IS NULL OR a.owner_user_id = $1)';

/**
 * Evaluate whether `user` is authorized to perform `action` on `application`.
 *
 * @param {{ id?: string, owner_user_id?: string | null, status?: string }} application
 * @param {{ id?: string | null, is_admin?: boolean } | null | undefined} user
 */
export function canAccessApplication(application, user) {
  if (!application || !user?.id) return false;
  if (user.is_admin === true) return true;
  return Boolean(application.owner_user_id && application.owner_user_id === user.id);
}

export async function loadApplicationAccessContext(db, applicationId, { forUpdate = false } = {}) {
  const lockClause = forUpdate ? ' FOR UPDATE OF a' : '';
  const result = await db.query(
    `SELECT a.id,
            a.owner_user_id,
            a.status,
            a.source,
            a.school_batch_id,
            ap.first_name_en,
            ap.middle_name_en,
            ap.last_name_en,
            ap.contact_email
     FROM applications a
     JOIN applicants ap ON ap.id = a.applicant_id
     WHERE a.id = $1${lockClause}`,
    [applicationId],
  );
  return result.rows[0] || null;
}

export async function assertApplicationAccess(db, applicationId, user, { forUpdate = false, notFoundMessage = 'ไม่พบใบสมัคร', forbiddenMessage = 'ไม่มีสิทธิ์เข้าถึงใบสมัครนี้' } = {}) {
  const row = await loadApplicationAccessContext(db, applicationId, { forUpdate });
  if (!row) {
    const error = new Error(notFoundMessage);
    error.statusCode = 404;
    throw error;
  }
  if (!canAccessApplication(row, user)) {
    const error = new Error(forbiddenMessage);
    error.statusCode = 403;
    throw error;
  }
  return row;
}
