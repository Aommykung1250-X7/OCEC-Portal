import { registrationEmail, slipIssueEmail } from '../server/applications.js';
import { getPool } from '../server/db.js';
import { sendGoogleWorkspaceEmail } from '../server/googleWorkspace.js';
import { registrationEmailSample, testRegistrationEmail } from './registration-email-sample.js';

const recipient = process.argv[2];
if (recipient !== testRegistrationEmail) {
  throw new Error(`Pass the requested test recipient exactly: ${testRegistrationEmail}`);
}

try {
  const approval = registrationEmail(registrationEmailSample, { testMode: true, approved: true });
  const approvalResult = await sendGoogleWorkspaceEmail({
    to: recipient,
    subject: 'ทดสอบอีเมลอนุมัติใบสมัคร OCEC Portal · TEST',
    ...approval,
  });
  console.log(`Approval email test sent to ${recipient}${approvalResult?.id ? ` (Gmail message ${approvalResult.id})` : ''}.`);

  const slipIssue = slipIssueEmail({
    applicationId: registrationEmailSample.id,
    applications: [{
      id: registrationEmailSample.id,
      applicant: registrationEmailSample.applicant,
      items: registrationEmailSample.items,
    }],
    reason: 'ตัวอย่างทดสอบ: กรุณาตรวจสอบยอดเงินและวันเวลาบนสลิป',
    testMode: true,
  });
  const slipResult = await sendGoogleWorkspaceEmail({
    to: recipient,
    subject: 'ทดสอบอีเมลแจ้งแก้ไขสลิป OCEC Portal · TEST',
    ...slipIssue,
  });
  console.log(`Slip issue email test sent to ${recipient}${slipResult?.id ? ` (Gmail message ${slipResult.id})` : ''}.`);
} finally {
  await getPool().end();
}
