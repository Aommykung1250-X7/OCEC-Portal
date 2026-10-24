import { createHash, randomBytes } from 'node:crypto';
import { getPool, transaction } from './db.js';
import { finalGrantHash } from './finalEligibility.js';
import { deleteGoogleDriveFile, downloadGoogleDriveFile, uploadGoogleDriveFile } from './googleWorkspace.js';
import { encryptQueuedEmailText, enqueueIntegrationJob } from './integrationQueue.js';

const normalize = (value) => String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const duplicateKey = (applicant, roundId) => createHash('sha256').update([
  normalize(applicant.firstNameEn), normalize(applicant.middleNameEn), normalize(applicant.lastNameEn),
  applicant.dateOfBirth, normalize(applicant.schoolName), roundId,
].join('\u001f')).digest('hex');
const money = (satang) => satang / 100;
const hashToken = (value) => createHash('sha256').update(value).digest('hex');

function portalUrl(path) {
  const origin = process.env.APP_ORIGIN || 'http://localhost:3001';
  return new URL(path, origin).toString();
}

async function queueEmail(client, { to, subject, text, html }, dedupeKey, { sensitive = false } = {}) {
  if (!to) return;
  const payload = {
    to,
    subject,
    ...(text ? (sensitive ? { encryptedText: encryptQueuedEmailText(text) } : { text }) : {}),
    ...(html ? (sensitive ? { encryptedHtml: encryptQueuedEmailText(html) } : { html }) : {}),
  };
  await enqueueIntegrationJob(client, 'gmail.send', payload, dedupeKey);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function formatBaht(satang) {
  return `฿${(Number(satang || 0) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 })}`;
}

function displayDate(value) {
  if (!value) return '—';
  const match = String(value).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}

export function registrationEmail(summary, { schoolBatchName = '', testMode = false, approved = false, rejectedApplication = false, rejectedReason = '' } = {}) {
  const rejected = rejectedApplication || Boolean(rejectedReason);
  const nameEn = [summary.applicant.firstNameEn, summary.applicant.middleNameEn, summary.applicant.lastNameEn].filter(Boolean).join(' ');
  const nameTh = [summary.applicant.firstNameTh, summary.applicant.lastNameTh].filter(Boolean).join(' ') || '—';
  const address = Object.values(summary.applicant.address || {}).map((part) => String(part || '').trim()).filter(Boolean).join(', ') || '—';
  const genderLabels = { Male: 'ชาย / Male', Female: 'หญิง / Female', 'Prefer not to say': 'ไม่ประสงค์ระบุ / Prefer not to say' };
  const applicantText = approved ? [
    `ชื่อภาษาอังกฤษ: ${nameEn || '—'}`,
    `ชื่อภาษาไทย: ${nameTh}`,
    `โรงเรียน: ${summary.applicant.schoolName || '—'}`,
  ] : [
    `ชื่อภาษาอังกฤษ: ${nameEn || '—'}`,
    `ชื่อภาษาไทย: ${nameTh}`,
    `เพศ: ${genderLabels[summary.applicant.gender] || summary.applicant.gender || '—'}`,
    `วันเกิด: ${displayDate(summary.applicant.dateOfBirth)}`,
    `โรงเรียน: ${summary.applicant.schoolName || '—'}`,
    `อีเมล: ${summary.applicant.email || '—'}`,
    `เบอร์โทรศัพท์: ${summary.applicant.phone || '—'}`,
    `ที่อยู่: ${address}`,
  ];
  const examLines = summary.items.map((item, index) => [
    `${index + 1}. ${item.competition}${item.short ? ` (${item.short})` : ''}${item.subject ? ` · ${item.subject}` : ''}`,
    `   ${item.round}${item.year ? ` ${item.year}` : ''} · ${item.grade}`,
    `   ${item.format}${item.center ? ` · ${item.center}` : ''}${item.format === 'Online Exam' && item.examEmail ? ` · ${item.examEmail}` : ''}`,
    ...(approved ? [] : [`   ค่าสมัคร ${formatBaht(item.feeSatang)}`]),
  ].join('\n'));
  const paperLines = summary.papers.map((paper) => `- ${paper.title}${paper.detail ? ` · ${paper.detail}` : ''} · ${formatBaht(paper.priceSatang)}`);
  const text = [
    rejected ? 'OCEC Portal · ใบสมัครไม่ผ่านการอนุมัติ' : approved ? 'OCEC Portal · อนุมัติการสมัครสอบ' : 'OCEC Portal · สรุปใบสมัครสอบ',
    `เลขที่ใบสมัคร: ${summary.id}`,
    rejected ? `สถานะ: ใบสมัครไม่ผ่านการอนุมัติ${rejectedReason ? ` · เหตุผล: ${rejectedReason}` : ''}` : approved ? `สถานะ: อนุมัติการสมัครสอบแล้ว${testMode ? ' · อีเมลทดสอบ' : ''}` : testMode ? 'อีเมลทดสอบระบบ · ข้อมูลตัวอย่าง (ไม่ใช่ใบสมัครจริง)' : schoolBatchName ? `โรงเรียน: ${schoolBatchName} · รอเจ้าหน้าที่ตรวจสอบการชำระเงินของโรงเรียน` : 'สถานะ: ได้รับใบสมัครแล้ว · รอเจ้าหน้าที่ตรวจสอบสลิป',
    '',
    'ข้อมูลผู้สมัคร',
    ...applicantText,
    '',
    'รายการสอบ',
    ...(examLines.length ? examLines : ['—']),
    '',
    ...(approved ? [] : [...(paperLines.length ? ['ข้อสอบเก่า', ...paperLines, ''] : []),
      `ค่าสมัครรวม: ${formatBaht(summary.registrationTotalSatang)}`,
      `ข้อสอบเก่ารวม: ${formatBaht(summary.paperTotalSatang)}`,
      `ยอดรวม: ${formatBaht(summary.totalSatang)}`]),
    '',
    ...(approved ? testMode ? [
      'ช่องทางแก้ไขข้อมูล (ตัวอย่างปุ่ม ไม่มีลิงก์ใช้งานจริง)',
      'มีบัญชีผู้สมัคร: แก้ไขข้อมูลผ่านบัญชีผู้สมัคร',
      'ไม่มีบัญชี: ค้นหาสถานะเพื่อแก้ไข',
      'อีเมลนี้ใช้ทดสอบรูปแบบเท่านั้น ไม่ได้สร้างหรือเปลี่ยนแปลงใบสมัครใด ๆ',
    ] : [
      'ช่องทางแก้ไขข้อมูล',
      `มีบัญชีผู้สมัคร: ${portalUrl(`/applications/${encodeURIComponent(summary.id)}/edit`)}`,
      `ไม่มีบัญชี: ${portalUrl('/status')} · ค้นหาสถานะ แล้วเลือกแก้ไขข้อมูลเพื่อยืนยันตัวตน`,
    ] : [testMode ? 'อีเมลนี้ใช้ทดสอบรูปแบบเท่านั้น ไม่ได้สร้างหรือเปลี่ยนแปลงใบสมัครใด ๆ' : `ติดตามใบสมัคร: ${portalUrl('/applications')}`]),
  ].join('\n');

  const detailRow = (label, value) => `<tr><td style="padding:7px 12px 7px 0;color:#737d9a;font-size:13px;vertical-align:top;width:150px">${escapeHtml(label)}</td><td style="padding:7px 0;color:#29345f;font-size:14px;font-weight:600;vertical-align:top;word-break:break-word">${escapeHtml(value || '—')}</td></tr>`;
  const examCards = summary.items.map((item, index) => `<tr><td style="padding:0 0 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e4e7f2;border-left:4px solid #6358bd;border-radius:10px;background:#fafaff"><tr><td style="padding:14px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="color:#29345f;font-size:16px;font-weight:700">${index + 1}. ${escapeHtml(item.competition)}${item.short ? ` <span style="color:#6158b4">(${escapeHtml(item.short)})</span>` : ''}</td>${approved ? '' : `<td align="right" style="white-space:nowrap;color:#29345f;font-size:15px;font-weight:700">${formatBaht(item.feeSatang)}</td>`}</tr>${item.subject ? `<tr><td colspan="2" style="padding-top:5px;color:#687594;font-size:13px">${escapeHtml(item.subject)}</td></tr>` : ''}<tr><td colspan="2" style="padding-top:9px;color:#424e73;font-size:13px;line-height:1.7">${escapeHtml(item.round)}${item.year ? ` · ${escapeHtml(item.year)}` : ''}<br>ระดับชั้น: ${escapeHtml(item.grade)}<br>รูปแบบ: ${escapeHtml(item.format)}${item.center ? ` · ${escapeHtml(item.center)}` : ''}${item.format === 'Online Exam' && item.examEmail ? `<br>อีเมลเข้าสอบ: ${escapeHtml(item.examEmail)}` : ''}</td></tr></table></td></tr></table></td></tr>`).join('');
  const paperCards = summary.papers.map((paper) => `<tr><td style="padding:10px 12px;border-bottom:1px solid #d9eaf1;color:#344568;font-size:13px">${escapeHtml(paper.title)}${paper.detail ? `<br><span style="color:#74829c;font-size:12px">${escapeHtml(paper.detail)}</span>` : ''}</td><td align="right" style="padding:10px 12px;border-bottom:1px solid #d9eaf1;color:#344568;font-size:13px;font-weight:700;white-space:nowrap">${formatBaht(paper.priceSatang)}</td></tr>`).join('');
  const statusLabel = rejected ? `ไม่อนุมัติใบสมัคร${rejectedReason ? ` · ${rejectedReason}` : ''}` : testMode ? approved ? 'TEST · อนุมัติการสมัครสอบแล้ว (ข้อมูลตัวอย่าง)' : 'อีเมลทดสอบ · ข้อมูลตัวอย่าง ไม่ใช่ใบสมัครจริง' : approved ? 'อนุมัติการสมัครสอบแล้ว' : schoolBatchName ? `สมัครผ่านโรงเรียน ${schoolBatchName} · รอตรวจสอบการชำระเงิน` : 'ได้รับใบสมัครแล้ว · รอเจ้าหน้าที่ตรวจสอบสลิป';
  const emailTypeLabel = rejected ? 'APPLICATION REJECTED' : approved ? `APPLICATION APPROVED${testMode ? ' · TEST' : ''}` : 'REGISTRATION SUMMARY';
  const emailTitle = rejected ? 'ใบสมัครไม่ผ่านการอนุมัติ' : approved ? `อนุมัติการสมัครสอบแล้ว${testMode ? ' · อีเมลทดสอบ' : ''}` : 'สรุปข้อมูลการสมัครสอบ';
  const html = `<!doctype html>
<html lang="th">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(emailTitle)} · OCEC Portal</title>
</head>
<body style="margin:0;padding:24px 10px;background:#f3f4fb;font-family:Arial,'Noto Sans Thai',Tahoma,sans-serif;color:#29345f">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e3e6f1;border-radius:16px;overflow:hidden">
          <tr><td height="6" style="height:6px;background:#6158b4;border-top:3px solid #e9568c;border-bottom:3px solid #f5ac36;font-size:0;line-height:0">&nbsp;</td></tr>
          <tr>
            <td style="padding:25px 30px 20px">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size:22px;font-weight:800;letter-spacing:.2px;color:#302b70">OCEC <span style="color:#e9568c">Portal</span></div>
                    <div style="margin-top:3px;color:#77819e;font-size:12px">ระบบสมัครสอบ · OCEC Thailand</div>
                  </td>
                  <td align="right" style="color:#f0a337;font-size:12px;font-weight:700">${emailTypeLabel}</td>
                </tr>
              </table>
              <div style="margin-top:22px;padding:15px 16px;border-radius:10px;background:#f3f1ff">
                <div style="font-size:19px;font-weight:750;color:#29345f">${emailTitle}</div>
                <div style="margin-top:5px;font-size:13px;color:#66718e">เลขที่ใบสมัคร <strong style="color:#5147a5">${escapeHtml(summary.id)}</strong></div>
                <div style="margin-top:10px;display:inline-block;padding:6px 10px;border-radius:20px;background:#fff2dc;color:#8c5913;font-size:12px;font-weight:700">${escapeHtml(statusLabel)}</div>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 22px">
              ${rejectedReason ? `<div style="margin-bottom:18px;padding:13px 15px;border:1px solid #f1c8d0;border-radius:9px;background:#fff5f6;color:#8a3043;font-size:14px;line-height:1.7"><strong>เหตุผลที่ไม่อนุมัติ</strong><br>${escapeHtml(rejectedReason)}</div>` : ''}
              <div style="padding-bottom:9px;border-bottom:1px solid #e8eaf2;color:#302b70;font-size:15px;font-weight:750">ข้อมูลผู้สมัคร</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding-top:8px">
                ${approved ? [detailRow('Student Name (English)', nameEn), detailRow('ชื่อ - สกุล (ภาษาไทย)', nameTh), detailRow('School Name', summary.applicant.schoolName)].join('') : [detailRow('Student Name (English)', nameEn), detailRow('ชื่อ - สกุล (ภาษาไทย)', nameTh), detailRow('Gender / เพศ', genderLabels[summary.applicant.gender] || summary.applicant.gender || '—'), detailRow('Date of Birth', displayDate(summary.applicant.dateOfBirth)), detailRow('School Name', summary.applicant.schoolName), detailRow('Email', summary.applicant.email), detailRow('เบอร์โทรศัพท์', summary.applicant.phone), detailRow('Address / ที่อยู่', address)].join('')}
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 30px 22px">
              <div style="padding-bottom:9px;border-bottom:1px solid #e8eaf2;color:#302b70;font-size:15px;font-weight:750">รายการสอบ</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px">
                ${examCards || '<tr><td style="color:#75809a;font-size:13px">ไม่มีรายการสอบ</td></tr>'}
              </table>
            </td>
          </tr>
          ${summary.papers.length && !approved ? `
          <tr>
            <td style="padding:0 30px 22px">
              <div style="padding-bottom:9px;border-bottom:1px solid #e8eaf2;color:#302b70;font-size:15px;font-weight:750">ข้อสอบเก่าที่เลือก</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px;border:1px solid #d9eaf1;border-radius:10px;background:#f2faff;overflow:hidden">
                ${paperCards}
              </table>
            </td>
          </tr>` : ''}
          <tr>
            <td style="padding:0 30px 26px">
              ${approved ? `
              <div style="padding-top:14px;border-top:1px solid #e6e8f0;color:#302b70;font-size:15px;font-weight:750">ช่องทางแก้ไขข้อมูล</div>
              <div style="margin-top:7px;color:#7b849c;font-size:12px;line-height:1.7">หากต้องการแก้ไขข้อมูลผู้สมัคร เลือกช่องทางที่ตรงกับการสมัครของคุณ</div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px">
                <tr><td style="padding-bottom:9px">${testMode ? '<span style="display:block;padding:13px 16px;border-radius:9px;background:#302b70;color:#ffffff;text-align:center;font-size:14px;font-weight:700">ตัวอย่างปุ่ม: แก้ไขข้อมูลผ่านบัญชีผู้สมัคร</span>' : `<a href="${escapeHtml(portalUrl(`/applications/${encodeURIComponent(summary.id)}/edit`))}" style="display:block;padding:13px 16px;border-radius:9px;background:#302b70;color:#ffffff;text-align:center;text-decoration:none;font-size:14px;font-weight:700">แก้ไขข้อมูลผ่านบัญชีผู้สมัคร</a>`}</td></tr>
                <tr><td>${testMode ? '<span style="display:block;padding:12px 16px;border:1px solid #d8d5f2;border-radius:9px;background:#ffffff;color:#5147a5;text-align:center;font-size:14px;font-weight:700">ตัวอย่างปุ่ม: ไม่มีบัญชี? ค้นหาสถานะเพื่อแก้ไข</span>' : `<a href="${escapeHtml(portalUrl('/status'))}" style="display:block;padding:12px 16px;border:1px solid #d8d5f2;border-radius:9px;background:#ffffff;color:#5147a5;text-align:center;text-decoration:none;font-size:14px;font-weight:700">ไม่มีบัญชี? ค้นหาสถานะเพื่อแก้ไข</a>`}</td></tr>
              </table>
              <div style="margin-top:13px;color:#7b849c;font-size:12px;line-height:1.7">${testMode ? 'อีเมลนี้ใช้ทดสอบรูปแบบเท่านั้น ปุ่มตัวอย่างไม่เชื่อมต่อไปยังใบสมัครจริง' : 'ผู้ไม่มีบัญชีให้ค้นหาสถานะใบสมัคร แล้วเลือกแก้ไขข้อมูลเพื่อยืนยันตัวตน'}</div>` : `
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #e6e8f0">
                <tr>
                  <td style="padding:12px 0;color:#687594;font-size:13px">ค่าสมัครรวม</td>
                  <td align="right" style="padding:12px 0;color:#344568;font-size:14px;font-weight:700">${formatBaht(summary.registrationTotalSatang)}</td>
                </tr>
                ${summary.papers.length ? `<tr>
                  <td style="padding:0 0 12px;color:#687594;font-size:13px">ข้อสอบเก่ารวม</td>
                  <td align="right" style="padding:0 0 12px;color:#344568;font-size:14px;font-weight:700">${formatBaht(summary.paperTotalSatang)}</td>
                </tr>` : ''}
                <tr>
                  <td style="padding:13px 14px;border-radius:9px 0 0 9px;background:#f3f1ff;color:#5147a5;font-size:15px;font-weight:750">ยอดรวม</td>
                  <td align="right" style="padding:13px 14px;border-radius:0 9px 9px 0;background:#f3f1ff;color:#5147a5;font-size:20px;font-weight:800">${formatBaht(summary.totalSatang)}</td>
                </tr>
              </table>
              <div style="margin-top:20px;text-align:center">
                ${testMode ? '<span style="display:inline-block;padding:12px 22px;border-radius:8px;background:#302b70;color:#ffffff;font-size:14px;font-weight:700">ตัวอย่างปุ่มติดตามใบสมัคร</span>' : `<a href="${escapeHtml(portalUrl('/applications'))}" style="display:inline-block;padding:12px 22px;border-radius:8px;background:#302b70;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">ติดตามใบสมัคร</a>`}
              </div>
              <div style="margin-top:16px;color:#7b849c;font-size:12px;line-height:1.7;text-align:center">${testMode ? 'อีเมลนี้จัดส่งเพื่อทดสอบรูปแบบเท่านั้น ไม่ได้สร้างหรือเปลี่ยนแปลงใบสมัครใด ๆ' : 'ระบบได้รับข้อมูลใบสมัครของคุณแล้ว หากพบปัญหาเกี่ยวกับข้อมูล กรุณาติดต่อเจ้าหน้าที่ OCEC Thailand'}</div>`}
            </td>
          </tr>
          <tr>
            <td style="padding:15px 30px;background:#fafaff;border-top:1px solid #eceef5;color:#8790a8;font-size:11px;text-align:center">OCEC Portal · ระบบสมัครสอบ OCEC Thailand</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  return { text, html };
}

export function slipIssueEmail({ applicationId, applications = [], schoolBatchName = '', affectedApplications = 1, reason, replacementUrl = '', testMode = false }) {
  const targetLabel = schoolBatchName ? `บิลสมัครของโรงเรียน ${schoolBatchName}` : `ใบสมัคร ${applicationId}`;
  const applicationLines = applications.map((application, index) => {
    const applicantName = [application.applicant?.firstNameEn, application.applicant?.middleNameEn, application.applicant?.lastNameEn].filter(Boolean).join(' ') || '—';
    const exams = (application.items || []).map((item) => `  • ${item.competition}${item.short ? ` (${item.short})` : ''} · ${item.round}${item.year ? ` ${item.year}` : ''} · ${item.format}`).join('\n');
    return `${index + 1}. ใบสมัคร ${application.id} · ${applicantName}${exams ? `\n${exams}` : ''}`;
  });
  const text = [
    'OCEC Portal · แจ้งให้แก้ไขสลิปชำระเงิน',
    testMode ? 'อีเมลทดสอบระบบ · ข้อมูลตัวอย่าง (ไม่มีผลกับใบสมัครจริง)' : targetLabel,
    schoolBatchName ? `จำนวนใบสมัครที่ได้รับผล: ${affectedApplications} ใบ` : '',
    '',
    `เหตุผล: ${reason || 'ต้องตรวจสอบสลิป'}`,
    ...(applicationLines.length ? ['', 'รายการที่เกี่ยวข้อง', ...applicationLines] : []),
    '',
    testMode ? 'ปุ่มส่งสลิปใหม่เป็นตัวอย่างและไม่มีลิงก์ใช้งานจริง' : `ส่งสลิปใหม่ได้หนึ่งครั้งภายใน 3 วัน: ${replacementUrl}`,
    schoolBatchName ? 'ลิงก์นี้ใช้แทนสลิปของทั้งชุด ใบสมัครที่อนุมัติแล้วจะคงสถานะเดิม' : '',
    testMode ? 'อีเมลนี้จัดส่งเพื่อทดสอบรูปแบบเท่านั้น ไม่ได้สร้างหรือเปลี่ยนแปลงใบสมัครใด ๆ' : 'หากลิงก์หมดอายุหรือพบปัญหา กรุณาติดต่อเจ้าหน้าที่ OCEC Thailand',
  ].filter((line) => line !== '').join('\n');

  const examRows = applications.map((application) => {
    const applicantName = [application.applicant?.firstNameEn, application.applicant?.middleNameEn, application.applicant?.lastNameEn].filter(Boolean).join(' ') || '—';
    const items = (application.items || []).map((item) => `<div style="padding:7px 0;border-top:1px solid #e9ebf2;color:#424e73;font-size:13px;line-height:1.6"><strong>${escapeHtml(item.competition)}${item.short ? ` (${escapeHtml(item.short)})` : ''}</strong><br>${escapeHtml(item.round)}${item.year ? ` · ${escapeHtml(item.year)}` : ''} · ${escapeHtml(item.format)}${item.center ? ` · ${escapeHtml(item.center)}` : ''}</div>`).join('');
    return `<tr><td style="padding:12px 14px;border:1px solid #e4e7f2;border-radius:9px;background:#fafaff"><div style="color:#29345f;font-size:14px;font-weight:700">${escapeHtml(application.id)} · ${escapeHtml(applicantName)}</div>${items}</td></tr>`;
  }).join('<tr><td height="9" style="height:9px;font-size:0">&nbsp;</td></tr>');
  const issueAction = testMode
    ? '<span style="display:inline-block;padding:13px 22px;border-radius:8px;background:#302b70;color:#ffffff;font-size:14px;font-weight:700">ตัวอย่างปุ่มส่งสลิปใหม่</span>'
    : `<a href="${escapeHtml(replacementUrl)}" style="display:inline-block;padding:13px 22px;border-radius:8px;background:#302b70;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700">ส่งสลิปใหม่</a>`;
  const html = `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>แจ้งให้แก้ไขสลิป OCEC</title></head>
<body style="margin:0;padding:24px 10px;background:#f3f4fb;font-family:Arial,'Noto Sans Thai',Tahoma,sans-serif;color:#29345f">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
    <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #e3e6f1;border-radius:16px;overflow:hidden">
      <tr><td height="6" style="height:6px;background:#6158b4;border-top:3px solid #e9568c;border-bottom:3px solid #f5ac36;font-size:0;line-height:0">&nbsp;</td></tr>
      <tr><td style="padding:25px 30px 20px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td><div style="font-size:22px;font-weight:800;letter-spacing:.2px;color:#302b70">OCEC <span style="color:#e9568c">Portal</span></div><div style="margin-top:3px;color:#77819e;font-size:12px">ระบบสมัครสอบ · OCEC Thailand</div></td><td align="right" style="color:#f0a337;font-size:12px;font-weight:700">PAYMENT SLIP UPDATE${testMode ? ' · TEST' : ''}</td></tr></table>
        <div style="margin-top:22px;padding:16px;border:1px solid #f2d9ac;border-radius:10px;background:#fff9ed"><div style="font-size:19px;font-weight:750;color:#7d5015">กรุณาแก้ไขสลิปชำระเงิน</div><div style="margin-top:6px;color:#765d3d;font-size:13px;line-height:1.7">${testMode ? 'อีเมลทดสอบ · ข้อมูลตัวอย่าง ไม่มีผลกับใบสมัครจริง' : escapeHtml(targetLabel)}${schoolBatchName ? `<br>ใบสมัครที่ได้รับผล ${Number(affectedApplications) || 1} ใบ` : ''}</div></div>
      </td></tr>
      <tr><td style="padding:0 30px 22px"><div style="padding:13px 15px;border-radius:9px;background:#fff9ed;color:#704b1b;font-size:14px;line-height:1.7"><strong>เหตุผลที่ต้องแก้ไข</strong><br>${escapeHtml(reason || 'ต้องตรวจสอบสลิป')}</div>
        ${examRows ? `<div style="margin-top:18px;padding-bottom:8px;border-bottom:1px solid #e8eaf2;color:#302b70;font-size:15px;font-weight:750">ข้อมูลใบสมัครที่เกี่ยวข้อง</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:11px">${examRows}</table>` : ''}
      </td></tr>
      <tr><td align="center" style="padding:0 30px 26px">${issueAction}<div style="margin-top:12px;color:#7b849c;font-size:12px;line-height:1.7">${testMode ? 'ตัวอย่างปุ่มนี้ไม่มีลิงก์ใช้งานจริง และอีเมลนี้ไม่เปลี่ยนแปลงใบสมัครใด ๆ' : 'ลิงก์นี้ใช้ส่งสลิปใหม่ได้หนึ่งครั้งภายใน 3 วัน'}${schoolBatchName && !testMode ? '<br>ลิงก์นี้ใช้แทนสลิปของทั้งชุด ใบสมัครที่อนุมัติแล้วจะคงสถานะเดิม' : ''}</div></td></tr>
      <tr><td style="padding:15px 30px;background:#fafaff;border-top:1px solid #eceef5;color:#8790a8;font-size:11px;text-align:center">OCEC Portal · ระบบสมัครสอบ OCEC Thailand</td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  return { text, html };
}

function invalid(message, statusCode = 400, extra = {}) {
  const error = new Error(message);
  error.statusCode = statusCode;
  Object.assign(error, extra);
  return error;
}

async function resolveDraft(client, candidate, ownerId, finalGrantToken = null) {
  const itemIds = candidate.items.map((item) => item.roundId);
  if (new Set(itemIds).size !== itemIds.length) throw invalid('An exam round can only appear once per application');
  const centerIds = [...new Set(candidate.items.map((item) => item.centerId))];
  const paperCenterIds = new Set(candidate.items.filter((item) => item.format === 'paper').map((item) => item.centerId));
  if (paperCenterIds.size > 1) throw invalid('All paper-based exams for one applicant must use the same exam center');
  const result = await client.query(`SELECT r.*, c.short_name, c.name AS competition_name, c.subject AS competition_subject, g.id AS grade_id, g.label AS grade_label,
    ec.id AS center_id, ec.code AS center_code, ec.name AS center_name
    FROM exam_rounds r
    JOIN competitions c ON c.id=r.competition_id
    JOIN exam_round_grades rg ON rg.exam_round_id=r.id
    JOIN grade_catalog g ON g.id=rg.grade_id AND g.active=true
    JOIN exam_centers ec ON ec.id=ANY($2::text[]) AND ec.active=true
    WHERE r.id=ANY($1::text[]) AND g.id=ANY($3::text[])`, [itemIds, centerIds, candidate.items.map((item) => item.gradeId)]);
  const resolved = [];
  let roundKey = '';
  const todayResult = await client.query("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today");
  const today = dateOnly(todayResult.rows[0].today);
  for (const item of candidate.items) {
    const round = result.rows.find((row) => row.id === item.roundId && row.grade_id === item.gradeId && row.center_id === item.centerId);
    if (!round) throw invalid(`Exam round or grade unavailable: ${item.roundId}`);
    const nextRoundKey = `${round.year}::${round.round_type}`;
    if (roundKey && roundKey !== nextRoundKey) throw invalid('One application can only contain items from the same academic year and exam round');
    roundKey = nextRoundKey;
    if (!round.active || round.final_manually_closed) throw invalid(`Exam round is closed: ${item.roundId}`);
    const openDate = dateOnly(round.open_date);
    const closeDate = dateOnly(round.close_date);
    if (!openDate || !closeDate || today < openDate || today > closeDate) throw invalid(`Exam round is outside registration dates: ${item.roundId}`);
    if (item.format === 'online') {
      if (round.center_code !== '500' || !item.examEmail) throw invalid('Online exams require center 500 and an exam email');
    } else {
      if (round.center_code === '500') throw invalid('Paper exams require an onsite center');
      const enabled = await client.query('SELECT 1 FROM exam_round_centers WHERE exam_round_id=$1 AND center_id=$2', [item.roundId, item.centerId]);
      if (!enabled.rowCount) throw invalid(`Exam center is not open for ${item.roundId}`);
    }
    let finalInvitationId = null;
    let finalGrantId = null;
    if (round.round_type === 'FINAL') {
      if (!candidate.sourceHeatApplicationId) throw invalid('Final registration requires an eligible Heat application', 403);
      const invitation = await client.query(`SELECT fi.id,fg.id AS grant_id FROM final_invitations fi
        JOIN application_items heat_item ON heat_item.id=fi.heat_application_item_id
        JOIN applications heat_application ON heat_application.id=heat_item.application_id
        JOIN exam_rounds heat_round ON heat_round.id=heat_item.exam_round_id
        JOIN results res ON res.application_item_id=heat_item.id AND res.eligible_for_final=true AND res.published_at IS NOT NULL
        LEFT JOIN final_verification_grants fg ON fg.final_invitation_id=fi.id
          AND fg.heat_application_id=heat_application.id AND fg.heat_application_item_id=heat_item.id
          AND fg.token_hash=$6 AND fg.verified_user_id=$3
          AND fg.expires_at>now() AND fg.claimed_at IS NULL
        WHERE fi.final_exam_round_id=$1 AND heat_application.id=$2
          AND ((heat_application.source='self' AND heat_application.owner_user_id=$3)
            OR (heat_application.source='school' AND fg.id IS NOT NULL))
          AND heat_round.competition_id=$4 AND heat_item.grade_id=$5 AND fi.claimed_application_id IS NULL
        LIMIT 1 FOR UPDATE OF fi`, [item.roundId, candidate.sourceHeatApplicationId, ownerId, round.competition_id, item.gradeId, finalGrantHash(finalGrantToken)]);
      if (!invitation.rowCount) throw invalid('This Heat application is not eligible for this Final round', 403);
      finalInvitationId = invitation.rows[0].id;
      finalGrantId = invitation.rows[0].grant_id;
    }
    const key = duplicateKey(candidate.applicant, item.roundId);
    const duplicate = await client.query(`SELECT ai.application_id, a.owner_user_id FROM application_items ai
      JOIN applications a ON a.id=ai.application_id WHERE ai.duplicate_key=$1`, [key]);
    if (duplicate.rowCount) throw invalid('Duplicate application', 409, { existingApplicationId: duplicate.rows[0].owner_user_id === ownerId ? duplicate.rows[0].application_id : null });
    const fee = item.format === 'online' ? round.online_price_satang : round.paper_price_satang;
    resolved.push({ input: item, round, fee, key, finalInvitationId, finalGrantId });
  }
  const paperIds = candidate.pastPaperIds || [];
  if (new Set(paperIds).size !== paperIds.length) throw invalid('Past paper selected twice');
  const papers = paperIds.length ? await client.query('SELECT * FROM past_papers WHERE id=ANY($1::text[]) AND active=true AND archived=false', [paperIds]) : { rows: [] };
  if (papers.rows.length !== paperIds.length) throw invalid('Past paper unavailable');
  const competitionIds = new Set(resolved.map(({ round }) => round.competition_id));
  if (papers.rows.some((paper) => paper.competition_id && !competitionIds.has(paper.competition_id))) throw invalid('Past paper does not match a selected competition');
  return { items: resolved, papers: papers.rows };
}

async function insertDraft(client, candidate, ownerId, source, batchId = null, status = 'draft', finalGrantToken = null) {
  const { items, papers } = await resolveDraft(client, candidate, ownerId, finalGrantToken);
  if (status !== 'draft' && items.some(({ round }) => round.round_type === 'FINAL') && source !== 'final') throw invalid('Final registration requires the Final flow', 403);
  if (items.some(({ finalGrantId }) => finalGrantId) && items.length !== 1) throw invalid('Verify each school Final exam separately', 403);
  const p = candidate.applicant;
  const applicant = await client.query(`INSERT INTO applicants(first_name_en,middle_name_en,last_name_en,first_name_th,last_name_th,date_of_birth,school_name,contact_email,contact_phone,address,gender,certificate_school_name)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [p.firstNameEn.trim(), p.middleNameEn?.trim() || '', p.lastNameEn.trim(), p.firstNameTh || null, p.lastNameTh || null, p.dateOfBirth, p.schoolName.trim(), p.contactEmail.trim(), p.contactPhone.trim(), p.address || {}, p.gender || null, p.certificateSchoolName?.trim() || null]);
  const registration = items.reduce((sum, item) => sum + item.fee, 0);
  const paperTotal = papers.reduce((sum, paper) => sum + paper.price_satang, 0);
  const application = await client.query(`INSERT INTO applications(applicant_id,owner_user_id,school_batch_id,source,status,registration_total_satang,paper_total_satang,source_heat_application_id,marketing_consent)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [applicant.rows[0].id, ownerId, batchId, source, status, registration, paperTotal, candidate.sourceHeatApplicationId || null, Boolean(candidate.marketingConsent)]);
  for (const { input, round, fee, key, finalInvitationId, finalGrantId } of items) {
    const snapshot = { competitionId: round.competition_id, competition: round.competition_name, short: round.short_name, roundId: round.id, roundTitle: round.title, year: round.year, grade: round.grade_label, center: { id: round.center_id, code: round.center_code, name: round.center_name }, format: input.format, fee: money(fee) };
    await client.query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,online_exam_email,fee_satang,snapshot,duplicate_key)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [application.rows[0].id, input.roundId, input.gradeId, input.format, input.centerId, input.format === 'online' ? input.examEmail : null, fee, snapshot, key]);
    if (finalInvitationId && status !== 'draft') {
      const claimed = await client.query('UPDATE final_invitations SET claimed_application_id=$1 WHERE id=$2 AND claimed_application_id IS NULL', [application.rows[0].id, finalInvitationId]);
      if (!claimed.rowCount) throw invalid('Final eligibility was already used by another application', 409);
      if (finalGrantId) {
        const consumed = await client.query(`UPDATE final_verification_grants SET claimed_at=now()
          WHERE id=$1 AND verified_user_id=$2 AND expires_at>now() AND claimed_at IS NULL RETURNING id`, [finalGrantId, ownerId]);
        if (!consumed.rowCount) throw invalid('Final verification expired or already used', 403);
      }
    }
  }
  for (const paper of papers) {
    await client.query('INSERT INTO application_past_papers(application_id,past_paper_id,price_satang,snapshot) VALUES($1,$2,$3,$4)', [application.rows[0].id, paper.id, paper.price_satang, { title: paper.title, detail: paper.detail, price: money(paper.price_satang) }]);
  }
  await client.query('INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data) VALUES($1,$2,$3,$4,$5)', [ownerId, 'application', application.rows[0].id, status === 'draft' ? 'create_draft' : 'submit', { source, registration: money(registration), papers: money(paperTotal), status }]);
  const driveFolders = [...new Set(items.map(({ round }) => `${round.short_name} - ${round.round_type === 'HEAT' ? 'HEAT ROUND' : round.round_type === 'FINAL' ? 'FINAL ROUND' : 'FINAL X'} ${round.year}`))];
  return {
    id: application.rows[0].id,
    total: money(registration + paperTotal),
    driveFolders,
    emailSummary: {
      id: application.rows[0].id,
      applicant: {
        firstNameEn: p.firstNameEn.trim(), middleNameEn: p.middleNameEn?.trim() || '', lastNameEn: p.lastNameEn.trim(),
        firstNameTh: p.firstNameTh || '', lastNameTh: p.lastNameTh || '', gender: p.gender || '', dateOfBirth: p.dateOfBirth,
        schoolName: p.schoolName.trim(), email: p.contactEmail.trim(), phone: p.contactPhone.trim(), address: p.address || {},
      },
      items: items.map(({ input, round, fee }) => ({
        competition: round.competition_name, short: round.short_name, subject: round.competition_subject,
        round: round.title, year: round.year, grade: round.grade_label,
        format: input.format === 'online' ? 'Online Exam' : 'Paper-Based', center: round.center_name,
        examEmail: input.format === 'online' ? input.examEmail : '', feeSatang: fee,
      })),
      papers: papers.map((paper) => ({ title: paper.title, detail: paper.detail, priceSatang: paper.price_satang })),
      registrationTotalSatang: registration,
      paperTotalSatang: paperTotal,
      totalSatang: registration + paperTotal,
    },
  };
}

