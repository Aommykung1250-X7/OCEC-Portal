# Registration photos, Final packages and ceremony guests

## Intent and confirmed requirements

Keep HEAT's existing post-close photo flow, and move FINAL and BBB FINAL_X photo/shirt collection into the registration form as requested on 2026-11-04. New Final submissions require their photo and shirt sizes before submission succeeds. Final prices come from the selected package, not the old format-based price fields.

The user confirmed:

- HEAT photo upload retains its original gates: approved application, registration closed and all exam numbers assigned. Its filename retains the exam number.
- FINAL/FINAL_X photo filenames contain only the applicant's English first/last name and extension, with no exam number or application identifier.
- FINAL/FINAL_X pricing and admin price controls are package-based. Existing `paper`/`online` fields describe delivery/center/email requirements only and are not a price source for new Final submissions.
- Shirt sizes remain SS, S, M, L, XL, 2XL, 3XL, 4XL, 5XL.
- Packages and Guest bookings are selected independently for each competition item in an application.
- Guest is an optional ceremony attendee add-on, distinct from the existing guest-account application mode.
- Each Guest costs 4,500 baht initially; allow 0–4 Guests per competition item.
- Each Guest must have an English first name, English last name and shirt size.
- Guest is available only with **Onsite + เข้าร่วมรับรางวัล**.
- BBB Final X follows the same mandatory photo/shirt flow and package choices as HKIMO/HKISO/HKICO/BBB Final.
- Prices must remain configurable for each exam round/year, preserving the amount charged on previously submitted applications.

## Package matrix

| Competition and round | Package | Initial applicant price | Guest available |
| --- | --- | ---: | --- |
| TIMO FINAL | Onsite | 4,500 baht | No |
| TIMO FINAL | Onsite + เข้าร่วมรับรางวัล | 7,900 baht | Yes |
| HKIMO / HKISO / HKICO / BBB FINAL | Onsite + เข้าร่วมรับรางวัล | 7,900 baht | Yes |
| HKIMO / HKISO / HKICO / BBB FINAL | Online | 4,500 baht | No |
| BBB FINAL_X | Onsite + เข้าร่วมรับรางวัล | 7,900 baht | Yes |
| BBB FINAL_X | Online | 4,500 baht | No |

For example, TIMO ceremony + two Guests costs 7,900 + 2 × 4,500 = 16,900 baht, before any existing past-paper purchases. Two competitions calculate their packages and Guest totals independently.

## Approach

Use package definitions owned by the existing exam round, with each application's item storing its selected package, shirt size, price snapshot and Guest records. This extends the existing annual catalog and fee-snapshot model. A package determines its delivery format for center/email validation; only the package definition supplies the Final price.

An alternative is to represent ceremony attendance as a separate surcharge on the current two exam formats. That makes the same ceremony package behave differently for TIMO and the other competitions, allows invalid combinations unless special rules are scattered through the system, and hides the package price from admins. A single global package price would also break per-year pricing. Round-owned packages are the proposed implementation choice; this is an engineering decision, not a separately confirmed user requirement.

## Applicant flow

### HEAT

1. The registration form and payment process retain their current behavior; photo is optional and is not a condition of submitting the application.
2. Retain the current approval, registration-close and complete-exam-number gates on the application detail page and upload/remove endpoints.
3. Name each uploaded photo using that item's exam number plus the applicant's English name, as before. Do not allow pending/slip-issue HEAT applications or applications without assigned numbers to upload early.
4. Cover both individual applications and applications managed by a school coordinator, using the existing ownership/applicant-email/admin rules.
5. HEAT never displays shirt-size or package/Guest controls.

### FINAL and BBB FINAL_X

