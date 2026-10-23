# แผนแยก OCEC Portal เป็น React components และย้ายสไตล์ไป Tailwind

## เป้าหมาย

โปรเจกต์ใช้ React อยู่แล้ว แต่ UI ส่วนใหญ่ยังรวมใน src/App.jsx ประมาณ 5,300 บรรทัด แผนนี้จะแยก UI ตามขอบเขตงานและย้ายสไตล์ของส่วนที่แยกแล้วไป Tailwind ทีละส่วน โดยรักษาหน้าตา เส้นทาง และพฤติกรรมปัจจุบันไว้ ให้ App รับผิดชอบ state ระดับแอป การโหลดข้อมูล และการเลือกหน้าเป็นหลัก งานแต่ละช่วงต้อง build และตรวจเส้นทางหลักได้ก่อนเริ่มช่วงถัดไป

## สภาพปัจจุบัน

- src/App.jsx รวม shared UI, หน้า public, ฟอร์ม, หน้า admin, domain helpers และ state ระดับแอป
- src/main.jsx โหลด CSS หลายชั้น ได้แก่ styles.css, design-refresh.css, rainbow-theme.css, landing-sky.css, admin-dashboard-v14.css, public-blue-theme.css, public-refero-theme.css และ brand-theme.css
- มีตัวอย่าง component แยกไฟล์แล้วใน src/ConfirmDialog.jsx และ src/SystemPages.jsx
- มี Playwright coverage สำหรับ public shell, การสมัคร และ admin workflows อยู่แล้ว
- ยังไม่ได้ติดตั้ง Tailwind; Vite config ไม่มี Tailwind plugin และสไตล์ปัจจุบันอาศัย CSS หลายไฟล์ที่เขียนทับกัน
- working tree มีการแก้ไขอื่นค้างอยู่ การลงมือทำตามแผนต้องรักษางานเหล่านั้นและย้ายโค้ดจากสถานะปัจจุบัน

## การตัดสินใจด้านโครงสร้าง

1. แยกตาม feature ก่อน: src/components/ui, src/components/public, src/features/home, src/features/applications, src/features/results และ src/features/admin
2. ให้ App เป็นเจ้าของ routing, API data และ callback หลัก ส่วน component รับข้อมูลผ่าน props และเก็บเฉพาะ UI state ของตัวเอง เช่น เมนูหรือ dialog
3. ย้าย helper หรือค่าคงที่ที่ใช้ร่วมกันไปโมดูลกลางก่อนย้าย consumer เพื่อเลี่ยง circular import; ไม่ย้าย business logic เพียงเพื่อให้ไฟล์สั้นลง
4. ในแต่ละ feature ให้แยก component โดยคง className/CSS เดิมก่อน แล้วทำงาน Tailwind ของ feature นั้นทันทีหลัง flow ผ่าน ไม่รอให้แยกทั้งแอปเสร็จ; ลบ selector เก่าเฉพาะส่วนที่ย้ายและเทียบภาพผ่านแล้ว
5. ใช้ชื่อไฟล์และ export ที่ชัดเจน ไม่มี barrel export จนกว่าขอบเขตโมดูลจะนิ่ง
6. ใช้ Tailwind CSS v4 ผ่าน `@tailwindcss/vite` และไฟล์ CSS entry เดียวสำหรับ theme/utility; เริ่มโดยไม่โหลด Preflight เพื่อรักษา baseline ของหน้าที่ยังใช้ CSS เดิม แล้วประเมิน Preflight หลังย้ายครบ
   - ปิดการค้นหา source อัตโนมัติด้วย `source(none)` และลงทะเบียน `@source` เฉพาะโฟลเดอร์ของ feature ที่ย้ายแล้ว เพื่อกัน legacy class จาก `App.jsx` ถูกสร้างเป็น utility โดยไม่ตั้งใจ
7. ย้ายค่าสี ฟอนต์ ระยะห่าง มุม และเงาที่ใช้ซ้ำไป `@theme`/design tokens; ใช้ utility ใน JSX สำหรับ layout/state/responsive และเก็บ CSS เฉพาะกรณีที่ utility อ่านยากหรือจำเป็น เช่น keyframes, third-party overrides และกฎเฉพาะที่ซับซ้อน
8. component ที่มี variant ต้อง map props ไปยัง class string ที่เขียนครบแบบ static; หลีกเลี่ยงการต่อชื่อ class แบบ `bg-${color}-...` เพื่อให้ Tailwind สร้าง CSS ได้ครบ