export async function createIndividualDraft(candidate, ownerId, finalGrantToken = null) {
  try {
    const source = candidate.source === 'final' ? 'final' : 'self';
    const { emailSummary, ...draft } = await transaction((client) => insertDraft(client, candidate, ownerId, source, null, 'draft', finalGrantToken));
    return draft;
  }
  catch (error) { throw await clarifyDuplicate(error, [candidate], ownerId); }
}

export async function createSchoolDraft(batch, ownerId, coordinatorEmail) {
  try { return await transaction(async (client) => {
    const result = await client.query(`INSERT INTO school_batches(coordinator_user_id,coordinator_email,school_name,source,total_satang,status)
      VALUES($1,$2,$3,$4,0,'draft') RETURNING id`, [ownerId, coordinatorEmail, batch.schoolName, batch.source]);
    const applicationIds = [];
    let total = 0;
    for (const candidate of batch.applicants) {
      if (normalize(candidate.applicant.schoolName) !== normalize(batch.schoolName)) throw invalid('School name must be the same for all applicants in a batch');
      const draft = await insertDraft(client, candidate, ownerId, 'school', result.rows[0].id);
      applicationIds.push(draft.id);
      total += Math.round(draft.total * 100);
    }
    await client.query('UPDATE school_batches SET total_satang=$1 WHERE id=$2', [total, result.rows[0].id]);
    return { id: result.rows[0].id, applicationIds, total: money(total) };
  }); }
  catch (error) { throw await clarifyDuplicate(error, batch.applicants, ownerId); }
}

