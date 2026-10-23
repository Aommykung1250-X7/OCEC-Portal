# Paper Based center poster — design

## Intent

Applicants need to see the attached nationwide Paper Based center poster while choosing an exam center. Admins need to replace that poster without changing application data or source code.

## Goals

- Show one shared poster when an applicant chooses Paper-Based, before the center selector.
- Support individual and school application forms, including Final applications.
- Keep the poster readable on phones with a compact preview and an accessible full-size viewer.
- Let admins preview, replace, and restore the attached default image from **Form options → Centers**.
- Preserve existing center choices and application snapshots.

## Non-goals

- Separate posters or photos for each center.
- Changing center names, availability, exam rules, or the applicant's selected center.
- Uploading applicant-provided images.

## Approaches

1. **One shared poster with a database-backed override (chosen).** Keep the attached image as the static default. Store admin replacements as image bytes in a dedicated table and serve them from a small public image endpoint. The form loads the image only when needed; a version token refreshes browser cache after replacement. This fits the nationwide poster and avoids placing a large image in every catalog response.
2. **Put a base64 image in the catalog response.** This reuses the existing catalog save path, but sends the full image with each catalog load and mixes media data with center settings.
3. **Upload a different image for each center.** This gives center-specific guidance, but the supplied image is one combined national guide and admins would have to maintain many files.

## Proposed interaction

- In the individual and school forms, show one shared poster card when at least one selected exam uses Paper-Based. Place it above the center selector(s), show a responsive preview, and provide a keyboard-accessible full-size viewer.
- In the admin's existing center settings panel, show the current poster, an upload/replace control, and a restore-default action. Accept PNG, JPEG, and WebP up to 5 MB; validate the data and type on the server.
- Keep the current attached image as the default when no custom poster is saved.
- Leave normal center and exam catalog saves independent from poster upload.

## Constraints and verification

- Use existing React, Fastify, PostgreSQL, and admin authentication patterns; no external storage account or new dependency.
- Add a migration for the single replaceable poster asset and protect write/delete endpoints with admin authentication.
- Verify public serving, admin-only replacement/reset, invalid and oversized upload rejection, conditional form display, and responsive viewer behavior.

## Approval status

The user approved one shared poster for all centers and approved this design for implementation on 2026-10-23.
