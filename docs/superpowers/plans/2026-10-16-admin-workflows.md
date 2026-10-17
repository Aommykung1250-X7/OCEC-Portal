# Admin Workflows and Catalog Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect admin review, internal notes, slip replacement, public rejection status, and catalog editing to their existing APIs with truthful success/error states.

**Architecture:** Keep the existing Fastify APIs and database workflows as the source of truth. Cover the existing rejection validation with tests and connect the review UI to review/notes/slip endpoints; use the catalog PUT API for saved state and track local edits until a confirmed response.

**Tech Stack:** Node.js 22.12+, Fastify 5, PostgreSQL, React 19, Playwright, existing `node:test` database suite.

**Spec:** `docs/superpowers/specs/2026-10-16-portal-api-wiring-design.md`

## Global Constraints

- ลิงก์แก้สลิปใช้ได้ครั้งเดียว และหมดอายุหลังไม่ได้ใช้งาน 3 วัน
- ปัญหาสลิปของชุดโรงเรียนส่งลิงก์ให้ผู้ประสานงานโรงเรียนเท่านั้น
- รูปเกียรติบัตรและหมายเหตุภายในแอดมินพร้อมประวัติเป็นฟีเจอร์จริง
- หมายเหตุแอดมินแก้ไขและลบได้ โดยเก็บประวัติก่อน/หลัง
- Google Sheets retry อัตโนมัติและมีปุ่ม retry สำหรับแอดมิน
- สถานะสาธารณะแสดง “ไม่อนุมัติ” พร้อมเหตุผลสั้น ๆ; การปฏิเสธส่งอีเมลถึงผู้สมัครด้วย
- ไม่สร้างระบบ ticket/FAQ หลังบ้าน; ช่องทางช่วยเหลือใช้ LINE OA OCEC_Thailand ที่ https://lin.ee/3hzFg1z
- ไม่โอนเจ้าของใบสมัคร Heat ของโรงเรียน และไม่เปิดสิทธิ์บัญชีผู้สมัครให้เข้าถึงใบสมัคร/ข้อมูลอื่นของ coordinator
- ทดสอบ Gmail, Drive และ Sheets ด้วย HTTP mocks; ไม่ใช้บัญชีบริการจริง
- ไม่สร้าง API ใหม่สำหรับ export ที่สร้างไฟล์จากข้อมูลซึ่งโหลดจาก API อยู่แล้ว
- หน้าตัวอย่างที่ยังเก็บไว้ต้องเป็น read-only และต้องไม่แสดงผลสำเร็จจากการบันทึกจริง
- ใช้ `npm run test:db` และ `npm run test:e2e` จากแผน browser harness ซึ่งสร้างฐานข้อมูลใหม่ทุกครั้ง; ใช้กฎ checkpoint/commit ของแผนนั้นเพื่อรักษางานที่ค้างใน checkout

## Review Focus

- ปฏิเสธพร้อมเหตุผลว่าง/เกินขีดจำกัด — UI และ API ต้องบล็อกและไม่ส่งอีเมล; ทดสอบ `reject requires a non-empty short reason`.
- ผู้ใช้สาธารณะค้นใบสมัครที่ถูกปฏิเสธ — เห็นสถานะและเหตุผลสั้น แต่ไม่เห็นโน้ตภายในหรือข้อมูลชำระเงิน; ทดสอบ `public rejection status exposes reason but not admin notes`.
- ผู้ประสานงานโรงเรียนได้รับลิงก์แก้สลิป — ผู้สมัครในชุดหรือแอดมินอื่นต้องไม่กลายเป็นผู้รับ; ทดสอบ `school slip replacement goes only to coordinator`.
- โน้ตถูกแก้/ลบหรือบันทึกพร้อมกัน — history ต้องเก็บค่าก่อน/หลัง actor/time และ UI แสดง error เมื่อ API ปฏิเสธ; ทดสอบ `admin can add edit delete and inspect note history`.
- catalog save ล้มเหลวหรือมีการออกจากหน้าขณะยัง dirty — ไม่มี success toast และผู้ดูแลได้รับคำเตือน; ทดสอบ `catalog dirty state survives failed save and blocks accidental navigation`.

---

### Task 1: Enforce rejection reason and render the public rejected state

**Files:**
- Modify: `server/index.js`, `server/applications.js`, `src/App.jsx`
- Modify: `test/api-boundaries.test.js`, `test/database-drafts.test.js`
- Create: `test/e2e/admin-rejection.spec.js`