function parsePaymentSlip(slip) {
  if (!slip || typeof slip.dataBase64 !== 'string') throw invalid('A payment slip is required');
  const mimeType = String(slip.mimeType || '').toLowerCase();
  if (!['application/pdf', 'image/jpeg', 'image/png'].includes(mimeType)) throw invalid('Payment slip must be a PDF, JPG, or PNG file');
  const fileName = String(slip.fileName || 'payment-slip').replace(/^.*[\\/]/, '').replace(/[\r\n\x00]/g, '').trim().slice(0, 180) || 'payment-slip';
  const encoded = slip.dataBase64.replace(/^data:[^,]+,/, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw invalid('Payment slip data is invalid');
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw invalid('Payment slip must be no larger than 10 MB');
  const isPdf = mimeType === 'application/pdf' && buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const isJpeg = mimeType === 'image/jpeg' && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = mimeType === 'image/png' && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (!isPdf && !isJpeg && !isPng) throw invalid('Payment slip file content does not match its file type');
  return { buffer, fileName, mimeType, sha256: createHash('sha256').update(buffer).digest('hex') };
}

async function createPaymentWithSlip(client, { applicationId = null, batchId = null, expectedSatang, slip, ownerId }) {
  const folderLabel = [...new Set(slip.roundFolders || [])].sort().join(' + ').slice(0, 100) || 'Unassigned Exam Round';
  const driveFile = await uploadGoogleDriveFile({ category: 'slips', folders: [folderLabel], name: slip.fileName, mimeType: slip.mimeType, buffer: slip.buffer });
  try {
    const payment = await client.query(`INSERT INTO payments(application_id,school_batch_id,expected_satang,status)
      VALUES($1,$2,$3,'pending') RETURNING id`, [applicationId, batchId, expectedSatang]);
    await client.query(`INSERT INTO payment_slips(payment_id,drive_file_id,file_name,mime_type,sha256,uploaded_by)
      VALUES($1,$2,$3,$4,$5,$6)`, [payment.rows[0].id, driveFile.id, slip.fileName, slip.mimeType, slip.sha256, ownerId]);
    return { paymentId: payment.rows[0].id, driveFileId: driveFile.id };
  } catch (error) {
    await deleteGoogleDriveFile(driveFile.id).catch(() => {});
    throw error;
  }
}

export async function submitIndividualApplication(candidate, ownerId, finalGrantToken = null) {
  const slip = parsePaymentSlip(candidate.slip);
  let uploadedFileId = '';
  try {
    return await transaction(async (client) => {
      const source = candidate.source === 'final' ? 'final' : candidate.source === 'guest' ? 'guest' : 'self';
      const application = await insertDraft(client, candidate, ownerId, source, null, 'pending', finalGrantToken);
      const totalSatang = Math.round(application.total * 100);
      const payment = await createPaymentWithSlip(client, { applicationId: application.id, expectedSatang: totalSatang, slip: { ...slip, roundFolders: application.driveFolders }, ownerId });
      uploadedFileId = payment.driveFileId;
      const email = registrationEmail(application.emailSummary);
      await queueEmail(client, {
        to: candidate.applicant.contactEmail,
        subject: `OCEC | สรุปใบสมัครสอบ ${application.id}`,
        ...email,
      }, `application-submitted:${application.id}`, { sensitive: true });
      return { id: application.id, paymentId: payment.paymentId, total: application.total };
    });
  } catch (error) {
    if (uploadedFileId) await deleteGoogleDriveFile(uploadedFileId).catch(() => {});
    throw await clarifyDuplicate(error, [candidate], ownerId);
  }
}

export async function submitSchoolBatch(batch, ownerId, coordinatorEmail) {
  const slip = parsePaymentSlip(batch.slip);
  let uploadedFileId = '';
  try {
    return await transaction(async (client) => {
      const schoolBatch = await client.query(`INSERT INTO school_batches(coordinator_user_id,coordinator_email,school_name,source,total_satang,status)
        VALUES($1,$2,$3,$4,0,'pending') RETURNING id`, [ownerId, coordinatorEmail, batch.schoolName.trim(), batch.source]);
      const applicationIds = [];
      let totalSatang = 0;
      const roundFolders = new Set();
      for (const candidate of batch.applicants) {
        if (normalize(candidate.applicant.schoolName) !== normalize(batch.schoolName)) throw invalid('School name must be the same for all applicants in a batch');
        const application = await insertDraft(client, candidate, ownerId, 'school', schoolBatch.rows[0].id, 'pending');
        applicationIds.push(application.id);
        totalSatang += Math.round(application.total * 100);
        for (const folder of application.driveFolders) roundFolders.add(folder);
        const email = registrationEmail(application.emailSummary, { schoolBatchName: batch.schoolName.trim() });
        await queueEmail(client, {
          to: candidate.applicant.contactEmail,
          subject: `OCEC | สรุปใบสมัครสอบ ${application.id}`,
          ...email,
        }, `application-submitted:${application.id}`, { sensitive: true });
      }
      await client.query('UPDATE school_batches SET total_satang=$1 WHERE id=$2', [totalSatang, schoolBatch.rows[0].id]);
      const payment = await createPaymentWithSlip(client, { batchId: schoolBatch.rows[0].id, expectedSatang: totalSatang, slip: { ...slip, roundFolders: [...roundFolders] }, ownerId });
      uploadedFileId = payment.driveFileId;
      await client.query('INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data) VALUES($1,$2,$3,$4,$5)', [ownerId, 'school_batch', schoolBatch.rows[0].id, 'submit', { applicationIds, total: money(totalSatang), paymentId: payment.paymentId }]);
      return { id: schoolBatch.rows[0].id, applicationIds, paymentId: payment.paymentId, total: money(totalSatang) };
    });
  } catch (error) {
    if (uploadedFileId) await deleteGoogleDriveFile(uploadedFileId).catch(() => {});
    throw await clarifyDuplicate(error, batch.applicants, ownerId);
  }
}

async function loadReviewEmailApplications(client, applicationId, schoolBatchId = null) {
  const applications = await client.query(`SELECT a.id,ap.first_name_en,ap.middle_name_en,ap.last_name_en,ap.first_name_th,ap.last_name_th,
      ap.school_name,ap.contact_email,ap.contact_phone
    FROM applications a JOIN applicants ap ON ap.id=a.applicant_id
    WHERE ($2::uuid IS NOT NULL AND a.school_batch_id=$2 AND a.status='slip_issue') OR a.id=$1
    ORDER BY a.submitted_at,a.id`, [applicationId, schoolBatchId]);
  if (!applications.rowCount) return [];
  const itemRows = await client.query(`SELECT ai.application_id,ai.format,ai.online_exam_email,ai.fee_satang,
      r.title AS round_title,r.year,c.name AS competition_name,c.short_name,c.subject,g.label AS grade_label,ec.name AS center_name
    FROM application_items ai JOIN exam_rounds r ON r.id=ai.exam_round_id
    JOIN competitions c ON c.id=r.competition_id JOIN grade_catalog g ON g.id=ai.grade_id
    JOIN exam_centers ec ON ec.id=ai.center_id
    WHERE ai.application_id=ANY($1::uuid[]) ORDER BY r.year,r.title,c.name,ai.id`, [applications.rows.map((row) => row.id)]);
  return applications.rows.map((row) => ({
    id: row.id,
    applicant: {
      firstNameEn: row.first_name_en, middleNameEn: row.middle_name_en, lastNameEn: row.last_name_en,
      firstNameTh: row.first_name_th, lastNameTh: row.last_name_th, schoolName: row.school_name,
      email: row.contact_email, phone: row.contact_phone,
    },
    items: itemRows.rows.filter((item) => item.application_id === row.id).map((item) => ({
      competition: item.competition_name, short: item.short_name, subject: item.subject,
      round: item.round_title, year: item.year, grade: item.grade_label,
      format: item.format === 'online' ? 'Online Exam' : 'Paper-Based',
      center: item.center_name, examEmail: item.format === 'online' ? item.online_exam_email : '',
      feeSatang: item.fee_satang,
    })),
  }));
}

export async function reviewApplication(applicationId, review, adminUserId) {
  return transaction(async (client) => {
    const priorResult = await client.query(`SELECT a.*,ap.contact_email,ap.first_name_en,ap.middle_name_en,ap.last_name_en,
        ap.first_name_th,ap.last_name_th,ap.school_name AS applicant_school_name,
        sb.coordinator_email,sb.school_name AS batch_school_name
      FROM applications a JOIN applicants ap ON ap.id=a.applicant_id
      LEFT JOIN school_batches sb ON sb.id=a.school_batch_id
      WHERE a.id=$1 FOR UPDATE OF a`, [applicationId]);
    if (!priorResult.rowCount) throw invalid('Application not found', 404);
    const prior = priorResult.rows[0];
    if (review.decision === 'reject') {
      if (!['pending', 'slip_issue'].includes(prior.status)) throw invalid('Only applications awaiting review can be rejected', 409);
      const reason = String(review.reason || '').trim().slice(0, 240);
      const rejected = await client.query("UPDATE applications SET status='rejected',review_note=$1,version=version+1 WHERE id=$2 RETURNING version", [reason || null, applicationId]);
      await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
        VALUES($1,'application',$2,'reject',$3,$4)`, [adminUserId, applicationId, prior, { status: 'rejected', reviewNote: reason || null }]);
      const emailApplications = await loadReviewEmailApplications(client, applicationId);
      const applicant = emailApplications[0]?.applicant || {};
      const rejectionEmail = registrationEmail({
        id: applicationId,
        applicant: { ...applicant, firstNameEn: prior.first_name_en, middleNameEn: prior.middle_name_en,
          lastNameEn: prior.last_name_en, firstNameTh: prior.first_name_th, lastNameTh: prior.last_name_th,
          schoolName: prior.applicant_school_name },
        items: emailApplications[0]?.items || [], papers: [],
        registrationTotalSatang: Number(prior.registration_total_satang || 0),
        paperTotalSatang: Number(prior.paper_total_satang || 0), totalSatang: Number(prior.total_satang || 0),
      }, { rejectedApplication: true, rejectedReason: reason });
      await queueEmail(client, { to: prior.contact_email, subject: 'OCEC | แจ้งผลการพิจารณาใบสมัครสอบ', ...rejectionEmail },
        `application-rejected:${applicationId}:v${rejected.rows[0].version}`, { sensitive: true });
      return { id: applicationId, status: 'rejected', reason };
    }
    if (review.decision === 'slip_issue') {
      if (!['pending', 'slip_issue'].includes(prior.status)) throw invalid('Only pending applications can be marked with a slip issue', 409);
      const note = String(review.reason || '').trim().slice(0, 240) || 'ต้องตรวจสอบสลิป';
      const paymentResult = await client.query(`SELECT * FROM payments WHERE (application_id=$1 OR ($2::uuid IS NOT NULL AND school_batch_id=$2))
        AND ($3::uuid IS NULL OR id=$3) ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [applicationId, prior.school_batch_id, review.paymentId || null]);
      if (!paymentResult.rowCount) throw invalid('Payment record not found', 409);
      const payment = paymentResult.rows[0];
      if (prior.school_batch_id) {
        const pendingBatchApplications = await client.query("SELECT id,status,review_note FROM applications WHERE school_batch_id=$1 AND status IN ('pending','slip_issue') FOR UPDATE", [prior.school_batch_id]);
        await client.query("UPDATE applications SET status='slip_issue',review_note=$1,version=version+1 WHERE school_batch_id=$2 AND status IN ('pending','slip_issue')", [note, prior.school_batch_id]);
        for (const batchApplication of pendingBatchApplications.rows) {
          await client.query('INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)', [adminUserId, 'application', batchApplication.id, 'mark_slip_issue', { status: batchApplication.status, reviewNote: batchApplication.review_note }, { status: 'slip_issue', reviewNote: note }]);
        }
      } else {
        await client.query("UPDATE applications SET status='slip_issue',review_note=$1,version=version+1 WHERE id=$2", [note, applicationId]);
        await client.query('INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)', [adminUserId, 'application', applicationId, 'mark_slip_issue', prior, { status: 'slip_issue', reviewNote: note }]);
      }
      await client.query("UPDATE payments SET status='slip_issue' WHERE id=$1", [payment.id]);
      if (prior.school_batch_id) await client.query("UPDATE school_batches SET status='slip_issue' WHERE id=$1", [prior.school_batch_id]);
      const token = randomBytes(32).toString('base64url');
      await client.query(`UPDATE slip_replacement_tokens SET used_at=coalesce(used_at,now()),revoked_at=now()
        WHERE payment_id=$1 AND used_at IS NULL AND revoked_at IS NULL`, [payment.id]);
      await client.query(`INSERT INTO slip_replacement_tokens(token_hash,payment_id,recipient_email,expires_at)
        VALUES($1,$2,$3,now()+interval '3 days')`, [hashToken(token), payment.id, prior.school_batch_id ? prior.coordinator_email : prior.contact_email]);
      const replacementUrl = portalUrl(`/slip-replacement?token=${encodeURIComponent(token)}`);
      const recipient = prior.school_batch_id ? prior.coordinator_email : prior.contact_email;
      const relatedApplications = await loadReviewEmailApplications(client, applicationId, prior.school_batch_id);
      const slipEmail = slipIssueEmail({
        applicationId,
        applications: relatedApplications,
        schoolBatchName: prior.batch_school_name || '',
        affectedApplications: relatedApplications.length || 1,
        reason: note,
        replacementUrl,
      });
      await queueEmail(client, {
        to: recipient,
        subject: `OCEC | กรุณาแก้ไขสลิปชำระเงิน ${prior.school_batch_id ? prior.batch_school_name : applicationId}`,
        ...slipEmail,
      }, `slip-replacement:${payment.id}:${hashToken(token)}`, { sensitive: true });
      return { id: applicationId, paymentId: payment.id, status: 'slip_issue', reviewNote: note, emailRecipient: prior.school_batch_id ? 'coordinator' : 'applicant' };
    }
    if (review.decision !== 'approve') throw invalid('Unsupported review decision');
    if (!['pending','approved'].includes(prior.status)) throw invalid('Application is not awaiting review or is blocked by a slip issue', 409);
    const paymentResult = await client.query(`SELECT * FROM payments WHERE (application_id=$1 OR ($2::uuid IS NOT NULL AND school_batch_id=$2))
      AND ($3::uuid IS NULL OR id=$3) ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [applicationId, prior.school_batch_id, review.paymentId || null]);
    if (!paymentResult.rowCount) throw invalid('Payment record not found', 409);
    const payment = paymentResult.rows[0];
    const slipResult = await client.query('SELECT 1 FROM payment_slips WHERE payment_id=$1 LIMIT 1', [payment.id]);
    if (!slipResult.rowCount) throw invalid('Payment slip not found', 409);
    if (prior.status === 'approved') {
      if (payment.status !== 'pending') throw invalid('ไม่พบรายการชำระเงินที่อยู่ระหว่างตรวจสอบ', 409);
      await client.query("UPDATE payments SET payment_account_id=NULL,confirmed_satang=NULL,confirmed_transfer_at=NULL,confirmed_account_number=NULL,confirmed_by=$1,confirmed_at=now(),status='confirmed' WHERE id=$2", [adminUserId,payment.id]);
      await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
        VALUES($1,'payment',$2,'confirm_additional_payment',$3,$4)`, [adminUserId,payment.id,{ status: payment.status, expectedSatang: payment.expected_satang },{ status: 'confirmed', applicationId }]);
      return { id: applicationId, status: 'approved', paymentId: payment.id, paymentOnly: true };
    }
    if (payment.status === 'slip_issue') throw invalid('โปรดรอหลักฐานการชำระเงินฉบับใหม่ก่อนอนุมัติใบสมัคร', 409);
    if (payment.status !== 'confirmed') {
      await client.query("UPDATE payments SET payment_account_id=NULL,confirmed_satang=NULL,confirmed_transfer_at=NULL,confirmed_account_number=NULL,confirmed_by=$1,confirmed_at=now(),status='confirmed' WHERE id=$2", [adminUserId, payment.id]);
    }
    const approved = await client.query("UPDATE applications SET status='approved',approved_by=$1,approved_at=now(),review_note=NULL,version=version+1 WHERE id=$2 RETURNING version", [adminUserId, applicationId]);
    if (prior.school_batch_id) {
      const state = await client.query(`SELECT count(*) AS total, count(*) FILTER (WHERE status='approved') AS approved
        FROM applications WHERE school_batch_id=$1`, [prior.school_batch_id]);
      const nextStatus = Number(state.rows[0].total) === Number(state.rows[0].approved) ? 'approved' : 'partially_approved';
      await client.query('UPDATE school_batches SET status=$1 WHERE id=$2', [nextStatus, prior.school_batch_id]);
    }
    await client.query('INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data) VALUES($1,$2,$3,$4,$5,$6)', [adminUserId, 'application', applicationId, 'approve', prior, { status: 'approved', paymentId: payment.id }]);
    const emailApplications = await loadReviewEmailApplications(client, applicationId);
    const emailApplicant = emailApplications[0]?.applicant || {};
    const emailItems = emailApplications[0]?.items || [];
    const emailSummary = {
      id: applicationId,
      applicant: {
        ...emailApplicant,
        firstNameEn: prior.first_name_en,
        middleNameEn: prior.middle_name_en,
        lastNameEn: prior.last_name_en,
        firstNameTh: prior.first_name_th,
        lastNameTh: prior.last_name_th,
        schoolName: prior.applicant_school_name,
      },
      items: emailItems,
      papers: [],
      registrationTotalSatang: Number(prior.registration_total_satang || 0),
      paperTotalSatang: Number(prior.paper_total_satang || 0),
      totalSatang: Number(prior.total_satang || 0),
    };
    const approvedEmail = registrationEmail(emailSummary, { approved: true });
    await queueEmail(client, {
      to: prior.contact_email,
      subject: 'OCEC | อนุมัติการสมัครสอบแล้ว',
      ...approvedEmail,
    }, `application-approved:${applicationId}`, { sensitive: true });
    const items = await client.query('SELECT id FROM application_items WHERE application_id=$1', [applicationId]);
    for (const item of items.rows) {
      await enqueueIntegrationJob(client, 'sheets.sync_item', { applicationItemId: item.id }, `sheets-item:${item.id}:v${approved.rows[0].version}`);
    }
    return { id: applicationId, status: 'approved', paymentId: payment.id };
  });
}

