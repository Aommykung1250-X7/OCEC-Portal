# Admin Application Review Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sidebar dropdown shortcuts that open the existing application review page filtered to individual or school submissions.

**Architecture:** Reuse the existing admin review page and its search, status, type, competition, and detail behavior. Carry the selected source in app navigation state, and keep it when returning from the application edit page. The sidebar follows the independent icon-navigation and chevron-expansion pattern used by “รายการสอบ”.

**Tech Stack:** React 19, JSX, Tailwind utility classes, existing route/navigation functions.

**Spec:** `docs/superpowers/specs/2026-10-24-admin-application-review-sidebar-design.md`

## Global Constraints

- “ตรวจใบสมัคร” icon opens the current review queue; its separate chevron toggles the source dropdown.
- “สมัครด้วยตนเอง” and “ผ่านโรงเรียน” open the same review page, filtered immediately.
- Keep search, pending/confirmed/all status, exam type, competition filters, school-group view, and application-detail interactions.
- Preserve source selection when returning from application editing.
- Do not change application data or review/approval rules.

## Review Focus

- Switching source while already on the review page must update the results and reset the school-group drilldown.
- Clicking the same school source from a school-group view must return to the direct filtered list.
- The parent icon must still navigate while the chevron only expands or collapses.
- Source-specific filters must not hide the review controls for search, status, type, or competition.
- Returning from application edit must retain the source chosen in the sidebar.

## Files

- Modify `src/features/admin/AdminShell.jsx` to add the review dropdown using the exam menu’s independent icon/chevron behavior.
- Modify `src/App.jsx` to carry review source selection through sidebar navigation and back from application editing.
- Modify `src/features/admin/AdminReviewPage.jsx` to apply the incoming source and keep existing review controls available.

### Task 1: Add source-aware review navigation

**Files:**
- Modify: `src/features/admin/AdminShell.jsx`
- Modify: `src/App.jsx`
- Modify: `src/features/admin/AdminReviewPage.jsx`

**Interfaces:**
- `Sidebar` passes source values `all`, `self`, and `school` to `navigate` for `admin-review`.
- `App` owns the selected source and a navigation revision so choosing a source while already on the review page remounts the queue in its default direct-list view.
- `AdminReviewPage` receives the selected source as a prop and applies it to its application filter.

- [x] **Step 1: Add the sidebar review menu.** Make the “ตรวจใบสมัคร” icon navigate to the all-source review queue and add a separate chevron that expands “สมัครด้วยตนเอง” and “ผ่านโรงเรียน”. Match the exam menu’s collapsed, expanded, mobile, tooltip, and focus behavior; expose the active source accessibly.
- [x] **Step 2: Carry source through navigation.** Add app-level review navigation state. Source children pass `self` or `school`; the parent icon and unrelated routes open `all`; returning from `admin-application-edit` preserves the previous source. Increment the navigation revision on each source selection so choosing the current source again resets the queue drilldown.
- [x] **Step 3: Apply the source in the review page.** Accept the source prop, filter the direct application list, and remove the in-page source selector because the sidebar now owns that choice. Keep search, status, type, competition, school-group, and detail flows intact; the school-group view remains school-scoped.
- [x] **Step 4: Review the diff and run the production build.** Confirm only the three listed source files changed for product behavior and that `npm run build` completes. Do not add or run automated tests for this task.

**Verification:** Production build succeeds; inspect the source changes for all five review-focus cases above.
