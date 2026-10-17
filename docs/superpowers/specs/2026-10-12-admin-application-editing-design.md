# OCEC Portal: administrator application editing

## Status

Design for review. No implementation changes for this feature have been made yet.

## Goals

- Let administrators correct applicant information at any time, regardless of application or exam status.
- Let administrators change an application's exam selections and per-exam details until the exam date. Lock selection membership and grade when the exam date arrives, but keep format changes available through that exam day for on-site requests; lock all exam details after the day ends.
- Preserve the applicant's existing self-edit rule: the applicant may edit profile information only after approval and within the configured edit window.
- When a numbered exam entry is replaced, cancel its old number permanently and assign the replacement the next number for its competition/round and center, using the existing numbering rules.
- Keep payment totals, audit history, result references, and Google Sheets consistent with edits.

## Chosen approach

Extend the existing administrator edit page with an admin-only API and a transaction that updates the applicant and exam entries together. Keep the applicant-facing profile APIs unchanged. Store canceled exam numbers as durable history so the existing maximum-suffix allocator can include them and never reuse a canceled number.

An exam entry's numbering scope is its round and center. If an already-numbered entry is removed or moved to another round/center, retain its old round, center, number, and cancellation metadata in history. If the edited application already had a generated Heat number, allocate the replacement Heat entry immediately at the end of the target center's existing sequence. Profile or grade corrections alone do not change an exam number. Final numbers are imported rather than generated; replaced Final entries retain their canceled number in history and the new entry waits for the normal Final-number import.

## Editing rules

- Administrators can edit the profile fields already shown in the admin form: English first/last name, school, contact email, phone, and address. These remain editable after an exam date or result publication.
- Administrators can add/remove exam selections and edit grade until the date of each selected round. The date is evaluated in `Asia/Bangkok`; selection membership and grade lock at the start of the exam date.
- Format remains editable through the exam date, then locks the next day. A format change updates its dependent venue: Online uses the Online center and requires an online exam email; Paper-Based requires an available physical center. If the effective center changes after a number was assigned, cancel the old number and assign the next number for the new center.
- A change cannot rewrite a published result. If a draft result-import row refers to a replaced entry, detach that reference and mark the row unmatched with a reason so it cannot publish against the replacement by mistake.
- Applicants continue using the existing self-edit endpoint, which requires an approved application and an open edit window. It does not permit exam-selection edits.
- For school batches, editing one applicant updates that application. A school-name correction keeps the batch's shared school name and its applicants consistent; any price increase updates the shared batch invoice.

## Pricing and payment

- Recalculate exam fees on the server from the catalog; do not trust browser-submitted prices.
- A price increase or newly added exam requires a new payment slip before saving the edit. Update the expected total and store the new slip as a new version of the existing payment evidence.
- A decrease is not refunded and is not applied as a discount to another selected exam. Persist the non-refundable difference separately so the invoice total does not silently fall.
- Admin approval remains slip-based; it does not require choosing an account or entering a confirmed amount or transfer time.

## Number history and downstream data

- Keep the current `application_items.exam_number` for the active entry and add an immutable history record for every canceled assignment.
- Update the number generator's counter from both active numbers and canceled-number history, under the existing allocation lock.
- Audit profile and exam changes as before/after values, including canceled and newly assigned numbers, actor, and timestamp.
- Queue Sheets synchronization after edits. When an item moves between rounds, remove/clear the old sheet row and write the current item to the new round's sheet.
- If a published result is already attached to an item, reject a change to that exam item while still permitting profile corrections.

## Scope boundaries

- Past-paper selections are not editable in this flow; the current admin editor does not expose them.
- Applicant self-edit behavior and permissions do not change.
- This does not create a payment account selector or manual amount/time verification fields in the review panel.

## Verification scenarios

- As admin, edit profile details on pending, approved, and post-exam applications; confirm changes persist and appear in the audit history.
- As applicant, confirm pending applications remain read-only and approved applications remain editable only within the configured window.
- Before the exam date, change a pending or approved application's BBB entry to HKIMO after a Heat number was generated. Confirm the BBB number is retained as canceled, the HKIMO number is the next suffix for its center/round, and a later generation does not reuse the canceled number.
- Confirm changing only the applicant name or grade does not change an assigned number.
- Confirm adding/removing exams and changing grade is blocked on the exam date; format changes remain possible on that date and are blocked the following day. Confirm profile fields remain editable throughout.
- Confirm an on-site-to-online format change on the exam date updates the venue, requires the online email, and cancels/reassigns the number if its center scope changed.
- Confirm a published result prevents changing its exam entry; a draft import reference becomes unmatched after a valid replacement.
- Confirm fee increases require a new slip and update individual or school-batch expected totals; decreases do not refund or discount another item.
- Confirm Sheets no longer shows the old exam row and contains the updated item in the correct sheet after its queued sync completes.