function dateOnly(value) {
  if (!value) return '';
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function adminAddress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw invalid('Address must be an object');
  const entries = Object.entries(input).map(([key, value]) => [String(key).slice(0, 80), String(value ?? '').trim()]).filter(([, value]) => value);
  if (entries.some(([, value]) => value.length > 255) || entries.length > 20) throw invalid('Address is too long');
  return Object.fromEntries(entries);
}

async function cancelExamNumber(client, item, applicationId, adminId, reason) {
  if (!item.exam_number) return null;
  await client.query(`INSERT INTO application_item_exam_number_history
    (application_id,application_item_id,exam_round_id,center_id,exam_number,reason,previous_data,canceled_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8)
    ON CONFLICT (exam_round_id,exam_number) DO NOTHING`, [applicationId, item.id, item.exam_round_id, item.center_id,
    item.exam_number, reason, { roundType: item.round_type, centerCode: item.center_code, gradeId: item.grade_id }, adminId]);
  return { applicationItemId: item.id, examNumber: item.exam_number, roundId: item.exam_round_id, centerId: item.center_id, reason };
}

async function assignNextHeatNumber(client, roundId, centerId) {
  const center = await client.query('SELECT code FROM exam_centers WHERE id=$1', [centerId]);
  if (!center.rowCount) throw invalid('Exam center not found', 409);
  const code = String(center.rows[0].code).trim();
  const used = await client.query(`SELECT ai.exam_number,ec.code FROM application_items ai JOIN exam_centers ec ON ec.id=ai.center_id
      WHERE ai.exam_round_id=$1 AND ai.exam_number IS NOT NULL
    UNION ALL
    SELECT h.exam_number,ec.code FROM application_item_exam_number_history h JOIN exam_centers ec ON ec.id=h.center_id
      WHERE h.exam_round_id=$1`, [roundId]);
  let maximum = 0;
  for (const row of used.rows) {
    const usedCode = String(row.code).trim();
    const number = String(row.exam_number || '');
    const suffix = Number.parseInt(number.slice(usedCode.length), 10);
    if (usedCode === code && number.startsWith(code) && Number.isFinite(suffix)) maximum = Math.max(maximum, suffix);
  }
  return `${code}${String(maximum + 1).padStart(4, '0')}`;
}