1. Retain the existing eligibility/verification flow and exact eligible round selection.
2. Each competition card replaces the generic format-only picker with its allowed package choices and prices. The selected package is the only source of Final pricing. Its delivery mode populates the existing format field: onsite packages use `paper`, Online uses `online`; there is no separate format-price picker for Final.
3. As amended by the user on 2026-11-12, Final/Final X Onsite has no center selector or domestic center-map image. Keep the existing package labels, including “Onsite”. The server assigns the internal Onsite destination automatically. Online still requires an exam email and center 500. TIMO FINAL rejects Online at both the UI and API boundaries.
4. Require one applicant photo for the application and one applicant shirt size for each competition item. Reuse the one applicant photo for each selected item, matching current certificate-photo behavior; do not infer or copy a photo from the prior-round application without the applicant choosing it in this form.
5. Show the existing optional size-chart/sample-shirt images beside the shirt controls. Their absence never blocks registration. The shared image settings apply to both FINAL and BBB FINAL_X.
6. For ceremony packages, offer 0–4 Guests, each with required English first/last name and shirt size. Zero Guests is valid. Guest names are not exam applicants and never receive exam numbers or invitations.
7. Switching away from a ceremony package removes Guests from the submitted payload and total. Retaining an unsent local draft of those rows is left to the builder; it must never accidentally submit or charge hidden rows.
8. Display applicant package fees, Guest charges, existing past-paper charges and the grand total before payment. Package labels and paid amounts appear in the confirmation/detail and admin review, with the Guest roster grouped under its competition.
9. A missing/invalid photo, missing shirt size, invalid package, incomplete Guest, more than four Guests, or Guests attached to another package prevents submission. Server validation independently enforces every rule.

## Post-submission behavior: proposed defaults

These decisions fill gaps in the request and are proposed for review:

- Preserve the ability to replace a Final applicant photo and change Final shirt sizes after submission. Open these Final controls from submission for pending, slip-issue and approved applications; rejected and unsubmitted drafts cannot use the post-submission endpoints. HEAT continues to use its original approval/close-date/exam-number gates.
- FINAL/FINAL_X photo replacement is allowed, but deleting the required photo without replacing it is not allowed. HEAT retains optional photo removal.
- Applicant self-service changes to packages or Guest bookings after submission are excluded from this change because they change the amount due; users contact admins. Existing admin editing/payment-adjustment behavior must be updated to understand package and Guest amounts instead of reverting to format-only fees.
- Existing submitted applications keep their current status and prices even if they lack the newly required photo, size or package fields. Mandatory form validation applies to new submissions; old records show their existing data or a clear missing/legacy label. No automatic reclassification of old onsite applications as ceremony participants or Guest purchases.

## Admin catalog and review

- Add package-price settings and the per-Guest price to the existing round/year editor. Both TIMO onsite prices need independent inputs; the other Final rounds need ceremony and Online prices.
- The selectable package types follow the matrix. Prices are editable; this request does not add an arbitrary package builder.
- For rounds without package configuration, initialize the applicable preset using the user's latest prices. New rounds get the same editable defaults. Existing saved package prices must not be reset on load or catalog save.
- Existing HEAT format-price controls retain their meaning. Final/Final X round editors show package prices and Guest price instead of the old Paper-Based/Online price inputs. All new Final pricing callers, summaries and admin application edits resolve the selected package; old format prices are consulted only to read existing legacy records, never as a fallback for a new Final submission.
- The admin application detail lists package, applicant shirt size, Guest names/sizes, Guest count/unit price/subtotal and total due, with access through the existing admin permissions.
- Keep the optional admin chart/sample upload settings and image validation. Update copy to include Final X.
- Registration/review emails include the package and Guest charge summary alongside the existing payment information. Guest rosters remain available in the authenticated portal; do not expose them through public name-search results.

## Persistence and interfaces

- Add round-owned package definitions with stable codes (`onsite`, `onsite_ceremony`, `online`), format, current price and display label. Store the Guest unit price per round alongside package configuration. Do not trust submitted labels, prices, totals or attendee counts supplied separately from the attendee array.
- Add a nullable package reference/code and immutable-at-submission package label/base-price and Guest unit-price snapshots to application items. Keep the existing per-item shirt size and certificate-photo associations.
- Store Guest first name, last name and shirt size against the owning application item, with stable ordering and a maximum of four. Guest amounts are computed from the validated roster length.
- Maintain the existing fee field as the total charge for the item (package base plus Guests) so existing application/payment totals and financial integrations remain consistent. Expose explicit component amounts in API responses and review/email summaries to avoid double-counting.
- Extend the authenticated Final submission contract with the required photo plus item package code, shirt size and Guests. Draft endpoints must not bypass required Final fields at final submission. Extend catalog/read mappings and admin-edit contracts as needed.
- Preserve existing invitation ownership, published-result eligibility, duplicate checks, verified school grants, round/year consistency, center rules, payment validation and audit records.

