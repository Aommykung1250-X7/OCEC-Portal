# OCEC Portal UI baseline

เก็บก่อนเริ่มแยก component และย้ายสไตล์ อ้างอิงจาก `src/App.jsx`, `src/routes.js`, `src/main.jsx` และ E2E บน branch `codex/react-tailwind-migration` (ฐาน `21e5d9c`)

## โครงสร้างปัจจุบัน

- `src/App.jsx` มี 5,348 บรรทัด รวม route composition, React state, API callbacks, domain helpers และ UI ของ public/admin
- `src/main.jsx` โหลด CSS ตามลำดับ: `styles.css`, `design-refresh.css`, `rainbow-theme.css`, `landing-sky.css`, `admin-dashboard-v14.css`, `public-blue-theme.css`, `public-refero-theme.css`, `brand-theme.css`
- UI ที่มีไฟล์แยกแล้ว: `src/ConfirmDialog.jsx`, `src/SystemPages.jsx`, `src/applicationCatalog.js` และโมดูล helper ด้าน route/result/center/workbook
- `src/routes.js` เป็นเจ้าของ `pageLabels`, `routeFromLocation`, `routeUrlFor` และ `/portal-admin`

## Route และ component ที่ render

| Route | Page key | UI หลัก |
|---|---|---|
| `/` | `home` | `LandingPage` (public shell, hero, รอบสอบ, journey) |
| `/apply`, `/apply/final` | `apply-heat`, `apply-final` | `ApplicationFormPage`, `FinalAccessGate` |
| `/applications` | `applications` | `ApplicationsPage`, `ApplicationCard` |
| `/applications/:id` | `application-detail` | `ApplicationDetailPage` |
| `/applications/:id/edit` | `edit-application` | `EditApplicationPage`, `ApplicantProfileFields` |
| `/applications/school/:key` | `school-application-group` | `SchoolApplicationGroupPage` |
| `/lookup`, `/status`, `/edit/verify/:id?` | lookup/status pages | `LookupChoicePage`, `StatusLookupPage`, `EditVerifyPage` |
| `/slip-upload/:id`, `/slip-replacement` | slip pages | upload gate, `SlipReplacementPage` |
| `/final/confirm`, `/results` | public result pages | `ApiFinalConfirmationPage` หรือ `FinalConfirmationPage`; `PublicResultsPage` |
| `/portal-admin` | `admin-login` | `AdminLoginPage` |
| `/portal-admin/dashboard` | `admin-home` | `AdminHomePage` |
| `/portal-admin/review`, `/portal-admin/applications/:id` | `admin-review` | `AdminReviewPage`, review dialogs |
| `/portal-admin/applications/:id/edit` | `admin-application-edit` | `AdminApplicationEditPage` |
| `/portal-admin/exams`, `/portal-admin/form-options` | admin catalog | `AdminRoundPage` in rounds/form-options mode |
| `/portal-admin/results`, `/portal-admin/final-ids`, `/portal-admin/integrations/sheets`, `/portal-admin/mock-papers` | admin tools | `AdminResultsPage`, `AdminFinalIdsPage`, `AdminSheetsPage`, `AdminMockPapersPage` |

## State และ callback ownership

### App owns

- route/page, `activeApplicationId`, persona, `navigate()` และ `window.history`/`popstate`
- auth profile/checking, applications, school batches, exam/competition/grade/center/past-paper/payment catalogs
- published results, result workflows, final access, public edit credentials, admin catalog save/dirty state และ toast
- backend loading, mutations และ callbacks ที่ส่งให้หน้า: `submitApplication`, `saveApplication`, `saveCertificatePhoto`, `approveApplication`, `rejectApplication`, `notifySlipIssue`, exam/catalog save/update, result import/resolve/publish และ Final ID import/resolve/save

### Component-local UI state

- public header: login dialog, account menu และ scroll offset ของ header
- public pages: filter รายการสมัคร, คำค้น/ผลค้นหา/validation และค่าฟอร์ม
- admin pages: selected item, dialog/accordion, upload/import state, matching rows และ form edits
- `ConfirmDialogProvider` owns confirmation dialog state; `AppErrorBoundary` owns error presentation

## Existing E2E coverage and baseline run

ก่อนเพิ่ม characterization tests มี 5 checks ผ่านใน `portal-shell.spec.js` และ `portal-smoke.spec.js`: help links, exam date/year, unscheduled state, admin round year และ mock login.

เพิ่ม checks สำหรับ login dialog focus/Escape, mobile header hide/show และ layout/dialog ที่ 320, 390, 1280 px. ผลล่าสุด: **8 ผ่าน** (Chrome, 5.5 วินาที). ทุก viewport ไม่มี document horizontal overflow และ login dialog อยู่ใน viewport; header offset เพิ่มเมื่อเลื่อนลงและลดเมื่อเลื่อนขึ้น.

`npm run build` ผ่าน; Vite แจ้งเตือน bundle JS ใหญ่กว่า 500 kB (778.98 kB minified) ซึ่งเป็น baseline เดิมและอยู่นอกขอบเขต component/Tailwind migration เว้นแต่การแยก component จะแก้ได้โดยตรง

## Tailwind migration guardrails

- `src/main.jsx` โหลด `tailwind.css` เป็น entry เดียว; entry นี้นำเข้า CSS เดิมตามลำดับ (`styles.css`, `design-refresh.css`, `rainbow-theme.css`, `landing-sky.css`, `admin-dashboard-v14.css`, `public-blue-theme.css`, `public-refero-theme.css`, `brand-theme.css`) ใน `components` layer แล้วจึงสร้าง Tailwind utilities ใน `utilities` layer
- Tailwind v4 ไม่โหลด Preflight และปิด source auto-detection ด้วย `source(none)`; ระหว่างย้ายให้เพิ่ม `@source` เฉพาะโฟลเดอร์ component ที่พร้อมแล้ว
- เหตุผล: source auto-detection เห็นชื่อคลาส legacy ทั่ว `src/App.jsx` เช่น `hidden`, `grid` และ `fixed`; utility ที่ถูกสร้างขึ้นอาจเปลี่ยนหน้าที่ยังไม่ได้ย้าย แม้ยังไม่มี Tailwind class ใน JSX
- CSS เดิมทั้งหมดอยู่ใน `components` layer ซึ่งมี priority ต่ำกว่า `utilities`; การไม่โหลด Preflight ช่วยคงค่าเริ่มต้นของ element บนหน้าที่ยังใช้ CSS เดิม
- ใน T-A1 ให้คงกฎของ shared UI ที่ยังมี consumer และกฎเฉพาะที่ utilities อ่านยาก เช่น marker ของเมนูและการเลื่อน header; ลบเฉพาะกฎซ้ำหรือ selector ที่ไม่มี consumer หลังตรวจ component และ computed style

## Working tree note

branch ใหม่สร้างจาก `main` ที่ commit `21e5d9c`. มีไฟล์แก้ไข/ไฟล์ใหม่ค้างอยู่ก่อนเริ่มงานและถูกเก็บไว้ใน working tree นี้; ห้าม reset, clean, stash หรือนำการเปลี่ยนแปลงเหล่านั้นไปรวม/commit โดยไม่ตรวจแยกก่อน
