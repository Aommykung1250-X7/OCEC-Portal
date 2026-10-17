# Final Eligibility Claim Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let eligible Heat applicants claim and submit a Final application under the correct Google account, including applicants whose Heat entry is owned by a school coordinator.

**Architecture:** School-submitted applicants search by name, choose an exam, verify the last four phone digits, then receive a short-lived server-side grant. The Google OAuth attempt binds that grant to the selected Google user; Final submission locks the grant and invitation in the existing transaction. Self-submitted Heat entries remain restricted to their current owner.

**Tech Stack:** Node.js 22.12+, Fastify 5, PostgreSQL, React 19, Playwright and existing `node:test` database suite.

**Spec:** `docs/superpowers/specs/2026-10-16-portal-api-wiring-design.md`

## Global Constraints

- BBB ใช้รางวัล 1st/2nd/3rd สำหรับสิทธิ์ Final; รายการแข่งขันอื่นใช้ Gold/Silver/Bronze
- Final จากใบสมัคร Heat ที่สมัครเองต้องใช้ Google account เดิมที่เป็นเจ้าของ Heat
- Final จากใบสมัคร Heat ที่โรงเรียนส่ง ผู้สมัครยืนยันชื่อ รายการสอบ และโทร 4 ตัวท้าย แล้วใช้ Google account ใดก็ได้ที่ผู้สมัครเลือก; ใบสมัคร Final เป็นของบัญชีนั้น ส่วน Heat ยังเป็นของผู้ประสานงาน
- ทดสอบ Gmail, Drive และ Sheets ด้วย HTTP mocks; ไม่ใช้บัญชีบริการจริง
- ไม่โอนเจ้าของใบสมัคร Heat ของโรงเรียน และไม่เปิดสิทธิ์บัญชีผู้สมัครให้เข้าถึงใบสมัคร/ข้อมูลอื่นของ coordinator
- ไม่สร้างระบบ ticket/FAQ หลังบ้าน; ช่องทางช่วยเหลือใช้ LINE OA OCEC_Thailand ที่ https://lin.ee/3hzFg1z
- ไม่สร้าง API ใหม่สำหรับ export ที่สร้างไฟล์จากข้อมูลซึ่งโหลดจาก API อยู่แล้ว
- หน้าตัวอย่างที่ยังเก็บไว้ต้องเป็น read-only และต้องไม่แสดงผลสำเร็จจากการบันทึกจริง
- ทดสอบกับ test database แบบ disposable เท่านั้น; ห้ามใช้บริการ Google จริง
- ใช้ `npm run test:db` และ `npm run test:e2e` จากแผน browser harness ซึ่งสร้างฐานข้อมูลใหม่ทุกครั้ง; ใช้กฎ checkpoint/commit ของแผนนั้นเพื่อรักษางานที่ค้างใน checkout

## Review Focus

- ไม่พบผล, ผลยังไม่ประกาศ, รางวัลไม่ผ่าน หรือปิดรับ Final แล้ว — ค้นหา/ยืนยันต้องไม่ออกสิทธิ์; ทดสอบ `filters unavailable and ineligible Heat results`.
- ชื่อเดียวกันอยู่หลายรอบหรือซ้ำในรอบเดียวกัน — ต้องให้เลือกรอบก่อนและหยุดกรณียังคลุมเครือ; ทดสอบ `requires exam selection and refuses ambiguous same-name matches`.
- เบอร์ 4 ตัวท้ายผิด, รูปแบบผิด, หรือเดาสุ่มหลายครั้ง — response ต้องไม่เปิดเผยการมีใบสมัครและต้อง rate-limit; ทดสอบ `verification is generic, no-store, and rate-limited`.
- grant หมดอายุ, OAuth ถูกยกเลิก/state หรือ nonce ผิด, หรือ callback ถูก replay — ไม่มีการผูกบัญชี/claim; ทดสอบ `expired or invalid OAuth continuation cannot claim a grant`.
- ผู้สมัครสองคนส่ง invitation เดียวกันพร้อมกันหรือ submit ซ้ำ — มี Final ได้หนึ่งใบ; ทดสอบ `concurrent school claims create one Final application`.
- ผู้สมัครมีหลายสิทธิ์ Final ใน Heat ใบเดียว — การยืนยันรายการหนึ่งต้องใช้แทนอีกรายการไม่ได้; ทดสอบ `school grant cannot claim a different invitation from the same Heat application`.

