# OCEC Portal production runbook

> **Authoritative Business Rules (OCEC-21):** For reconciled business rules (email transport, slip inspection binding, Final/Final X eligibility, and result snapshots), refer to [docs/business-rules-registry.md](../business-rules-registry.md).

This guide covers the production setup for the current Portal backend. Portal uses its own PostgreSQL database. Gmail, Drive, Sheets, and the Portal worker run through the Google account connected in the admin screen. The worker loop runs inside the Portal API process, so the first Railway deployment needs one Portal service and one Portal PostgreSQL service; OCEC-Cert services and its database stay separate.

## Required environment

Set these values on the Portal service and keep credentials out of source control:

| Variable | Production value |
| --- | --- |
| `DATABASE_URL` | Connection string for the Portal PostgreSQL database only |
| `DATABASE_SSL` | `true` only if the selected database provider requires TLS |
| `PORT` | Provided by Railway |
| `HOST` | `0.0.0.0` |
| `APP_ORIGIN` | The public HTTPS origin for the Portal, without a trailing slash |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Login OAuth client |
| `GOOGLE_REDIRECT_URI` | `https://<portal-domain>/api/auth/google/callback` |
| `ADMIN_EMAILS` | Comma-separated Google account emails allowed into `/portal-admin` |
| `GOOGLE_INTEGRATION_CLIENT_ID`, `GOOGLE_INTEGRATION_CLIENT_SECRET` | Workspace OAuth client; may reuse the login client when configured for the Workspace callback too |
| `GOOGLE_INTEGRATION_REDIRECT_URI` | `https://<portal-domain>/api/admin/google-workspace/callback` |
| `GOOGLE_INTEGRATION_ENCRYPTION_KEY` | Stable base64-encoded 32-byte key used to encrypt the Google refresh token in PostgreSQL |
| `VITE_BACKEND_ENABLED` | `true`, set during the frontend build |

Keep the encryption key stable. Changing it prevents the service from decrypting the stored Google refresh token; reconnect the account after deliberately rotating the key.

## Google Workspace preparation

1. In Google Cloud, enable Google Drive API, Google Sheets API, and Gmail API for the project used by the connected account.
2. Add the Workspace callback above to the OAuth client’s authorized redirect URIs. The login callback and Workspace callback are separate URLs.
3. Configure the consent screen and grant `drive.file`, `spreadsheets`, and `gmail.send` to the app. Reconnect from **หลังบ้าน → Google Sheets** after changing scopes.
4. Sign in to `/portal-admin` with an email listed in `ADMIN_EMAILS`, connect the Google account that owns the Drive files and sender identity, and initialize the Drive folders.
5. Check the integration status screen. Confirm that the expected connected email appears, all required scopes are present, and Drive folders are initialized before inviting applicants.

The Google account connected in the admin screen owns files and sends email through Gmail API over HTTPS. Sheets use a workbook per academic year and a tab per exam and round. Application and payment records remain in Portal PostgreSQL if a Drive file is removed; its preview will then be unavailable.

## Database and deployment

1. Create a dedicated Portal PostgreSQL database. Do not point `DATABASE_URL` at OCEC-Cert.
2. Take a database backup before the first production migration. The application history is retained and migrations do not delete application or payment history automatically.
3. Build with `npm run build`, run migrations with `npm run db:migrate`, then start with `npm start`. In Railway, use build command `npm run build`, pre-deploy command `npm run db:migrate`, and start command `npm start`.
4. Use `/api/ready` as the Railway health check. It returns `200` only after PostgreSQL is reachable and **every** SQL migration declared in `server/migrationsManifest.js` (`001` through `025`) is present in `schema_migrations`; if even one migration is missing (including a middle gap), it returns `503`. `/api/health` and `/api/live` are process liveness checks independent of database connectivity. Startup also validates required production environment variables in `server/config.js` without printing secret values.
5. Note for upgrading from migration `022` (current deployed baseline) to Phase 2 (`025`): take a database snapshot first, run read-only `npm run db:preflight:024`, reconcile any duplicate published batches if reported (`scripts/reconcile-duplicate-result-batches.js`), then run `npm run db:migrate` (which acquires a PostgreSQL advisory lock so concurrent migration runners serialize cleanly) to apply `023_payment_slip_inspections.sql`, `024_result_publication_snapshots.sql`, and `025_catalog_revision.sql`.
6. After the service has its HTTPS domain, update `APP_ORIGIN`, both OAuth redirect URIs, and Google authorized origins/redirect URIs, then redeploy.
7. Sign in, connect Workspace, initialize folders, and submit one controlled application using a dedicated test applicant before opening the form publicly.

