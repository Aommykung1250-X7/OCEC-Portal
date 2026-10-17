# Browser Acceptance Harness and Portal Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, repeatable browser acceptance test harness and make the shared portal help and exam schedule use live catalog data.

**Architecture:** Playwright will run the Vite client and a test-only Fastify entry point against a fresh local PostgreSQL database created for each run. A test-only Google OAuth provider will exercise redirects and session creation without Google credentials or the integration worker. A traceability matrix will map each primary menu action to an API test, browser test, external link, or documented browser-only behavior.

**Tech Stack:** Node.js 22.12+, Playwright, React 19, Vite 8, Fastify 5, PostgreSQL, existing `node:test` suite.

**Spec:** `docs/superpowers/specs/2026-10-16-portal-api-wiring-design.md`

## Global Constraints

- ทดสอบ Gmail, Drive และ Sheets ด้วย HTTP mocks; ไม่ใช้บัญชีบริการจริง
- ติดต่อฝ่ายช่วยเหลือผ่าน LINE OA OCEC_Thailand ที่ https://lin.ee/3hzFg1z
- ไม่สร้างระบบ ticket/FAQ หลังบ้าน; ช่องทางช่วยเหลือใช้ LINE OA ตามที่ผู้ใช้เลือก
- ไม่โอนเจ้าของใบสมัคร Heat ของโรงเรียน และไม่เปิดสิทธิ์บัญชีผู้สมัครให้เข้าถึงใบสมัคร/ข้อมูลอื่นของ coordinator
- ไม่เปลี่ยน Google Workspace ให้เรียกบริการจริงในการทดสอบ
- ไม่สร้าง API ใหม่สำหรับ export ที่สร้างไฟล์จากข้อมูลซึ่งโหลดจาก API อยู่แล้ว
- หน้าตัวอย่างที่ยังเก็บไว้ต้องเป็น read-only และต้องไม่แสดงผลสำเร็จจากการบันทึกจริง
- โปรเจกต์ยังไม่มี browser test harness; เพิ่ม harness สำหรับเส้นทาง end-to-end โดยใช้ test database แบบ disposable และ OAuth/Google provider mocks ห้ามชี้การทดสอบไปฐานข้อมูล production หรือบริการ Google จริง
- Checkout ปัจจุบันมีไฟล์ที่ผู้ใช้แก้ค้างอยู่จำนวนมาก; ก่อนเริ่มให้บันทึก baseline ของ `git status` และ diff โดยไม่แก้/ทิ้งงานเดิม ห้าม `git add` ทั้งไฟล์หรือ commit งานเดิมปะปน ใช้ checkpoint แบบ diff/test จนกว่าจะทำงานบน checkout ที่แยกและสะอาดได้
- รันแผนตามลำดับ: browser harness และ traceability ก่อน, Final claim ต่อ, admin workflows หลังสุด; ทุกคำสั่ง DB/E2E ใช้ runner ฐานข้อมูลชั่วคราวจาก Task 1 เท่านั้น

## Review Focus

- `TEST_DATABASE_ADMIN_URL` ว่างหรือชี้ host ภายนอก — runner ต้องหยุดก่อน CREATE DATABASE; ทดสอบใน `test/e2e/runner-safety.test.js`.
- เปิด mock OAuth พร้อม `NODE_ENV=production` — server ต้องปฏิเสธการเริ่มต้น; ทดสอบใน `test/e2e/runner-safety.test.js`.
- catalog ไม่มีรอบสอบที่มี `examDate` — หน้าเว็บต้องแสดงทางกลับหน้าหลักที่มีรายการสอบโดยไม่มีวันตัวอย่าง; ทดสอบใน `test/e2e/portal-shell.spec.js`.
- วันที่สอบเปลี่ยนข้ามวันตามเขตเวลา Bangkok — วันที่ที่แสดงต้องตรงกับวันใน catalog; ทดสอบใน `test/e2e/portal-shell.spec.js`.
- ผู้ใช้เปิด LINE OA ในแท็บใหม่ — ลิงก์ต้องชี้ URL ที่ยืนยันและมี `rel="noopener noreferrer"`; ทดสอบใน `test/e2e/portal-shell.spec.js`.

---

### Task 1: Add the isolated browser test runner and OAuth mock

