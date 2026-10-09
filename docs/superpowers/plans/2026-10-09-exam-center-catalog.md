# Exam Center Catalog Implementation Plan

> **For agentic workers:** Implement this plan task-by-task in this session. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manage one shared center catalog, select centers per exam card, enforce one common center per applicant, and export a count by center and grade after a card closes.

**Architecture:** Add small pure helpers for center lookup, filtering, and summary aggregation. Keep exam cards and applications in the existing React state in `src/App.jsx`; use stable center IDs and retain display snapshots on applications. Use one browser-side XLSX adapter for center import and summary downloads.

**Tech Stack:** React 19, Vite 8, JavaScript, SheetJS `xlsx`, existing CSS.

**Spec:** `docs/superpowers/specs/2026-10-09-ocec-batch-centers-certificate-design.md`

## Global Constraints

- This remains a UI prototype and uses mock data and browser-local state only.
- It does not connect to a database, payment provider, or file-storage service.
- Online Exam uses the shared `Online : Home Base` center (code `500`).
- The center catalog has no applicant-count column.
- Summary export counts every application assigned to the exam card, regardless of review status.

---

### Task 1: Add browser XLSX and center domain helpers

**Files:**
- Create: `src/excel.js`
- Create: `src/centers.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/App.jsx`

**Interfaces:**
- `readWorkbook(file)` returns a SheetJS workbook parsed from `await file.arrayBuffer()`.
- `downloadWorkbook(sheets, filename)` accepts `{ name, rows }[]`, writes each rows matrix to a named sheet, and downloads the `.xlsx` file.
- `parseCenterRows(rows)` returns `{ centers, issues }`; valid rows become `{ id, code, name, active: true }`, invalid rows include their Excel row number and reason.
- `getCommonCenters(competitionIds, examCatalog, centerCatalog)` returns active centers whose IDs appear on every selected exam card.
- `buildCenterSummaryRows(applications, exam)` returns center/code/name, grade, and count rows for one exam card without filtering by application status.

- [ ] Add `xlsx` as a production dependency and implement `readWorkbook` and `downloadWorkbook` in `src/excel.js`.
- [ ] Implement `parseCenterRows` using the supplied `Center` worksheet layout: column A is name and column B is code; flag blank values, duplicate codes, and code `000` with row-level messages instead of silently importing them.
- [ ] Implement center intersection by finding exam cards with the selected competition IDs and retaining centers allowed on every card; return an empty list when any selected card has no shared center.
- [ ] Implement `buildCenterSummaryRows` by selecting applications whose `examIds` or `competitions[].id` include the card’s competition ID, then grouping each by stored grade for that competition and center snapshot; include pending and confirmed records.
- [ ] Seed the shared catalog from valid rows in the supplied `Timo.xlsx` workbook, add the `Online : Home Base` row with code `500`, and map existing demo application center names to stable center IDs on initial state.
- [ ] Confirm the adapter API is used consistently by later plans: `readWorkbook(file)` and `downloadWorkbook(sheets, filename)`.

**Manual verification:** Import a workbook with valid entries, blanks, a duplicate code, and code `000`; confirm valid rows and each issue are reported by row. Confirm a summary helper includes every status and groups by the grade for the selected card.

### Task 2: Build the editable center catalog and per-card center settings

**Files:**
- Modify: `src/App.jsx` (`AdminRoundPage`, exam creation, exam-card details, center state)
- Modify: `src/styles.css`
- Modify: `src/design-refresh.css`

**Interfaces:**
- Exam cards store `centerIds: string[]`.
- Center deletion deactivates the center for future selection and removes it from card checklists while existing application snapshots remain intact.
- Center edits remain allowed while any card is open.

- [ ] Replace the `centerLocked` restriction in `AdminRoundPage` with a per-card checklist backed by `exam.centerIds`; default newly created cards to the currently active centers.
- [ ] Replace the filename-only center upload with XLSX import through `readWorkbook`, show an issue preview, require confirmation before replacing the active catalog, and preserve referenced center snapshots.
- [ ] Remove the applicant-count column and demo applicant counts from the center table; add edit, add, and deactivate/remove controls that remain enabled while registrations are open.
- [ ] Render the center checklist on both the add-exam form and each existing round card, with clear empty-state text when no center is enabled.
- [ ] Add accessible, responsive styling for a long center list and per-card checkboxes; keep controls usable on mobile.

**Manual verification:** Open a registration card and add, edit, and remove catalog entries; verify edits stay enabled. Enable different centers on two cards and verify their selections remain independent.

### Task 3: Use common centers in application forms and export closed-card summaries

**Files:**
- Modify: `src/App.jsx` (`ApplicationFormPage`, `SchoolBatchForm`, `submitApplication`, admin card actions)
- Modify: `src/centers.js`
- Modify: `src/styles.css`
- Modify: `src/design-refresh.css`

**Interfaces:**
- Paper-Based applicant state stores `centerId` and a display snapshot.
- Online applicant state stores center ID for code `500` and displays `Online : Home Base`.
- `buildCenterSummaryRows(applications, exam)` from Task 1 feeds each closed card’s export button.

- [ ] Derive individual and school applicant center options from selected competition cards via `getCommonCenters`; keep the form blocked until one valid common center is selected.
- [ ] Save center ID, code, and name on each new application. For Online Exam, choose the active code-500 center automatically without showing a physical-center selector.
- [ ] Keep existing display fields readable by using the stored name snapshot when a catalog center has since been renamed or removed.
- [ ] Add one “ดาวน์โหลดสรุปศูนย์สอบ” button to each closed exam card, hide or disable it while that card is open, and export center/grade/count/total rows as `.xlsx` via `downloadWorkbook`.
- [ ] Use a filename containing competition, round, and year, and include Online : Home Base as a normal summary group.

**Manual verification:** Select two competitions with intersecting and non-intersecting center sets in both forms; confirm only shared centers are offered and no-common-center submission is blocked. Close a card and download its report; confirm the report includes all application statuses and correct grade groupings.
