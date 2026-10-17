# OCEC Portal test strategy and decision log

Updated: 16 October 2026. Scope: OCEC Portal only.

## Purpose

Tests should describe accepted business behavior and become an executable gate for completing unfinished features. A finite suite cannot enumerate every possible input. Each feature therefore needs representative success, boundary, invalid input, authorization, concurrency, retry, and failure cases, plus regression cases for defects found later.

## Decision record ADR-T001: source of expected behavior

Status: **open; ask the product owner for each conflict**.

The current website, `OCEC-Portal-Requirements.md`, `docs/backend/implementation-plan.md`, and server code sometimes disagree. The product owner has said to ask when they conflict because later changes may supersede the earlier document. Do not turn a disputed behavior into a passing test solely because it appears in code or one document. Record the answer here, then add an executable regression test linked to its case ID.

| Decision | Conflict | Answer |
| --- | --- | --- |
| D01 | BBB Final eligibility: medals only versus 1st/2nd/3rd too | **Decided 12 Oct 2026:** BBB uses 1st/2nd/3rd; other competitions use Gold/Silver/Bronze. |
| D02 | Slip replacement link: valid until used versus 7 day expiry | **Decided 12 Oct 2026:** single use; an unused link expires after 3 days. |
| D03 | School batch slip problem: contact emails on applications versus coordinator only | **Decided 12 Oct 2026:** send the replacement link to the school coordinator only. |
| D04 | Certificate photo and admin note/history: prototype feature versus required production feature | **Decided 12 Oct 2026:** both are required and need acceptance tests. |
| D05 | Sheets sync UI: automatic retry only versus manual retry button | **Decided 12 Oct 2026:** keep automatic retry and provide an admin retry button. |
| D06 | Internal admin notes edit/delete policy | **Decided 12 Oct 2026:** admins may edit and delete notes, and both operations must retain history. |
| D07 | Public lookup's `rejected` status versus the two-status rule | **Decided 12 Oct 2026:** show rejected as a third public status. |
| D08 | Whether public rejected status includes a reason | **Decided 12 Oct 2026:** show the admin's short reason with rejected status. |
| D09 | Heat number order within a grade | **Decided 12 Oct 2026:** English first name, then middle name, then surname, ascending. |
| D10 | Whether rejection also sends an email | **Decided 12 Oct 2026:** send the applicant a rejection email with the short reason. The public lookup rule is D08. |
| D11 | Google Workspace test environment | **Decided 12 Oct 2026:** there is no separate Google account or credentials; use HTTP mocks for Gmail, Drive, and Sheets. Do not call the real provider. |
| D12 | Final ownership after school Heat | **Decided 16 Oct 2026:** search name, select an exam, verify phone last four, then require Google login; Final belongs to the applicant-selected Google account while school Heat remains coordinator-owned. Self Heat Final uses the Heat owner's account. |

## Test layers

1. **Pure rules** (`node --test`): center catalog, workbook parsing, prices, award eligibility, statuses, date windows, email content, and encryption. No external service.
2. **API contract** (`Fastify.inject`): authentication, authorization, schema limits, response shape, cache headers, and error mapping. Mock external dependencies or use a dedicated disposable database.
3. **Database workflow** (dedicated test PostgreSQL only): migrations, transactions, uniqueness, ownership, state transitions, concurrent submissions, import matching, outbox, and audit records. Fixtures use unique run IDs, but the seeded catalog and changed round settings persist between runs, so use a disposable database. Never point these tests at production or a shared staging database.
4. **Browser workflow** (dedicated test deployment): one full path per persona, plus keyboard, mobile, upload, and error-state checks. Stub Google/Drive/Sheets/Gmail at the network boundary.
5. **Provider adapter** (mock Google HTTP): OAuth state/scope/token handling, Drive folder and file requests, Gmail MIME message, and Sheets append/update. These run with the disposable database and no Google credentials. A live provider check would require a separate test account and is outside this suite.

`npm test` runs pure, API-boundary, runner-safety, and database tests; the database workflow skips unless the runner supplies `TEST_DATABASE_URL`. Use `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- npm test` for a full run. The runner creates a uniquely named local database and drops only that database afterward. Use `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e` for Playwright; its API entry point does not start the integration worker and its OAuth provider is test-only. Google Workspace calls use HTTP mocks.

## Domain glossary

| Term | Meaning in tests |
| --- | --- |
| Applicant | The person taking an exam; one application is for one applicant. |
| Owner | Google account that submitted an application, either the applicant or a school coordinator. |
| School batch | Applications submitted together with one combined payment and slip. Each application is reviewed separately. |
| Application item | One selected competition and round inside an application. Results, exam numbers, and Sheets rows attach to items. |
| Exam round | A competition in a year and Heat/Final stage, with its own dates, grades, centers, and prices. |
| Center snapshot | Center code and name copied into the application so later catalog edits do not rewrite history. |
| Submitted | Application with a payment slip awaiting admin review. It is visible in public status search. |
| Approved | Admin accepted the application; permitted profile fields remain editable until the edit deadline. |
| Result draft | Imported result rows that may be replaced or resolved before publication. |
| Published result | Locked public result. Eligible awards may create a Final invitation. |
| Final invitation | Permission to create a separate Final application from an eligible Heat result. |
| Outbox job | Durable work item for email, Drive, or Sheets; business data survives provider failure. |

