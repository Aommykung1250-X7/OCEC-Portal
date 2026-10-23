# งานแยก React components และย้ายสไตล์ไป Tailwind

รายการนี้ใช้กับ tasks/plan.md แต่ละงานต้องจบด้วยโค้ดที่ build ได้และตรวจ flow ที่ย้ายแล้วได้จริง งาน `T-*` จะตามหลังงานแยก component ของ feature เดียวกัน ไม่ใช่แผน Tailwind แยกภายหลัง

## ช่วง A — ฐานและ public shell

### Task 1 — บันทึก baseline ของ UI และข้อมูล

**งาน:** ระบุ prop/data contract ของหน้าหลัก ฟอร์ม และ admin; ตรวจ coverage เดิมและเติมเฉพาะ regression case ที่ยังไม่มีสำหรับ login dialog, mobile header และ navigation

**Acceptance criteria:**
- [x] มีรายการ route, state owner และ callback สำคัญก่อนเริ่มย้าย
- [x] มี baseline ผลตรวจที่ 320, 390 และ 1280 พิกเซล

**Verification:** npm run build; รัน test/e2e/portal-shell.spec.js และ portal-smoke.spec.js ผ่าน npm run test:e2e พร้อมตัวเลือกไฟล์

**Dependencies:** ไม่มี

**Files likely touched:** tasks/plan.md, tasks/todo.md, tasks/baseline.md, test/e2e/portal-shell.spec.js

**Result:** `npm run build` ผ่าน; focused E2E 8/8 ผ่านบน Chrome ที่ติดตั้งในเครื่อง หลังเพิ่ม coverage สำหรับ login dialog, mobile header และ responsive viewport

**Estimated scope:** M

### Task T0 — ตั้งฐาน Tailwind v4 แบบไม่กระทบหน้าเดิม

**งาน:** เพิ่ม `tailwindcss` และ `@tailwindcss/vite`, ลง plugin ใน Vite, สร้าง `src/tailwind.css` ที่ประกาศ layer แล้ว import `tailwindcss/theme.css` และ `tailwindcss/utilities.css` โดยยังไม่ import Preflight, กำหนด `@theme` จากสีและ typography ที่ใช้อยู่จริง และเพิ่ม CSS entry ใน `src/main.jsx`; ปิด auto-detection ด้วย `source(none)` แล้วเพิ่ม `@source` เฉพาะโฟลเดอร์ component ที่ย้ายในแต่ละช่วง เพื่อไม่ให้ legacy class ใน `App.jsx` ถูกสร้างเป็น Tailwind utility ก่อนเวลา

**Acceptance criteria:**
- [x] มี utility ตัวอย่างที่ build ออกจริงโดยไม่มีการเปลี่ยน layout ของหน้าที่ยังไม่ย้าย
- [x] token ชื่อกลางสำหรับ brand, text, surface และ border อ้างค่าเดียวกับธีมปัจจุบัน; ไม่สร้าง palette ใหม่ในขั้นนี้
- [x] บันทึกลำดับ CSS import และหลักการใช้ legacy CSS ระหว่าง migration
- [x] ระบุ selector แบบ unlayered ที่จะชน utility ใน feature แรกและวิธีลบ/จำกัด selector นั้นก่อนเริ่ม T-A1
- [x] build ไม่สร้าง utility จาก legacy class ใน `App.jsx`; โฟลเดอร์ component ที่ย้ายแต่ละช่วงต้องมี `@source` ของตัวเอง

**Result:** ติดตั้ง Tailwind CSS / Vite plugin `4.3.3`; build ผ่าน; focused portal-shell/smoke E2E 9/9 ผ่านที่ 320/390/1280 px; ทดสอบ utility จาก temporary `@source inline` แล้วถอดออก; ผล build ปกติไม่มี generated utility จาก legacy source

**Verification:** npm run build; portal-shell E2E; ตรวจ public home, login dialog และ admin dashboard ที่ 320/390/1280 พิกเซลกับ baseline ของ Task 1

**Dependencies:** Task 1

**Files likely touched:** package.json, package-lock.json, vite.config.js, src/main.jsx, src/tailwind.css

**Estimated scope:** S

### Task 2 — แยก shared UI primitives

**งาน:** ย้าย Icon, BrandMark, Button, Field, PageHeading, ProfileAvatar และ StatusBadge ออกจาก App โดยคง props, className และ markup ที่ใช้อยู่

**Acceptance criteria:**
- [x] หน้า public และ admin ใช้ component กลางจากโมดูลใหม่
- [x] ไม่มี import ย้อนกลับจาก component กลางไป App

**Result:** แยก `Icon`, `BrandMark`, `Button`, `Field`, `PageHeading`, `ProfileAvatar` และ `StatusBadge` ไป `src/components/ui/`; `npm run build` ผ่าน; portal-shell/smoke E2E 9/9 ผ่าน