**Files:**
- Create: `playwright.config.js`
- Create: `scripts/test-e2e.js`
- Create: `scripts/with-test-db.js`, `test/e2e/api-server.js`, `test/e2e/fixtures.js`
- Create: `test/e2e/runner-safety.test.js`
- Create: `test/e2e/portal-smoke.spec.js`
- Modify: `package.json`, `package-lock.json`, `server/auth.js`

**Interfaces:**
- `npm run test:e2e` runs `node scripts/test-e2e.js`; `npm run test:db -- <node test command>` runs that command in the same fresh-database wrapper. Both return nonzero if preflight, database setup, command, or cleanup fails.
- `scripts/with-test-db.js` exports `validateTestDatabaseAdminUrl(value)` and `withFreshTestDatabase(command, args)`; the wrapper requires `TEST_DATABASE_ADMIN_URL` on `localhost`, `127.0.0.1`, or `::1`, creates a random database named `ocec_test_<random>`, passes its URL as `DATABASE_URL` and `TEST_DATABASE_URL`, and drops only the database it created after all child processes stop. It never drops or resets a pre-existing database. `scripts/test-e2e.js` calls this wrapper, runs migration/seed, and forwards CLI arguments to Playwright; `npm run test:e2e:install` installs Chromium.
- The wrapper strips inherited Google OAuth/Workspace credentials and production `.env` settings from child environments, sets a test-only session secret and `APP_ORIGIN`, and must not invoke scripts that load `.env`. `test/e2e/api-server.js` imports the Fastify app directly and listens on loopback without `server/start.js` or the integration worker. The Playwright web servers use `reuseExistingServer: false`, ports `3001`/`5173` on `127.0.0.1`, and `workers: 1`; occupied ports fail rather than attach to an unrelated server. `test/e2e/fixtures.js` creates uniquely named users, rounds, results, invitations, and catalog values per test and restores shared catalog mutations in cleanup so tests do not depend on ordering.
- `GOOGLE_OAUTH_MODE=mock` is accepted only with `NODE_ENV=test`. The mock provider exposes fixed `candidate`, `coordinator`, and `admin` test personas through the normal callback/state/nonce path, and is not registered in production; tests cannot supply arbitrary profiles.
- The mock callback must verify the nonce supplied by the provider against the stored OAuth attempt; tests inject a mismatched nonce to prove this check. The browser uses the Vite origin and same-origin API proxy. Set Playwright `testMatch: '**/*.spec.js'` and package `test` to `node --test test/*.test.js test/e2e/*.test.js`, so each runner loads only its own files.

- [ ] **Step 1: Write failing runner-safety and smoke tests** named `rejects a non-local database before creating one`, `creates and drops only its fresh test database`, `refuses mock OAuth in production`, `rejects a mismatched mock OAuth nonce`, and `loads the portal shell and completes a mock Google login`; assert unsafe URLs cause no database call, cleanup never targets a pre-existing database, the test identity appears from `/api/auth/me` after a valid callback, and invalid nonce does not create a session.
- [ ] **Step 2: Run the runner unit tests and browser smoke test to verify they fail** with the missing validation and provider behavior.

