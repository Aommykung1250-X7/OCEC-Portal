const NAME_PARTS = /[<>:"/\\|?*\x00-\x1f\x7f]/g;
const EXTENSIONS_BY_MIME_TYPE = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['application/pdf', 'pdf'],
]);

function normalizeName(value) {
  return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
}

function joinName(...parts) {
  return parts.map(normalizeName).filter(Boolean).join(' ');
}

export function paymentSlipYear(uploadedAt) {
  const date = uploadedAt instanceof Date ? uploadedAt : new Date(uploadedAt);
  if (!Number.isFinite(date.getTime())) throw new Error('A valid payment slip upload time is required');
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Bangkok' })
    .formatToParts(date)
    .find((part) => part.type === 'year')?.value;
  if (!year) throw new Error('A valid payment slip upload year is required');
  return year;
}

export function paymentSlipFolderName(uploadedAt) {
  return `OCEC Slip ${paymentSlipYear(uploadedAt)}`;
}

export function paymentSlipDisplayName({
  isSchoolBatch = false,
  schoolName,
  firstNameTh,
  lastNameTh,
  firstNameEn,
  middleNameEn,
  lastNameEn,
} = {}) {
  if (isSchoolBatch) return normalizeName(schoolName) || 'School';
  return joinName(firstNameEn, middleNameEn, lastNameEn) || joinName(firstNameTh, lastNameTh) || 'Applicant';
}

export function paymentSlipFileName(displayName, mimeType, sequence = 0) {
  const extension = EXTENSIONS_BY_MIME_TYPE.get(String(mimeType || '').toLowerCase());
  if (!extension) throw new Error('Unsupported payment slip type');
  if (!Number.isSafeInteger(sequence) || sequence < 0) throw new Error('Payment slip sequence must be a non-negative integer');
  const safeName = normalizeName(displayName)
    .replace(NAME_PARTS, '-')
    .replace(/[. ]+$/g, '')
    .replace(/^[. ]+/g, '')
    .slice(0, 140) || 'Applicant';
  const suffix = sequence ? `_${sequence}` : '';
  return `${safeName}${suffix}.${extension}`;
}

export function paymentSlipFileNameBase(displayName, mimeType) {
  return paymentSlipFileName(displayName, mimeType, 0).replace(/\.[^.]+$/, '').toLocaleLowerCase('en-US');
}
