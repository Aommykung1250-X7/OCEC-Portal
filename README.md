# OCEC Portal

ระบบสมัครสอบและจัดการ OCEC ใช้ React + Vite, Fastify และ PostgreSQL ของ Portal แยกจาก OCEC-Cert ใช้โลโก้ OCEC TH ใน `public/ocec-logo.png`

## เริ่มใช้งาน

```sh
npm install
npm run dev
```

สำหรับพัฒนา UI ให้เปิด URL ที่ Vite แสดงใน terminal; สำหรับการทำงานแบบ backend จริงบนเครื่อง ใช้ขั้นตอน production-like ด้านล่าง

สร้าง build สำหรับ preview ได้ด้วย:

```sh
npm run build
npm run preview
```

## รันแบบ production บนเครื่อง (localhost)

โหมดนี้ให้ PostgreSQL ของ Portal แยกในเครื่อง และให้ API เสิร์ฟหน้าเว็บจาก production build บน origin เดียวกัน เหมือนโครงสร้างตอน deploy โดยไม่ใช้ Railway service เพิ่ม

1. ติดตั้งและเปิด PostgreSQL ในเครื่อง (macOS + Homebrew): `brew install postgresql@16` และ `brew services start postgresql@16`
2. สร้างฐานข้อมูลครั้งแรก: `createdb ocec_portal`
3. คัดลอก `.env.example` เป็น `.env` แล้วตั้ง `DATABASE_URL=postgresql://<ชื่อผู้ใช้ macOS>@127.0.0.1:5432/ocec_portal`, `HOST=127.0.0.1`, `APP_ORIGIN=http://localhost:3001` และ `GOOGLE_REDIRECT_URI=http://localhost:3001/api/auth/google/callback`
4. รัน `npm run local:production` แล้วเปิด `http://localhost:3001`

ให้ตั้ง `VITE_BACKEND_ENABLED=true` เพื่ออ่าน catalog, ใบสมัคร และสถานะจาก PostgreSQL/API จริง ต้องกำหนด Google OAuth และเพิ่ม redirect URI `http://localhost:3001/api/auth/google/callback` ใน Google Cloud ก่อน build

ฐานข้อมูล local แยกจาก Railway และ OCEC-Cert; เพิ่มข้อมูล catalog และบัญชีรับเงินจริงของลูกค้าผ่านหลังบ้านก่อนเปิดรับสมัคร

## Portal API และการส่งใบสมัคร

API ของ Portal ใช้ PostgreSQL แยกจาก OCEC-Cert รองรับ Google Login, catalog, ส่งใบสมัครรายคน/โรงเรียน และคิวตรวจ/อนุมัติ เมื่อเปิด `VITE_BACKEND_ENABLED=true` หน้าเว็บจะอ่านใบสมัครจาก API และบันทึกการส่ง/ตรวจลงฐานข้อมูลแทน state ใน browser

1. สร้างฐานข้อมูล PostgreSQL ของ Portal แยกจาก OCEC-Cert
2. คัดลอก `.env.example` เป็น `.env` แล้วกำหนด `DATABASE_URL`, `APP_ORIGIN`, Google OAuth และ `ADMIN_EMAILS` (คั่นหลายอีเมลด้วย comma)
3. รัน `npm run db:migrate` เพื่อสร้าง schema และปรับฐานข้อมูลให้เป็นรุ่นล่าสุด
4. รัน `npm run api:dev` และ `npm run dev` คนละ terminalเมื่อพัฒนา; โหมด production-like ให้ใช้ `npm run local:production`
5. เตรียม catalog, ศูนย์สอบ, รายการระดับชั้น, ข้อสอบเก่า และบัญชีรับเงินในฐานข้อมูล แล้ว build ใหม่เมื่อเปลี่ยน `VITE_BACKEND_ENABLED`

Google OAuth redirect URI ใน Google Cloud ต้องตรงกับ `GOOGLE_REDIRECT_URI`; local production ใช้ `http://localhost:3001/api/auth/google/callback`. การล็อกอินจริงใช้ session cookie แบบ HttpOnly และกำหนดแอดมินจาก `ADMIN_EMAILS` เท่านั้น

หน้าแอดมินเข้าได้ที่ `/portal-admin` และใช้ Google Login ด้วยบัญชีที่อีเมลตรงกับ `ADMIN_EMAILS` ใน `.env` เช่น `admin1@example.com,admin2@example.com` ระบบเช็ก allowlist ฝั่ง server ทุกครั้งที่ใช้ session; การพิมพ์อีเมลอย่างเดียวไม่ทำให้ได้สิทธิ์แอดมิน

