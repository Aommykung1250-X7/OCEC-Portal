import assert from 'node:assert/strict';
import test from 'node:test';
import { registrationEmail, slipIssueEmail } from '../server/applications.js';
import { registrationEmailSample } from '../scripts/registration-email-sample.js';

const emailOrigin = process.env.APP_ORIGIN || 'http://localhost:3001';

test('registration email includes applicant, exam, past-paper, and separated payment details', () => {
  const { text, html } = registrationEmail(registrationEmailSample);

  assert.match(text, /Sample Candidate/);
  assert.match(text, /ผู้ทดสอบ ระบบ/);
  assert.match(text, /Paper-Based · Bangkok/);
  assert.match(text, /Online Exam · Home Base · phanuwataom1250@gmail\.com/);
  assert.match(text, /Qualifier Round 2025/);
  assert.match(text, /ค่าสมัครรวม: ฿1,410/);
  assert.match(text, /ข้อสอบเก่ารวม: ฿500/);
  assert.match(text, /ยอดรวม: ฿1,910/);
  assert.match(html, /OCEC <span style="color:#e9568c">Portal<\/span>/);
  assert.match(html, /REGISTRATION SUMMARY/);
  assert.ok(html.includes(`href="${emailOrigin}/applications`));
  assert.match(html, /background:#f2faff/);
});

test('registration test mode is clearly labeled and does not use a localhost tracking link', () => {
  const { text, html } = registrationEmail(registrationEmailSample, { testMode: true });

  assert.match(text, /อีเมลทดสอบระบบ/);
  assert.match(text, /ไม่ใช่ใบสมัครจริง/);
  assert.match(html, /อีเมลทดสอบ · ข้อมูลตัวอย่าง ไม่ใช่ใบสมัครจริง/);
  assert.match(html, /ตัวอย่างปุ่มติดตามใบสมัคร/);
  assert.match(html, /ไม่ได้สร้างหรือเปลี่ยนแปลงใบสมัครใด ๆ/);
  assert.doesNotMatch(html, /localhost:3001/);
});

test('registration email escapes applicant values before putting them in HTML', () => {
  const malicious = structuredClone(registrationEmailSample);
  malicious.applicant.firstNameEn = '<img src=x onerror=alert(1)>';
  const { html } = registrationEmail(malicious);

  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img src=x onerror=alert\(1\)>/);
});

test('approved application email includes exam details and both edit paths without showing payment totals', () => {
  const { text, html } = registrationEmail(registrationEmailSample, { approved: true });

  assert.match(text, /อนุมัติการสมัครสอบแล้ว/);
  assert.match(text, /BBB[\s\S]*Heat Round 2569[\s\S]*Paper-Based/);
  assert.match(text, /HKICO[\s\S]*Heat Round 2569[\s\S]*Online Exam/);
  assert.match(text, /\/applications\/TEST-OCEC-EMAIL-20261012\/edit/);
  assert.match(text, /\/status/);
  assert.doesNotMatch(text, /ยอดรวม:|ข้อสอบเก่ารวม:|ค่าสมัครรวม:/);
  assert.match(html, /APPLICATION APPROVED/);
  assert.ok(html.includes(`href="${emailOrigin}/applications/TEST-OCEC-EMAIL-20261012/edit"`));
  assert.ok(html.includes(`href="${emailOrigin}/status"`));
  assert.doesNotMatch(html, /฿755|฿655|฿1,910/);
});

test('approved test email renders inert edit buttons and clearly says it is synthetic', () => {
  const { text, html } = registrationEmail(registrationEmailSample, { approved: true, testMode: true });

  assert.match(text, /อีเมลทดสอบ/);
  assert.match(text, /ปุ่ม ไม่มีลิงก์ใช้งานจริง/);
  assert.match(html, /ตัวอย่างปุ่ม: แก้ไขข้อมูลผ่านบัญชีผู้สมัคร/);
  assert.match(html, /ตัวอย่างปุ่ม: ไม่มีบัญชี\? ค้นหาสถานะเพื่อแก้ไข/);
  assert.match(html, /ปุ่มตัวอย่างไม่เชื่อมต่อไปยังใบสมัครจริง/);
  assert.doesNotMatch(html, /href="http:\/\/localhost:3001/);
});

test('slip issue email shares the OCEC theme and uses an inert action in test mode', () => {
  const { text, html } = slipIssueEmail({
    applicationId: registrationEmailSample.id,
    applications: [{ id: registrationEmailSample.id, applicant: registrationEmailSample.applicant, items: registrationEmailSample.items }],
    reason: 'ยอดเงินในสลิปไม่ตรง',
    testMode: true,
  });

  assert.match(text, /ยอดเงินในสลิปไม่ตรง/);
  assert.match(text, /Paper-Based/);
  assert.match(text, /Online Exam/);
  assert.match(text, /ปุ่มส่งสลิปใหม่เป็นตัวอย่าง/);
  assert.match(html, /OCEC <span style="color:#e9568c">Portal<\/span>/);
  assert.match(html, /PAYMENT SLIP UPDATE · TEST/);
  assert.match(html, /ตัวอย่างปุ่มส่งสลิปใหม่/);
  assert.match(html, /ไม่มีลิงก์ใช้งานจริง/);
  assert.doesNotMatch(html, /href=/);
});

test('production slip issue email links to the supplied one-time replacement URL and escapes its reason', () => {
  const { text, html } = slipIssueEmail({
    applicationId: registrationEmailSample.id,
    reason: '<script>alert(1)</script>',
    replacementUrl: 'https://portal.example/slip-replacement?token=abc123',
  });

  assert.match(html, /href="https:\/\/portal\.example\/slip-replacement\?token=abc123"/);
  assert.match(text, /หนึ่งครั้งภายใน 3 วัน/);
  assert.match(html, /หนึ่งครั้งภายใน 3 วัน/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('school batch slip email explains that one link replaces the shared slip and approved applications stay approved', () => {
  const applications = [
    { id: 'A1', applicant: { firstNameEn: 'Ada', lastNameEn: 'One' }, items: [{ competition: 'BBB', round: 'Heat', format: 'Paper-Based' }] },
    { id: 'A2', applicant: { firstNameEn: 'Ben', lastNameEn: 'Two' }, items: [{ competition: 'BBB', round: 'Heat', format: 'Paper-Based' }] },
  ];
  const { text, html } = slipIssueEmail({
    schoolBatchName: 'Example School', affectedApplications: 2, applications,
    reason: 'เปิดสลิปไม่ได้', replacementUrl: 'https://portal.example/slip-replacement?token=batch',
  });
  assert.match(text, /จำนวนใบสมัครที่ได้รับผล: 2 ใบ/);
  assert.match(text, /A1 · Ada One/);
  assert.match(text, /A2 · Ben Two/);
  assert.match(text, /ลิงก์นี้ใช้แทนสลิปของทั้งชุด/);
  assert.match(text, /ใบสมัครที่อนุมัติแล้วจะคงสถานะเดิม/);
  assert.match(html, /href="https:\/\/portal\.example\/slip-replacement\?token=batch"/);
});