**Verification:** npm run build; ตรวจ public home และ admin dashboard

**Dependencies:** Task T0

**Files likely touched:** src/App.jsx, src/components/ui/index.jsx, src/components/ui/icons.js

**Estimated scope:** M

### Task 3 — แยก public shell และ login dialog

**งาน:** ย้าย PublicPortalHeader, AuthDialog, PublicPortalFooter และ PublicPortalLayout เป็น component แยก; ให้ App ส่ง page, auth และ callbacks ผ่าน props

**Acceptance criteria:**
- [x] เมนูบัญชี login dialog และ footer ทำงานเหมือนเดิม
- [x] nav-bar ยังเลื่อนซ่อน/โผล่ และ dialog ยังอยู่ใน viewport บนมือถือ

**Result:** แยก public header, login dialog, footer และ layout เป็น `src/components/public/*`; เพิ่ม account-menu outside-press characterization test; `npm run build` ผ่าน; portal-shell/smoke E2E 10/10 ผ่าน รวม Escape/focus restoration, menu, scroll และ viewport 320/390/1280 px

**Verification:** npm run build; ตรวจ login, Escape, focus, menu และการเลื่อนที่ 320/390/1280 พิกเซล

**Dependencies:** Task 2

**Files likely touched:** src/App.jsx, src/components/public/PublicPortalHeader.jsx, src/components/public/AuthDialog.jsx, src/components/public/PublicPortalLayout.jsx

**Estimated scope:** M

### Task T-A1 — ย้าย shared UI และ public shell ไป Tailwind

**งาน:** ย้ายสไตล์ของ Button, Field, badge, header, profile menu, AuthDialog และ footer ที่แยกแล้วไป utility; ใช้ static class map สำหรับ variant; เก็บ CSS เฉพาะการเคลื่อน nav-bar และกฎซับซ้อนที่มีเหตุผล พร้อมลบ selector เก่าที่ไม่มี consumer แล้ว

**Acceptance criteria:**
- [x] desktop/mobile header, login dialog และ footer มีขนาด ระยะ และสีตรง baseline
- [x] menu, hover/focus, disabled, Escape, touch target และ nav-bar ตอนเลื่อนทำงานเดิม
- [x] ไม่มี selector เก่าของส่วนนี้ที่ไม่ถูกใช้อีก และไม่กระทบส่วนอื่นที่ใช้ shared UI

**Verification:** npm run build; portal-shell E2E; เทียบภาพ 320/390/1280 พิกเซลและตรวจ scroll/login บนมือถือ

**Result:** ย้าย shared UI, public header/account menu, login dialog และ footer ไปใช้ Tailwind utilities โดยคง CSS เฉพาะ marker ของ nav, การเคลื่อน header และกฎแบรนด์ที่ยังมี consumer; ลบ base selector เดิมและ selector direct-child ที่ไม่ตรงกับ markup ปัจจุบัน อัปเดต CSS entry เป็น layered legacy styles → Tailwind utilities.

**Verification:** `npm run build` ผ่าน; `npm test` 47 ผ่าน / 3 ข้าม (ต้องใช้ disposable database); `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- test/e2e/portal-shell.spec.js` ผ่าน 10/10; ตรวจภาพ public shell ที่ 390/1280 และ viewport 320/390/1280 ผ่าน overflow/bounds checks.

**Dependencies:** Tasks 2–3