Run: `node --test test/e2e/runner-safety.test.js`
Expected: FAIL because `validateTestDatabaseAdminUrl` and the fresh-database wrapper are not defined.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "portal shell"`
Expected: FAIL because the API/Vite Playwright harness and mock provider are not configured.

- [ ] **Step 3: Implement the runner and test provider** using `scripts/with-test-db.js` for fresh database creation/cleanup and `scripts/test-e2e.js` to run `server/migrate.js`, `server/seed.js`, then Playwright. Add `@playwright/test`, `test:db`, `test:e2e`, and `test:e2e:install` scripts; add the worker-free API/Vite web servers and guarded mock OAuth adapter in `server/auth.js`.
- [ ] **Step 4: Run the focused tests and verify they pass**, then run `npm test` to confirm the existing Node test suite still works.

Run: `node --test test/e2e/runner-safety.test.js && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "portal shell" && npm test`
Expected: PASS with a disposable local test database; preflight cases PASS without opening a database connection.

- [ ] **Step 5: Review the task diff and record passing commands**. Commit only in a clean isolated checkout after verifying every staged hunk belongs to this task; in the current dirty checkout leave changes unstaged.

### Task 2: Publish feature traceability and correct test decisions

**Files:**
- Create: `docs/testing/feature-traceability.md`
- Create: `test/feature-traceability.test.js`
- Modify: `docs/testing/test-strategy.md`, `test/api-boundaries.test.js`, `test/database-drafts.test.js`

**Interfaces:**
- The matrix has columns `เมนู/การกระทำ`, `ชนิด`, `API หรือปลายทาง`, and `กรณีทดสอบ`.
- Every primary public/admin action maps to a concrete test name in this plan or in `2026-10-16-final-eligibility-claim.md` and `2026-10-16-admin-workflows.md`; references to future cases are marked `planned` until those test names exist. Browser-only export/navigation rows state why they do not persist.
- Existing tests are referenced by their current file/name; future tests use the exact names defined in those plans.
- The inventory includes auth/session; individual/school draft and submit; My Applications; status/edit access; certificate photos; slip replacement; Final eligibility; public results; admin review/notes/application edit; exam/catalog/payment-account settings; result import/resolve/publish/Heat numbering/Final IDs; Google Workspace, Sheets sync, and job retry; external LINE support; and browser-only navigation/export.

- [ ] **Step 1: Add a failing documentation contract test** in `test/feature-traceability.test.js` that reads the matrix and verifies required columns, coverage rows for every inventory group, non-empty test references for API actions, the LINE OA URL for help, and a browser-only reason for exports. In normal mode it accepts explicitly marked `planned` references; with `TRACEABILITY_REQUIRE_IMPLEMENTED=1` it resolves each referenced file and exact test name and fails on any `planned` row. Add API/database coverage named `admin CRUD endpoints enforce role, schema and persistence`, `certificate photo endpoint enforces ownership and no-store`, and `result and Final ID APIs require admin and validate action confirmation`.
- [ ] **Step 2: Run the contract test and verify it fails** because the matrix does not exist.

Run: `node --test test/feature-traceability.test.js`
Expected: FAIL with the missing matrix assertion; newly added API cases expose any uncovered route contract.

- [ ] **Step 3: Write the matrix, fill missing API boundary tests, and align test strategy decisions**. Map every API group from `server/index.js` and every primary menu action to an existing or planned exact test; include auth/role, validation, no-store/privacy, ownership, persistence, and workflow tests where the route changes data. Classify LINE help as external, browser navigation/export as non-persistent, and keep hidden prototype actions explicitly marked read-only. Preserve the confirmed Final ownership, BBB awards, three-day one-time link, school coordinator recipient, and Google HTTP mock rules.
- [ ] **Step 4: Run the documentation contract, focused API/database cases, and existing test suite**.

Run: `node --test test/feature-traceability.test.js test/api-boundaries.test.js && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- node --test test/database-drafts.test.js && npm test`
Expected: PASS; every primary menu action has one explicit coverage classification and test reference.

- [ ] **Step 5: Review the task diff and record passing commands** under the checkout rule above.

### Task 3: Wire help and schedule content to the approved destinations/data

**Files:**
- Create: `test/e2e/portal-shell.spec.js`
- Modify: `src/App.jsx`, `docs/testing/feature-traceability.md`

**Interfaces:**
- Header and footer help links both use `https://lin.ee/3hzFg1z`, `target="_blank"`, and `rel="noopener noreferrer"`.
- User-facing exam-date/year labels derive from the loaded `/api/catalog` `examDate` and `year`; when no relevant date exists, the component links to the existing home page exam listings without substituting a hard-coded date.

- [ ] **Step 1: Write browser tests** named `header and footer help open the configured LINE OA safely`, `exam schedule reflects catalog date and year after reload`, and `schedule with no exam date links to exam listings without a sample date`; assert exact URL/attributes, API-updated date/year, and the no-date fallback.
- [ ] **Step 2: Run the browser tests and verify the date/help assertions fail** against the prototype links and hard-coded date copy.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "help open|schedule reflects|links to exam listings"`
Expected: FAIL on the existing `#help` prototype and hard-coded schedule text.

- [ ] **Step 3: Replace the prototype help handlers and fixed user-facing schedule copy** in `src/App.jsx`; derive displayed schedule labels from the catalog response and link to the existing home page exam listings when no date exists.
- [ ] **Step 4: Run the portal-shell tests and production build**.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "help open|schedule reflects|links to exam listings" && npm run build`
Expected: PASS; displayed dates track the catalog and no user-facing schedule shows the old sample date.

- [ ] **Step 5: Review the task diff and record passing commands** under the checkout rule above.