**Interfaces:**
- `PATCH /api/admin/applications/:id/review` with `decision: "reject"` requires `reason` trimmed to 1–240 characters; other decisions retain their existing request shape.
- `StatusLookupPage` renders returned `status === "rejected"` as “ไม่อนุมัติ” and displays the short `reason` returned by `/api/public/applications/status`; it never renders `adminNotes`.
- Existing backend rejection email contains the same validated short reason shown by public status.

- [ ] **Step 1: Write API/database/browser tests** named `reject requires a non-empty short reason`, `public rejection status exposes reason but not admin notes`, `admin can reject with reason and applicant receives same reason by email`, and `approve action shows success only after API response`; assert blank/space-only/over-limit reasons are rejected and a valid decision updates server state before success appears.
- [ ] **Step 2: Run the targeted suites and verify the API contract passes while the browser test fails** because the public UI omits the returned reason.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- node --test test/api-boundaries.test.js test/database-drafts.test.js && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "admin can reject|approve action"`
Expected: API/database validation PASS; browser test FAIL on absent public reason display.

- [ ] **Step 3: Keep the existing API/service validation covered and render the reason**; add route-schema validation only if the API contract test finds a gap, and show an accessible reason input before confirmation.
- [ ] **Step 4: Run the focused tests plus existing public lookup and review tests**.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- node --test test/api-boundaries.test.js test/database-drafts.test.js && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "admin can reject|approve action"`
Expected: PASS; rejection email and public status share the reason; public response contains no admin note fields.

- [ ] **Step 5: Review the task diff and record passing commands** under the checkout rule in the browser-harness plan.

### Task 2: Connect internal admin notes and audit history to the review page

**Files:**
- Modify: `src/App.jsx`, `docs/testing/feature-traceability.md`
- Create: `test/e2e/admin-notes.spec.js`

**Interfaces:**
- `GET /api/admin/applications/:id/notes?includeHistory=true` supplies notes and audit history; create/update/delete use the existing POST/PATCH/DELETE routes and `body` max 4000 characters.
- `AdminReviewPage` loads notes when the selected application changes, and exposes add, edit, delete, and history controls. Each mutation updates the view only after a successful response.
- Only the authenticated admin review page requests notes; public status, applicant pages, and email payloads do not contain them.

- [ ] **Step 1: Write browser tests** named `admin can add edit delete and inspect note history`, `note API failures do not show success or discard draft`, and `non-admin and public views never render admin notes`; assert author/time, before/after history, and delete history.
- [ ] **Step 2: Run the browser tests and verify they fail** because the review UI does not call the existing notes routes.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "admin can add edit delete|note API failures|never render admin notes"`
Expected: FAIL because the notes controls are absent.

- [ ] **Step 3: Implement the notes panel in `AdminReviewPage`** with loading/empty/error states, 4000-character validation, edit/delete confirmation, and an expandable history view using the existing API.
- [ ] **Step 4: Run the notes browser tests and the existing history/privacy DB tests**.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "admin can add edit delete|note API failures|never render admin notes" && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- node --test test/database-drafts.test.js`
Expected: PASS; create/edit/delete each records actor/time and before/after values; public/admin authorization boundary holds.

- [ ] **Step 5: Review the task diff and record passing commands** under the checkout rule in the browser-harness plan.

### Task 3: Replace the fake slip-upload success page with the one-time API workflow

**Files:**
- Modify: `src/App.jsx`, `docs/backend/implementation-plan.md`, `docs/testing/test-strategy.md`, `docs/testing/feature-traceability.md`
- Create: `test/e2e/admin-slip-replacement.spec.js`

**Interfaces:**
- Admin action submits `{ decision: "slip_issue", reason, paymentId? }` to `PATCH /api/admin/applications/:id/review`; only a successful API response shows success and reloads the application.
- For a school batch the backend sends the one-use replacement URL to the coordinator only. The existing public `/slip-replacements/validate` and `/submit` endpoints remain responsible for expiry, one-use, and file validation.
- The existing `/slip-upload/:id` page is a local-only prototype that can show success without an API call. Remove its mutable flow or redirect it to a safe status page; direct navigation to that URL must never claim an upload succeeded. Keep the token-based `/slip-replacement` route as the only upload entry point.
- Update `docs/backend/implementation-plan.md` to state unused links expire after 3 days (not 7); preserve the one-use rule.

