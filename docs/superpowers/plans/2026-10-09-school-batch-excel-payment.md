# School Batch Excel and Combined Payment Implementation Plan

> **For agentic workers:** Implement this plan after the exam-center catalog plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let school coordinators enter applicants manually or import an Excel workbook, then submit all applicants under one combined bill and one shared payment slip.

**Architecture:** Keep one application record per student and add a `SchoolBatch` record that owns the invoice total and slip. Use a normalized workbook with Applicants, Exam Selections, Past Papers, and Batch Info sheets so multiple selections fit without fixed-width competition columns. Parse and preview locally before creating records.

**Tech Stack:** React 19, Vite 8, JavaScript, SheetJS `xlsx`, existing CSS.

**Spec:** `docs/superpowers/specs/2026-10-09-ocec-batch-centers-certificate-design.md`

## Global Constraints

- This remains a UI prototype and uses mock data and browser-local state only.
- It does not connect to a database, payment provider, or file-storage service.
- Both manual entry and Excel import use one combined invoice and one shared required slip.
- Administrators review and approve each student's application individually.
- The Excel template includes all per-student web-form fields and the form's batch-level consent.

---

### Task 1: Create the school workbook template and parser

**Files:**
- Create: `src/schoolBatchWorkbook.js`
- Use: `src/excel.js` (`readWorkbook`, `downloadWorkbook`)
- Modify: `src/App.jsx` (`SchoolBatchForm`)
- Modify: `src/styles.css`
- Modify: `src/design-refresh.css`

**Interfaces:**
- `createSchoolTemplateSheets()` returns named row matrices for `Applicants`, `Exam Selections`, `Past Papers`, and `Batch Info`.
- `parseSchoolWorkbook(workbook, catalogs)` returns `{ applicants, consent, issues }`, where issues identify sheet, row, field, and message.
- `createSchoolApplicantFromRows(applicantRow, selections, pastPapers)` returns the exact applicant shape consumed by `SchoolBatchForm`.

- [ ] Implement template sheets with columns for row ID, English and Thai names, gender, birth date, school and certificate-school name, email, phone, address lines, district/city, province, postal code, exam format, center code, and batch consent; add linked selection sheets for competition/grade and optional past-paper IDs.
- [ ] Implement workbook parsing for these named sheets and resolve all lookup values against active exam, grade, center, and past-paper catalogs.
- [ ] Emit row-specific issues for required blanks, invalid email/phone, unknown applicant row IDs, invalid grades, inactive or unavailable centers, duplicate applicant row IDs, and missing competition selections.
- [ ] Add a “ดาวน์โหลดเทมเพลต Excel” action and an `.xlsx` file picker to `SchoolBatchForm`; selecting a file parses to a staged preview without overwriting the current batch.
- [ ] Show a replace/re-import action, an issue count, and a mobile-friendly applicant preview; only an issue-free staged workbook can replace the batch form state.

**Manual verification:** Download the template, populate at least two applicants with more than one exam selection, import it, and confirm all web-form fields and selections are prefilled. Introduce a missing name, unknown center, and invalid grade; verify each issue cites its sheet and row and leaves current batch entries unchanged.

### Task 2: Unify manual and Excel batch submission under one invoice and slip

**Files:**
- Modify: `src/App.jsx` (`SchoolBatchForm`, `ApplicationFormPage`, `submitApplication`, `AdminReviewPage`, root app state)
- Modify: `src/styles.css`
- Modify: `src/design-refresh.css`

**Interfaces:**
- `SchoolBatch` has `{ id, applicationIds, source, invoiceTotal, slipFileName, consent, submitted }`; the prototype retains the selected filename, consistent with the existing mock slip upload.
- School submission calls `onSubmit({ source: "school", batchId, batchApplications, schoolBatch })`.
- Every application keeps its own ID, status, result fields, and `batchId`.

- [ ] Add `schoolBatches` state and create one batch record when a school submits; create independent application records linked by `batchId` without copying separate slips or invoices into each student record.
- [ ] Replace the current per-applicant `fileName` controls in `SchoolBatchForm` with one required batch slip control; enforce the existing 10 MB limit and supported JPG/PNG/PDF types.
- [ ] Retain the per-student fee breakdown, calculate `invoiceTotal` as the sum of all exam and optional past-paper fees, and show a single batch total and single slip in the summary.
- [ ] Require the coordinator to confirm the full roster and combined total once; do not submit until all applicant forms validate and the single slip exists.
- [ ] Store one batch-level consent value and replace the current toast copy about separate per-applicant email/slip processing with confirmation of one grouped school submission.
- [ ] Pass batch records into `AdminReviewPage`; for each student review row, resolve the shared slip and batch invoice using `batchId`, while retaining per-student approve/reject actions.
- [ ] For Excel import, load staged rows into the same `batch.applicants` structure and use the same total, slip, confirmation, and submission functions as manual entry.
- [ ] Keep the form's active-student editor and switcher, and ensure 50–60 loaded applicants remain navigable without rendering 60 complete forms simultaneously.

**Manual verification:** Submit a 50–60-person manual batch with one slip; submit a separate workbook batch; confirm each produces one batch invoice/slip but individual application records. In admin review, approve one applicant and leave another pending; verify both link to the same batch slip and amount.
