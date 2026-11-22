# Final Shirt Sizes Implementation Plan

> **For agentic workers:** Use executing-plans to implement the tasks in order, with test-driven-development and verification-before-completion.

**Goal:** Let Final applicants choose SS through 5XL beside certificate-photo upload, with optional admin-provided size-chart and sample-shirt images.

**Architecture:** Store a nullable size per application item. Use one shared pair of optional Final shirt images, stored and served separately from catalog snapshots using the existing validated poster-upload pattern. Reuse the certificate-photo availability window and existing applicant/coordinator/admin permissions.

**Tech Stack:** React, Fastify, PostgreSQL, Node test runner, Playwright. No new dependency.

**Spec:** User request in this chat, with default implementation authorized on 2026-11-03; fixed sizes SS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL. User opted to proceed with defaults.

## Global Constraints

- Only FINAL items support shirt sizes; HEAT and FINAL_X retain their existing behavior.
- Saving sizes does not require a certificate photo or either admin image.
- No size is preselected for existing applications; a user can save and change their choice in the photo-upload window.
- Admin manages optional PNG/JPEG/WebP images (up to 5 MB each) at Form options → Final shirts, independent of catalog saves.
- Existing unrelated workspace changes must be preserved; no production data is used for tests.
- UI uses existing surface, form, button, notice and responsive styles.

## Review Focus

1. An authenticated stranger cannot update someone else's size.
2. Mixed/multiple items cannot update an unrelated item or partially apply an invalid request.
3. Pending applications, missing exam numbers and registration that is still open cannot save sizes.
4. Empty media settings never prevent size selection; invalid replacements preserve the current image.
5. Reload, narrow screens and failed network writes preserve saved choices and expose readable status/errors.

## Task 1: Persistence and API

**Files:** `shared/finalShirts.js`, `server/finalShirts.js`, migration 020, `server/index.js`, `server/catalog.js`, `server/applications.js`, `test/database-final-shirts.test.js`, `test/api-boundaries.test.js`.

**Interfaces:** `FINAL_SHIRT_SIZES`; PUT `/api/applications/:id/shirt-sizes` with `{items:[{applicationItemId,shirtSize}]}`; GET `/api/final-shirt-images/:kind`; PUT/DELETE `/api/admin/final-shirt-images/:kind` for `chart` or `sample`. Catalog `finalShirtImages` maps image kinds to version strings. Application competitions expose nullable `shirtSize`.

- [x] Write and run failing tests for API authorization, valid-size persistence, all window gates, ownership, cross-item updates, atomic invalid requests and optional image lifecycle.
- [x] Add the additive migration, server validation/transactions/audit records, protected routes, and read mappings.
- [x] Run new unit/API/database checks and verify they pass.

## Task 2: Applicant and admin interfaces

**Files:** `src/components/FinalShirtImages.jsx`, `src/tailwind.css`, `src/features/applications/FinalShirtSection.jsx`, `src/features/admin/FinalShirtSettings.jsx`, `src/features/applications/ApplicationPages.jsx`, `src/features/admin/CatalogOptions.jsx`, `src/features/admin/AdminRoundPage.jsx`, `src/features/admin/AdminReviewPage.jsx`, `src/App.jsx`, `test/e2e/final-shirts.spec.js`.

**Interfaces:** detail receives `finalShirtImages` and `onSaveShirtSizes(id,items)`; admin receives `finalShirtImages` and `onFinalShirtImagesChange`. Reuse Task 1 contracts.

- [x] Add browser tests for the exact size list, default empty media, saved-value reload, changing sizes without a photo, non-Final exclusion, lock state, admin image upload/delete/validation and narrow layouts.
- [x] Implement controls beside certificate photos, optional expandable images, admin settings and admin review visibility.
- [x] Run browser tests in a disposable local database, inspect screenshots, run `npm test` and `npm run build`.
- [x] Review the diff for security, scope and regressions; record verification results below.

## Verification record

- New workflow observed failing before API and UI implementation, then passing after implementation.
- Database: 14/14 Final shirts + Final claim + Final X tests passed; 30/30 existing application, review, photo and integration database tests passed. Tests used fresh disposable databases on a temporary PostgreSQL server on localhost port 55437; no application database was migrated.
- Browser: 5/5 tests passed (four new shirt tests and the existing Final X flow), using installed Chrome, mock OAuth/Workspace and isolated API/web ports. The media test additionally passed after waiting for web fonts, with component bounds and thumbnail dimensions verified at 320, 768, 1024 and 1440 px. No JavaScript page errors were observed in that flow.
- Focused unit/API: 15/15 authorization, Final eligibility, Final X and route tests passed.
- `npm run build`: passed, with the existing large-chunk warning. `git diff --check`: passed.
- Full `npm test`: 75 passed, 5 skipped, 3 existing failures in unchanged sources: two center-poster tests use the 5,288,240-byte static PNG despite the 5,242,880-byte limit; one payment-account empty-state assertion expects older Thai wording. These unrelated files were not modified.
- Screenshot review found the new shared gallery was outside Tailwind's explicit source list; added that file to the source list and verified thumbnails stay at most 160 px tall. The existing decorative background canvas can exceed viewport width; responsive assertions target the feature's own rendered bounds and scroll width.
- Screenshots: `outputs/final-shirts/admin-mobile.png`, `outputs/final-shirts/applicant-320.png`, `outputs/final-shirts/applicant-1440.png`. Media shown in screenshots is test data.
- Final self-review covered input validation, owner/applicant/admin permissions, per-item persistence, transaction atomicity, optional image handling, catalog-save independence, keyboard-accessible native dialogs, existing flow preservation and dependency scope. No dependency was added. Existing unrelated workspace changes were preserved.
- Deployment requires running `npm run db:migrate` to apply `020_final_shirts.sql` before starting the updated API. This task does not deploy to production.