- [ ] **Step 1: Write browser and database tests** named `admin issues a replacement link only after API success`, `direct slip-upload URL cannot claim local-only success`, `school slip replacement goes only to coordinator`, and `replacement link expires after three days and is one use`; assert failed API shows an error without success, direct prototype URL cannot show a success toast, queued email has only the coordinator recipient, and the second token submission fails.
- [ ] **Step 2: Run the tests and verify they fail** against the local-only `slip-upload` success state and stale 7-day document rule.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "issues a replacement|direct slip-upload|three days"`
Expected: FAIL until the admin route and UI use the API-backed flow.

- [ ] **Step 3: Implement the admin replacement action and remove prototype success behavior** including the direct `/slip-upload/:id` route; keep the current public one-time token upload endpoint and use its validation errors in the UI. Correct the backend implementation plan and feature matrix.
- [ ] **Step 4: Run slip browser tests and existing token/email database tests**.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "issues a replacement|direct slip-upload|three days" && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- node --test test/database-drafts.test.js test/api-boundaries.test.js`
Expected: PASS; token lifetime is 3 days, use count is one, and school-batch recipient is coordinator only.

- [ ] **Step 5: Review the task diff and record passing commands** under the checkout rule in the browser-harness plan.

### Task 4: Track catalog edits until the API confirms persistence

**Files:**
- Modify: `src/App.jsx`, `docs/testing/feature-traceability.md`
- Create: `test/e2e/admin-catalog-save.spec.js`

**Interfaces:**
- `AdminRoundPage` compares its editable catalog snapshot to the last server-confirmed snapshot; `onSaveCatalog()` resolves `true` only after `PUT /api/admin/catalog` succeeds and `false` on failure. The snapshot covers exams, competitions, grades, centers, past papers, and payment accounts included in that PUT payload.
- A dirty catalog displays an unsaved indicator and registers both `beforeunload` protection and an in-app navigation confirmation. Successful save resets the baseline; failed save preserves dirty values and displays an error.
- Existing catalog schema/route remains unchanged; no new persistence API is added.

- [ ] **Step 1: Write browser tests** named `catalog dirty state survives failed save and blocks accidental navigation`, `saved catalog remains after reload`, and `invalid catalog response does not show saved state`; assert unsaved indicator, warning, preserved input after HTTP 500, and persisted date/round after reload.
- [ ] **Step 2: Run the browser tests and verify they fail** because edits currently have no dirty-state guard.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "catalog dirty state|saved catalog remains|invalid catalog response"`
Expected: FAIL on missing dirty indicator and navigation warning.

- [ ] **Step 3: Implement the confirmed snapshot baseline and guards** around all fields persisted by `PUT /api/admin/catalog`; only clear dirty state after a successful response and keep unsaved fields after a failed request.
- [ ] **Step 4: Run catalog browser tests, API contract tests, all database tests, and production build**.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "catalog dirty state|saved catalog remains|invalid catalog response" && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- npm test && npm run build`
Expected: PASS; server-confirmed catalog survives reload and failed saves never show success.

- [ ] **Step 5: Review the task diff and record passing commands** under the checkout rule in the browser-harness plan.

### Task 5: Close the feature matrix and run the full acceptance gate

**Files:**
- Modify: `docs/testing/feature-traceability.md`, `test/feature-traceability.test.js`, `docs/testing/test-strategy.md`

**Interfaces:**
- No matrix row remains `planned`; every API-backed action points to an existing exact test name, and every external/browser-only action has its verified destination or reason.
- The final gate runs pure/API/database tests on a fresh local database, browser tests on a separate fresh local database, and the production build; Google interactions remain HTTP mocks.

- [ ] **Step 1: Run `TRACEABILITY_REQUIRE_IMPLEMENTED=1 node --test test/feature-traceability.test.js`** and list any missing or still-planned test references; the strict check must fail until all rows are resolved.
- [ ] **Step 2: Add only the missing behavior tests or correct stale matrix references**, then rerun the strict check. Do not mark a row covered merely because an unrelated test touches its API.
- [ ] **Step 3: Run the complete gate**.

Run: `TRACEABILITY_REQUIRE_IMPLEMENTED=1 node --test test/feature-traceability.test.js && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- npm test && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e && npm run build`
Expected: PASS with zero planned matrix rows, no skipped database workflow test, all browser scenarios green, and a successful production build.

- [ ] **Step 4: Review the final diff and record results** under the checkout rule in the browser-harness plan; report any test that could not run due to missing local PostgreSQL or Chromium setup.