## Case inventory

Legend: `A` automated and passing; `F` automated and currently failing; `P` planned, needs a test harness or implementation; `D` blocked by a product decision. The IDs remain stable so failures can be traced to a rule.

### Identity and authorization

| ID | Scenario | Status |
| --- | --- | --- |
| AUTH-01 | Anonymous requests cannot read personal or admin data | A |
| AUTH-02 | Google callback rejects absent code/state, replay, expired state, unverified email, wrong nonce | P |
| AUTH-03 | OAuth return URL cannot redirect off site | P (start attempt stores a safe return path; callback redirect still needs a provider test) |
| AUTH-04 | Session cookie is HTTP-only, SameSite, Secure on HTTPS, and expires; logout revokes token | P (OAuth state cookie and logout revocation covered; session issuance needs provider test) |
| AUTH-05 | Non-admin receives 403 on every admin operation; admin list changes take effect on next request | P (role boundary covered in DB test) |
| AUTH-06 | Coordinator sees own applications, not another account's data; batch ownership still needs coverage | P (individual ownership covered) |

### Registration, profile, and public lookup

| ID | Scenario | Status |
| --- | --- | --- |
| APP-01 | Individual draft and submission create one applicant, selected items, price snapshots, payment and email job atomically | P (draft snapshot covered after date workaround) |
| APP-02 | Same person/round/competition duplicate is rejected with existing application reference | A |
| APP-03 | Different person, year, round, or competition is allowed | P |
| APP-04 | Open/close dates use Bangkok day boundary; manual closure wins | P |
| APP-05 | Invalid name, date, email, phone, item count, grade, format, center, and unknown catalog IDs are rejected | P |
| APP-06 | Online format uses center 500 and requires exam email; paper format uses an allowed active center | P |
| APP-07 | Submitted application appears in public search with pending, confirmed, or rejected status; rejected shows a short reason | A |
| APP-08 | Public edit requires matching English name plus last four phone digits; rate limits and no-store headers apply | P |
| APP-09 | Pending applicant cannot edit; approved owner/public verified applicant can edit only allowed profile fields before deadline | P (owner path covered) |
| APP-10 | Admin can edit after submission and after applicant deadline, with audit, price difference, and extra slip | P |
| APP-11 | Changing current catalog does not alter an existing application snapshot | P |
| APP-12 | My Applications groups by competition/year and retains history | P |
| APP-13 | Application service accepts an open round when PostgreSQL returns native `date` values | A |
| APP-14 | Admin rejection stores a short reason and emails the applicant | A |

### School batch and Excel

| ID | Scenario | Status |
| --- | --- | --- |
| BATCH-01 | Template import previews every applicant and shows row/field errors without writing applications | A |
| BATCH-02 | Missing columns, malformed choices, unknown grades/centers/papers, duplicate rows, and empty sheets report exact rows | P |
| BATCH-08 | CSV parser handles BOM, quoted cells, semicolon/tab, and file-size/type limits | A |
| BATCH-03 | Submission is atomic for 1 to 100 applicants and one shared payment/slip | P (draft rollback covered) |
| BATCH-04 | Batch total equals sum of per-person exam items and past papers, including mixed formats | P (draft total covered) |
| BATCH-05 | Each member can be reviewed separately; replacing a bad shared slip changes only pending members | P |
| BATCH-06 | Concurrent duplicate submissions create only one intended batch | P |
| BATCH-07 | Shared slip issue email goes only to the school coordinator | A (database recipient and batch status) |

### Payments and mail

| ID | Scenario | Status |
| --- | --- | --- |
| PAY-01 | Individual/Final application has one slip; school batch has one shared slip | P |
| PAY-02 | Admin approval requires a readable slip and records reviewer/time; rejection preserves reason | P |
| PAY-03 | Online to paper charges an additional 100 baht; paper to online records no refund | P |
| PAY-04 | Replacement token is unpredictable, scoped to slip only, single-use, and rejects replay | P |
| PAY-05 | Replacement link works once and an unused link expires after 3 days | A |
| PAY-06 | Unsupported file type, corrupt content, oversized upload, and missing file are rejected | P |
| MAIL-01 | Submission, approval, slip issue, and eligible result mail go to the correct recipient once | P |
| MAIL-02 | Ineligible result sends no result mail | P |
| MAIL-03 | HTML escapes applicant input; test messages contain no live action links | A |
| MAIL-04 | Provider failure leaves application committed and queues retry without duplicate mail | P |

### Catalog, centers, and exam numbers