API สำหรับ flow ใบสมัคร: `POST /api/applications/submit`, `POST /api/school-batches/submit`, `GET /api/applications/mine`, `GET /api/admin/applications`, `GET /api/admin/payment-slips/:id` และ `PATCH /api/admin/applications/:id/review` พร้อมเส้นทาง login/catalog และแก้ไขรอบสอบ

การส่งใบสมัครตรวจรอบสอบที่เปิด ระดับชั้น ศูนย์สอบ รูปแบบสอบ ราคา ข้อสอบเก่า และรายการซ้ำก่อนบันทึกเป็นสถานะรอตรวจ ชุดโรงเรียนคิดเงินรวมหนึ่งบิลและเก็บสลิปหนึ่งไฟล์ โดยแอดมินอนุมัติแยกผู้สมัครได้ แอดมินต้องตรวจและยืนยันบัญชี ยอด และวันเวลาโอนเองก่อนอนุมัติ

สลิปใหม่ถูกอัปโหลดเข้า Google Drive แบบ private ในโฟลเดอร์แยกตามรายการสอบ/รอบ และฐานข้อมูลเก็บ Drive file ID ไว้ให้แอดมินเปิดตรวจผ่าน API ที่ต้องเป็นแอดมินเท่านั้น สลิปเก่าที่เคยเก็บใน PostgreSQL ยังเปิดได้จากที่เดิมเพื่อรองรับข้อมูลระหว่างย้าย

แอดมินบันทึกแค็ตตาล็อกรอบสอบ ระดับชั้น ศูนย์สอบ ข้อสอบเก่า และบัญชีรับเงินลงฐานข้อมูลได้จากหน้าแอดมิน ผู้สมัครหรือผู้ประสานงานแก้ข้อมูลส่วนตัวของใบที่อนุมัติแล้วได้จนถึงวันปิดแก้ไข โดย backend ตรวจเจ้าของและกำหนดวันก่อนบันทึก

**เชื่อม Google Workspace ในเครื่อง:** เพิ่ม redirect URI `http://localhost:3001/api/admin/google-workspace/callback` ใน OAuth client เพิ่มเติมจาก callback สำหรับ Login เดิม แล้วตั้ง `GOOGLE_INTEGRATION_ENCRYPTION_KEY` ใน `.env` สร้างคีย์ด้วย `openssl rand -base64 32` จากนั้นเปิด Drive API, Gmail API และ Google Sheets API ใน Google Cloud; ที่ Google Auth Platform → Data Access ต้องมี `drive.file`, `gmail.send` และ `https://www.googleapis.com/auth/spreadsheets` เมื่อเพิ่ม scope Sheets แล้ว ให้เปิดหน้า Google Sheets ในหลังบ้านและเชื่อมบัญชีใหม่เพื่ออนุญาต scope ล่าสุด ระบบสร้างโฟลเดอร์ให้เองเมื่อเริ่มใช้งาน

ลำดับ 4–6 ทำในโค้ดแล้ว: มีคิว PostgreSQL สำหรับอีเมลผ่าน Gmail API, ลิงก์แก้สลิปใช้ได้ครั้งเดียวและหมดอายุเมื่อไม่ได้ใช้ภายใน 3 วัน (ชุดโรงเรียนแทนสลิปทั้งบิลและส่งลิงก์ให้ผู้ประสานงานเท่านั้น), และคิวซิงก์ Google Sheets หลังอนุมัติ หนึ่งแถวต่อ Application Item ID; workbook แยกปี, tab แยกการแข่งขัน/รอบ แอดมินดูสถานะและเริ่มงานที่ล้มเหลวใหม่ได้ที่หน้า Google Sheets Worker ทำงานใน Portal API service เดียวกัน ไม่ต้องเพิ่ม Railway service

**รายชื่อส่ง Mock:** หน้าแอดมิน “รายชื่อ Mock และข้อสอบเก่า” ให้เลือกรายการสอบ ปีการศึกษา ระดับชั้น และวันที่ส่งใบสมัครตั้งแต่–ถึง (นับรวมทั้งสองวันตามเวลาไทย) แล้วกด “เพิ่มเข้า Google Sheet” ระบบจะอ่านข้อมูลจากชีตรายชื่อสมัครสอบที่อนุมัติแล้วและเพิ่มลงไฟล์ `OCEC Mock <ปี>` หนึ่งไฟล์ต่อปี โดยแยกแท็บตามรายการสอบ การเลือกชุดเดิมอีกครั้งจะอัปเดตชื่อ อีเมล เบอร์โทร และระดับชั้นในแถวเดิม แต่คงสถานะ Mock ที่แอดมินเลือกใน Google Sheet ไว้ คอลัมน์สถานะเป็น dropdown: `รอส่ง`, `ส่งแล้ว`, `อีเมลมีปัญหา` และบันทึกอยู่ใน Google Sheet นั้น