---

### Task 1: Add private Final search and phone verification grant APIs

**Files:**
- Create: `server/finalEligibility.js`
- Create: `server/migrations/014_final_verification_grants.sql`
- Create: `test/final-eligibility.test.js`
- Modify: `server/index.js`, `test/api-boundaries.test.js`, `test/database-drafts.test.js`

**Interfaces:**
- `POST /api/public/final-eligibility/search` accepts `{ candidateName: string }` and returns `{ choices: [{ finalRoundId, competition, round, year }] }`; it never returns candidate name, school, phone, email, application ID, or result ID. Choices represent the open Final invitations corresponding to the selected exam; duplicate public labels can remain visible once, but verification must resolve to exactly one invitation.
- `POST /api/public/final-eligibility/verify` accepts `{ candidateName, finalRoundId, phoneLast4 }`; on one exact eligible match it sets an HttpOnly, SameSite=Lax `ocec_final_verification` cookie (Secure when `APP_ORIGIN` is HTTPS) and returns `{ verified: true }` with `Cache-Control: no-store`. Invalid, ambiguous, and unmatched attempts use the same public error body.
- `searchSchoolFinalEligibility(candidateName: string)` returns distinct public Final-round choices from published results and unclaimed invitations only. `createFinalVerificationGrant({ candidateName, finalRoundId, phoneLast4 })` returns an opaque cookie value only after exactly one candidate/invitation match.
- `final_verification_grants` stores a token hash, `final_invitation_id`, source Heat application/item IDs, expiration time, verified user ID, and claim timestamp; `oauth_attempts.final_verification_grant_id` binds one grant to one OAuth attempt. Raw tokens never enter PostgreSQL or JSON responses. Grants expire after 10 minutes and are invalidated after one successful Final submission.

- [ ] **Step 1: Write failing service and API tests** named `search returns only published eligible school exam choices`, `filters unavailable and ineligible Heat results`, `applies BBB 1st/2nd/3rd and other Gold/Silver/Bronze rules`, `requires exam selection and refuses ambiguous same-name matches`, and `verification is generic, no-store, and rate-limited`; assert zero PII fields and no grant on all rejected cases. Cover `finalRoundId` selection and two eligible invitations sharing a Heat application without collapsing them into one grant.
- [ ] **Step 2: Run the focused tests and verify they fail** because the grant table and endpoints do not exist.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- node --test test/database-drafts.test.js test/api-boundaries.test.js`
Expected: FAIL at missing migration/API behavior; no production URL accepted.

- [ ] **Step 3: Implement the migration, service queries, schemas, and rate-limited routes**. Normalize whitespace/case only for name matching; require a unique invitation match after the selected Final round and phone suffix; keep all search/verify responses `no-store`.
- [ ] **Step 4: Run focused DB/API tests and all pure tests**.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- node --test test/database-drafts.test.js test/api-boundaries.test.js test/final-eligibility.test.js`
Expected: PASS for eligibility, privacy, generic failures, rate limit, and existing award rules.

- [ ] **Step 5: Review the task diff and record passing commands** under the checkout rule in the browser-harness plan.

### Task 2: Bind the verification grant to OAuth and atomically claim Final invitations

**Files:**
- Modify: `server/auth.js`, `server/applications.js`, `server/index.js`
- Modify: `test/database-drafts.test.js`, `test/api-boundaries.test.js`

