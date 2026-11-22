# Final Registration Packages Implementation Plan

> **For agentic workers:** Use executing-plans task by task, with test-driven-development and verification-before-completion.

**Goal:** Make new Final/BBB Final X registrations require a name-only photo, shirt sizes and an explicitly priced package, with optional ceremony Guests, while retaining HEAT upload gates.

**Architecture:** Extend exam-round catalog configuration and item snapshots with package prices and Guest rosters. Share fixed package/size policy between UI and API; derive delivery mode from the selected package, never its price. Upload the required Final photo in the existing transactional submission workflow.

**Tech Stack:** Existing React, Fastify, PostgreSQL, Drive, Node tests and Playwright. No new dependency.

**Spec:** `docs/superpowers/specs/2026-11-04-final-packages-and-registration-photos-design.md`, including the user's amendments after reviewing the initial design.

## Global Constraints

- HEAT keeps approval + registration-close + complete-exam-number upload gates and exam-number filenames.
- Final/Final X require photo and per-item applicant size; photo filenames contain only English first/last name and extension.
- TIMO Final packages: `onsite` 4,500; `onsite_ceremony` 7,900. Other Final and BBB Final X: `onsite_ceremony` 7,900; `online` 4,500.
- Guest: 0–4 per competition, 4,500 each initially, only `onsite_ceremony`; English first/last name and SS–5XL required.
- Prices remain configurable per round/year; retain old submitted prices and unrelated workspace changes.
- Required-photo failures roll back new applications/payments/invitations and clean up new external files.

## Review Focus

1. Old submitted Final records without packages/photo/size remain readable at their original price.
2. Package switches must not submit or charge hidden Guests; tampered format/price/Guest payloads are rejected.
3. Near-limit photo plus payment-slip requests fit without raising all API route limits.
4. Same-name Final photo uploads use distinct file IDs while retaining name-only display filenames.
5. Admin edits and saved catalog snapshots must not silently revert new fees to format prices.

## Task 1: Package policy and catalog persistence

**Files:** `shared/finalPackages.js`, `server/migrations/021_final_registration_packages.sql`, `server/catalog.js`, `server/applications.js`, `test/final-packages.test.js`, new database workflow tests.

**Interfaces:** rounds expose `packagePrices: {onsite?,onsite_ceremony?,online?}` and `guestPrice` (baht); submissions use item `packageCode`, `shirtSize`, `guests:[{firstNameEn,lastNameEn,shirtSize}]`. Shared `getFinalPackageOptions(competitionId,roundType)`, `normalizeFinalPackagePrices(...)`, `resolveFinalPackageSelection(...)` supply allowed codes, validated prices and computed item charge. Store package/Guest snapshots per application item without changing the meaning of `fee_satang` (complete item charge).

- [x] Write policy tests for exact matrices, configurable prices, Guest bounds/data, forbidden combinations and ignored legacy format prices; run them and observe failure.
- [x] Add shared policy, additive round/item fields and catalog save/load/round-update mappings.
- [x] Integrate server-owned package resolution and item read/write snapshots; run policy/database checks.

## Task 2: Final submission photos and post-submission controls

**Files:** `server/applications.js`, `server/index.js`, `server/finalShirts.js`, `src/features/applications/applicationUtils.js`, photo/database tests.

**Interfaces:** `/api/applications/submit` accepts `certificatePhoto:{fileName,mimeType,dataBase64}` in addition to the existing slip, bounded to 32 MiB request size. Final/Final X allow photo replacement and shirt updates for submitted pending/slip-issue/approved applications, with no required-photo deletion. HEAT contracts stay unchanged.

- [x] Write failing tests for mandatory Final photo/shirt, name-only filenames for Final and Final X, old HEAT gates, foreign access, rollback on upload failure, and photo+slip request size.
- [x] Integrate initial photo uploads/associations into submission, preserve retry eligibility and cleanup, and update post-submission policies by round type.
- [x] Verify database/API tests, including existing progression and registration workflows updated to send required Final data.

## Task 3: Registration and admin interfaces

**Files:** new package/Guest and photo form components in `src/features/applications`, existing form/App payload mapping, application detail, admin round prices, admin application editing/review, registration/review email summaries, browser tests.

**Interfaces:** UI consumes Task 1 round prices and emits its item contract; a shared `FinalPackageFields` component can be reused by registration/admin editing. Admin application edit serialization includes packages/Guests/sizes, and retains historical price components for unchanged selections.

- [x] Write failing browser tests for TIMO and standard package choices, required photo/size/Guest fields, 0–4 Guests, totals, package switch, admin package pricing and review visibility.
- [x] Implement the package-driven form and photo upload, protected summaries, round price editor and package-aware admin edits/payment adjustments.
- [x] Update applicable email summaries without exposing rosters in public lookup; verify the 16,900-baht example, configurable-year prices and legacy records.
- [x] Verify on 320/768/1024/1440px after fonts load, inspect screenshots and errors, run focused tests, broader existing database tests, build and diff checks; obtain a final independent code review.

## Progress / verification

- Local branch: `codex/final-registration-packages`; pre-existing uncommitted work retained.
- Known baseline from the previous feature: full `npm test` has 3 unrelated failures (two oversized static poster fixtures and an older payment empty-state text assertion).
- Package database tests: 9/9 pass; Final X database regression: 1/1 pass in a fresh disposable database. Shared unit/email tests: 15/15 pass. Focused Chrome Final package, shirt, eligibility, Final X and HEAT form tests: 17/17 pass.
- Production build and `git diff --check` pass. Independent review found and resolved Guest JSON key-order comparison and archived-round edit issues.
- Full `npm test` still has the same 3 baseline failures noted above. A broad combined database test also exposes an existing test-fixture isolation issue in `database-drafts.test.js`; the affected Final X regression passes on a clean disposable database.
