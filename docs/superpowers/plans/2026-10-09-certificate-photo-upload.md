# Certificate Photo Upload Implementation Plan

> **For agentic workers:** Implement this plan after the school-batch record model is available. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let approved applicants optionally add a portrait to their application for later use on an OCEC award certificate.

**Architecture:** Store one optional photo descriptor on each application record in local React state. The same application detail UI is visible to the individual applicant or school coordinator, so either can update the same photo. Pending applications cannot upload; the prototype does not generate certificates or persist files remotely.

**Tech Stack:** React 19, browser `FileReader`, existing CSS.

**Spec:** `docs/superpowers/specs/2026-10-09-ocec-batch-centers-certificate-design.md`

## Global Constraints

- This remains a UI prototype and uses mock data and browser-local state only.
- It does not connect to a database or file-storage service.
- Photo upload is optional and available only after an administrator approves the application.
- School coordinators and individual applicants can update the same photo for a school-submitted application.
- Accept JPG, PNG, or WebP up to 10 MB; show preview, replace, and remove actions.

---

### Task 1: Add the approved-application certificate photo section

**Files:**
- Modify: `src/App.jsx` (`ApplicationDetailPage`, application state handler, route props)
- Modify: `src/styles.css`
- Modify: `src/design-refresh.css`

**Interfaces:**
- Application stores optional `certificatePhoto: { name: string, type: string, dataUrl: string }`.
- `saveCertificatePhoto(applicationId, certificatePhoto)` updates that application in the existing `applications` state.
- `ApplicationDetailPage` consumes `onSaveCertificatePhoto(applicationId, value)` and shows an uploader only when `application.status === "confirmed"`.

- [ ] Add `saveCertificatePhoto` next to `updateApplication` and pass it to `ApplicationDetailPage`.
- [ ] Add a certificate-photo card after the application details for confirmed records, with a clear note that OCEC may use the portrait on the award certificate and upload is optional.
- [ ] Use a hidden file input and `FileReader.readAsDataURL`; accept image/jpeg, image/png, and image/webp only and reject files larger than 10 MB before reading.
- [ ] On successful load, save one `certificatePhoto` object to the application and render its preview; selecting a new file replaces the same application property, while remove clears it.
- [ ] Keep the photo visible and editable from both the coordinator's and applicant's application detail views; do not gate photo upload on result publication.
- [ ] Add responsive preview and button styles consistent with the portal cards and form controls.

**Manual verification:** Open a pending application and confirm no uploader is present. Approve it in admin review; open the same school application as coordinator and applicant and confirm both show the same stored preview. Upload an invalid type and an oversized image and confirm neither changes the saved photo; replace and remove a valid image.