/** Admin-only edit path. Applicant profile APIs intentionally keep their existing approval and deadline checks. */
export async function updateAdminApplication(applicationId, input, adminUserId) {
  const paymentSlip = input.paymentSlip ? parsePaymentSlip(input.paymentSlip) : null;
  let uploadedDriveFileId = '';
  const deletedPhotoDriveIds = [];
  try {
    const outcome = await transaction(async (client) => {
      const found = await client.query(`SELECT a.*,ap.first_name_en,ap.middle_name_en,ap.last_name_en,ap.first_name_th,ap.last_name_th,ap.date_of_birth,
          ap.school_name,ap.contact_email,ap.contact_phone,ap.address,
          sb.school_name AS batch_school_name
        FROM applications a JOIN applicants ap ON ap.id=a.applicant_id
        LEFT JOIN school_batches sb ON sb.id=a.school_batch_id
        WHERE a.id=$1 FOR UPDATE OF a,ap`, [applicationId]);
      if (!found.rowCount) throw invalid('Application not found', 404);
      const application = found.rows[0];
      const currentItemsResult = await client.query(`SELECT ai.*,r.year,r.round_type,r.exam_date,r.competition_id,r.title AS round_title,
          c.short_name,c.name AS competition_name,c.subject,g.label AS grade_label,ec.code AS center_code,ec.name AS center_name
        FROM application_items ai JOIN exam_rounds r ON r.id=ai.exam_round_id JOIN competitions c ON c.id=r.competition_id
        JOIN grade_catalog g ON g.id=ai.grade_id JOIN exam_centers ec ON ec.id=ai.center_id
        WHERE ai.application_id=$1 ORDER BY ai.id FOR UPDATE OF ai`, [applicationId]);
      if (!currentItemsResult.rowCount) throw invalid('Application has no exam items', 409);
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['heat-exam-number-generation']);
      const todayResult = await client.query("SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS today");
      const today = dateOnly(todayResult.rows[0].today);
      const currentItems = currentItemsResult.rows;
      const currentById = new Map(currentItems.map((item) => [item.id, item]));
      const primaryRoundType = currentItems[0].round_type;
      const primaryYear = currentItems[0].year;

      const profileInput = input.profile || {};
      const nextProfile = {
        firstName: String(profileInput.firstNameEn ?? application.first_name_en).trim(),
        middleName: String(profileInput.middleNameEn ?? application.middle_name_en ?? '').trim(),
        lastName: String(profileInput.lastNameEn ?? application.last_name_en).trim(),
        thaiFirstName: String(profileInput.firstNameTh ?? application.first_name_th ?? '').trim(),
        thaiLastName: String(profileInput.lastNameTh ?? application.last_name_th ?? '').trim(),
        school: String(profileInput.schoolName ?? application.school_name).trim(),
        email: String(profileInput.contactEmail ?? application.contact_email).trim(),
        phone: String(profileInput.contactPhone ?? application.contact_phone).trim(),
        address: adminAddress(profileInput.address ?? application.address ?? {}),
      };
      if (!nextProfile.firstName || !nextProfile.lastName || !nextProfile.school || !nextProfile.email || !nextProfile.phone) throw invalid('โปรดกรอกชื่อ นามสกุล โรงเรียน อีเมล และหมายเลขโทรศัพท์');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextProfile.email)) throw invalid('รูปแบบอีเมลติดต่อไม่ถูกต้อง');
      if (nextProfile.phone.replace(/\D/g, '').length < 4) throw invalid('หมายเลขโทรศัพท์ต้องมีตัวเลขอย่างน้อย 4 หลัก');

      if (!Array.isArray(input.items) || input.items.length < 1 || input.items.length > 30) throw invalid('โปรดระบุรายการสอบอย่างน้อย 1 รายการ');
      const itemIds = input.items.map((item) => item.applicationItemId).filter(Boolean);
      const roundIds = input.items.map((item) => item.roundId);
      if (new Set(itemIds).size !== itemIds.length || new Set(roundIds).size !== roundIds.length) throw invalid('พบรายการสอบซ้ำกันในใบสมัคร');
      if (itemIds.some((id) => !currentById.has(id))) throw invalid('พบรายการสอบที่ไม่อยู่ในใบสมัครนี้', 403);

      const prepared = [];
      for (const itemInput of input.items) {
        const prior = itemInput.applicationItemId ? currentById.get(itemInput.applicationItemId) : null;
        const roundResult = await client.query(`SELECT r.*,c.short_name,c.name AS competition_name,c.subject,
            g.id AS selected_grade_id,g.label AS selected_grade_label,g.active AS selected_grade_active,
            ec.id AS selected_center_id,ec.code AS selected_center_code,ec.name AS selected_center_name,ec.active AS selected_center_active,
            EXISTS(SELECT 1 FROM exam_round_grades rg WHERE rg.exam_round_id=r.id AND rg.grade_id=g.id) AS grade_available,
            EXISTS(SELECT 1 FROM exam_round_centers rc WHERE rc.exam_round_id=r.id AND rc.center_id=ec.id) AS center_available
          FROM exam_rounds r JOIN competitions c ON c.id=r.competition_id
          JOIN grade_catalog g ON g.id=$2 JOIN exam_centers ec ON ec.id=$3
          WHERE r.id=$1`, [itemInput.roundId,itemInput.gradeId,itemInput.centerId]);
        if (!roundResult.rowCount) throw invalid(`ไม่พบรอบสอบ ระดับชั้น หรือศูนย์สอบของ ${itemInput.roundId}`);
        const round = roundResult.rows[0];
        if (round.round_type !== primaryRoundType || round.year !== primaryYear) throw invalid('รายการสอบในใบสมัครต้องอยู่ในปีการศึกษาและรอบสอบเดียวกัน');
        const retained = Boolean(prior && prior.exam_round_id === round.id);
        if (!retained && !round.active) throw invalid(`รอบสอบ ${round.title} ไม่เปิดให้เพิ่มในใบสมัคร`);
        const registrationOpen = Boolean(round.open_date && round.close_date && !round.final_manually_closed
          && dateOnly(round.open_date) <= today && today <= dateOnly(round.close_date));
        if (!retained && !registrationOpen) throw invalid(`รอบสอบ ${round.title} ปิดรับสมัครแล้ว จึงเพิ่มในใบสมัครไม่ได้`, 409);
        if (!retained && (!round.selected_grade_active || !round.selected_center_active)) throw invalid('ระดับชั้นหรือศูนย์สอบที่เลือกไม่ได้เปิดใช้งาน');
        const todayDate = round.exam_date ? dateOnly(round.exam_date) : '';
        const isPastSelectionLock = Boolean(todayDate && today >= todayDate);
        const isPastFormatLock = Boolean(todayDate && today > todayDate);
        if (!round.grade_available && !(retained && prior.grade_id === itemInput.gradeId)) throw invalid(`ระดับชั้นไม่เปิดใน ${round.title}`);
        const format = itemInput.format;
        if (!['paper','online'].includes(format)) throw invalid('รูปแบบการสอบไม่ถูกต้อง');
        if (format === 'online') {
          if (round.selected_center_code !== '500') throw invalid('การสอบรูปแบบ Online Exam ต้องเลือกศูนย์สอบ Online : Home Base');
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(itemInput.examEmail || '').trim())) throw invalid(`กรอกอีเมลเข้าสอบให้ถูกต้องสำหรับ ${round.short_name}`);
        } else {
          if (round.selected_center_code === '500') throw invalid('การสอบรูปแบบ Paper-Based ต้องเลือกศูนย์สอบที่กำหนด');
          const sameCenter = retained && prior.center_id === itemInput.centerId;
          if (!round.center_available && !sameCenter) throw invalid(`ศูนย์สอบนี้ไม่เปิดใน ${round.title}`);
        }
        const gradeChanged = retained && prior.grade_id !== itemInput.gradeId;
        const formatChanged = retained && prior.format !== format;
        const centerChanged = retained && prior.center_id !== itemInput.centerId;
        const emailChanged = retained && prior.format === format && String(prior.online_exam_email || '') !== String(format === 'online' ? itemInput.examEmail || '' : '');
        if (retained && gradeChanged && isPastSelectionLock) throw invalid(`ถึงวันสอบแล้ว จึงแก้ระดับชั้นของ ${round.short_name} ไม่ได้`, 409);
        if (retained && emailChanged && isPastSelectionLock) throw invalid(`ถึงวันสอบแล้ว จึงแก้อีเมลเข้าสอบของ ${round.short_name} ไม่ได้`, 409);
        if (retained && formatChanged && isPastFormatLock) throw invalid(`วันสอบของ ${round.short_name} ผ่านไปแล้ว จึงแก้รูปแบบสอบไม่ได้`, 409);
        if (retained && centerChanged && isPastSelectionLock && !formatChanged) throw invalid(`ถึงวันสอบแล้ว จึงแก้ศูนย์สอบของ ${round.short_name} ไม่ได้`, 409);
        if (!retained && isPastSelectionLock) throw invalid(`ถึงวันสอบแล้ว จึงเพิ่มหรือเปลี่ยนรายการ ${round.short_name} ไม่ได้`, 409);

        let finalInvitationId = null;
        if (round.round_type === 'FINAL') {
          if (!application.source_heat_application_id) throw invalid('ไม่พบใบสมัครรอบ HEAT ที่ใช้ยืนยันสิทธิ์สมัครรอบ FINAL', 403);
          const invitation = await client.query(`SELECT fi.id FROM final_invitations fi
            JOIN application_items heat_item ON heat_item.id=fi.heat_application_item_id
            JOIN applications heat_application ON heat_application.id=heat_item.application_id
            JOIN exam_rounds heat_round ON heat_round.id=heat_item.exam_round_id
            JOIN results res ON res.application_item_id=heat_item.id AND res.eligible_for_final=true
            WHERE fi.final_exam_round_id=$1 AND heat_application.id=$2
              AND heat_round.competition_id=$3 AND heat_item.grade_id=$4
              AND (fi.claimed_application_id IS NULL OR (fi.claimed_application_id=$5 AND $6::boolean))
            LIMIT 1 FOR UPDATE OF fi`, [round.id,application.source_heat_application_id,round.competition_id,itemInput.gradeId,
            applicationId,Boolean(retained && !gradeChanged)]);
          if (!invitation.rowCount) throw invalid(`ไม่พบสิทธิ์สมัคร FINAL สำหรับ ${round.short_name} ระดับ ${round.selected_grade_label}`, 403);
          finalInvitationId = invitation.rows[0].id;
        }

        const feeSatang = retained && prior.format === format
          ? Number(prior.fee_satang)
          : Number(format === 'online' ? round.online_price_satang : round.paper_price_satang);
        const center = { id: round.selected_center_id, code: round.selected_center_code, name: round.selected_center_name };
        const snapshot = {
          ...(retained && prior.snapshot && typeof prior.snapshot === 'object' ? prior.snapshot : {}),
          competitionId: round.competition_id, competition: round.competition_name, short: round.short_name,
          roundId: round.id, roundTitle: round.title, year: round.year, grade: round.selected_grade_label,
          center, format, fee: money(feeSatang),
        };
        const identity = {
          firstNameEn: nextProfile.firstName, middleNameEn: nextProfile.middleName, lastNameEn: nextProfile.lastName,
          dateOfBirth: dateOnly(application.date_of_birth), schoolName: nextProfile.school,
        };
        prepared.push({ input: itemInput, prior, retained, round, center, gradeId: itemInput.gradeId, gradeLabel: round.selected_grade_label,
          format, examEmail: format === 'online' ? String(itemInput.examEmail || '').trim() : null,
          feeSatang, snapshot, finalInvitationId, key: duplicateKey(identity, round.id), todayDate, isPastSelectionLock, isPastFormatLock,
          formatChanged, centerChanged, gradeChanged, emailChanged });
      }

      const retainedIds = new Set(prepared.filter((item) => item.retained).map((item) => item.prior.id));
      const removedItems = currentItems.filter((item) => !retainedIds.has(item.id));
      for (const item of removedItems) {
        const examDate = dateOnly(item.exam_date);
        if (examDate && today >= examDate) throw invalid(`ถึงวันสอบแล้ว จึงลบหรือเปลี่ยนรายการ ${item.short_name} ไม่ได้`, 409);
      }

      const editedItemIds = prepared.filter((item) => item.retained && (item.gradeChanged || item.formatChanged || item.centerChanged || item.emailChanged || item.feeSatang !== Number(item.prior.fee_satang))).map((item) => item.prior.id);
      const protectedItemIds = [...new Set([...removedItems.map((item) => item.id), ...editedItemIds])];
      const results = protectedItemIds.length ? await client.query('SELECT application_item_id FROM results WHERE application_item_id=ANY($1::uuid[]) LIMIT 1', [protectedItemIds]) : { rowCount: 0 };
      if (results.rowCount) throw invalid('ไม่สามารถเปลี่ยนแปลงรายการสอบที่ประกาศผลแล้วได้', 409);

      const affectedApplications = application.school_batch_id
        ? await client.query(`SELECT a.id AS application_id,a.applicant_id,ap.first_name_en,ap.middle_name_en,ap.last_name_en,ap.date_of_birth,ap.school_name
            FROM applications a JOIN applicants ap ON ap.id=a.applicant_id WHERE a.school_batch_id=$1 ORDER BY a.id FOR UPDATE OF a,ap`, [application.school_batch_id])
        : { rows: [{ application_id: application.id, applicant_id: application.applicant_id, first_name_en: application.first_name_en,
          middle_name_en: application.middle_name_en, last_name_en: application.last_name_en, date_of_birth: application.date_of_birth, school_name: application.school_name }] };
      const affectedIds = affectedApplications.rows.map((row) => row.application_id);
      const predictedKeys = [];
      for (const sibling of affectedApplications.rows) {
        const isTarget = sibling.application_id === applicationId;
        const identity = {
          firstNameEn: isTarget ? nextProfile.firstName : sibling.first_name_en,
          middleNameEn: isTarget ? nextProfile.middleName : sibling.middle_name_en,
          lastNameEn: isTarget ? nextProfile.lastName : sibling.last_name_en,
          dateOfBirth: dateOnly(sibling.date_of_birth),
          schoolName: application.school_batch_id ? nextProfile.school : (isTarget ? nextProfile.school : sibling.school_name),
        };
        const roundsForSibling = isTarget ? prepared.map((item) => item.round.id) : (await client.query('SELECT exam_round_id FROM application_items WHERE application_id=$1', [sibling.application_id])).rows.map((row) => row.exam_round_id);
        predictedKeys.push(...roundsForSibling.map((roundId) => ({ applicationId: sibling.application_id, key: duplicateKey(identity, roundId) })));
      }
      const keys = predictedKeys.map((entry) => entry.key);
      if (new Set(keys).size !== keys.length) throw invalid('ข้อมูลนี้ทำให้เกิดใบสมัครซ้ำกัน', 409);
      const duplicateConflict = await client.query(`SELECT application_id FROM application_items
        WHERE duplicate_key=ANY($1::text[]) AND NOT (application_id=ANY($2::uuid[])) LIMIT 1`, [keys, affectedIds]);
      if (duplicateConflict.rowCount) throw invalid('ข้อมูลนี้ซ้ำกับใบสมัครอื่น', 409);

      const canceledNumbers = [];
      const deletedPhotoDriveIds = [];
      const deletedSheetRows = [];
      const removedIds = removedItems.map((item) => item.id);
      if (removedIds.length) {
        for (const item of removedItems) {
          const canceled = await cancelExamNumber(client, item, applicationId, adminUserId, 'application_item_replaced');
          if (canceled) canceledNumbers.push(canceled);
        }
        const claimedInvitations = await client.query('SELECT id FROM final_invitations WHERE heat_application_item_id=ANY($1::uuid[]) AND claimed_application_id IS NOT NULL LIMIT 1', [removedIds]);
        if (claimedInvitations.rowCount) throw invalid('รายการสอบนี้มีผู้สมัครยืนยันสิทธิ์รอบ Final แล้ว จึงเปลี่ยนรายการไม่ได้', 409);
        await client.query(`UPDATE result_import_rows ir SET application_item_id=NULL,match_status='unmatched',match_note='รายการสอบถูกเปลี่ยนโดยแอดมิน'
          FROM result_import_batches b WHERE b.id=ir.batch_id AND b.status='draft' AND ir.application_item_id=ANY($1::uuid[])`, [removedIds]);
        await client.query(`UPDATE final_id_import_rows SET application_item_id=NULL,match_status='unmatched',match_note='รายการสอบถูกเปลี่ยนโดยแอดมิน'
          WHERE application_item_id=ANY($1::uuid[])`, [removedIds]);
        await client.query('DELETE FROM final_invitations WHERE heat_application_item_id=ANY($1::uuid[])', [removedIds]);
        await client.query('UPDATE final_invitations SET claimed_application_id=NULL WHERE claimed_application_id=$1 AND final_exam_round_id=ANY($2::text[])', [applicationId, removedItems.filter((item) => item.round_type === 'FINAL').map((item) => item.exam_round_id)]);
        const photos = await client.query('SELECT drive_file_id FROM certificate_photos WHERE application_item_id=ANY($1::uuid[])', [removedIds]);
        deletedPhotoDriveIds.push(...photos.rows.map((row) => row.drive_file_id).filter(Boolean));
        await client.query('DELETE FROM certificate_photos WHERE application_item_id=ANY($1::uuid[])', [removedIds]);
        const sheetRows = await client.query('SELECT exam_round_id,spreadsheet_row FROM google_workspace_sheet_rows WHERE application_item_id=ANY($1::uuid[])', [removedIds]);
        deletedSheetRows.push(...sheetRows.rows);
        for (const row of sheetRows.rows) await enqueueIntegrationJob(client, 'sheets.clear_row', { examRoundId: row.exam_round_id, spreadsheetRow: row.spreadsheet_row }, `sheets-clear:${row.exam_round_id}:${row.spreadsheet_row}:${Date.now()}`);
        await client.query('DELETE FROM application_items WHERE id=ANY($1::uuid[])', [removedIds]);
      }
      await client.query("UPDATE application_items SET duplicate_key='admin-edit-'||id::text WHERE application_id=ANY($1::uuid[])", [affectedIds]);

      const profileChanges = [
        ['ชื่อภาษาอังกฤษ', application.first_name_en, nextProfile.firstName], ['นามสกุลภาษาอังกฤษ', application.last_name_en, nextProfile.lastName],
        ['ชื่อภาษาไทย', application.first_name_th, nextProfile.thaiFirstName], ['นามสกุลภาษาไทย', application.last_name_th, nextProfile.thaiLastName],
        ['โรงเรียน', application.school_name, nextProfile.school], ['อีเมลติดต่อ', application.contact_email, nextProfile.email],
        ['เบอร์โทรศัพท์', application.contact_phone, nextProfile.phone],
        ['ที่อยู่', JSON.stringify(application.address || {}), JSON.stringify(nextProfile.address)],
      ].filter(([, before, after]) => String(before ?? '') !== String(after ?? ''));
      const schoolChanged = String(application.school_name || '').trim() !== nextProfile.school;
      if (schoolChanged && application.school_batch_id) {
        for (const sibling of affectedApplications.rows) {
          if (sibling.application_id !== applicationId && String(sibling.school_name || '').trim() !== nextProfile.school) {
            await client.query('UPDATE applicants SET school_name=$1 WHERE id=$2', [nextProfile.school, sibling.applicant_id]);
            await client.query('UPDATE applications SET version=version+1 WHERE id=$1', [sibling.application_id]);
            await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
              VALUES($1,'application',$2,'admin_edit',$3,$4)`, [adminUserId, sibling.application_id,
              { fields: { โรงเรียน: sibling.school_name } }, { changes: [{ label: 'โรงเรียน', oldValue: sibling.school_name, newValue: nextProfile.school }] }]);
          }
        }
        await client.query('UPDATE school_batches SET school_name=$1 WHERE id=$2', [nextProfile.school, application.school_batch_id]);
      }
      await client.query(`UPDATE applicants SET first_name_en=$1,middle_name_en=$2,last_name_en=$3,first_name_th=$4,last_name_th=$5,school_name=$6,
          contact_email=$7,contact_phone=$8,address=$9::jsonb WHERE id=$10`, [nextProfile.firstName,nextProfile.middleName,nextProfile.lastName,
        nextProfile.thaiFirstName,nextProfile.thaiLastName,nextProfile.school,nextProfile.email,nextProfile.phone,JSON.stringify(nextProfile.address),application.applicant_id]);
      for (const sibling of affectedApplications.rows) {
        if (sibling.application_id === applicationId) continue;
        const siblingItems = await client.query('SELECT id,exam_round_id FROM application_items WHERE application_id=$1', [sibling.application_id]);
        const siblingIdentity = { firstNameEn: sibling.first_name_en, middleNameEn: sibling.middle_name_en, lastNameEn: sibling.last_name_en,
          dateOfBirth: dateOnly(sibling.date_of_birth), schoolName: application.school_batch_id ? nextProfile.school : sibling.school_name };
        for (const siblingItem of siblingItems.rows) {
          await client.query('UPDATE application_items SET duplicate_key=$1 WHERE id=$2', [duplicateKey(siblingIdentity, siblingItem.exam_round_id), siblingItem.id]);
        }
      }

      const itemChanges = [];
      let adjustmentIncrease = removedItems.reduce((sum, item) => sum + Number(item.fee_satang), 0);
      const itemsToReassign = [];
      const priorHeatNumbered = currentItems.some((item) => item.round_type === 'HEAT' && item.exam_number);
      for (const item of prepared) {
        if (item.retained) {
          const oldFee = Number(item.prior.fee_satang);
          if (item.feeSatang < oldFee) adjustmentIncrease += oldFee - item.feeSatang;
          const numberMoved = item.prior.center_id !== item.center.id && Boolean(item.prior.exam_number);
          if (numberMoved) {
            const canceled = await cancelExamNumber(client, item.prior, applicationId, adminUserId, 'exam_center_changed');
            if (canceled) canceledNumbers.push(canceled);
            await client.query('UPDATE application_items SET exam_number=NULL WHERE id=$1', [item.prior.id]);
            if (item.round.round_type === 'HEAT') itemsToReassign.push({ id: item.prior.id, roundId: item.round.id, centerId: item.center.id });
          }
          await client.query(`UPDATE application_items SET grade_id=$1,format=$2,center_id=$3,online_exam_email=$4,
              fee_satang=$5,snapshot=$6,duplicate_key=$7 WHERE id=$8`, [item.gradeId,item.format,item.center.id,item.examEmail,
            item.feeSatang,item.snapshot,item.key,item.prior.id]);
          if (item.gradeChanged || item.formatChanged || item.centerChanged || item.emailChanged || item.feeSatang !== oldFee) itemChanges.push({
            label: `${item.round.short_name} · รายละเอียดสอบ`, oldValue: `${item.prior.grade_label} · ${item.prior.format === 'online' ? 'Online Exam' : 'Paper-Based'} · ${item.prior.center_name}${item.prior.online_exam_email ? ` · อีเมล ${item.prior.online_exam_email}` : ''} · ${money(oldFee)} บาท`,
            newValue: `${item.gradeLabel} · ${item.format === 'online' ? 'Online Exam' : 'Paper-Based'} · ${item.center.name}${item.examEmail ? ` · อีเมล ${item.examEmail}` : ''} · ${money(item.feeSatang)} บาท`,
          });
        } else {
          const inserted = await client.query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,online_exam_email,fee_satang,snapshot,duplicate_key)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`, [applicationId,item.round.id,item.gradeId,item.format,item.center.id,item.examEmail,item.feeSatang,item.snapshot,item.key]);
          item.applicationItemId = inserted.rows[0].id;
          if (item.round.round_type === 'HEAT' && priorHeatNumbered) itemsToReassign.push({ id: item.applicationItemId, roundId: item.round.id, centerId: item.center.id });
          itemChanges.push({ label: `${item.round.short_name} · เพิ่มรายการสอบ`, oldValue: 'ไม่มี', newValue: `${item.gradeLabel} · ${item.format === 'online' ? 'Online Exam' : 'Paper-Based'} · ${item.center.name}${item.examEmail ? ` · อีเมล ${item.examEmail}` : ''} · ${money(item.feeSatang)} บาท` });
        }
      }
      for (const item of prepared.filter((entry) => entry.round.round_type === 'FINAL' && entry.finalInvitationId && (!entry.retained || entry.gradeChanged))) {
        if (item.retained && item.gradeChanged) await client.query('UPDATE final_invitations SET claimed_application_id=NULL WHERE claimed_application_id=$1 AND final_exam_round_id=$2', [applicationId,item.round.id]);
        const claimed = await client.query('UPDATE final_invitations SET claimed_application_id=$1 WHERE id=$2 AND claimed_application_id IS NULL', [applicationId,item.finalInvitationId]);
        if (!claimed.rowCount) throw invalid('สิทธิ์สมัครรอบ FINAL ถูกใช้ไปแล้ว โปรดตรวจสอบข้อมูลแล้วดำเนินการอีกครั้ง', 409);
      }
      for (const removed of removedItems) itemChanges.push({ label: `${removed.short_name} · ลบรายการสอบ`, oldValue: `${removed.grade_label} · ${removed.format === 'online' ? 'Online Exam' : 'Paper-Based'} · ${removed.center_name} · ${money(removed.fee_satang)} บาท${removed.exam_number ? ` · เลข ${removed.exam_number}` : ''}`, newValue: 'ยกเลิก' });

      const numberAssignments = [];
      for (const item of itemsToReassign) {
        const number = await assignNextHeatNumber(client, item.roundId, item.centerId);
        await client.query('UPDATE application_items SET exam_number=$1 WHERE id=$2', [number,item.id]);
        numberAssignments.push({ applicationItemId: item.id, examNumber: number });
      }

      const registrationSatang = prepared.reduce((sum, item) => sum + item.feeSatang, 0);
      const nextAdjustment = Number(application.non_refundable_adjustment_satang || 0) + adjustmentIncrease;
      const nextTotalSatang = registrationSatang + Number(application.paper_total_satang || 0) + nextAdjustment;
      const additionalDue = Math.max(0, nextTotalSatang - Number(application.total_satang || 0));
      if (additionalDue > 0 && !paymentSlip) throw invalid(`โปรดแนบหลักฐานการชำระเงินส่วนที่เพิ่มจำนวน ${money(additionalDue).toLocaleString('th-TH')} บาทก่อนบันทึก`);
      if (profileChanges.length || itemChanges.length || nextAdjustment !== Number(application.non_refundable_adjustment_satang || 0)) {
        const changeList = [...profileChanges.map(([label, oldValue, newValue]) => ({ label, oldValue: oldValue || '', newValue: newValue || '' })), ...itemChanges];
        if (nextAdjustment !== Number(application.non_refundable_adjustment_satang || 0)) changeList.push({ label: 'ส่วนต่างที่ไม่คืน/ไม่นำไปหัก', oldValue: money(application.non_refundable_adjustment_satang || 0), newValue: money(nextAdjustment) });
        if (numberAssignments.length) changeList.push({ label: 'เลขประจำตัวสอบใหม่', oldValue: canceledNumbers.map((item) => item.examNumber).join(', ') || '—', newValue: numberAssignments.map((item) => item.examNumber).join(', ') });
        await client.query(`UPDATE applications SET registration_total_satang=$1,non_refundable_adjustment_satang=$2,version=version+1 WHERE id=$3`, [registrationSatang,nextAdjustment,applicationId]);
        await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
          VALUES($1,'application',$2,'admin_edit',$3,$4)`, [adminUserId,applicationId,
          { status: application.status, fields: Object.fromEntries(profileChanges.map(([label, before]) => [label, before])), examNumbersCanceled: canceledNumbers },
          { changes: changeList, examNumbersAssigned: numberAssignments, additionalDue: money(additionalDue), status: application.status }]);
      }

      if (application.school_batch_id && schoolChanged) {
        await client.query(`UPDATE school_batches SET total_satang=(SELECT coalesce(sum(total_satang),0) FROM applications WHERE school_batch_id=$1) WHERE id=$1`, [application.school_batch_id]);
      } else if (application.school_batch_id && nextTotalSatang !== Number(application.total_satang || 0)) {
        await client.query(`UPDATE school_batches SET total_satang=(SELECT coalesce(sum(total_satang),0) FROM applications WHERE school_batch_id=$1) WHERE id=$1`, [application.school_batch_id]);
      }
      if (additionalDue > 0) {
        const roundFolders = [...new Set(prepared.map((item) => `${item.round.short_name} - ${item.round.round_type === 'HEAT' ? 'HEAT ROUND' : item.round.round_type === 'FINAL' ? 'FINAL ROUND' : 'FINAL X'} ${item.round.year}`))];
        const payment = await createPaymentWithSlip(client, { applicationId: application.school_batch_id ? null : applicationId,
          batchId: application.school_batch_id || null, expectedSatang: additionalDue, slip: { ...paymentSlip, roundFolders }, ownerId: adminUserId });
        uploadedDriveFileId = payment.driveFileId;
      }

      const affectedItemIds = await client.query('SELECT id FROM application_items WHERE application_id=$1', [applicationId]);
      const version = await client.query('SELECT version FROM applications WHERE id=$1', [applicationId]);
      if (application.status === 'approved') {
        for (const item of affectedItemIds.rows) await enqueueIntegrationJob(client, 'sheets.sync_item', { applicationItemId: item.id }, `sheets-item:${item.id}:v${version.rows[0].version}`);
      }
      if (schoolChanged && application.school_batch_id) {
        const siblingItems = await client.query(`SELECT ai.id,a.version FROM application_items ai JOIN applications a ON a.id=ai.application_id WHERE a.school_batch_id=$1`, [application.school_batch_id]);
        for (const item of siblingItems.rows) if (application.status === 'approved') await enqueueIntegrationJob(client, 'sheets.sync_item', { applicationItemId: item.id }, `sheets-item:${item.id}:v${item.version}`);
      }
      return { id: applicationId, version: version.rows[0].version, total: money(nextTotalSatang), additionalDue: money(additionalDue), canceledNumbers, numberAssignments };
    });
    for (const fileId of deletedPhotoDriveIds) await deleteGoogleDriveFile(fileId).catch(() => {});
    return outcome;
  } catch (error) {
    if (uploadedDriveFileId) await deleteGoogleDriveFile(uploadedDriveFileId).catch(() => {});
    throw error;
  }
}

async function updateApplicationProfile(applicationId, input, { ownerId = null, publicIdentity = null } = {}) {
  return transaction(async (client) => {
    const found = await client.query(`SELECT a.id AS application_id,a.applicant_id,a.owner_user_id,a.school_batch_id,a.status,
      ap.first_name_en,ap.middle_name_en,ap.last_name_en,ap.first_name_th,ap.last_name_th,ap.date_of_birth,ap.school_name,ap.contact_email,ap.contact_phone,ap.address
      FROM applications a JOIN applicants ap ON ap.id=a.applicant_id WHERE a.id=$1 FOR UPDATE OF a,ap`, [applicationId]);
    if (!found.rowCount) throw invalid('Application not found', 404);
    const target = found.rows[0];
    if (ownerId && target.owner_user_id !== ownerId) throw invalid('You do not have permission to edit this application', 403);
    if (publicIdentity) {
      const storedName = normalize([target.first_name_en, target.middle_name_en, target.last_name_en].filter(Boolean).join(' '));
      const storedLastFour = String(target.contact_phone || '').replace(/\D/g, '').slice(-4);
      if (normalize(publicIdentity.candidateName) !== storedName || String(publicIdentity.phoneLast4 || '') !== storedLastFour) {
        throw invalid('ไม่พบข้อมูลที่ตรงกัน โปรดตรวจสอบชื่อภาษาอังกฤษและหมายเลขโทรศัพท์ 4 หลักท้าย', 403);
      }
    }
    if (!ownerId && !publicIdentity) throw invalid('You do not have permission to edit this application', 403);
    if (target.status !== 'approved') throw invalid('Application details can only be edited after approval', 409);

    const deadline = await client.query(`SELECT min(r.edit_close_date) AS edit_deadline,
      bool_and(r.edit_close_date IS NOT NULL AND (now() AT TIME ZONE 'Asia/Bangkok')::date <= r.edit_close_date) AS editable
      FROM application_items ai JOIN exam_rounds r ON r.id=ai.exam_round_id WHERE ai.application_id=$1`, [applicationId]);
    if (!deadline.rows[0]?.editable) throw invalid('The application edit window is closed or has not been configured', 409);

    const next = {
      firstName: String(input.firstNameEn || '').trim(), middleName: String(input.middleNameEn || '').trim(), lastName: String(input.lastNameEn || '').trim(),
      thaiFirstName: String(input.firstNameTh ?? target.first_name_th ?? '').trim(), thaiLastName: String(input.lastNameTh ?? target.last_name_th ?? '').trim(),
      schoolName: String(input.schoolName || '').trim(), contactEmail: String(input.contactEmail || '').trim(), contactPhone: String(input.contactPhone || '').trim(),
      address: Object.fromEntries(Object.entries(input.address || {}).map(([key, value]) => [key, String(value || '').trim()]).filter(([, value]) => value)),
    };
    if (!next.firstName || !next.lastName || !next.schoolName || !next.contactEmail || !next.contactPhone) throw invalid('First name, last name, school, contact email, and phone are required');
    if (next.contactPhone.replace(/\D/g, '').length < 4) throw invalid('หมายเลขโทรศัพท์ต้องมีตัวเลขอย่างน้อย 4 หลัก');
    const schoolChanged = String(target.school_name || '').trim() !== next.schoolName;
    const updateWholeSchoolBatch = Boolean(target.school_batch_id && schoolChanged && ownerId);
    if (updateWholeSchoolBatch) await client.query('SELECT id FROM school_batches WHERE id=$1 FOR UPDATE', [target.school_batch_id]);
    const affected = updateWholeSchoolBatch
      ? (await client.query(`SELECT a.id AS application_id,a.applicant_id,ap.first_name_en,ap.middle_name_en,ap.last_name_en,ap.date_of_birth,ap.school_name
          FROM applications a JOIN applicants ap ON ap.id=a.applicant_id WHERE a.school_batch_id=$1 ORDER BY a.id FOR UPDATE OF a,ap`, [target.school_batch_id])).rows
      : [target];
    const affectedIds = affected.map((row) => row.application_id);
    const duplicateUpdates = [];
    for (const row of affected) {
      const isTarget = row.applicant_id === target.applicant_id;
      const identity = {
        firstNameEn: isTarget ? next.firstName : row.first_name_en,
        middleNameEn: isTarget ? next.middleName : row.middle_name_en,
        lastNameEn: isTarget ? next.lastName : row.last_name_en,
        dateOfBirth: row.date_of_birth,
        schoolName: schoolChanged ? next.schoolName : row.school_name,
      };
      const items = await client.query('SELECT id,exam_round_id FROM application_items WHERE application_id=$1', [row.application_id]);
      for (const item of items.rows) duplicateUpdates.push({ itemId: item.id, applicationId: row.application_id, key: duplicateKey(identity, item.exam_round_id) });
    }
    const keys = duplicateUpdates.map((row) => row.key);
    if (new Set(keys).size !== keys.length) throw invalid('These details would create a duplicate application', 409);
    const conflicts = await client.query(`SELECT application_id FROM application_items
      WHERE duplicate_key=ANY($1::text[]) AND NOT (application_id=ANY($2::uuid[])) LIMIT 1`, [keys, affectedIds]);
    if (conflicts.rowCount) throw invalid('These details would create a duplicate application', 409);

    const targetChanges = [
      ['ชื่อภาษาอังกฤษ', target.first_name_en, next.firstName], ['ชื่อกลางภาษาอังกฤษ', target.middle_name_en || '', next.middleName],
      ['นามสกุลภาษาอังกฤษ', target.last_name_en, next.lastName], ['ชื่อภาษาไทย', target.first_name_th || '', next.thaiFirstName],
      ['นามสกุลภาษาไทย', target.last_name_th || '', next.thaiLastName], ['โรงเรียน', target.school_name, next.schoolName],
      ['อีเมลติดต่อ', target.contact_email, next.contactEmail], ['เบอร์โทรศัพท์', target.contact_phone, next.contactPhone],
      ['ที่อยู่', JSON.stringify(target.address || {}), JSON.stringify(next.address)],
    ].filter(([, before, after]) => String(before ?? '') !== String(after ?? ''));
    if (!targetChanges.length) return { id: applicationId, status: 'approved', editDeadline: deadline.rows[0].edit_deadline };

    for (const row of affected) {
      const isTarget = row.applicant_id === target.applicant_id;
      const changes = isTarget ? targetChanges : [['โรงเรียน', row.school_name, next.schoolName]]
        .filter(([, before, after]) => String(before ?? '') !== String(after ?? ''));
      if (!changes.length) continue;
      if (isTarget) {
        await client.query(`UPDATE applicants SET first_name_en=$1,middle_name_en=$2,last_name_en=$3,first_name_th=$4,last_name_th=$5,school_name=$6,
          contact_email=$7,contact_phone=$8,address=$9::jsonb WHERE id=$10`, [next.firstName, next.middleName, next.lastName, next.thaiFirstName, next.thaiLastName, next.schoolName, next.contactEmail, next.contactPhone, JSON.stringify(next.address), target.applicant_id]);
      } else {
        await client.query('UPDATE applicants SET school_name=$1 WHERE id=$2', [next.schoolName, row.applicant_id]);
      }
      await client.query('UPDATE applications SET version=version+1 WHERE id=$1', [row.application_id]);
      for (const duplicateUpdate of duplicateUpdates.filter((item) => item.applicationId === row.application_id)) {
        await client.query('UPDATE application_items SET duplicate_key=$1 WHERE id=$2', [duplicateUpdate.key, duplicateUpdate.itemId]);
      }
      await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
        VALUES($1,'application',$2,$3,$4,$5)`, [ownerId, row.application_id, publicIdentity ? 'edit_profile_public' : 'edit_profile',
        { fields: Object.fromEntries(changes.map(([label, before]) => [label, before])) },
        { changes: changes.map(([label, before, after]) => ({ label, oldValue: before || '', newValue: after || '' })) }]);
      const items = await client.query('SELECT id FROM application_items WHERE application_id=$1', [row.application_id]);
      const version = await client.query('SELECT version FROM applications WHERE id=$1', [row.application_id]);
      for (const item of items.rows) {
        await enqueueIntegrationJob(client, 'sheets.sync_item', { applicationItemId: item.id }, `sheets-item:${item.id}:v${version.rows[0].version}`);
      }
    }
    if (updateWholeSchoolBatch) await client.query('UPDATE school_batches SET school_name=$1 WHERE id=$2', [next.schoolName, target.school_batch_id]);
    const updated = await client.query('SELECT version FROM applications WHERE id=$1', [applicationId]);
    return { id: applicationId, status: 'approved', version: updated.rows[0].version, editDeadline: deadline.rows[0].edit_deadline };
  });
}

