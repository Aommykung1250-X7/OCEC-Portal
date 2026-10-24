# Google Drive Payment Slip Year Folders

## Goal

Store payment slips in one Google Drive folder per upload year, independent of exam, and give every file a predictable applicant-based name.

## Behavior

- New slips go to `OCEC Portal/Payment Slips/OCEC Slip YYYY`, where `YYYY` is the upload year in `Asia/Bangkok`.
- Individual application slips use the applicant's English full name. A shared school-batch slip uses the school name.
- The first slip for a name in a year is `Name.ext`; later slips use `Name_1.ext`, `Name_2.ext`, and so on. Each year starts at the unsuffixed name again.
- All versions of existing slips are reorganized into the annual folder and renamed in upload-time order. Their Google Drive file IDs remain unchanged. Legacy slips stored as database bytes are uploaded and linked to Drive as part of the same operation.
- An admin action runs the existing-slip reorganization. Repeating it is safe and keeps names and locations stable. Rows with no Drive file and no stored bytes are reported as skipped; per-file failures are reported so the admin can retry.
- File extensions are derived from validated MIME types (`.jpg`, `.png`, `.pdf`). Applicant text is normalized and unsafe filename characters are replaced.

## Implementation direction

Use the existing `Payment Slips` root and add an annual child folder; leave the separate certificate-photo and spreadsheet folders alone. New upload flows use the same server helper for year, display name, sequence allocation, and filename. A database advisory lock for the normalized filename and year prevents concurrent uploads from choosing the same suffix. An admin-only endpoint and the existing Google Drive connection card expose the idempotent backfill for old Drive files and legacy database bytes.

## Boundaries

- Do not change exam registration, payment review, or slip replacement semantics.
- Do not delete or duplicate an existing Drive file when it can be moved and renamed by its ID.
- Keep the Google OAuth scopes unchanged.
- Keep current user changes in the checkout intact.

## Review focus

- A timestamp near midnight must use the Bangkok calendar year.
- Resubmitted slips, admin-added slips, and school-batch slips must use the same folder and naming rules.
- Two simultaneous uploads for the same filename must not receive the same suffix.
- A partially failed backfill must be safe to retry without duplicate files or changed links.
- Missing legacy Drive files and legacy database-only bytes must be handled and reported correctly.
