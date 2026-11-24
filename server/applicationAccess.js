/**
 * Shared server-side authorization policy for account-scoped application access
 * (OCEC-12):
 * - Viewing applications in an account (`/api/applications/mine`)
 * - Managing & downloading certificate photos (`/api/applications/:id/certificate-photo`, `/api/certificate-photos/:itemId`)
 * - Updating Final shirt sizes (`/api/applications/:id/shirt-sizes`)
 *
 * Authorization is granted strictly by:
 * 1. Administrator role (`user.is_admin === true`), where allowed for the action
 * 2. Application owner (`application.owner_user_id === user.id`)
 * 3. Verifiable server-side delegation (a verified `final_verification_grants`
 *    record bound to `user.id` for that application, or a submitted Final
 *    application owned by `user.id` whose `source_heat_application_id` points
 *    to that Heat application — never on `draft` applications)
 *
 * Sharing or matching `applicants.contact_email` or `applicants.contact_phone`
 * NEVER grants automatic account access to another user's application.
 */

export const VERIFIED_DELEGATION_EXISTS_SQL = `(
  a.status <> 'draft' AND (
    EXISTS (
      SELECT 1
      FROM final_verification_grants fvg
      WHERE fvg.heat_application_id = a.id
        AND fvg.verified_user_id = $1
    )
    OR EXISTS (
      SELECT 1
      FROM applications final_app
      WHERE final_app.source_heat_application_id = a.id
        AND final_app.owner_user_id = $1
        AND final_app.status <> 'draft'
    )
  )
)`;

/**
 * Evaluate whether `user` is authorized to perform `action` on `application`.
 *
 * @param {{ id?: string, owner_user_id?: string | null, status?: string }} application
 * @param {{ id?: string | null, is_admin?: boolean } | null | undefined} user
 * @param {{ action?: 'view' | 'photo' | 'shirt', hasVerifiedDelegation?: boolean }} [options]
 */
export function canAccessApplication(application, user, { action = 'view', hasVerifiedDelegation = false } = {}) {
  if (!application || !user?.id) return false;
  if (user.is_admin === true) return true;
  if (application.owner_user_id && application.owner_user_id === user.id) return true;
  if (application.status === 'draft') return false;
  if (hasVerifiedDelegation && ['view', 'photo', 'shirt'].includes(action)) return true;
  return false;
}

export async function loadApplicationAccessContext(db, applicationId, userId, { forUpdate = false } = {}) {
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
            ap.contact_email,
            (
              $2::uuid IS NOT NULL
              AND a.status <> 'draft'
              AND (
                EXISTS (
                  SELECT 1 FROM final_verification_grants fvg
                  WHERE fvg.heat_application_id = a.id AND fvg.verified_user_id = $2
                )
                OR EXISTS (
                  SELECT 1 FROM applications final_app
                  WHERE final_app.source_heat_application_id = a.id
                    AND final_app.owner_user_id = $2
                    AND final_app.status <> 'draft'
                )
              )
            ) AS has_verified_delegation
     FROM applications a
     JOIN applicants ap ON ap.id = a.applicant_id
     WHERE a.id = $1${lockClause}`,
    [applicationId, userId || null],
  );
  return result.rows[0] || null;
}

export async function assertApplicationAccess(db, applicationId, user, { action = 'view', forUpdate = false, notFoundMessage = 'ไม่พบใบสมัคร', forbiddenMessage = 'ไม่มีสิทธิ์เข้าถึงใบสมัครนี้' } = {}) {
  const row = await loadApplicationAccessContext(db, applicationId, user?.id, { forUpdate });
  if (!row) {
    const error = new Error(notFoundMessage);
    error.statusCode = 404;
    throw error;
  }
  if (!canAccessApplication(row, user, { action, hasVerifiedDelegation: row.has_verified_delegation === true })) {
    const error = new Error(forbiddenMessage);
    error.statusCode = 403;
    throw error;
  }
  return row;
}
