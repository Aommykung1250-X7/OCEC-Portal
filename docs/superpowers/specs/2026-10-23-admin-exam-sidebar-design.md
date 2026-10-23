# Admin exam navigation — design

## Intent

Make admin exam rounds easier to find by putting competition names in the sidebar and showing each competition’s round cards grouped by year.

## Goals

- Keep the desktop admin sidebar collapsed until its header toggle is clicked; hovering or focusing does not expand it.
- Let the **รายการสอบ** icon open the exam management page and its separate expand button show or hide the competition list.
- Remove the section headings that currently divide admin sidebar items; keep the existing navigation items.
- Populate the competition list from the competition catalog so current names (HKIMO, HKISO, HKICO, TIMO, BBB) and future entries appear without hard-coded menu changes.
- On a selected competition page, show every configured round, including rounds closed to registration, grouped by year. Show HEAT, FINAL, and FINAL X side by side when present.
- Let admins add rounds from that page, preselecting the chosen competition, and open existing round cards to edit them.
- Keep existing round validation, save behavior, and admin permissions.

## Non-goals

- Changing exam-round data, registration status rules, APIs, database schema, or other admin workflows.
- Creating a separate implementation or route per competition.

## Approaches

1. **Reuse the existing exam management page and filter by competition (chosen).** Keep the existing round editing and creation logic, scope its cards to the selected competition, and use the catalog to build the sidebar list. This is the selected approach and supports future catalog entries with the least duplicated code.
2. **Create a dedicated page for each competition.** This separates each view but duplicates navigation and round-management behavior as the catalog grows.
3. **Keep round links inside the dropdown.** This avoids a page change but conflicts with the requested competition page, year rows, and add-round action.

## Proposed interaction

- The desktop sidebar remains collapsed on pointer hover and keyboard focus. A header toggle explicitly expands or collapses the full sidebar.
- The **รายการสอบ** icon navigates to the existing all-rounds view. Its adjacent expand button independently opens or closes the competition dropdown when the sidebar is expanded.
- The dropdown shows competition catalog entries by their short name when available, otherwise their name. Choosing one opens the existing exam page filtered to that competition.
- The page shows all configured years for the selected competition. Each year has its HEAT, FINAL, and FINAL X cards in columns where those rounds exist. Closed rounds remain visible with their current status.
- If no rounds exist, show an empty state and the same **เพิ่มรอบสอบ** action. The existing creation form opens with that competition selected.
- Selecting a round card opens its existing settings for editing.

## Constraints and verification

- Reuse the current React components, catalog data, and save flow; add no dependencies or database changes.
- Preserve responsive behavior and keyboard operation for the icon link, expand button, competition links, add action, and round cards.
- Verify the production build and inspect the changed diff. Do not add or run tests unless requested.

## Approval status

Approved by user on 2026-10-23; the explicit-click expansion behavior was clarified on the same date.