**Interfaces:**
- `GET /api/auth/google/start?flow=final&returnTo=/final/confirm` binds the opaque verification cookie's database grant ID to the single-use `oauth_attempts` row; unrelated sign-ins do not carry a grant.
- A valid Google callback binds the grant to the returned Google user only after state, nonce, expiry, and single-use OAuth checks pass. A callback failure leaves the invitation unclaimed.
- `GET /api/applications/final-eligibility` requires a Google session and returns only the applicant fields and still-open Final rounds covered by the current user's own Heat record or the single invitation in a bound school verification grant. For a school grant it also requires the HttpOnly `ocec_final_verification` cookie to match the grant bound to this user.
- Extend `submitIndividualApplication(candidate, ownerId, finalGrantToken?)` and `resolveDraft(client, candidate, ownerId, finalGrantToken?)`; the submit route extracts the raw token from the HttpOnly `ocec_final_verification` cookie. A Final invitation is valid when Heat is owned by `ownerId` or a live grant is bound to `ownerId` **and to that exact invitation and Heat item**. Lock the grant and invitation in the submission transaction, then consume the grant and set `claimed_application_id` only if every check passes. A school-grant submission contains only that selected Final item; another item requires its own verification. Self-owned Heat may keep the existing multi-item behavior.

- [ ] **Step 1: Write failing transaction/OAuth tests** named `self-owned Heat Final requires the same owner`, `school-owned Heat Final belongs to the verified Google user`, `school grant cannot claim a different invitation from the same Heat application`, `OAuth state nonce expiry and replay cannot bind the grant`, `expired or invalid OAuth continuation cannot claim a grant`, and `concurrent school claims create one Final application`; assert school Heat remains owned by the coordinator and only one Final row is committed.
- [ ] **Step 2: Run the focused database tests and verify they fail** for the school-owned valid case and grant binding.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- node --test test/database-drafts.test.js`
Expected: FAIL because current Final resolution requires `heat_application.owner_user_id = ownerId` and OAuth attempts have no grant binding.

- [ ] **Step 3: Implement OAuth binding and transactional claim**; preserve existing Google state/nonce/session checks, keep raw verification tokens in HttpOnly cookies only, and reject any client-provided eligibility list as authority.
- [ ] **Step 4: Run focused DB/API tests plus existing auth and application tests**.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- node --test test/database-drafts.test.js test/api-boundaries.test.js`
Expected: PASS; self and school ownership rules hold, callback replay fails, and concurrent submissions leave exactly one claimed invitation.

- [ ] **Step 5: Review the task diff and record passing commands** under the checkout rule in the browser-harness plan.

### Task 3: Replace the prototype Final confirmation flow with API-backed steps

**Files:**
- Create: `test/e2e/final-eligibility.spec.js`
- Modify: `src/App.jsx`, `docs/testing/test-strategy.md`, `docs/testing/feature-traceability.md`

**Interfaces:**
- `FinalConfirmationPage` loads self-owned Heat choices from authenticated APIs; school search calls the search endpoint, requires an exam choice, verifies the phone suffix, then starts the mockable Google login with `flow=final`.
- After OAuth, the page calls `/api/applications/final-eligibility`, shows only authorized applicant/round data, and submits through the existing `/api/applications/submit` API.
- Remove guest Final continuation and any authorization based on `applications`, `allowedRoundIds`, `setFinalAccess`, or other browser-only state. OAuth cancellation/expiry shows a retry path that repeats verification without consuming the invitation.

- [ ] **Step 1: Write browser tests** named `self applicant continues only with the Heat owner Google account`, `school applicant chooses an exam verifies phone then logs in with chosen Google account`, `guest Final submission is unavailable`, and `OAuth cancellation allows verification retry`; assert pre-verification results expose no candidate PII and a successful school Final remains under the chosen account.
- [ ] **Step 2: Run the browser tests and verify they fail** against client-side lookup and the guest button.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "self applicant|school applicant|guest Final|OAuth cancellation"`
Expected: FAIL on the current client-only search, guest route, and lost post-OAuth selection.

- [ ] **Step 3: Implement the API-backed Final page and callback continuation** with explicit loading, empty, error, expired-grant, and success states; do not keep applicant PII or trusted eligibility in browser persistence.
- [ ] **Step 4: Run the Final browser tests, database/API suites, and production build**.

Run: `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e -- --grep "self applicant|school applicant|guest Final|OAuth cancellation" && TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- npm test && npm run build`
Expected: PASS; both ownership paths work, guest is absent, and all application/API tests pass.

- [ ] **Step 5: Review the task diff and record passing commands** under the checkout rule in the browser-harness plan.