เมื่อยังไม่ได้เชื่อมบัญชีหรือยังขาด scope งานจะค้างในคิวและเริ่มส่งเมื่อสิทธิ์พร้อม ระบบจะลองใหม่อัตโนมัติ และแอดมินสั่ง retry งานที่ยังล้มเหลวได้ รายละเอียดอยู่ใน [แผน backend](docs/backend/implementation-plan.md)

รายละเอียดลำดับงานทั้งหมดอยู่ที่ [แผน backend](docs/backend/implementation-plan.md)

## ทดลอง deploy บน Railway

ใช้ Railway project เดิมของ OCEC-Cert ได้ โดยเพิ่ม **Portal PostgreSQL** และ **Portal Web** เป็น service ใหม่ ไม่ผูก `DATABASE_URL` กับฐานข้อมูลของ OCEC-Cert

- Portal Web เชื่อม GitHub repo นี้ แล้วตั้ง Build Command `npm run build`, Pre-deploy Command `npm run db:migrate`, Start Command `npm start`, Healthcheck Path `/api/ready`
- ตั้ง `DATABASE_URL` เป็น reference ของ Portal PostgreSQL, `DATABASE_SSL` ตามผู้ให้บริการ และ `VITE_BACKEND_ENABLED=true` เพื่อใช้งานฐานข้อมูลจริง
- ให้ Railway กำหนด `PORT` เอง จากนั้น Generate Domain สำหรับ Portal Web แล้วตั้ง `APP_ORIGIN=https://<โดเมน Portal>`
- หากต้องลอง Google Login ให้เพิ่ม `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI=https://<โดเมน Portal>/api/auth/google/callback`, `ADMIN_EMAILS` และตั้ง `VITE_BACKEND_ENABLED=true` แล้ว redeploy ตรวจให้แน่ใจว่า catalog และบัญชีรับเงินในฐานข้อมูลเป็นข้อมูลที่ต้องการก่อนเปิดให้ผู้สมัครใช้

API เสิร์ฟไฟล์ `dist` และ `/api` จาก service เดียวกัน เพื่อให้ session cookie และ Google redirect ใช้โดเมนเดียวกัน ไม่ต้องเพิ่ม public domain ให้ฐานข้อมูล

## สิทธิ์ BBB Final X และรูปเกียรติบัตร

BBB รอบ Final ที่ประกาศผลแล้วและได้ Gold, Silver หรือ Bronze มีสิทธิ์สมัคร Final X ของรายการสอบและปีเดียวกัน ผ่าน flow ยืนยันสิทธิ์เดิม (บัญชีเจ้าของใบสมัคร หรือยืนยันตัวตนผู้สมัครผ่านโรงเรียน) โดยต้องอยู่ในช่วงรับสมัครและใช้สิทธิ์ได้ครั้งเดียว เกณฑ์ BBB Heat ไป Final ยังคงเป็นอันดับ 1st–3rd รายการอื่นจบการแข่งขันที่ Final และไม่สามารถสร้างหรือสมัคร Final X ได้

ก่อนเปิดใช้ ให้รัน `npm run db:migrate` ตามขั้นตอน deploy เดิม Migration 019 ปรับสิทธิ์จากผล BBB Final ที่มีอยู่แล้วโดยไม่ต้องประกาศซ้ำ ระบบสร้างคำเชิญ Final X จากผลที่ประกาศแล้วได้แม้เพิ่มรอบ Final X ทีหลัง

รูปเกียรติบัตรที่อัปโหลดใหม่เก็บใต้ Certificate Photos เป็น `<ปีรอบสอบ>/<ชื่อย่อรายการสอบ>/Heat|Final|Final X/<เลขสอบ>_<ชื่อ>_<นามสกุล>.<นามสกุลไฟล์จริง>` สมัครหลายรายการจะบันทึกรูปเดียวกันแยกทุกโฟลเดอร์ ชื่อไฟล์คงรูปแบบเดิม และไม่มีงานย้ายรูปที่เก็บไว้ก่อนหน้านี้