export async function updateOwnedApplicationProfile(applicationId, input, ownerId) {
  return updateApplicationProfile(applicationId, input, { ownerId });
}

export async function updatePublicApplicationProfile(applicationId, input, identity) {
  return updateApplicationProfile(applicationId, input, { publicIdentity: identity });
}

function parseCertificatePhoto(photo) {
  if (!photo || typeof photo.dataBase64 !== 'string') throw invalid('โปรดเลือกไฟล์ภาพก่อนอัปโหลด');
  const mimeType = String(photo.mimeType || '').toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw invalid('ไฟล์ภาพเกียรติบัตรต้องเป็น JPG, PNG หรือ WebP');
  const encoded = photo.dataBase64.replace(/^data:[^,]+,/, '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded) || encoded.length % 4 !== 0) throw invalid('ข้อมูลไฟล์ภาพไม่ถูกต้อง');
  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length || buffer.length > 10 * 1024 * 1024) throw invalid('รูปภาพต้องมีขนาดไม่เกิน 10 MB');
  const valid = mimeType === 'image/jpeg' ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
    : mimeType === 'image/png' ? buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      : buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (!valid) throw invalid('ชนิดไฟล์ไม่ตรงกับข้อมูลภาพ');
  const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
  const baseName = String(photo.fileName || 'certificate-photo').replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '').normalize('NFKC').replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 120) || 'certificate-photo';
  return { buffer, mimeType, extension, fileName: `${baseName}.${extension}`, sha256: createHash('sha256').update(buffer).digest('hex') };
}

async function getPhotoUploadContext(applicationId, userId, userEmail, isAdmin) {
  const result = await getPool().query(`SELECT a.id,a.owner_user_id,a.status,ap.first_name_en,ap.middle_name_en,ap.last_name_en,ap.contact_email
    FROM applications a JOIN applicants ap ON ap.id=a.applicant_id WHERE a.id=$1`, [applicationId]);
  if (!result.rowCount) throw invalid('ไม่พบใบสมัคร',404);
  const application = result.rows[0];
  const isApplicant = Boolean(userEmail) && application.contact_email.toLowerCase() === String(userEmail).toLowerCase();
  if (!isAdmin && application.owner_user_id !== userId && !isApplicant) throw invalid('ไม่มีสิทธิ์จัดการภาพของใบสมัครนี้',403);
  if (application.status !== 'approved') throw invalid('สามารถอัปโหลดภาพได้หลังผู้ดูแลระบบอนุมัติใบสมัครแล้วเท่านั้น',409);
  const deadline = await getPool().query(`SELECT bool_and(r.edit_close_date IS NOT NULL AND (now() AT TIME ZONE 'Asia/Bangkok')::date<=r.edit_close_date) AS editable
    FROM application_items ai JOIN exam_rounds r ON r.id=ai.exam_round_id WHERE ai.application_id=$1`, [applicationId]);
  if (!deadline.rows[0]?.editable) throw invalid('หมดช่วงเวลาอัปโหลดภาพ หรือยังไม่ได้กำหนดวันปิดแก้ไข',409);
  const items = await getPool().query(`SELECT ai.id AS application_item_id,ai.exam_number,r.id AS round_id,r.year,r.round_type,
      c.short_name,c.name AS competition_name
    FROM application_items ai JOIN exam_rounds r ON r.id=ai.exam_round_id JOIN competitions c ON c.id=r.competition_id
    WHERE ai.application_id=$1 ORDER BY ai.id`, [applicationId]);
  if (!items.rowCount || items.rows.some((item) => !item.exam_number)) throw invalid('โปรดสร้างเลขประจำตัวสอบก่อนอัปโหลดภาพเกียรติบัตร',409);
  return { application, items: items.rows };
}

const safeFilePart = (value) => String(value || '').normalize('NFKC').trim().replace(/[^\p{L}\p{N}-]+/gu, '_').replace(/^_+|_+$/g, '').slice(0, 80);