For local production-like operation, copy `.env.example` to `.env`, use a separate local Portal database, set `APP_ORIGIN=http://localhost:3001`, set both callback URLs to `http://localhost:3001/...`, set `VITE_BACKEND_ENABLED=true`, then run `npm run local:production`.

## Pre-opening verification

- [ ] `GET /api/ready` reports `ready: true`.
- [ ] Google Login works for an allowed admin and is denied for an email outside `ADMIN_EMAILS`.
- [ ] Workspace status shows Drive, Gmail, and Sheets scopes; folder initialization succeeds.
- [ ] An individual application and a school batch create pending records and upload the slip to the correct Drive folder.
- [ ] Admin review requires staff to inspect the uploaded slip. Approval records the reviewing admin and approval time; receiving account, confirmed amount, and transfer time are not recorded.
- [ ] A slip issue emails the coordinator for school batches. The single-use replacement link replaces the batch slip and returns only still-pending applications to review.
- [ ] Approval queues email and one Sheets row per application item. Re-running a sync updates the existing row by Application Item ID.
- [ ] Applicants and school coordinators can open applications owned by their Google account (`owner_user_id`); sharing a `contact_email` or starting/expiring Final verification does not expose another user's Heat application, certificate photo, or shirt sizes (see `BR-15` and `BR-OPEN-05`).
- [ ] All admin catalog, exam round, pricing, and payment-account write APIs require `If-Match` or `expectedRevision` (`428` when omitted, `409`/`412` on stale revision). Google Sheets `sheets.clear_row` jobs verify spreadsheet ID, sheet ID, current `A1:Z1` headers, metadata uniqueness, and row identity strictly read-only without mutating layout; a job closes as `completed` only when a single target row covering `A:Z` is verified empty (recording explicit `(applicationItemId, spreadsheetId, sheetId)` `verified_empty` evidence in `audit_logs`) or when matching explicit audit evidence already exists, and otherwise stops as `MANUAL_REVIEW_REQUIRED:` with zero writes to Google Sheets.
- [ ] Heat exam numbers cannot be created while the round is open. A closed-round import is confirmed, appears on the right applicants, and is stable when repeated.
- [ ] Result Excel imports as a draft. Unmatched, duplicate, and mismatched rows are resolved before publication. Public results change only after publish; publishing Heat grants Final only to eligible awards and opens the matching Final registration round.
- [ ] Final number imports match only registered applicants with a valid Heat invitation and eligible published result; the admin resolves conflicts before applying numbers.
- [ ] Restore a recent PostgreSQL backup in a separate staging database and verify migrations and API readiness there.

## Day-to-day operation

- Check `/api/ready`, application logs, and **หลังบ้าน → Google Sheets** for failed or stuck outbox jobs. Retry a failed integration job after fixing its cause.
- Check the Google account quota and available Drive space. The Portal stores Drive file IDs and metadata, not a second copy of uploaded files in PostgreSQL.
- Keep regular encrypted PostgreSQL backups and periodically test restoring them. Protect the OAuth secrets and encryption key as database credentials.
- Keep result, payment, and audit history in PostgreSQL. Do not use the public Sheets workbook as the source of truth.

## Known operational limits

- The connected Google account, OAuth client, Google API enablement, consent configuration, and live sender identity are external setup; they cannot be validated until the customer account is connected.
- Automated `OCEC-05` row-clearing tests run against a mocked Google Sheets API, and live Google Sheets `Sort range` behavior has **not** yet been confirmed on a real test workbook. Because Google Sheets API v4 provides no conditional write (`If-Match`) and does not guarantee row-level `DeveloperMetadata` follows in-place `Sort range` operations, `sheets.clear_row` verifies target metadata/headers/row identity strictly read-only and routes any non-empty target row to `MANUAL_REVIEW_REQUIRED:` without sending any write to Google Sheets.
- Payment slips are displayed for manual inspection. Approval remains unavailable until the slip can be opened.
- Certificate photos require exam numbers and an open edit window. Drive deletion outside the Portal leaves the metadata in Portal but makes the preview unavailable.
- Do not deploy or invite applicants until the pre-opening checks pass with the production Google account and database.