**Files likely touched:** src/components/ui/*, src/components/public/*, src/tailwind.css, src/styles.css, src/brand-theme.css และ CSS theme ที่มี selector ของ shell

**Estimated scope:** M

### Task 4 — แยกหน้าแรก

**งาน:** แยก LandingPage เป็น Hero, ExamRounds และ Journey ภายใน feature home โดยให้ข้อมูลรอบสอบมาจาก props เดิม

**Acceptance criteria:**
- [x] ปุ่มสมัคร ตรวจสถานะ และรายการสอบทำงานเหมือนเดิม
- [x] สถานะไม่มีรอบสอบและมีรอบสอบแสดงผลครบ

**Verification:** npm run build; ตรวจหน้าแรกที่ 320/390/1280 พิกเซล และ portal-shell smoke

**Dependencies:** Task T-A1

**Result:** แยกหน้าแรกเป็น `LandingPage`, `HomeHero`, `ExamRounds` และ `Journey`; ย้าย `ExamLogo` ไป shared UI และย้ายตัวช่วยวันที่/ประเภทสอบไป `src/examUtils.js` โดยคง route callbacks, animation observer และ markup เดิม

**Verification:** `npm run build` ผ่าน; `npm test` 49 ผ่าน / 3 ข้าม / 0 ล้ม; `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- test/e2e/portal-shell.spec.js test/e2e/portal-smoke.spec.js` ผ่าน 13/13; เก็บภาพ baseline 320/390/1280 px แล้ว

**Files likely touched:** src/App.jsx, src/features/home/LandingPage.jsx, src/features/home/HomeSections.jsx

**Estimated scope:** M

### Task T-A2 — ย้ายหน้าแรกไป Tailwind

**งาน:** ย้าย layout, typography, card, CTA, responsive state ของ Hero, ExamRounds และ Journey ไป utility; ลบ selector เฉพาะหน้าแรกที่ไม่มี consumer หลังเทียบภาพ

**Acceptance criteria:**
- [x] empty/populated exam rounds, CTA และภาพประกอบตรง baseline ที่สามขนาดจอ
- [x] ไม่มี horizontal overflow, ปุ่มยังแตะง่าย และความเคลื่อนไหวเดิมไม่เปลี่ยน
- [x] CSS หน้าแรกที่เหลือมีเหตุผลและระบุ component เจ้าของได้

**Verification:** npm run build; portal-shell smoke; เทียบภาพ 320/390/1280 พิกเซลทั้ง empty/populated state

**Result:** ย้าย layout, typography, card, CTA, responsive state และพื้นที่หลักของ Home ไป Tailwind; คง CSS เฉพาะ illustration, hero ornament, card entrance motion, hover และ icon treatment ที่ยังมี consumer; ลบ stylesheet `landing-sky.css` และ homepage theme สีน้ำเงินรุ่นเก่าที่ไม่มี markup ใช้แล้ว

**Verification:** `npm run build` ผ่าน; `npm test` 49 ผ่าน / 3 ข้าม / 0 ล้ม; portal-shell + portal-smoke E2E ผ่าน 15/15 รวม populated/empty ที่ 320/390/1280 px และเช็ก horizontal overflow / touch target; เทียบ screenshot ที่ 390/1280 กับ baseline แล้ว

**Dependencies:** Task 4

**Files likely touched:** src/features/home/*, src/landing-sky.css, src/public-blue-theme.css, src/public-refero-theme.css, src/brand-theme.css

**Estimated scope:** M

### Checkpoint A

- [x] Public home, login, mobile navigation และ footer ตรง baseline
- [x] npm run build ผ่าน
- [x] Public shell และหน้าแรกที่แยกแล้วใช้ Tailwind เป็นหลัก; CSS เก่าที่ไม่ใช้ถูกลบโดยไม่กระทบหน้าอื่น

## ช่วง B — เส้นทางผู้สมัคร

### Task 5 — แยกใบสมัครและหน้าค้นหาสถานะ

**งาน:** ย้าย ApplicationsPage, ApplicationDetailPage และหน้า lookup/status เป็นโมดูล feature applications โดยรักษา route params และ callback เดิม

**Acceptance criteria:**
- [x] เปิดรายการใบสมัครและรายละเอียดจาก route เดิมได้
- [x] ค้นหาและแก้ไขผ่านขั้นยืนยันตัวตนได้ตามเดิม

**Verification:** npm run build; รัน Playwright smoke ที่เกี่ยวกับ application และ status

**Dependencies:** Tasks 2–3

**Result:** แยกหน้ารายการ/รายละเอียดใบสมัครและหน้าค้นหา/ยืนยันตัวตนไป `src/features/applications/`; ย้าย helper ที่ใช้ร่วมกับ admin และฟอร์มไป `applicationUtils.js`; App ยังคงเป็นเจ้าของ route, callback และการตั้งค่า backend

**Verification:** `npm run build` ผ่าน; `npm test` 49 ผ่าน / 3 ข้าม / 0 ล้ม; `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- test/e2e/applicant-pages.spec.js` ผ่าน 2/2

**Files likely touched:** src/App.jsx, src/features/applications/ApplicationPages.jsx, src/features/applications/StatusPages.jsx

**Estimated scope:** M

### Task 6 — แยกหน้าผลสอบและยืนยันสิทธิ์ Final

**งาน:** ย้าย PublicResultsPage และ FinalConfirmationPage พร้อมส่วนย่อย โดยคง data contract ของ Heat/Final

**Acceptance criteria:**
- [x] หน้าผลสอบแสดง empty, pending และ published state ได้
- [x] เส้นทางยืนยันสิทธิ์ Final และปุ่มต่อไปยังสมัคร Final ทำงานเดิม

**Verification:** npm run build; รัน focused final-eligibility และ results workflows

**Dependencies:** Tasks 2–3

**Result:** แยก PublicResultsPage, FinalConfirmationPage และ API-backed Final confirmation ไป `src/features/results/`; ย้าย label/active-year helpers ที่ใช้ร่วมกันออกจาก App และส่ง demo profile ผ่าน props

**Verification:** `npm run build` ผ่าน; `npm test` 49 ผ่าน / 3 ข้าม / 0 ล้ม; `final-eligibility.spec.js` ผ่าน 5/5; `results-page.spec.js` ผ่าน 2/2 สำหรับสถานะรอประกาศและผลสอบที่เผยแพร่

**Files likely touched:** src/App.jsx, src/features/results/PublicResultsPage.jsx, src/features/results/FinalConfirmationPage.jsx

**Estimated scope:** M

### Task T-B1 — ย้ายหน้ารายการ สถานะ และผลสอบไป Tailwind

**งาน:** ย้ายสไตล์ของ application list/detail, lookup/status, public results และ Final confirmation ทีละหน้า โดยคง visual state เดิมและลบ CSS เฉพาะหน้าที่ผ่านการตรวจแล้ว

**Acceptance criteria:**
- [x] empty, pending, published, error และ loading state ของหน้าที่เกี่ยวข้องครบ
- [x] ตารางและข้อมูลยาวอ่านได้ที่ 320/390 พิกเซลโดยไม่เกิด overflow ที่ไม่ได้ตั้งใจ
- [x] ไม่มี legacy selector ของหน้าเหล่านี้ที่เลิกใช้แล้ว

**Result:** ย้าย layout ของ application list/detail, lookup/status, public results และ Final confirmation ไป Tailwind; เหลือ CSS เฉพาะสี เส้นกรอบ typography และส่วนตกแต่งที่ยังใช้; ลบกฎ responsive และ selector เก่าที่ไม่มี consumer; เพิ่ม coverage สำหรับ status loading/empty/error, results pending/published/no-match และ Final loading/error

**Verification:** `npm run build` ผ่าน; `npm test` 49 ผ่าน / 3 ข้าม / 0 ล้ม; applicant-pages E2E 3/3, final-eligibility E2E 6/6 และ results-page E2E 4/4 ผ่านโดยรัน suite แยก; ตรวจภาพ responsive ที่ 320/390/1280 px และเช็ก document overflow

**Verification:** npm run build; focused application/status/results E2E; เทียบภาพมือถือและเดสก์ท็อป

**Dependencies:** Tasks 5–6, T-A2

**Files likely touched:** src/features/applications/*, src/features/results/*, src/styles.css, src/public-blue-theme.css, src/public-refero-theme.css

**Estimated scope:** M

### Task 7 — แยก field และตัวเลือกที่ใช้ร่วมกันในฟอร์ม

**งาน:** ย้าย ApplicantProfileFields, CompetitionFormatPicker, payment card และ helper UI ที่ใช้ทั้ง Heat, Final และ school batch

**Acceptance criteria:**
- [x] shared form component รับค่าผ่าน props โดยไม่อ่าน state จาก App
- [x] การเลือกวิชา รูปแบบสอบ และยอดชำระยังคำนวณเหมือนเดิม

**Result:** แยก `ApplicantProfileFields`, `CompetitionFormatPicker` และ `PaymentAccountCards` ไป `src/features/applications/FormFields.jsx` กับ `FormOptions.jsx`; state และการคำนวณยอดยังอยู่ที่ App

**Verification:** `npm run build` ผ่าน; `npm test` 52 ผ่าน / 3 ข้าม / 0 ล้ม; focused application-catalog/payment-account/form-component tests 8/8; applicant-pages E2E 3/3 และ final-eligibility E2E 6/6 ผ่าน

**Dependencies:** Task T-B1

**Files likely touched:** src/App.jsx, src/features/applications/FormFields.jsx, src/features/applications/FormOptions.jsx

**Estimated scope:** M

### Task 8 — แยกฟอร์มสมัคร Heat และ Final

**งาน:** ย้าย ApplicationFormPage ไป feature applications โดยให้ App ส่ง catalog, prefill, access และ onSubmit ผ่าน props

**Acceptance criteria:**
- [x] Heat และ Final แสดง field ตามเงื่อนไขเดิม
- [x] validation, draft และ submit ไม่เปลี่ยนพฤติกรรม

**Result:** ย้าย `ApplicationFormPage` ไป `src/features/applications/ApplicationFormPage.jsx`; App ส่ง catalog, prefill, access, backend mode, callback และ SchoolBatch renderer ผ่าน props; ย้าย form catalog กับ helper ที่ใช้ร่วมกันไป `formCatalog.js` และ `formUtils.js`

**Verification:** `npm run build` ผ่าน; `npm test` 52 ผ่าน / 3 ข้าม / 0 ล้ม; Heat/Final eligibility E2E 7/7 และ applicant-pages E2E 3/3 ผ่าน; ตรวจ `git diff --check` ผ่าน

**Verification:** npm run build; รัน application และ final E2E flow ที่มีอยู่

**Dependencies:** Tasks 6–7

**Files likely touched:** src/App.jsx, src/features/applications/ApplicationFormPage.jsx, src/features/applications/formUtils.js

**Estimated scope:** M

### Task 9 — แยกฟอร์มสมัครผ่านโรงเรียน

**งาน:** ย้าย SchoolBatchForm และส่วนย่อยของการจัดการผู้สมัครหลายคนไป feature applications

**Acceptance criteria:**
- [x] เพิ่ม สลับ ลบผู้สมัคร และนำเข้าไฟล์ได้เหมือนเดิม
- [x] ยอดรวมและข้อมูลชำระเงินไม่เปลี่ยน

**Result:** แยก `SchoolBatchForm` ไป `src/features/applications/SchoolBatchForm.jsx`; ฟอร์มรับ applicants, catalog, payment data และ callbacks ผ่าน props โดยไม่มี import จาก App

**Verification:** `npm run build` ผ่าน; `npm test` 52 ผ่าน / 3 ข้าม / 0 ล้ม; school-batch-workbook tests 4/4; school add/switch/remove E2E ผ่าน โดยตรวจยอดรวมและ breakdown รายคน; Heat/Final E2E 7/7; `git diff --check` ผ่าน

**Verification:** npm run build; รัน school-batch-workbook tests และ school flow ที่เกี่ยวข้อง

**Dependencies:** Tasks 7–8

**Files likely touched:** src/App.jsx, src/features/applications/SchoolBatchForm.jsx, src/features/applications/SchoolApplicantSections.jsx

**Estimated scope:** M

### Task T-B2 — ย้ายฟอร์มสมัครไป Tailwind

**Status:** complete

**งาน:** ย้าย shared field/option ก่อน ตามด้วยฟอร์ม Heat/Final และฟอร์มโรงเรียน; ปิดงานย่อยแต่ละฟอร์มด้วย visual/flow check ก่อนย้ายฟอร์มถัดไป

**Acceptance criteria:**
- [x] shared field, error/help text, selection, payment และ disabled state ตรง baseline
- [x] Heat/Final form ผ่านทั้งขั้นกรอก บันทึก draft และ submit
- [x] school batch form รองรับข้อมูลหลายคนและไฟล์นำเข้าโดย layout ไม่แตก
- [x] CSS ฟอร์มเดิมถูกลบเฉพาะ selector ที่ไม่มี consumer แล้ว

**Verification:** npm run build; focused application/final/school tests; ตรวจ 320/390/1280 พิกเซลด้วยข้อความไทยยาวและ validation errors

**Dependencies:** Tasks 7–9

**Files likely touched:** src/features/applications/*, src/styles.css, src/design-refresh.css, src/public-refero-theme.css

**Estimated scope:** L (แบ่ง commit/PR ย่อยตาม shared fields, Heat/Final และ school ได้)

**Result:** ย้าย field, ตัวเลือกสอบ, รูปแบบสอบ, payment cards และฟอร์ม Heat/Final/โรงเรียนไป Tailwind พร้อมลบ selector เก่าที่ไม่มี consumer และเก็บ state disabled/reduced-motion; ฟอร์มปัจจุบันไม่มีปุ่มบันทึก draft จึงคง API และ workflow draft เดิมโดยไม่เพิ่ม UI ใหม่

**Verification:** `npm run build` ผ่าน; `npm test` 55 ผ่าน / 3 ข้าม / 0 ล้ม; database draft workflows 30/30 ผ่าน; application-submit 1/1, school-application 2/2, final-eligibility 7/7, applicant-pages 3/3 และ results-page 4/4 ผ่าน; ตรวจ responsive ที่ 320/390/1280 px และไม่พบ overflow

### Checkpoint B

- [x] สมัคร Heat/Final, สมัครผ่านโรงเรียน, ค้นหา, แก้ไข และดูผลสอบผ่าน
- [x] npm run build และ focused public tests ผ่าน
- [x] หน้า public ที่แยกแล้วใช้ Tailwind เป็นหลัก และฟอร์มทั้งสามแบบไม่เกิด mobile regression

## ช่วง C — หลังบ้าน

### Task 10 — แยก admin shell และ dashboard

**Status:** complete

**งาน:** ย้าย Sidebar, Topbar, HomePage และ AdminHomePage; App ยังส่ง route, persona และ auth ผ่าน props

**Acceptance criteria:**
- [x] admin navigation และ access gate ทำงานเดิม
- [x] dashboard อ่านข้อมูลเดียวกับก่อนย้าย

**Verification:** npm run build; ตรวจ admin login/dashboard และ portal-shell test

**Dependencies:** Task 2

**Files likely touched:** src/App.jsx, src/features/admin/AdminShell.jsx, src/features/admin/AdminHomePage.jsx

**Estimated scope:** M

**Result:** ย้าย Sidebar, Topbar, HomePage, AdminLoginPage และ AdminHomePage ไป `src/features/admin/AdminShell.jsx`; App ส่ง `backendEnabled`, persona, auth, navigation และข้อมูล dashboard ผ่าน props โดยไม่ย้าย state/access gate ออกจาก App

**Verification:** `npm run build` ผ่าน; `npm test` 55 ผ่าน / 3 ข้าม / 0 ล้ม; `portal-shell.spec.js` ผ่าน 14/14 รวม admin login/dashboard ที่ 320/390/1280 px

### Task T-C1 — ย้าย admin shell และ dashboard ไป Tailwind

**Status:** complete

**งาน:** ย้าย sidebar, topbar, navigation และ dashboard card ไป utility โดยคง state ของเมนูและ access gate

**Acceptance criteria:**
- [x] desktop/mobile admin navigation, focus และ card grid ตรง baseline
- [x] dashboard ทุก persona และ empty/loading state แสดงครบ

**Verification:** npm run build; admin dashboard smoke; เทียบภาพ 320/390/1280 พิกเซล

**Dependencies:** Task 10, T-B2

**Files likely touched:** src/features/admin/AdminShell.jsx, src/features/admin/AdminHomePage.jsx, src/admin-dashboard-v14.css, src/styles.css

**Estimated scope:** M

**Result:** ย้าย sidebar, topbar, admin navigation และ dashboard cards/layout ไป Tailwind utilities; คง CSS เฉพาะ shared/legacy admin views ที่ยังไม่ย้าย. เพิ่ม E2E ตรวจ rail hover/focus และ mobile drawer/scrim.

**Verification:** `npm run build` ผ่าน; `npm test` ผ่าน 55 / ข้าม 3 / ล้มเหลว 0; `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- test/e2e/portal-shell.spec.js` ผ่าน 16/16 ที่ครอบคลุม 320/390/1280 px; `git diff --check` ผ่าน.

### Task 11 — แยกหน้าตรวจใบสมัคร

**งาน:** ย้าย AdminReviewPage และ dialog ตรวจสลิป/ปฏิเสธไป feature admin โดยคง callbacks และสถานะการตรวจ

**Acceptance criteria:**
- [x] อนุมัติ ปฏิเสธ และแจ้งปัญหาสลิปได้เหมือนเดิม
- [x] dialog ปิดด้วยปุ่มและคีย์บอร์ดได้

**Verification:** npm run build; รัน admin-workflows หรือ focused review E2E

**Dependencies:** Task T-C1

**Files likely touched:** src/App.jsx, src/features/admin/AdminReviewPage.jsx, src/features/admin/ReviewDialogs.jsx

**Result:** แยก `AdminReviewPage` และ `DemoTransferSlip`, `ReviewSlipDialog`, `ReviewRejectDialog` ไป `src/features/admin/`; ส่ง `backendEnabled` และ callbacks ผ่าน props; เพิ่ม E2E ปิด dialog ด้วยปุ่มและ Escape

**Verification:** `npm run build` ผ่าน; `TEST_DATABASE_ADMIN_URL=postgres://localhost/postgres E2E_BROWSER_CHANNEL=chrome npm run test:e2e -- test/e2e/admin-workflows.spec.js` ผ่าน 9/9 รวมอนุมัติ ปฏิเสธ แจ้งปัญหาสลิป และปิด dialog

**Estimated scope:** M

### Task T-C2 — ย้ายหน้าตรวจใบสมัครไป Tailwind

**งาน:** ย้ายตาราง/การ์ด review และ dialog ตรวจสลิป/ปฏิเสธไป utility โดยคงสีสถานะและความชัดของ action

**Acceptance criteria:**
- [x] รายการยาว สถานะหลายแบบ และ dialog ที่มีข้อความยาวใช้งานได้บนมือถือ
- [x] focus, Escape, overlay และปุ่มอนุมัติ/ปฏิเสธทำงานเดิม

**Verification:** `npm run build` ผ่าน; `npm test` ผ่าน 55 / ข้าม 3 / ล้มเหลว 0; admin-workflows E2E ผ่าน 9/9; ตรวจภาพ dialog และขอบเขตที่ 320/390/1280 พิกเซล; คิว 14 รายการและสถานะรอตรวจ/ยืนยันแล้วเลื่อนได้บนหน้าจอ 320 พิกเซล; focus เข้า dialog และคืนไปปุ่มเปิดเมื่อกด Escape; เหตุผลยาว 240 ตัวอักษรและ overlay ปิด dialog ได้; `git diff --check` ผ่าน

**Result:** ย้าย layout ของคิว รายการตรวจ ใบสมัคร ตารางข้อสอบ/ข้อสอบเก่า ยอดชำระ ตัวอย่างสลิป และ dialog ไป Tailwind utilities; ลบ selector ของ review ที่ย้ายแล้วจาก CSS เดิม

**Dependencies:** Task 11

**Files likely touched:** src/features/admin/AdminReviewPage.jsx, src/features/admin/ReviewDialogs.jsx, src/admin-dashboard-v14.css

**Estimated scope:** M

### Task 12 — แยกโครงหน้าจัดการรอบสอบ

**งาน:** ย้าย AdminRoundPage เฉพาะโครงหน้า รายการรอบสอบ และการแก้ไขรอบสอบ โดยคง save contract จาก App

**Acceptance criteria:**
- [x] เพิ่ม แก้ไข และปิดรอบสอบได้เหมือนเดิม
- [x] dirty state และผลการบันทึกแสดงถูกต้อง

**Verification:** `npm run build` ผ่าน; `npm test` ผ่าน 55 / ข้าม 3 / ล้มเหลว 0; `admin-catalog-save.spec.js` ผ่าน 5/5; `admin-workflows.spec.js` ผ่าน 9/9; `git diff --check` ผ่าน

**Result:** ย้าย `AdminRoundPage`, `AdminFormOptionAccordion`, `CenterSelectionList` และ `GradeSelectionList` ไป `src/features/admin/AdminRoundPage.jsx`; แยกค่า default ของรายการสอบและ helper ที่ใช้กับผลสอบไป `adminCatalogDefaults.js` และ `adminUtils.js`; คง route composition และ save callbacks ไว้ใน `App.jsx`

**Dependencies:** Task T-C2

**Files likely touched:** src/App.jsx, src/features/admin/AdminRoundPage.jsx, src/features/admin/RoundEditor.jsx

**Estimated scope:** M

### Task 13 — แยกส่วนตัวเลือกในแค็ตตาล็อก

**งาน:** ย้ายส่วนจัดการวิชา ระดับชั้น ศูนย์สอบ บัญชีชำระเงิน และข้อสอบเก่าที่ใช้ในหน้า admin ออกเป็น component ย่อย

**Acceptance criteria:**
- [x] ตัวเลือกทุกส่วนอ่านและแก้ไขจาก catalog เดิม
- [x] การบันทึกและ validation ไม่เปลี่ยน

**Verification:** `npm run build` ผ่าน; `npm test` ผ่าน 55 / ข้าม 3 / ล้มเหลว 0; `admin-catalog-save.spec.js` ผ่าน 8/8 โดยตรวจชื่อรายการสอบ ศูนย์สอบ บัญชีรับโอน ระดับชั้น ข้อสอบเก่า และการเพิ่ม/แก้/ปิดรอบ; payment-account catalog unit tests ผ่าน; `git diff --check` ผ่าน

**Result:** ย้ายตัวจัดการชื่อรายการสอบและหน้าตัวเลือกเป็น `CatalogOptions`; แยก accordion, selection lists และเนื้อหาจัดการศูนย์สอบเป็น `CatalogResources`; `AdminRoundPage` คง state/validation และส่ง callbacks ให้ panel ย่อย

**Dependencies:** Task 12

**Files likely touched:** src/features/admin/AdminRoundPage.jsx, src/features/admin/CatalogOptions.jsx, src/features/admin/CatalogResources.jsx, src/App.jsx

**Estimated scope:** M

### Task T-C3 — ย้ายหน้าแค็ตตาล็อกไป Tailwind

**งาน:** ย้าย RoundEditor และแต่ละ panel ของวิชา ระดับชั้น ศูนย์สอบ บัญชีชำระเงิน และข้อสอบเก่าทีละ panel หลังแยก component แล้ว

**Acceptance criteria:**
- [x] validation, dirty state, save feedback และ drag/selection ที่มีอยู่ไม่เปลี่ยน
- [x] panel ข้อมูลมากยังใช้ได้ที่ 320/390 พิกเซลโดยไม่ซ่อน action สำคัญ
- [x] CSS เก่าถูกลบเฉพาะ panel ที่ผ่าน visual/flow check

**Result:** ย้ายแผงรายการสอบ ตัวเลือกวิชา ระดับชั้น ศูนย์สอบ บัญชีรับโอน และข้อสอบเก่าไปใช้ Tailwind; ปรับตารางข้อสอบเก่าและรายการศูนย์สอบให้แสดง action ครบในจอแคบ; ลบกฎ CSS เฉพาะแผงที่ตรวจ flow และภาพแล้ว พร้อมคงกฎ disclosure, focus และ reduced-motion ที่ยังจำเป็น

**Verification:** `npm run build` ผ่าน; `npm test` ผ่าน 55 / ข้าม 3 / ล้มเหลว 0; `admin-catalog-save.spec.js` ผ่าน 10/10 และ `admin-workflows.spec.js` ผ่าน 9/9 (รันรวม 19/19); responsive checks และภาพ 320/390/1280 พิกเซล ตรวจ action bounds และไม่มี page overflow; `git diff --check` ผ่าน

**Dependencies:** Tasks 12–13

**Files likely touched:** src/features/admin/AdminRoundPage.jsx, src/features/admin/CatalogOptions.jsx, src/features/admin/CatalogResources.jsx, src/admin-dashboard-v14.css

**Estimated scope:** L (แบ่ง commit/PR ย่อยตาม panel ได้)

### Task 14 — แยกผลสอบและการเชื่อมต่อ admin

**งาน:** ย้าย AdminResultsPage, AdminFinalIdsPage และ AdminSheetsPage ไป feature admin โดยคง import, publish และ API callbacks

**Acceptance criteria:**
- [ ] import, resolve และ publish ผลสอบทำงานเดิม
- [ ] เลข Final และหน้า Sheets แสดงสถานะเดิม

**Verification:** npm run build; รัน admin-workflows และ final-eligibility tests

**Dependencies:** Task T-C3

**Files likely touched:** src/App.jsx, src/features/admin/AdminResultsPage.jsx, src/features/admin/AdminFinalIdsPage.jsx, src/features/admin/AdminSheetsPage.jsx

**Estimated scope:** M

### Task T-C4 — ย้ายผลสอบ เลข Final และ Sheets ไป Tailwind

**งาน:** ย้ายการจัดวางตาราง, upload/import feedback, publish state, Final IDs และ Sheets status ไป utility ทีละหน้า

**Acceptance criteria:**
- [ ] ตารางและสถานะ import/resolve/publish อ่านได้ทั้งมือถือและเดสก์ท็อป
- [ ] error, loading, success และ confirmation state ครบ; action สำคัญยังเห็นชัด

**Verification:** npm run build; focused admin results/final E2E; เทียบภาพ 320/390/1280 พิกเซล

**Dependencies:** Task 14

**Files likely touched:** src/features/admin/AdminResultsPage.jsx, src/features/admin/AdminFinalIdsPage.jsx, src/features/admin/AdminSheetsPage.jsx, src/admin-dashboard-v14.css

**Estimated scope:** M

### Checkpoint C

- [ ] Admin dashboard, review, catalog save, result publish และ Final IDs ผ่าน
- [ ] npm run build และ focused admin tests ผ่าน
- [ ] หน้า admin ที่แยกแล้วใช้ Tailwind เป็นหลักและทุก state สำคัญตรง baseline

## ช่วง D — เก็บโครงสร้าง

### Task 15 — ลด App ให้เหลือ orchestration

**งาน:** ลบ component/helper ที่ย้ายแล้วจาก App, จัด import, ลบ selector CSS ที่ไม่ใช้แล้ว, ระบุเจ้าของ CSS ที่ยังต้องคงไว้ต่อ feature และเก็บโค้ดซ้ำที่เกิดจากการย้าย

**Acceptance criteria:**
- [ ] App เหลือ app state, API callbacks และ route composition เป็นหลัก
- [ ] ไม่มี circular import และไม่มี component ที่นิยามซ้ำ
- [ ] ไม่มี UI regression บนมือถือและเดสก์ท็อป
- [ ] ไม่มี selector เก่าที่ไม่มี consumer และ CSS ที่เหลือมีเหตุผล/เจ้าของชัดเจน

**Verification:** npm run build; npm test; npm run test:e2e; ตรวจภาพ 320/390/1280 พิกเซล

**Dependencies:** Tasks 3–14, T-A1–T-C4

**Files likely touched:** src/App.jsx, src/main.jsx, tasks/plan.md

**Estimated scope:** M

### Task T-D — ตรวจ Tailwind/CSS รอบสุดท้าย

**งาน:** ตรวจ CSS output, source scanning, specificity และ legacy CSS ที่เหลือ; ทดลอง Preflight บน branch/commit แยกแล้วเก็บไว้เฉพาะเมื่อทุกหน้าและ flow ผ่าน มิฉะนั้นคงการ import แบบไม่ใช้ Preflight พร้อมบันทึกเหตุผล; ตรวจ visual regression รอบสุดท้าย

**Acceptance criteria:**
- [ ] ไม่มี utility ที่ใช้ใน UI แต่หายจาก production build; variant ใช้ static class map
- [ ] CSS เก่าเหลือเฉพาะ global/animation/third-party/กรณีเฉพาะที่มีเจ้าของชัดเจน
- [ ] ตัดสินใจเรื่อง Preflight จากผลทดสอบจริงและบันทึกการตัดสินใจ
- [ ] ทุกหน้า responsive และพฤติกรรมสำคัญตรง baseline หรือมีรายการเปลี่ยนที่ตั้งใจ

**Verification:** npm run build; npm test; npm run test:e2e; เปรียบเทียบภาพ 320/390/1280 พิกเซลครบ public/admin และตรวจ production preview

**Dependencies:** Task 15

**Files likely touched:** src/tailwind.css, src/main.jsx, CSS legacy ที่ยังเหลือ, tasks/plan.md

**Estimated scope:** M

### Checkpoint D

- [ ] ทุก acceptance criteria ผ่าน
- [ ] บันทึกผลทดสอบและความต่างของ UI ที่ตั้งใจเปลี่ยน
- [ ] React component migration และ Tailwind migration ทั้งคู่เสร็จในแผนเดียวกัน
