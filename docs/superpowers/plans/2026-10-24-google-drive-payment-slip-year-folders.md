# Google Drive Payment Slip Year Folders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put every payment slip in its Bangkok upload-year folder and name it by applicant or school, with stable per-year suffixes.

**Architecture:** Add a small server helper for annual folder names, applicant display names, and sanitized filenames. Route all current slip upload paths through it and use a PostgreSQL advisory lock while selecting the next suffix. Add an admin-only, retry-safe backfill that moves and renames existing Drive files by file ID and uploads legacy database-only bytes.

**Tech Stack:** Node.js ESM, Fastify, PostgreSQL, Google Drive API, React, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-24-google-drive-payment-slip-year-folders-design.md`

## Global Constraints

- Folder path: `OCEC Portal/Payment Slips/OCEC Slip YYYY`.
- Year uses the `Asia/Bangkok` calendar at slip upload time.
- Individual files use the applicant's English full name; school batches use the school name.
- Use `.jpg`, `.png`, or `.pdf` from validated MIME type; suffix sequence starts at zero per name and year.
- Preserve Drive file IDs and all unrelated dirty checkout work.

## Review Focus

- Year boundary near midnight in Bangkok: test a UTC date that falls on the next Bangkok calendar day.
- Name sanitization and extension: test Thai text, separators, missing optional Thai name, and all allowed MIME types.
- Replacement/admin-added/school-batch uploads: test that they use annual folders and the correct owner label.
- Concurrent suffix allocation: test the lock-based allocator's monotonic sequence.
- Backfill partial failure and rerun: test unchanged IDs, local-byte upload, skipped missing data, and idempotence.

---

### Task 1: Filename and year rules

**Files:**
- Create: `server/paymentSlipFiles.js`
- Create: `test/payment-slip-files.test.js`

- [ ] Write tests for Bangkok year selection, applicant/school labels, filename sanitization, and suffixes.
- [ ] Run the focused test and confirm it fails because the helpers do not exist.
- [ ] Implement the pure helper functions.
- [ ] Rerun the focused test and confirm it passes.

### Task 2: Route all new slip uploads through annual folders

**Files:**
- Modify: `server/applications.js`
- Modify: `server/googleWorkspace.js`
- Test: `test/database-drafts.test.js`

- [ ] Add a failing database-backed test for new individual and school-batch uploads and repeat uploads.
- [ ] Run the focused database test and confirm the expected annual folder and filenames fail.
- [ ] Update individual, school-batch, admin-added, and replacement uploads to allocate names under a per-year lock and upload to `OCEC Slip YYYY`.
- [ ] Rerun the focused database test and confirm all paths use the shared rule.

### Task 3: Backfill existing slips and expose an admin action

**Files:**
- Modify: `server/googleWorkspace.js`
- Modify: `server/index.js`
- Modify: `src/App.jsx`
- Test: `test/database-drafts.test.js`
- Test: `test/e2e/admin-workflows.spec.js`

- [ ] Add failing tests for moving/renaming prior Drive files, uploading legacy database bytes, retrying after a partial failure, and admin-only access.
- [ ] Run the focused tests and confirm the missing backfill behavior fails.
- [ ] Implement the idempotent backfill, admin route, and status/results in the Google Drive admin card.
- [ ] Rerun the focused tests and confirm the migration action reports moved, uploaded, skipped, and failed counts.

### Task 4: Verify the complete change

- [ ] Run the focused payment-slip tests.
- [ ] Run the full test suite and production build.
- [ ] Review the diff to confirm unrelated user changes are untouched and only slip files are changed in Drive.
