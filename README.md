# OCEC Portal prototype

หน้าเว็บต้นแบบสำหรับทดลอง flow สมัครสอบ OCEC และหน้าจัดการ โดยใช้ React + Vite และข้อมูลจำลองใน browser ใช้โลโก้ OCEC TH จากผู้ใช้ใน `public/ocec-logo.png`

## เริ่มใช้งาน

```sh
npm install
npm run dev
```

เปิด URL ที่ Vite แสดงใน terminal เพื่อทดลองหน้าแรกและ workflow ต่าง ๆ

สร้าง build สำหรับ preview ได้ด้วย:

```sh
npm run build
npm run preview
```

## Portal API ระยะแรก

เพิ่ม API ของ Portal และ PostgreSQL สำหรับข้อมูลตั้งต้นของรายการสอบ, Google Login แบบ OAuth และการสร้างใบสมัครแบบร่างที่คำนวณยอดจากฐานข้อมูล ส่วนการส่งใบสมัครพร้อมสลิป การอนุมัติ การชำระเงิน และการเชื่อม Google Drive/Sheets ยังเป็น workflow ตัวอย่างในหน้าเว็บ ห้ามเปิด `VITE_BACKEND_ENABLED=true` สำหรับผู้สมัครจริงจนกว่า workflow เหล่านี้จะย้ายเข้า API ครบ

1. สร้างฐานข้อมูล PostgreSQL ของ Portal แยกจาก OCEC-Cert
2. คัดลอก `.env.example` เป็น `.env` แล้วกำหนด `DATABASE_URL`, `APP_ORIGIN`, Google OAuth และ `ADMIN_EMAILS` (คั่นหลายอีเมลด้วย comma)
3. รัน `npm run db:migrate` แล้ว `npm run db:seed`
4. รัน `npm run api:dev` และ `npm run dev` คนละ terminal
5. เมื่อต้องการลองให้หน้าเว็บอ่าน catalog และล็อกอินจริง ตั้ง `VITE_BACKEND_ENABLED=true` แล้วเริ่ม Vite ใหม่

Google OAuth redirect URI ใน Google Cloud ต้องตรงกับ `GOOGLE_REDIRECT_URI` เช่น `http://localhost:5173/api/auth/google/callback` ในเครื่อง หรือ URL ของ Portal ที่ deploy แล้ว การล็อกอินจริงใช้ session cookie แบบ HttpOnly และกำหนดแอดมินจาก `ADMIN_EMAILS` เท่านั้น

API ที่พร้อม: `GET /api/health`, `GET /api/catalog`, `GET /api/auth/me`, `GET /api/auth/google/start`, `GET /api/auth/google/callback`, `POST /api/auth/logout`, `PATCH /api/admin/exams/:id` (ต้องเป็นแอดมิน), `POST /api/application-drafts`, `POST /api/school-batch-drafts` และ `GET /api/applications/mine` (ต้องล็อกอิน) ข้อมูล seed เป็นข้อมูล staging ตามรายการ BBB, HKISO และ HKICO HEAT 2569 ที่ยืนยันแล้ว และ seed จะไม่เขียนทับการแก้ไขเดิม

API แบบร่างตรวจระดับชั้น ศูนย์สอบ กำหนดการ ราคา และใบซ้ำทางฝั่งเซิร์ฟเวอร์ ชุดโรงเรียนรับผู้สมัครหลายคนและรวมยอดเป็นบิลเดียว การสร้างแบบร่างยังไม่ถือว่าส่งใบสมัครหรือชำระเงิน

**ข้อควรแก้ก่อนเปิดรับจริง:** `npm audit` รายงานช่องโหว่ระดับ high ของแพ็กเกจ `xlsx` เดิม และ npm ไม่มีรุ่นแก้ให้แพ็กเกจนี้ ต้องย้ายส่วนอ่าน Excel ไปใช้ไลบรารีที่ดูแลอยู่ก่อนเปิดรับไฟล์จากผู้ใช้จริง

รายละเอียดลำดับงานทั้งหมดอยู่ที่ [แผน backend](docs/backend/implementation-plan.md)

## ทดลอง deploy บน Railway

ใช้ Railway project เดิมของ OCEC-Cert ได้ โดยเพิ่ม **Portal PostgreSQL** และ **Portal Web** เป็น service ใหม่ ไม่ผูก `DATABASE_URL` กับฐานข้อมูลของ OCEC-Cert

- Portal Web เชื่อม GitHub repo นี้ แล้วตั้ง Build Command `npm run build`, Pre-deploy Command `npm run db:seed`, Start Command `npm start`, Healthcheck Path `/api/health`
- ตั้ง `DATABASE_URL` เป็น reference ของ Portal PostgreSQL, `DATABASE_SSL=false`, `VITE_BACKEND_ENABLED=false` ระหว่างดูตัวอย่าง UI
- ให้ Railway กำหนด `PORT` เอง จากนั้น Generate Domain สำหรับ Portal Web แล้วตั้ง `APP_ORIGIN=https://<โดเมน Portal>`
- หากต้องลอง Google Login ให้เพิ่ม `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://<โดเมน Portal>/api/auth/google/callback`, `ADMIN_EMAILS` และตั้ง `VITE_BACKEND_ENABLED=true` แล้ว redeploy; หน้าใบสมัคร/ชำระเงินยังเป็นข้อมูลจำลอง

API เสิร์ฟไฟล์ `dist` และ `/api` จาก service เดียวกัน เพื่อให้ session cookie และ Google redirect ใช้โดเมนเดียวกัน ไม่ต้องเพิ่ม public domain ให้ฐานข้อมูล