## Upload and transaction constraints

- Accept the existing photo formats JPG/PNG/WebP up to 10 MiB, with the same or stronger content validation as the current photo endpoint. Validate required inputs before claiming eligibility or creating external files.
- A submission can contain both a 10 MiB payment slip and a 10 MiB applicant photo. Increase only the relevant authenticated individual-submission route's bounded request size (32 MiB is sufficient for both base64 payloads plus the bounded form), or use an equally bounded staged upload if the implementation proves that necessary. Do not silently reduce either advertised file limit.
- Keep Drive organization by academic year/competition/round. HEAT keeps its exam-number-plus-name filename. FINAL/FINAL_X always use only the sanitized English first/last name plus the image extension, e.g. `Anna_Smith.jpg`, including replacements made after exam numbers are assigned. Do not append an exam number, timestamp, counter or application identifier. Resolve identity and same-name uploads using Drive file IDs/application-item associations and metadata, rather than changing the display filename. Public display URLs remain permission-checked application-item photo URLs.
- Treat application/item/Guest rows, prices, payment/slip, required photo associations and invitation claims as one successful submission. If a Drive upload or database step fails, clean up files created by that attempt, roll back the application and preserve eligibility for retry. Do not delete existing files on a failed replacement.
- The required photo must exist durably when Final submission reports success; do not enqueue an upload that can later leave a successful application without a photo.

## Compatibility and scope

- Use the current React/Fastify/PostgreSQL/Drive stack and existing components and validation patterns; no new service or dependency is required.
- Preserve pre-existing unrelated workspace changes, including the in-progress Sheets layout work.
- Existing Sheets financial values must reflect the complete item charge including Guests. This feature does not introduce a separate ceremony-booking service, Guest accounts, Guest exam eligibility, a new public roster, or a new configurable Sheets layout.
- Historical fee snapshots remain readable and unchanged; new package references must be nullable for legacy records.
- Additive schema migrations are applied before the updated API starts. Migration/testing does not authorize production deployment or real outgoing test email.

## Verification criteria

1. HEAT self and school-owned applications retain approval, registration-close and complete-exam-number gates. Before-close, pending/slip-issue and missing-number requests are rejected; permitted uploads retain the exam number in the filename. Unrelated accounts cannot upload/read/delete photos for either round type.
2. Every new FINAL and BBB FINAL_X submission requires its photo and all applicant shirt sizes; all missing-input paths fail before side effects.
3. TIMO has exactly its two onsite packages; the four other FINAL competitions and BBB FINAL_X have ceremony + Online. The backend rejects disallowed combinations, including a forged package from another round. Changing a legacy format-price field cannot change a new Final package charge; Final admin controls use package prices only.
4. For each competition, 0–4 complete Guests are accepted only for ceremony. Five Guests, missing names/sizes, invalid sizes, malformed objects and Guests on onsite-only/Online are rejected atomically.
5. Multi-competition registration independently calculates package and Guest amounts; changing a package never charges hidden Guests. Verify the 16,900-baht example and a multi-item example.
6. Price changes affect future submissions only; old item/payment snapshots remain unchanged. Admin edits use the existing payment adjustment/non-refund rules for package and Guest fee differences.
7. Required photos and payment slips near their advertised limits can be submitted together; oversized requests/files fail with a readable error. Simulated Drive failure preserves invitations and cleans up new files.
8. Existing eligibility, school verification, duplicate prevention, admin review, payment/slip replacement and prior-round/Final X progression tests remain effective.
9. Browser checks cover form required states, totals, optional images, Guest rows and removal, HEAT upload gates, successful reloads and errors at 320, 768, 1024 and 1440 px. Review screenshots after fonts load and confirm keyboard-accessible labels/dialogs.
10. Final and Final X filenames contain only the English name and extension, before and after exam-number allocation; same-name applicants remain associated with their own file IDs and cannot overwrite or read one another's photo.

## Approval status

The user reviewed the design in chat and requested three amendments on 2026-11-04: restore the original HEAT upload gates, use package prices rather than format prices for Final, and use name-only Final photo filenames. Those amendments are incorporated above. The explicitly marked defaults remain the proposed behavior from that review.

An independent builder check on 2026-11-04 returned “nothing important left” before these amendments; the amended flows, filename policy and corresponding verification criteria were then checked against the user's corrections.