## ลำดับงาน

### ช่วง A — ตั้งฐานและ public shell

- [x] Task 1: บันทึกพฤติกรรมหลักและขอบเขตข้อมูล
- [x] Task T0: ติดตั้ง Tailwind v4, ตั้ง theme tokens และตรวจผลกระทบกับ CSS เดิม
- [x] Task 2: แยก shared UI primitives
- [x] Task 3: แยก header, login dialog, footer และ public layout
- [x] Task T-A1: ย้าย shared UI และ public shell ที่แยกแล้วไป Tailwind
- [x] Task 4: แยกหน้าแรก
- [x] Task T-A2: ย้ายหน้าแรกไป Tailwind และลบ CSS เฉพาะหน้าแรกที่เลิกใช้
- [x] Checkpoint A: public home, login, mobile navigation และ footer ตรงกับของเดิม

### ช่วง B — เส้นทางผู้สมัคร

- [x] Task 5: แยกหน้ารายการใบสมัคร รายละเอียด และค้นหาสถานะ
- [x] Task 6: แยกหน้าผลสอบและยืนยันสิทธิ์ Final
- [x] Task T-B1: ย้ายหน้ารายการ/สถานะ/ผลสอบไป Tailwind
- [x] Task 7: แยกส่วนย่อยที่ใช้ร่วมกันในฟอร์ม
- [x] Task 8: แยกฟอร์มสมัคร Heat และ Final
- [x] Task 9: แยกฟอร์มสมัครผ่านโรงเรียน
- [x] Task T-B2: ย้าย shared fields, ฟอร์ม Heat/Final และฟอร์มโรงเรียนไป Tailwind ทีละหน้าฟอร์ม
- [x] Checkpoint B: สมัคร ตรวจสถานะ แก้ไขใบสมัคร และยืนยันสิทธิ์ยังทำงานตามเดิม

### ช่วง C — หลังบ้าน

- [x] Task 10: แยก admin shell และ dashboard
- [x] Task T-C1: ย้าย admin shell และ dashboard ไป Tailwind
- [x] Task 11: แยกหน้าตรวจใบสมัครและ dialog ที่เกี่ยวข้อง
- [x] Task T-C2: ย้ายหน้าตรวจใบสมัครและ dialog ไป Tailwind
- [x] Task 12: แยกโครงหน้าแค็ตตาล็อกรอบสอบ
- [x] Task 13: แยกส่วนตัวเลือก ศูนย์สอบ การชำระเงิน และข้อสอบเก่าในแค็ตตาล็อก
- [x] Task T-C3: ย้ายหน้าแค็ตตาล็อกไป Tailwind ทีละ panel
- [ ] Task 14: แยกหน้าผลสอบ เลข Final และ Sheets
- [ ] Task T-C4: ย้ายหน้าผลสอบ เลข Final และ Sheets ไป Tailwind
- [ ] Checkpoint C: การบันทึกแค็ตตาล็อกและงานหลังบ้านหลักยังผ่าน

### ช่วง D — เก็บโครงสร้าง

- [ ] Task 15: ลด App ให้เป็น orchestration, ลบโค้ดและ CSS ที่ย้ายแล้ว และบันทึกเจ้าของสไตล์ของแต่ละ feature
- [ ] Task T-D: ตรวจ CSS ที่เหลือ, ตัดสินใจเรื่อง Preflight และตรวจ visual regression รอบสุดท้าย
- [ ] Checkpoint D: build, unit tests และ Playwright smoke ผ่าน; เทียบจอ 320, 390 และ 1280 พิกเซล

รายละเอียด acceptance criteria, ไฟล์ที่คาดว่าจะเปลี่ยน และวิธีตรวจของแต่ละงานอยู่ใน tasks/todo.md

## ความสัมพันธ์ของงาน

Task 1 → T0 → Task 2–3 → T-A1 → Task 4 → T-A2 → Task 5–6 → T-B1 → Task 7–9 → T-B2 → Task 10 → T-C1 → Task 11 → T-C2 → Task 12–13 → T-C3 → Task 14 → T-C4 → Task 15 → T-D

ภายในแต่ละช่วงสามารถแยก component ที่ไม่ใช้ state ร่วมกันได้ แต่ทุกงานต้องรวมเข้ากับ App และตรวจเส้นทางจริงก่อนถือว่าเสร็จ

