# Admin application review sidebar design

## Intent

Make it faster for admins to reach applications from an individual or a school submission. Match the existing exam sidebar pattern: the icon opens the review page and the separate chevron expands source choices.

## Goals

- Add sidebar choices for applications submitted individually and through schools.
- Selecting a source opens the existing review page with that source applied immediately.
- Keep the existing application detail, approval, rejection, and edit flows.
- Keep search, status (pending, confirmed, all), exam type, and competition filters available on the review page.
- Preserve the selected source when returning from application editing.

## Non-goals

- No separate review pages or duplicate review logic.
- No changes to application data, review rules, or approval behavior.
- Keep the existing school-group view available for admins who use it.

## Approaches

1. **Reuse the current review page with a source preset (recommended).** The sidebar's individual/school options open the current review page with its source filter set. This reuses the existing list, filters, and details and keeps the change localized.
2. **Create separate pages for each source.** This duplicates the review workflow and would require keeping two filter/detail paths in sync, so it is not chosen.

## Interaction

- Clicking the “ตรวจใบสมัคร” icon opens the current review queue across all sources.
- Clicking its chevron expands/collapses two children: “สมัครด้วยตนเอง” and “ผ่านโรงเรียน”.
- Clicking either child opens the same review page and immediately filters to that source.
- The user can then search, filter by review status, exam type, and competition. The existing school-group view remains available.

## Constraints and implementation choice

- Follow the existing sidebar expand/collapse behavior, responsive states, and visual styles used by “รายการสอบ”.
- Pass the source selection through app navigation state rather than adding routes or changing the URL format.
- Preserve that source selection while the admin opens an application for editing and returns to the queue.
- Continue to treat pending payment records as awaiting review, as the current status filter does.

## Acceptance

- The sidebar icon opens the review page; its chevron only expands/collapses the two source choices.
- Each source choice shows only matching applications on arrival.
- Existing search, pending/confirmed/all status, exam type, competition, school-group, and application-detail interactions continue to work.
- On a narrow screen, both source choices remain reachable through the open sidebar.
