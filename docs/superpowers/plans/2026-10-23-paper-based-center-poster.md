# Paper Based center poster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the approved nationwide Paper-Based exam-center poster to applicants and let admins replace or restore it from Form options → Centers.

**Architecture:** Keep the supplied poster as a static public default and store one optional replacement image in PostgreSQL. A small `centerPosterVersion` value in the catalog identifies the current image without adding image bytes to catalog responses; dedicated public and admin endpoints serve, replace, and reset the image. A reusable applicant component displays the poster once when Paper-Based is selected, and a focused admin component manages its upload.

**Tech Stack:** React 19, Fastify 5, PostgreSQL, Vite, Playwright, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-23-paper-based-center-poster-design.md`

## Global Constraints

- Use existing React, Fastify, PostgreSQL, and admin authentication patterns; no external storage account or new dependency.
- Use one shared poster for all centers, show it for individual and school forms including Final applications, and keep the existing center choices and application snapshots unchanged.
- Keep the poster readable on phones with a compact preview and an accessible full-size viewer.
- In Form options → Centers, let admins preview, replace, and restore the attached default image.
- Accept PNG, JPEG, and WebP up to 5 MB; validate image type and data on the server.
- Keep poster writes independent from normal center and exam catalog saves; serve image bytes outside the catalog response.

## Review Focus

- No custom image has been saved: applicants and admins must see the attached default poster. Pin in Task 1 route test and Task 2 form test.
- A malformed signature, unsupported MIME type, or file above 5 MB is uploaded: reject it without replacing the saved poster. Pin MIME/signature/size cases in Task 1 tests.
- A non-admin tries to replace or reset the image: reject the request; public image reads remain available. Pin both write paths in Task 1 route tests.
- Admin changes the poster while staying on the page, then opens an application form in the same SPA: the new version must display without a stale browser cache. Pin save/reset version updates in Task 3 E2E coverage.
- Applicant has several Paper-Based competitions or uses the school form: show one poster for the active selection, and hide it when no Paper-Based exam remains selected. Pin individual and school behavior in Task 2 E2E coverage.

## File Responsibilities

- `public/paper-based-centers-poster.png`: static default copied from the supplied attachment.
- `server/migrations/017_paper_based_center_poster.sql`: singleton replacement row, MIME type, image bytes, version timestamp, and admin attribution.
- `server/centerPoster.js`: image validation and persistence functions, with no HTTP or UI responsibilities.
- `server/index.js`: public read endpoint plus admin-only replacement/reset endpoints.
- `server/catalog.js`: expose the small nullable `centerPosterVersion` metadata field only.
- `src/features/applications/CenterPosterPreview.jsx`: reusable responsive preview and accessible full-size viewer.
- `src/features/admin/CenterPosterSettings.jsx`: file validation, preview, upload/reset controls, and save feedback.
- `src/App.jsx`, `src/features/applications/ApplicationFormPage.jsx`, `src/features/applications/SchoolBatchForm.jsx`, `src/features/admin/AdminRoundPage.jsx`, `src/features/admin/CatalogOptions.jsx`, and `src/features/admin/CatalogResources.jsx`: carry the version and place the reusable controls in the existing screens.
- `test/center-poster.test.js`: focused server-side validation tests.
- `test/e2e/center-poster.spec.js`: browser coverage for API permissions, applicant display, and admin workflow.

---

### Task 1: Persist and serve the poster safely

**Files:**
- Create: `public/paper-based-centers-poster.png` from `/var/folders/jd/kbknlt054kv84xmm696yy6nr0000gn/T/TemporaryItems/NSIRD_screencaptureui_7KgWaZ/ภาพถ่ายหน้าจอ 2569-10-23 เวลา 12.10.02.png`
- Create: `server/migrations/017_paper_based_center_poster.sql`
- Create: `server/centerPoster.js`
- Modify: `server/index.js`
- Modify: `server/catalog.js`
- Test: `test/center-poster.test.js`
- Test: `test/e2e/center-poster.spec.js`

**Interfaces:**
- `getCenterPosterOverride() -> Promise<{ content: Buffer, mimeType: string, version: string } | null>` returns only the saved override.
- `saveCenterPoster({ mimeType: string, dataBase64: string }, actorId: string) -> Promise<{ version: string }>` validates and upserts the singleton row.
- `resetCenterPoster(actorId: string) -> Promise<void>` removes the override and records the admin action in the row's audit fields/log.
- `GET /api/center-poster` serves saved bytes, or the static default when no override exists; respond with `Content-Type`, `ETag`, `Cache-Control: public, max-age=0, must-revalidate`, and `X-Content-Type-Options: nosniff`.
- `PUT /api/admin/center-poster` accepts `{ mimeType, dataBase64 }`, requires `requireAdmin`, and returns `{ version }`.
- `DELETE /api/admin/center-poster` requires `requireAdmin` and returns `{ version: null }`.
- `/api/catalog` adds `centerPosterVersion: string | null`; it never returns image bytes.

- [x] **Step 1: Write failing image-validation tests** for PNG/JPEG/WebP signatures, unsupported type, MIME/signature mismatch, invalid base64, empty content, and content over 5 MiB. Export a pure `decodeCenterPosterUpload({ mimeType, dataBase64 }) -> Buffer` from `server/centerPoster.js` for these tests.
- [x] **Step 2: Run `node --test test/center-poster.test.js` and verify the new tests fail** because the validation helper is not implemented.
- [x] **Step 3: Create the migration and backend service.** Use one row keyed by `id=1`, `bytea` content, allowlisted MIME type, `updated_at timestamptz`, and `updated_by` referencing `users(id)`. Reject decoded content above `5 * 1024 * 1024` bytes and check the matching magic bytes for PNG, JPEG, and WebP. Reset deletes the override; admin attribution is captured in `audit_logs` for both replace and reset.
- [x] **Step 4: Add the routes and catalog metadata.** Public GET returns override bytes or reads the static default file; derive a stable ETag from stored version/content and honor `If-None-Match`. Admin PUT/DELETE use `requireAdmin`. Add `centerPosterVersion` to `loadCatalog()` from `updated_at` and keep all existing catalog fields intact.
- [x] **Step 5: Add route tests.** In `test/e2e/center-poster.spec.js`, verify public default response, anonymous and signed-in non-admin write denial, admin replacement response and bytes, catalog version update, and reset returning the image to default. Upload `public/paper-based-centers-poster.png` as the valid fixture.
- [x] **Step 6: Run the focused checks.** `node --test test/center-poster.test.js`, `npm run test:e2e -- test/e2e/center-poster.spec.js`, and `npm run build` must pass.

### Task 2: Display the poster in individual and school forms

**Files:**
- Create: `src/features/applications/CenterPosterPreview.jsx`
- Modify: `src/App.jsx`
- Modify: `src/features/applications/ApplicationFormPage.jsx`
- Modify: `src/features/applications/SchoolBatchForm.jsx`
- Test: `test/e2e/center-poster.spec.js`

**Interfaces:**
- `CenterPosterPreview({ version: string | null, backendEnabled: boolean })` renders the image URL `/api/center-poster?v=<version>` when an override exists, otherwise the static default URL; when backend is disabled it always uses the static URL.
- `ApplicationFormPage` and `SchoolBatchForm` consume `centerPosterVersion: string | null` and `backendEnabled: boolean` from `App.jsx`.

- [x] **Step 1: Add failing browser assertions** that the default poster is absent before Paper-Based selection, appears once above the center selector after selection, opens a named full-size dialog from its accessible control, closes with Escape, and disappears when all selected formats switch to Online.
- [x] **Step 2: Add school-form assertions** that the poster appears once for the active applicant with a Paper-Based selection and not for an applicant whose selected formats are all Online.
- [x] **Step 3: Run `npm run test:e2e -- test/e2e/center-poster.spec.js` and verify the display assertions fail** before implementing the component.
- [x] **Step 4: Implement `CenterPosterPreview`** with a responsive image constrained to container width, meaningful Thai alt text, lazy loading, an explicit “ดูโปสเตอร์ขนาดใหญ่” button, and a native modal `<dialog>` with close button and keyboard Escape behavior.
- [x] **Step 5: Wire `centerPosterVersion` from catalog state in `App.jsx`; render the component once per form when any selected competition uses Paper-Based.** In the school batch form, base visibility on the active applicant's selected formats. Place the component before the center selectors, not inside each competition card.
- [x] **Step 6: Run `npm run test:e2e -- test/e2e/center-poster.spec.js` and `npm run build`; verify the image remains one instance when multiple Paper-Based competitions are selected.**

### Task 3: Add admin replace and restore controls

**Files:**
- Create: `src/features/admin/CenterPosterSettings.jsx`
- Modify: `src/App.jsx`
- Modify: `src/features/admin/AdminRoundPage.jsx`
- Modify: `src/features/admin/CatalogOptions.jsx`
- Modify: `src/features/admin/CatalogResources.jsx`
- Test: `test/e2e/center-poster.spec.js`

**Interfaces:**
- `CenterPosterSettings({ version: string | null, onVersionChange: (version: string | null) => void })` previews the current poster and calls the dedicated admin endpoints; it does not mutate `centerCatalog` or trigger the catalog autosave.
- `App.jsx` owns `centerPosterVersion` and updates it from catalog load and the admin upload/reset response so subsequent SPA navigation uses the latest URL.

- [x] **Step 1: Write failing admin E2E assertions** for previewing the default, selecting/replacing an image, seeing a saved confirmation, preserving the new preview after reload, restoring the default, and showing errors for invalid or over-limit files.
- [x] **Step 2: Run `npm run test:e2e -- test/e2e/center-poster.spec.js` and verify the new admin assertions fail** because the controls are not present.
- [x] **Step 3: Implement `CenterPosterSettings` in the existing Form options → Centers panel.** Accept `.png,.jpg,.jpeg,.webp`, enforce 5 MiB client-side, convert the selected image to `{ mimeType, dataBase64 }`, send PUT/DELETE with same-origin credentials, update version state only after success, and expose save/error state with an accessible live region. Disable duplicate actions while saving.
- [x] **Step 4: Wire the component through the existing admin page tree.** Keep the poster upload/reset requests separate from `/api/admin/catalog`; after a successful write, update `centerPosterVersion` and show the new `?v=` preview immediately.
- [x] **Step 5: Run `npm run test:e2e -- test/e2e/center-poster.spec.js` and `npm run build`; verify a catalog edit and poster update each persist independently.**

### Task 4: Verify responsive and Final-form coverage

**Files:**
- Modify: `test/e2e/center-poster.spec.js`
- Modify only if needed: `src/features/applications/CenterPosterPreview.jsx`, `src/features/applications/ApplicationFormPage.jsx`, `src/features/applications/SchoolBatchForm.jsx`

**Interfaces:** Consumes the public API and form component contracts established in Tasks 1–3; adds no new server or UI interface.

- [x] **Step 1: Add final-form coverage** using the existing Final eligibility fixture and verify a Paper-Based Final selection shows the same shared poster before its center selector.
- [x] **Step 2: Add mobile viewport checks** at 390 px width for no horizontal overflow, poster image contained within the form card, and full-size viewer reachable by keyboard and touch.
- [x] **Step 3: Run `npm run test:e2e` and `npm run build`; confirm all poster flows and the existing application/admin workflows pass.**

## Self-Review

- **Spec coverage:** Shared default/replacement storage and API are Task 1; individual/school/Final display and viewer are Tasks 2 and 4; admin replace/restore within the existing center settings is Task 3; mobile presentation is Tasks 2 and 4; independent catalog saves are covered in Task 3.
- **Step scan:** Each task specifies named tests, interfaces, files, and verification commands; no unassigned product behavior remains.
- **Type consistency:** `centerPosterVersion` is nullable in API/catalog and all React props; PUT returns a string version; reset returns null; both forms consume the same preview component contract.
- **Review Focus:** The five likely failure cases each have a test in the task responsible for the route, forms, or admin controls.
- **Proportion:** Four tasks follow the cross-layer boundaries already present in the app and avoid introducing storage infrastructure or a new dependency.