export async function uploadCertificatePhoto(applicationId, photoInput, userId, userEmail, isAdmin = false) {
  const photo = parseCertificatePhoto(photoInput);
  const { application, items } = await getPhotoUploadContext(applicationId, userId, userEmail, isAdmin);
  const candidateName = [application.first_name_en,application.middle_name_en,application.last_name_en].filter(Boolean).map(safeFilePart).filter(Boolean).join('_');
  const uploads = [];
  try {
    for (const item of items) {
      const roundName = `${item.short_name} - ${item.round_type === 'HEAT' ? 'HEAT ROUND' : item.round_type === 'FINAL' ? 'FINAL ROUND' : 'FINAL X'} ${item.year}`;
      const fileStem = `${safeFilePart(item.exam_number)}_${candidateName}`.slice(0, 175 - photo.extension.length);
      const fileName = `${fileStem}.${photo.extension}`;
      const driveFile = await uploadGoogleDriveFile({ category:'photos', folders:[roundName], name:fileName, mimeType:photo.mimeType, buffer:photo.buffer });
      uploads.push({ ...item, driveFileId: driveFile.id, fileName });
    }
    const oldFileIds = await transaction(async (client) => {
      const checked = await client.query(`SELECT a.id,a.owner_user_id,a.status,ap.contact_email
        FROM applications a JOIN applicants ap ON ap.id=a.applicant_id WHERE a.id=$1 FOR UPDATE OF a`, [applicationId]);
      const stillEditable = await client.query(`SELECT bool_and(r.edit_close_date IS NOT NULL AND (now() AT TIME ZONE 'Asia/Bangkok')::date<=r.edit_close_date) AS editable
        FROM application_items ai JOIN exam_rounds r ON r.id=ai.exam_round_id WHERE ai.application_id=$1`, [applicationId]);
      if (!checked.rowCount || checked.rows[0].status !== 'approved' || !stillEditable.rows[0]?.editable) throw invalid('ใบสมัครอยู่นอกช่วงเวลาที่อนุญาตให้อัปโหลดภาพ',409);
      const applicantEmailMatches = Boolean(userEmail) && checked.rows[0]?.contact_email.toLowerCase() === String(userEmail).toLowerCase();
      if (!isAdmin && checked.rows[0].owner_user_id !== userId && !applicantEmailMatches) throw invalid('ไม่มีสิทธิ์จัดการภาพของใบสมัครนี้',403);
      const prior = await client.query('SELECT application_item_id,drive_file_id FROM certificate_photos WHERE application_item_id=ANY($1::uuid[]) FOR UPDATE', [items.map((item) => item.application_item_id)]);
      for (const upload of uploads) await client.query(`INSERT INTO certificate_photos(application_item_id,drive_file_id,file_name,uploaded_by,mime_type,sha256,file_size,uploaded_at,updated_at)
        VALUES($1,$2,$3,$4,$5,$6,$7,now(),now()) ON CONFLICT(application_item_id) DO UPDATE SET
        drive_file_id=excluded.drive_file_id,file_name=excluded.file_name,uploaded_by=excluded.uploaded_by,mime_type=excluded.mime_type,
        sha256=excluded.sha256,file_size=excluded.file_size,uploaded_at=now(),replaced_at=now(),updated_at=now()`,
      [upload.application_item_id,upload.driveFileId,upload.fileName,userId,photo.mimeType,photo.sha256,photo.buffer.length]);
      await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data)
        VALUES($1,'application',$2,'upload_certificate_photo',$3)`, [userId,applicationId,{ itemCount: uploads.length, fileName: uploads[0]?.fileName, replaced: prior.rowCount > 0 }]);
      return prior.rows.map((row) => row.drive_file_id).filter(Boolean);
    });
    await Promise.all(oldFileIds.map((fileId) => deleteGoogleDriveFile(fileId).catch(() => {})));
    return { applicationId, photo: { name: uploads[0]?.fileName || photo.fileName, uploadedAt: new Date().toISOString(), itemCount: uploads.length } };
  } catch (error) {
    await Promise.all(uploads.map((upload) => deleteGoogleDriveFile(upload.driveFileId).catch(() => {})));
    throw error;
  }
}

export async function removeCertificatePhoto(applicationId, userId, userEmail, isAdmin = false) {
  const { items } = await getPhotoUploadContext(applicationId,userId,userEmail,isAdmin);
  const removed = await transaction(async (client) => {
    const existing = await client.query('SELECT cp.application_item_id,cp.drive_file_id FROM certificate_photos cp JOIN application_items ai ON ai.id=cp.application_item_id WHERE ai.application_id=$1 FOR UPDATE OF cp', [applicationId]);
    await client.query('DELETE FROM certificate_photos cp USING application_items ai WHERE cp.application_item_id=ai.id AND ai.application_id=$1', [applicationId]);
    await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,after_data)
      VALUES($1,'application',$2,'remove_certificate_photo',$3)`, [userId,applicationId,{ removed: existing.rowCount }]);
    return existing.rows.map((row) => row.drive_file_id).filter(Boolean);
  });
  await Promise.all(removed.map((fileId) => deleteGoogleDriveFile(fileId).catch(() => {})));
  return { removed: removed.length, itemCount: items.length };
}

export async function downloadCertificatePhoto(applicationItemId, userId, userEmail, isAdmin = false) {
  const result = await getPool().query(`SELECT cp.drive_file_id,cp.file_name,cp.mime_type,a.owner_user_id,ap.contact_email
    FROM certificate_photos cp JOIN application_items ai ON ai.id=cp.application_item_id
    JOIN applications a ON a.id=ai.application_id JOIN applicants ap ON ap.id=a.applicant_id WHERE ai.id=$1`, [applicationItemId]);
  if (!result.rowCount) throw invalid('ไม่พบรูปสำหรับเกียรติบัตร',404);
  const isApplicant = Boolean(userEmail) && result.rows[0].contact_email.toLowerCase() === String(userEmail).toLowerCase();
  if (!isAdmin && result.rows[0].owner_user_id !== userId && !isApplicant) throw invalid('ไม่มีสิทธิ์ดูภาพนี้',403);
  const content = await downloadGoogleDriveFile(result.rows[0].drive_file_id);
  return { content, fileName: result.rows[0].file_name, mimeType: result.rows[0].mime_type };
}

async function clarifyDuplicate(error, candidates, ownerId) {
  if (error.code !== '23505' || error.constraint !== 'application_items_duplicate_key_key') return error;
  const keys = candidates.flatMap((candidate) => candidate.items.map((item) => duplicateKey(candidate.applicant, item.roundId)));
  const result = await getPool().query('SELECT a.id FROM application_items ai JOIN applications a ON a.id=ai.application_id WHERE ai.duplicate_key=ANY($1::text[]) AND a.owner_user_id=$2 LIMIT 1', [keys, ownerId]);
  return invalid('Duplicate application', 409, { existingApplicationId: result.rows[0]?.id || null });
}

async function queryApplications({ userId = null, userEmail = null, excludeDrafts = false, applicationId = null } = {}) {
  const result = await getPool().query(`SELECT a.id AS application_id, a.source, a.status AS application_status, a.submitted_at,
      a.approved_at, a.school_batch_id, a.registration_total_satang, a.paper_total_satang, a.non_refundable_adjustment_satang, a.total_satang,
      a.source_heat_application_id, a.marketing_consent, a.review_note, edit_rule.edit_deadline, edit_rule.editable AS edit_window_open,
      edit_history.change_history,
      ap.first_name_en, ap.middle_name_en, ap.last_name_en, ap.first_name_th, ap.last_name_th,
      ap.gender, ap.certificate_school_name, ap.date_of_birth, ap.school_name, ap.contact_email,
      ap.contact_phone, ap.address,
      sb.total_satang AS batch_total_satang, sb.coordinator_email, sb.source AS batch_source,
      ai.id AS application_item_id, ai.exam_round_id, ai.grade_id, ai.format, ai.center_id,
      ai.online_exam_email, ai.fee_satang, ai.snapshot, ai.exam_number,
      cp.file_name AS certificate_photo_file_name,cp.mime_type AS certificate_photo_mime_type,cp.uploaded_at AS certificate_photo_uploaded_at,
      r.year AS academic_year, r.round_type, r.title AS round_title, r.exam_date,
      c.id AS competition_id, c.short_name, c.name AS competition_name, c.subject,
      g.label AS grade_label, ec.code AS center_code,
      coalesce(ai.snapshot->'center'->>'name', ec.name) AS center_name,
      (SELECT coalesce(json_agg(json_build_object('id', p.past_paper_id, 'title', pp.title, 'detail', pp.detail,
        'name', pp.title || ' — ' || pp.detail, 'fee', p.price_satang / 100.0) ORDER BY pp.group_name, pp.title), '[]'::json)
        FROM application_past_papers p JOIN past_papers pp ON pp.id=p.past_paper_id WHERE p.application_id=a.id) AS past_papers,
      pay.id AS payment_id, pay.status AS payment_status, pay.payment_account_id,
      pay.expected_satang, pay.confirmed_satang, pay.confirmed_transfer_at, pay.confirmed_account_number,
      pa.category AS payment_account_type, pa.bank_name, pa.account_name, pa.account_number,
      slip.id AS slip_id, slip.file_name AS slip_file_name, slip.mime_type AS slip_mime_type,
      (SELECT coalesce(json_agg(json_build_object('id',p.id,'status',p.status,'expectedSatang',p.expected_satang,'createdAt',p.created_at,
        'slip',CASE WHEN latest_slip.id IS NULL THEN NULL ELSE json_build_object('id',latest_slip.id,'name',latest_slip.file_name,
          'type',latest_slip.mime_type,'url','/api/admin/payment-slips/'||latest_slip.id::text) END)
        ORDER BY p.created_at DESC),'[]'::json)
        FROM payments p LEFT JOIN LATERAL (SELECT ps.id,ps.file_name,ps.mime_type FROM payment_slips ps
          WHERE ps.payment_id=p.id ORDER BY ps.version DESC,ps.uploaded_at DESC LIMIT 1) latest_slip ON true
        WHERE p.application_id=a.id OR (a.school_batch_id IS NOT NULL AND p.school_batch_id=a.school_batch_id)) AS payment_records
    FROM applications a
    JOIN applicants ap ON ap.id=a.applicant_id
    LEFT JOIN school_batches sb ON sb.id=a.school_batch_id
    JOIN application_items ai ON ai.application_id=a.id
    JOIN exam_rounds r ON r.id=ai.exam_round_id
    JOIN competitions c ON c.id=r.competition_id
    JOIN grade_catalog g ON g.id=ai.grade_id
    JOIN exam_centers ec ON ec.id=ai.center_id
    LEFT JOIN LATERAL (SELECT p.* FROM payments p WHERE p.application_id=a.id OR (a.school_batch_id IS NOT NULL AND p.school_batch_id=a.school_batch_id) ORDER BY p.created_at DESC LIMIT 1) pay ON true
    LEFT JOIN certificate_photos cp ON cp.application_item_id=ai.id
    LEFT JOIN payment_accounts pa ON pa.id=pay.payment_account_id
    LEFT JOIN LATERAL (SELECT ps.id, ps.file_name, ps.mime_type FROM payment_slips ps WHERE ps.payment_id=pay.id ORDER BY ps.version DESC, ps.uploaded_at DESC LIMIT 1) slip ON true
    LEFT JOIN LATERAL (SELECT min(r2.edit_close_date) AS edit_deadline,
      bool_and(r2.edit_close_date IS NOT NULL AND (now() AT TIME ZONE 'Asia/Bangkok')::date <= r2.edit_close_date) AS editable
      FROM application_items ai2 JOIN exam_rounds r2 ON r2.id=ai2.exam_round_id WHERE ai2.application_id=a.id) edit_rule ON true
    LEFT JOIN LATERAL (SELECT coalesce(json_agg(json_build_object('id',al.id,'editor',coalesce(u.display_name,'ผู้ดูแลระบบ'),
      'at',al.created_at,'changes',al.after_data->'changes') ORDER BY al.created_at DESC),'[]'::json) AS change_history
      FROM audit_logs al LEFT JOIN users u ON u.id=al.actor_user_id
      WHERE al.entity_type='application' AND al.entity_id=a.id::text AND al.action IN ('edit_profile','admin_edit')) edit_history ON true
    WHERE ($1::uuid IS NULL OR a.owner_user_id=$1 OR ($2::text IS NOT NULL AND lower(ap.contact_email)=lower($2)))
      AND (NOT $3::boolean OR a.status <> 'draft')
      AND ($4::uuid IS NULL OR a.id=$4)
    ORDER BY a.submitted_at DESC, r.year DESC, c.short_name`, [userId, userEmail, excludeDrafts, applicationId]);
  const applications = new Map();
  for (const row of result.rows) {
    let application = applications.get(row.application_id);
    if (!application) {
      const status = row.application_status === 'approved' ? 'confirmed' : row.application_status === 'slip_issue' ? 'pending' : row.application_status;
      const transferAt = row.confirmed_transfer_at ? new Date(row.confirmed_transfer_at).toISOString() : '';
      const transferAtInput = transferAt ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(transferAt)).replace(' ', 'T') : '';
      const address = row.address && typeof row.address === 'object' ? row.address : {};
      application = {
        id: row.application_id,
        owner: row.source === 'school' ? 'coordinator' : row.source === 'guest' ? 'guest' : 'candidate',
        source: row.source === 'school' ? 'school' : row.source === 'guest' ? 'guest' : 'self',
        kind: row.round_type === 'FINAL' ? 'Final' : 'Heat',
        year: row.academic_year,
        status,
        slipIssue: row.application_status === 'slip_issue' ? (row.review_note || 'รอตรวจสอบสลิป') : '',
        submitted: row.submitted_at?.toISOString?.() || row.submitted_at,
        approvedAt: row.approved_at?.toISOString?.() || row.approved_at || '',
        editDeadline: row.edit_deadline?.toISOString?.().slice(0, 10) || row.edit_deadline || '',
        canEdit: row.application_status === 'approved' && Boolean(row.edit_window_open),
        batchId: row.school_batch_id || '',
        invoiceTotal: row.batch_total_satang == null ? 0 : money(row.batch_total_satang),
        paymentId: row.payment_id || '',
        paymentStatus: row.payment_status || '',
        paymentAccountId: row.payment_account_id || '',
        paymentAccountType: row.payment_account_type || '',
        paymentAccountSnapshot: row.payment_account_id ? { id: row.payment_account_id, category: row.payment_account_type, bankName: row.bank_name, accountName: row.account_name, accountNumber: row.account_number } : null,
        transferAmount: row.confirmed_satang == null ? null : money(row.confirmed_satang),
        transferDateTime: transferAt,
        transferDateTimeInput: transferAtInput,
        expectedPayment: money(row.expected_satang || row.total_satang),
        paymentRecords: (row.payment_records || []).map((payment) => ({ ...payment,
          expectedAmount: money(payment.expectedSatang), createdAt: payment.createdAt?.toISOString?.() || payment.createdAt,
          slipFile: payment.slip || null })),
        slipFileName: row.slip_file_name || '',
        slipFile: row.slip_id ? { id: row.slip_id, name: row.slip_file_name, type: row.slip_mime_type, url: `/api/admin/payment-slips/${row.slip_id}` } : null,
        candidate: [row.first_name_en, row.middle_name_en, row.last_name_en].filter(Boolean).join(' '),
        nameParts: { firstName: row.first_name_en, middleName: row.middle_name_en || '', lastName: row.last_name_en },
        school: row.school_name,
        contactEmail: row.contact_email,
        phoneLast4: row.contact_phone.slice(-4),
        studentInformation: { firstName: row.first_name_en, middleName: row.middle_name_en || '', lastName: row.last_name_en, thaiFirstName: row.first_name_th || '', thaiLastName: row.last_name_th || '', gender: row.gender || '', certificateSchoolName: row.certificate_school_name || '', dateOfBirth: row.date_of_birth?.toISOString?.().slice(0, 10) || row.date_of_birth, email: row.contact_email, phone: row.contact_phone, ...address },
        sourceHeatId: row.source_heat_application_id || '',
        marketingConsent: Boolean(row.marketing_consent),
        registrationFee: money(row.registration_total_satang),
        pastPapersTotal: money(row.paper_total_satang),
        nonRefundableAdjustment: money(row.non_refundable_adjustment_satang || 0),
        totalPayment: money(row.total_satang),
        competitions: [],
        pastPapers: row.past_papers || [],
        changeHistory: (row.change_history || []).map((entry) => ({ ...entry, at: entry.at?.toISOString?.() || entry.at, changes: entry.changes || [] })),
      };
      applications.set(row.application_id, application);
    }
    const centerSnapshot = { id: row.center_id, code: row.center_code, name: row.center_name };
    application.competitions.push({
      id: row.competition_id, applicationItemId: row.application_item_id, gradeId: row.grade_id, short: row.short_name, name: row.competition_name, subject: row.subject,
      grade: row.grade_label, format: row.format === 'online' ? 'Online Exam' : 'Paper-Based',
      examEmail: row.online_exam_email || '', fee: money(row.fee_satang), chargedFee: money(row.fee_satang),
      center: row.center_name, centerId: row.center_id, centerCode: row.center_code, centerSnapshot,
      roundId: row.exam_round_id, roundType: row.round_type, examDate: row.exam_date?.toISOString?.().slice(0, 10) || row.exam_date || '', examNumber: row.exam_number || '',
      certificatePhoto: row.certificate_photo_file_name ? { name: row.certificate_photo_file_name, type: row.certificate_photo_mime_type, uploadedAt: row.certificate_photo_uploaded_at?.toISOString?.() || row.certificate_photo_uploaded_at, url: `/api/certificate-photos/${row.application_item_id}` } : null,
    });
  }
  return [...applications.values()].map((application) => {
    application.examIds = application.competitions.map((item) => item.id);
    application.exam = application.competitions.map((item) => `${item.short} · ${item.grade}`).join(', ');
    application.grade = application.competitions.map((item) => `${item.short}: ${item.grade}`).join(' · ');
    application.format = new Set(application.competitions.map((item) => item.format)).size > 1 ? 'Mixed' : application.competitions[0]?.format || 'Paper-Based';
    application.center = [...new Set(application.competitions.map((item) => item.center))].join(' · ');
    application.centerId = application.competitions[0]?.centerId || '';
    application.centerCode = application.competitions[0]?.centerCode || '';
    application.centerSnapshot = application.competitions[0]?.centerSnapshot || null;
    application.examEmail = application.competitions.find((item) => item.format === 'Online Exam')?.examEmail || '';
    application.heatId = application.kind === 'Heat' ? (application.competitions.find((item) => item.roundType === 'HEAT')?.examNumber || '') : '';
    application.finalId = application.kind === 'Final' ? (application.competitions.find((item) => item.roundType === 'FINAL')?.examNumber || '') : '';
    application.certificatePhoto = application.competitions.find((item) => item.certificatePhoto)?.certificatePhoto || null;
    return application;
  });
}