## ความเสี่ยงและวิธีรับมือ

| ความเสี่ยง | วิธีรับมือ |
|---|---|
 helper ใน App ถูกอ้างจากหลายหน้า | ย้าย helper ไปโมดูลกลางก่อนย้ายหน้า และตรวจ import graph ทุกช่วง |
 state หรือ callback เปลี่ยนพฤติกรรมระหว่างย้าย | คง prop contract เดิมและตรวจ flow สำคัญหลังทุก 2–3 งาน |
 CSS หลายไฟล์เขียนทับกัน | คง className ระหว่าง extraction; ย้าย selector ของ feature ที่เสร็จแล้วและลบกฎเก่าในงาน Tailwind คู่กัน ตรวจ computed style/ภาพก่อนลบ |
 Tailwind Preflight เปลี่ยนหน้าที่ยังไม่ย้าย | เริ่มด้วย theme และ utilities โดยไม่โหลด Preflight; ทดสอบทั้ง public/admin ก่อนตัดสินใจเปิด |
 utility แพ้ selector CSS เดิมหรือมี class ที่ build ไม่ขึ้น | CSS เดิมที่ไม่อยู่ใน layer อาจชนะ utility แม้ import ก่อน; ลบ/จำกัด selector ที่ชนใน feature นั้น ตรวจ cascade จริง ใช้ static variant map และตรวจ CSS ที่ build |
 working tree มีงานอื่นค้างอยู่ | ไม่ reset หรือเขียนทับไฟล์อื่น ตรวจ diff เฉพาะส่วนก่อนและหลังแต่ละงาน |
 หน้า admin และฟอร์มมีขนาดใหญ่ | แบ่งตามหน้าที่ ไม่ย้ายทั้งกลุ่มในครั้งเดียว |

## กติกาการย้ายสไตล์ทีละส่วน

Tailwind source detection ใช้ `source(none)` และเพิ่ม `@source` เฉพาะโฟลเดอร์ component ที่ย้ายแล้ว เพราะ legacy class จาก `App.jsx` อาจถูกสร้างเป็น utility และเปลี่ยนหน้าเดิมโดยไม่ตั้งใจ

- งาน `T-*` เป็นงานในแผนเดียวกันและตามหลัง component ที่เป็นเจ้าของ UI นั้นโดยตรง; แต่ละงานปิดได้เมื่อ build ผ่านและเทียบหน้าเดิมบนมือถือ/เดสก์ท็อปผ่าน
- อย่าใส่ legacy class และ Tailwind utility ที่กำหนด property เดียวกันไว้ถาวรใน element เดียว; ช่วงเปลี่ยนผ่านให้ระบุ owner ของสไตล์และลบกฎเก่าหลังตรวจผ่าน
- ย้าย responsive, hover/focus และ disabled state ไปพร้อมกัน ตรวจ touch target, overflow, dialog, navbar และ footer ตามปัญหาที่เคยแก้
- หลังทุกงาน Tailwind ให้ค้นหา selector ที่เลิกใช้ใน CSS ทั้งแปดไฟล์ก่อนลบ; อย่าลบกฎ global หรือที่แชร์กับ feature อื่นเพียงเพราะหน้าเดียวดูถูกต้อง

## เอกสารอ้างอิงสำหรับขั้นติดตั้ง

- [Tailwind CSS with Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Theme variables](https://tailwindcss.com/docs/theme)
- [Disabling Preflight](https://tailwindcss.com/docs/preflight#disabling-preflight)
- [Detecting classes in source files](https://tailwindcss.com/docs/detecting-classes-in-source-files)

## เกณฑ์จบ

- ทุกหน้าใช้ component ที่อยู่ใน feature ของตัวเอง; App เหลือ orchestration และ route composition เป็นหลัก
- ไม่มี circular import หรือ UI implementation ซ้ำโดยไม่จำเป็น
- หน้าตาและพฤติกรรมเดิมยังตรงกันบนมือถือและเดสก์ท็อป
- UI ของ feature ที่แยกแล้วใช้ Tailwind เป็นหลัก; CSS เดิมเหลือเฉพาะกฎที่มีเหตุผลชัดและมีเจ้าของ
- build และชุดตรวจที่เกี่ยวข้องผ่าน