| ID | Scenario | Status |
| --- | --- | --- |
| CAT-01 | Center import trims values, preserves IDs, includes online 500, reports blanks/000/duplicates | A |
| CAT-06 | Center import preview rejects non-three-digit codes before admin saves | A |
| CAT-02 | Multi-competition paper center choices use intersection of active allowed centers | A |
| CAT-03 | Existing application uses historical center snapshot | A |
| CAT-04 | Admin catalog updates validate code uniqueness, linked records, prices, grades, dates, and archive behavior | P |
| CAT-05 | Center count report groups per competition, center, grade, and year | A |
| ID-01 | Heat IDs are assigned only after close and admin confirmation, including pending applications | P (manual close path covered) |
| ID-02 | IDs are unique: 3 digit center plus 4 digit sequence, per center from 0001 | P (one center covered) |
| ID-03 | Sort by center, configured grade order, English first/middle/surname, then submission time for ties | A |
| ID-04 | Concurrent generation is idempotent; cancelled/reassigned numbers are audited | P |

### Results and Final

| ID | Scenario | Status |
| --- | --- | --- |
| RESULT-01 | Import validates required columns, 1 to 20,000 rows, and each required cell | P |
| RESULT-02 | Match by exam number; unknown, duplicate, and mismatched name/school/grade rows become conflicts | P (school mismatch covered) |
| RESULT-03 | Admin resolves conflicts or replaces draft before publication | P (resolve covered) |
| RESULT-04 | Publication is blocked while conflicts remain; publication is idempotent and permanently locks results | P (block/lock covered) |
| RESULT-05 | Public result search and filters show all awards only after publication | P |
| RESULT-06 | For non-BBB competitions, Gold/Silver/Bronze are eligible; Merit/Participation are not | A |
| RESULT-07 | For BBB, only 1st/2nd/3rd are eligible | A |
| FINAL-01 | Eligible Heat applicant can confirm immediately after publication until scheduled/manual close | P |
| FINAL-02 | School Heat applicant verifies name, selected Final exam, and phone last four, then logs in with an applicant-selected Google account; self Heat applicant uses the Heat owner's account | A |
| FINAL-03 | Final prefill may be corrected and creates a separate paid application | P |
| FINAL-04 | Final number shows pending until import; match by name and school, pause ambiguous/unknown rows | P (unknown/duplicate rows covered) |
| FINAL-05 | Final number apply waits for conflict resolution and never changes the published Heat result | P (unresolved block and matched apply covered) |

### Integrations, files, and operations

| ID | Scenario | Status |
| --- | --- | --- |
| INT-01 | Queued sensitive email encrypts with a fresh nonce and rejects tampering/wrong key | A |
| INT-02 | Approved item creates exactly one Sheets row; edit updates same row and timestamp | P (mock insert/update and row mapping pass; timestamp and real provider remain unverified) |
| INT-03 | Sheets is one way; provider outage retries without losing web changes | P (mock outage preserves web edit and later sync succeeds; queued end-to-end retry remains) |
| INT-04 | Failed Sheets sync shows the agreed status and admin retry button while automatic retry continues | P |
| INT-05 | Drive upload/download/delete use correct folder and preserve application when file is missing | P (mock folder and file requests pass; missing-file workflow remains) |
| INT-06 | Failed jobs have bounded retries, actionable admin status, and safe manual retry | A (automatic backoff/exhaustion and atomic manual retry audit) |
| OPS-01 | Migrations work on empty DB and upgrade prior schema; readiness fails before latest migration | P |
| OPS-02 | Public/private file responses use correct cache, content type, and access controls | P |
| PHOTO-01 | Optional certificate photo upload/replace/delete authorization, deadline, format and 10 MB limit | P (file signature, ownership, approval, number and deadline covered before Drive) |
| AUDIT-01 | Admin edits create an immutable before/after history tied to actor and time | P |
| AUDIT-02 | Internal admin notes are private and attributed; edit/delete preserve before/after history and cannot be seen in public or applicant views | A |

## Current automation

Run the full Node suite with `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:db -- npm test`, the browser suite with `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres npm run test:e2e`, and the strict action inventory with `TRACEABILITY_REQUIRE_IMPLEMENTED=1 node --test test/feature-traceability.test.js`. Each database run creates and deletes its own local test database. The action-to-test mapping is maintained in [feature-traceability.md](feature-traceability.md); the `P` rows above are additional scenarios still useful for future expansion, not claims that an existing action lacks a test.

The acceptance tests cover native PostgreSQL date handling, atomic integration retry/audit writes, public rejected reasons, three-day single-use slip replacement links, name-based Heat-number ordering, admin rejection with reason email, private admin notes with immutable history, BBB placement eligibility, Final claim ownership and concurrency, catalog persistence, center validation, and workbook choices. Cases marked `P` remain candidates for deeper coverage.

The Google Workspace mock exercises OAuth state and required scopes, encrypted refresh-token storage, Drive folder creation and upload/download/delete requests, Gmail MIME generation and header validation, and Sheets append/update of one mapped row. A mocked Sheets 503 leaves the web edit committed; a later sync updates the same row. No real Google account or service was contacted.