export async function listMyApplications(userId, userEmail) { return queryApplications({ userId, userEmail }); }
export async function listAllApplications() { return queryApplications({ excludeDrafts: true }); }

function mapAdminApplicationNote(row) {
  return {
    id: row.id,
    applicationId: row.application_id,
    body: row.body,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at || null,
  };
}

function validatedAdminNoteBody(body) {
  const value = String(body || '').trim();
  if (!value) throw invalid('โปรดระบุข้อความก่อนบันทึก');
  if (value.length > 4000) throw invalid('ข้อความต้องมีความยาวไม่เกิน 4,000 ตัวอักษร');
  return value;
}

export async function createApplicationAdminNote(applicationId, body, adminUserId) {
  const value = validatedAdminNoteBody(body);
  return transaction(async (client) => {
    const application = await client.query('SELECT id FROM applications WHERE id=$1', [applicationId]);
    if (!application.rowCount) throw invalid('Application not found', 404);
    const inserted = await client.query(`INSERT INTO application_admin_notes(application_id,body,created_by,updated_by)
      VALUES($1,$2,$3,$3) RETURNING *`, [applicationId, value, adminUserId]);
    const note = inserted.rows[0];
    await client.query(`INSERT INTO application_admin_note_history(note_id,application_id,actor_user_id,action,after_body)
      VALUES($1,$2,$3,'create',$4)`, [note.id, applicationId, adminUserId, value]);
    return mapAdminApplicationNote(note);
  });
}

export async function listApplicationAdminNotes(applicationId, { includeHistory = false } = {}) {
  const application = await getPool().query('SELECT id FROM applications WHERE id=$1', [applicationId]);
  if (!application.rowCount) throw invalid('Application not found', 404);
  const notes = await getPool().query(`SELECT * FROM application_admin_notes
    WHERE application_id=$1 AND deleted_at IS NULL ORDER BY created_at,id`, [applicationId]);
  const response = { notes: notes.rows.map(mapAdminApplicationNote) };
  if (includeHistory) {
    const history = await getPool().query(`SELECT h.*,u.display_name AS actor_name,u.email AS actor_email
      FROM application_admin_note_history h JOIN users u ON u.id=h.actor_user_id
      WHERE h.application_id=$1 ORDER BY h.id`, [applicationId]);
    response.history = history.rows.map((row) => ({
      id: row.id,
      noteId: row.note_id,
      action: row.action,
      actor: { id: row.actor_user_id, name: row.actor_name, email: row.actor_email },
      createdAt: row.created_at,
      before: row.before_body === null ? null : { body: row.before_body },
      after: row.after_body === null ? null : { body: row.after_body },
    }));
  }
  return response;
}

export async function updateApplicationAdminNote(applicationId, noteId, body, adminUserId) {
  const value = validatedAdminNoteBody(body);
  return transaction(async (client) => {
    const current = await client.query(`SELECT * FROM application_admin_notes
      WHERE id=$1 AND application_id=$2 AND deleted_at IS NULL FOR UPDATE`, [noteId, applicationId]);
    if (!current.rowCount) throw invalid('Application note not found', 404);
    const prior = current.rows[0];
    const updated = await client.query(`UPDATE application_admin_notes SET body=$1,updated_by=$2,updated_at=now()
      WHERE id=$3 RETURNING *`, [value, adminUserId, noteId]);
    await client.query(`INSERT INTO application_admin_note_history(note_id,application_id,actor_user_id,action,before_body,after_body)
      VALUES($1,$2,$3,'edit',$4,$5)`, [noteId, applicationId, adminUserId, prior.body, value]);
    return mapAdminApplicationNote(updated.rows[0]);
  });
}

export async function deleteApplicationAdminNote(applicationId, noteId, adminUserId) {
  return transaction(async (client) => {
    const current = await client.query(`SELECT * FROM application_admin_notes
      WHERE id=$1 AND application_id=$2 AND deleted_at IS NULL FOR UPDATE`, [noteId, applicationId]);
    if (!current.rowCount) throw invalid('Application note not found', 404);
    const note = current.rows[0];
    await client.query(`UPDATE application_admin_notes SET deleted_at=now(),updated_by=$1,updated_at=now() WHERE id=$2`, [adminUserId, noteId]);
    await client.query(`INSERT INTO application_admin_note_history(note_id,application_id,actor_user_id,action,before_body)
      VALUES($1,$2,$3,'delete',$4)`, [noteId, applicationId, adminUserId, note.body]);
  });
}

const publicApplicationStatus = (status) => status === 'approved' ? 'confirmed' : status === 'rejected' ? 'rejected' : 'pending';

export async function searchPublicApplicationStatuses(name) {
  const normalizedName = normalize(name);
  if (normalizedName.length < 3) throw invalid('โปรดระบุชื่อภาษาอังกฤษอย่างน้อย 3 ตัวอักษร');
  const escapedName = normalizedName.replace(/[!%_]/g, '!$&');
  const result = await getPool().query(`SELECT a.status AS application_status,a.review_note,a.submitted_at,
      concat_ws(' ',ap.first_name_en,NULLIF(ap.middle_name_en,''),ap.last_name_en) AS candidate,
      COALESCE((SELECT string_agg(concat_ws(' · ',CASE r.round_type WHEN 'HEAT' THEN 'HEAT ROUND' WHEN 'FINAL' THEN 'FINAL ROUND' ELSE 'FINAL X' END,r.year,c.short_name,g.label),', '
        ORDER BY r.year DESC,c.short_name,g.label)
        FROM application_items ai JOIN exam_rounds r ON r.id=ai.exam_round_id
        JOIN competitions c ON c.id=r.competition_id JOIN grade_catalog g ON g.id=ai.grade_id
        WHERE ai.application_id=a.id),'') AS exam
    FROM applications a JOIN applicants ap ON ap.id=a.applicant_id
    WHERE a.status <> 'draft'
      AND lower(regexp_replace(trim(concat_ws(' ',ap.first_name_en,NULLIF(ap.middle_name_en,''),ap.last_name_en)),'[[:space:]]+',' ','g')) LIKE $1 ESCAPE '!'
    ORDER BY a.submitted_at DESC LIMIT 100`, [`%${escapedName}%`]);
  return result.rows.map((row) => ({
    candidate: row.candidate,
    exam: row.exam,
    status: publicApplicationStatus(row.application_status),
    ...(row.application_status === 'rejected' && row.review_note ? { reason: row.review_note } : {}),
  }));
}

function publicEditApplication(application) {
  const information = application.studentInformation || {};
  return {
    id: application.id,
    source: application.source,
    kind: application.kind,
    year: application.year,
    status: application.status,
    canEdit: application.canEdit,
    editDeadline: application.editDeadline,
    candidate: application.candidate,
    nameParts: application.nameParts,
    school: application.school,
    contactEmail: application.contactEmail,
    phoneLast4: application.phoneLast4,
    exam: application.exam,
    grade: application.grade,
    competitions: application.competitions.map((item) => ({
      id: item.id,
      short: item.short,
      name: item.name,
      grade: item.grade,
      format: item.format,
      center: item.center,
      centerSnapshot: item.centerSnapshot,
      roundType: item.roundType,
    })),
    studentInformation: {
      firstName: information.firstName,
      middleName: information.middleName || '',
      lastName: information.lastName,
      thaiFirstName: information.thaiFirstName || '',
      thaiLastName: information.thaiLastName || '',
      email: information.email,
      phone: information.phone,
      address1: information.address1 || '',
      address2: information.address2 || '',
      city: information.city || '',
      province: information.province || '',
      postalCode: information.postalCode || '',
    },
  };
}

export async function getPublicApplicationForEdit(candidateName, phoneLast4, applicationId = null) {
  const normalizedName = normalize(candidateName);
  const normalizedLastFour = String(phoneLast4 || '');
  if (normalizedName.length < 3 || !/^\d{4}$/.test(normalizedLastFour)) throw invalid('ไม่พบข้อมูลที่ตรงกัน โปรดตรวจสอบชื่อภาษาอังกฤษและหมายเลขโทรศัพท์ 4 หลักท้าย', 403);
  const matched = await getPool().query(`SELECT a.id
    FROM applications a JOIN applicants ap ON ap.id=a.applicant_id
    WHERE a.status <> 'draft'
      AND ($3::uuid IS NULL OR a.id=$3)
      AND lower(regexp_replace(trim(concat_ws(' ',ap.first_name_en,NULLIF(ap.middle_name_en,''),ap.last_name_en)),'[[:space:]]+',' ','g'))=$1
      AND right(regexp_replace(ap.contact_phone,'[^0-9]','','g'),4)=$2
    ORDER BY a.submitted_at DESC LIMIT 1`, [normalizedName, normalizedLastFour, applicationId]);
  if (!matched.rowCount) throw invalid('ไม่พบข้อมูลที่ตรงกัน โปรดตรวจสอบชื่อภาษาอังกฤษและหมายเลขโทรศัพท์ 4 หลักท้าย', 403);
  const applications = await queryApplications({ applicationId: matched.rows[0].id });
  if (!applications[0]) throw invalid('ไม่พบใบสมัคร', 404);
  return publicEditApplication(applications[0]);
}

export async function getSlipReplacementStatus(token) {
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(String(token || ''))) throw invalid('This slip link is invalid or has expired', 410);
  const result = await getPool().query(`SELECT t.expires_at,t.used_at,t.revoked_at,p.school_batch_id,sb.school_name,
      (SELECT count(*)::integer FROM applications a WHERE (p.school_batch_id IS NOT NULL AND a.school_batch_id=p.school_batch_id OR p.school_batch_id IS NULL AND a.id=p.application_id) AND a.status='slip_issue') AS affected_applications
    FROM slip_replacement_tokens t JOIN payments p ON p.id=t.payment_id
    LEFT JOIN school_batches sb ON sb.id=p.school_batch_id
    WHERE t.token_hash=$1`, [hashToken(token)]);
  const link = result.rows[0];
  const valid = Boolean(link && !link.used_at && !link.revoked_at && new Date(link.expires_at).getTime() > Date.now() && link.affected_applications > 0);
  if (!valid) throw invalid('This slip link is invalid, expired, or has already been used', 410);
  return { valid: true, expiresAt: link.expires_at, schoolName: link.school_name || null, applicationCount: link.affected_applications };
}

export async function replacePaymentSlip(token, slipInput) {
  if (!/^[A-Za-z0-9_-]{32,100}$/.test(String(token || ''))) throw invalid('This slip link is invalid or has expired', 410);
  const slip = parsePaymentSlip(slipInput);
  let uploadedFileId = '';
  try {
    return await transaction(async (client) => {
      const tokenResult = await client.query(`SELECT * FROM slip_replacement_tokens
        WHERE token_hash=$1 AND used_at IS NULL AND revoked_at IS NULL AND expires_at>now() FOR UPDATE`, [hashToken(token)]);
      if (!tokenResult.rowCount) throw invalid('This slip link is invalid, expired, or has already been used', 410);
      const link = tokenResult.rows[0];
      const paymentResult = await client.query('SELECT * FROM payments WHERE id=$1 FOR UPDATE', [link.payment_id]);
      if (!paymentResult.rowCount) throw invalid('Payment record not found', 404);
      const payment = paymentResult.rows[0];
      const applicationResult = await client.query(`SELECT a.id,a.status,a.applicant_id,ap.contact_email,sb.coordinator_email,sb.school_name
        FROM applications a JOIN applicants ap ON ap.id=a.applicant_id
        LEFT JOIN school_batches sb ON sb.id=a.school_batch_id
        WHERE (a.id=$1 OR ($2::uuid IS NOT NULL AND a.school_batch_id=$2)) AND a.status='slip_issue'
        FOR UPDATE OF a`, [payment.application_id, payment.school_batch_id]);
      if (!applicationResult.rowCount) throw invalid('No application is waiting for a replacement slip', 409);
      const itemRounds = await client.query(`SELECT DISTINCT c.short_name,r.round_type,r.year
        FROM applications a JOIN application_items ai ON ai.application_id=a.id
        JOIN exam_rounds r ON r.id=ai.exam_round_id JOIN competitions c ON c.id=r.competition_id
        WHERE a.id=$1 OR ($2::uuid IS NOT NULL AND a.school_batch_id=$2)`, [payment.application_id, payment.school_batch_id]);
      const folders = [...new Set(itemRounds.rows.map((round) => `${round.short_name} - ${round.round_type === 'HEAT' ? 'HEAT ROUND' : round.round_type === 'FINAL' ? 'FINAL ROUND' : 'FINAL X'} ${round.year}`))];
      const folderLabel = folders.sort().join(' + ').slice(0, 100) || 'Unassigned Exam Round';
      const driveFile = await uploadGoogleDriveFile({ category: 'slips', folders: [folderLabel], name: slip.fileName, mimeType: slip.mimeType, buffer: slip.buffer });
      uploadedFileId = driveFile.id;
      const version = await client.query('SELECT coalesce(max(version),0)+1 AS next_version FROM payment_slips WHERE payment_id=$1', [payment.id]);
      await client.query(`INSERT INTO payment_slips(payment_id,drive_file_id,file_name,mime_type,sha256,version,uploaded_by)
        VALUES($1,$2,$3,$4,$5,$6,NULL)`, [payment.id, driveFile.id, slip.fileName, slip.mimeType, slip.sha256, version.rows[0].next_version]);
      const affectedIds = applicationResult.rows.map((application) => application.id);
      await client.query(`UPDATE applications SET status='pending',review_note=NULL,version=version+1
        WHERE id=ANY($1::uuid[]) AND status='slip_issue'`, [affectedIds]);
      await client.query("UPDATE payments SET status='pending' WHERE id=$1", [payment.id]);
      if (payment.school_batch_id) {
        const batchState = await client.query(`SELECT count(*) FILTER (WHERE status='approved')::integer AS approved,
            count(*) FILTER (WHERE status IN ('pending','slip_issue'))::integer AS pending
          FROM applications WHERE school_batch_id=$1`, [payment.school_batch_id]);
        const batchStatus = batchState.rows[0].approved > 0 ? 'partially_approved' : 'pending';
        await client.query('UPDATE school_batches SET status=$1 WHERE id=$2', [batchStatus, payment.school_batch_id]);
      }
      await client.query(`UPDATE slip_replacement_tokens SET used_at=coalesce(used_at,now()),revoked_at=now()
        WHERE payment_id=$1 AND used_at IS NULL AND revoked_at IS NULL`, [payment.id]);
      for (const application of applicationResult.rows) {
        await client.query(`INSERT INTO audit_logs(actor_user_id,entity_type,entity_id,action,before_data,after_data)
          VALUES(NULL,'application',$1,'replace_payment_slip',jsonb_build_object('status','slip_issue'),jsonb_build_object('status','pending','paymentId',$2::uuid,'slipVersion',$3::integer))`,
        [application.id, payment.id, version.rows[0].next_version]);
      }
      const recipient = payment.school_batch_id ? applicationResult.rows[0].coordinator_email : applicationResult.rows[0].contact_email;
      await queueEmail(client, {
        to: recipient,
        subject: 'OCEC ได้รับสลิปใหม่แล้ว',
        text: `ระบบได้รับสลิปใหม่สำหรับ ${payment.school_batch_id ? `บิลโรงเรียน ${applicationResult.rows[0].school_name}` : `ใบสมัคร ${applicationResult.rows[0].id}`} แล้ว มี ${affectedIds.length} ใบสมัครกลับเข้าสู่คิวตรวจสอบ${payment.school_batch_id ? ' โดยใบสมัครที่อนุมัติแล้วคงสถานะเดิม' : ''}`,
      }, `slip-replaced:${payment.id}:${version.rows[0].next_version}`);
      return { paymentId: payment.id, replacedApplications: affectedIds.length, slipVersion: version.rows[0].next_version };
    });
  } catch (error) {
    if (uploadedFileId) await deleteGoogleDriveFile(uploadedFileId).catch(() => {});
    throw error;
  }
}
