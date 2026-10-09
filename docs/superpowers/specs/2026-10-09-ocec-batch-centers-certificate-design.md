# OCEC Portal: school batches, exam centers, and certificate photos

## Status

Design for review. This change remains a UI prototype and uses mock data and browser-local state only. It does not connect to a database, payment provider, or file-storage service.

## Goals

- Import and manage one shared exam-center catalog, then choose available centers separately on each exam card.
- Let a school submit many applicants from either a web form or an Excel workbook while paying with one combined bill and uploading one shared payment slip.
- Let administrators download a center and grade count for an exam card after registration closes.
- Let an approved applicant optionally upload a portrait for later use on an award certificate.

## Chosen approach

Keep one application record per applicant and introduce a school-batch record that owns the combined invoice and slip. This preserves individual review, approval, exam IDs, and results while grouping payment. A single merged roster record would make those later individual actions harder; separate per-person bills and slips would contradict the requested school workflow.

Keep centers in one shared catalog with stable IDs, codes, names, and active state. Exam cards store the IDs they allow. Duplicating center records on every card would make name and code corrections inconsistent. Online Exam uses the shared `Online : Home Base` center (code `500`).

## Center catalog and exam cards

- Import the `Center` worksheet from the provided center workbook. Column A supplies the center name and column B supplies its code. Preview the rows and clearly flag incomplete or invalid entries, including the placeholder row with code `000`; require correction or explicit exclusion before applying the import.
- The catalog UI supports adding, editing, and removing centers while exam cards are open. It has no applicant-count column. Removing a center makes it unavailable for future selection but preserves the name/code snapshot on existing applications.
- Each exam card has its own center checklist. An applicant selecting several competitions chooses one center that is available on every selected card; the form shows the shared choices and explains when no center is common to all selections.
- Applications store the stable center ID plus a display snapshot. Online applications resolve to center code `500` automatically.
- Once an exam card is closed, show a download action on that card. The Excel summary counts every application assigned to that card, regardless of review status, grouped by center and grade, with a total. A participant registered for multiple competitions appears in each relevant card's own summary.

## School applications and combined payment

- Both manual entry and Excel import create one application per student and one shared school-batch record. The batch owns the total invoice, payment slip, submission source, and linked application IDs. Administrators continue reviewing and approving each student individually.
- The manual form keeps its per-student fields and selections, but replaces per-student slips with one combined amount and one required batch slip. The confirmation summarizes the whole batch; it does not create separate payment requests for each applicant.
- Provide an Excel template with an Applicants sheet containing an applicant row ID and every per-student field in the web form (English/Thai names, gender, birth date, school and certificate school name, email, phone, address, format, and center); an Exam Selections sheet links each applicant row ID to one or more competition IDs and grades; an optional Past Papers sheet links purchased papers; a Batch Info sheet carries the form's batch-level consent. This normalized layout supports multiple competitions per student without an ever-widening set of columns.
- Import parses the workbook locally and presents a preview before submission. It reports row-specific missing fields, invalid grades, unknown centers, duplicate applicant rows, and invalid competition selections. The user can replace the chosen workbook and re-import before submitting. No applications are created until the whole batch passes required validation and the coordinator confirms the combined total and one slip.
- The batch total is the sum of each student's exam fees and optional past papers. The prototype presents one invoice total and one slip for that amount.

## Certificate photo upload

- After an administrator changes an application to approved, show an optional certificate-photo section on that application detail. Pending applications do not show the upload control.
- Store one portrait per application, with preview, replace, and remove actions. Accept JPG, PNG, or WebP up to 10 MB. Explain that OCEC may use the photo on the applicant's award certificate; uploading is optional and does not change eligibility or results.
- For school batches, both the school coordinator and the individual applicant can access the same approved application and upload its photo. The photo belongs to the application, so replacing it from either account updates the same preview. For individual applications, the applicant uploads on their own application.
- The photo is local mock state and is not persisted to a real storage service. The prototype does not generate certificates.

## Data shape

- `Center`: stable `id`, `code`, `name`, `active`.
- Exam card: `centerIds` for the centers available on that card.
- Application: `centerId` and display snapshot; for school submissions, `batchId`; optional `certificatePhoto` metadata/data URL after approval.
- `SchoolBatch`: `id`, `applicationIds`, `source` (`manual` or `excel`), `invoiceTotal`, `slipFileName`, and confirmation state.

## Error handling and interaction

- Keep invalid workbook rows visible in a preview with a specific reason and allow replacing the workbook. Do not silently discard invalid applicant or center rows.
- If a selected center is removed from the active catalog after registration, preserve its application snapshot and include it in exports.
- If no shared center is available for an applicant's selected competitions, block submission and show which selection prevents a valid common center.
- On mobile, keep the Excel preview and per-student form navigable without requiring a wide table; use stacked row cards or a contained horizontal scroll area for the preview.

## Verification scenarios

- Import a valid center file, reject or exclude the incomplete center row with a visible explanation, then assign centers to different exam cards while a card is open.
- Confirm an applicant sees only centers shared by all selected competitions, while Online Exam resolves to code `500`.
- Submit 50–60 manual applicants with one combined amount and one slip; confirm each application remains independently reviewable.
- Download the workbook template, fill and import multiple applicants with multiple competition selections, fix a row error, replace the file, and submit one batch invoice.
- Close an exam card and verify its summary includes all application statuses grouped by center and grade; verify no download action appears while it is open.
- Confirm a pending applicant has no photo uploader; after approval, verify both the school coordinator and applicant can view and update the same photo on a school-submitted application, and upload, replace, and remove a photo on an individual application.

## Scope boundaries

- No real payment processing, persistent database, cloud upload, certificate generation, or email delivery is added.
- Payment and center summary are mock UI workflows. Excel import/export operates in the browser against the provided workbook/template structure.
