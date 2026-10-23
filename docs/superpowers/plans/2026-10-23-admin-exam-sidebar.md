# Admin exam sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make admin exam navigation competition-based, with all configured rounds shown by year and addable from the selected competition page.

**Architecture:** Reuse the current `admin-round` route and `AdminRoundPage` CRUD. Pass the competition catalog and selected competition through the existing app shell/navigation state; filter and group the existing exam catalog for display.

**Tech Stack:** React, JSX, Tailwind utility classes, existing catalog and save callbacks.

**Spec:** [2026-10-23-admin-exam-sidebar-design.md](../specs/2026-10-23-admin-exam-sidebar-design.md)

## Global Constraints

- Reuse the current React components, catalog data, and save flow; add no dependencies or database changes.
- Preserve responsive behavior and keyboard operation for the icon link, expand button, competition links, add action, and round cards.
- Do not add or run tests unless requested.

## Review Focus

- A competition with no configured rounds still appears in the dropdown and can open the add-round form.
- A competition with only one or two round types shows only those cards, without empty columns.
- Closed rounds remain visible and retain their existing status and edit behavior.
- Adding a competition through the existing catalog makes it appear in the dropdown without a hard-coded menu update.
- Changing competition while round data is dirty must preserve the existing unsaved-change safeguard.

---

### Task 1: Competition sidebar and navigation state

**Files:**
- Modify: `src/features/admin/AdminShell.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- `AdminShell` and `Sidebar` receive `competitionCatalog` and `selectedAdminCompetitionId`.
- `navigate(nextPage, applicationId, competitionId)` records `competitionId` when `nextPage` is `admin-round`.

- [x] Flatten the admin navigation rendering so it no longer prints section headings, while preserving each current item and its icon/label.
- [x] Make the **รายการสอบ** icon link navigate to the all-rounds view; add a separate accessible expand button that toggles the competition submenu without navigating.
- [x] Keep the desktop sidebar collapsed on hover and focus; add an explicit header control to expand or collapse its width.
- [x] Build submenu entries from `competitionCatalog` in catalog order, showing `short || name`; selecting one navigates to `admin-round` with its competition ID.
- [x] In `navigate`, apply the dirty-catalog confirmation before leaving the page or switching the selected competition.
- [x] Pass catalog and selection through `App` to `AdminShell`; confirm new catalog entries are represented by the dynamic menu code.

### Task 2: Competition-scoped round cards and add flow

**Files:**
- Modify: `src/features/admin/AdminRoundPage.jsx`
- Modify: `src/App.jsx`

**Interfaces:**
- `AdminRoundPage` receives `selectedCompetitionId` and `competitionCatalog` in addition to its existing exam catalog and callbacks.

- [x] When a competition is selected, filter existing exam records to that competition and show every year, including rounds closed to registration.
- [x] Group selected-competition rounds by year in descending order; lay out existing HEAT, FINAL, and FINAL X cards in 1–3 responsive columns according to which rounds exist.
- [x] Show the selected competition in the page heading. With no configured rounds, show an empty state that keeps the add-round action available.
- [x] Change the selected page action to **เพิ่มรอบสอบ** and open the existing creation form with the selected competition preselected; retain current duplicate checks and save callbacks.
- [x] Keep clicking a round card opening the existing editable settings for that round.

### Task 3: Review and build check

**Files:**
- Review: `src/features/admin/AdminShell.jsx`, `src/features/admin/AdminRoundPage.jsx`, `src/App.jsx`

- [x] Check the five Review Focus conditions against the implementation and changed diff.
- [x] Run `npm run build`; expected result is exit code 0.
- [x] Run `git diff --check`; expected result is no whitespace errors.

## Execution Handoff

This plan has two implementation tasks with shared navigation state and one final review/build task. Native execution is recommended because the changes are small and the sidebar, app state, and page filter need to land together.
