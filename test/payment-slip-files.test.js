import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentSlipDisplayName, paymentSlipFileName, paymentSlipFolderName } from '../server/paymentSlipFiles.js';

test('payment slip folder year uses the Bangkok calendar year', () => {
  assert.equal(paymentSlipFolderName('2026-12-31T17:30:00.000Z'), 'OCEC Slip 2027');
  assert.equal(paymentSlipFolderName('2026-12-31T16:59:59.000Z'), 'OCEC Slip 2026');
});

test('individual slip names use the applicant English full name', () => {
  assert.equal(paymentSlipDisplayName({ firstNameTh: 'สมชาย', lastNameTh: 'ใจดี', firstNameEn: 'Somchai', lastNameEn: 'Jaidee' }), 'Somchai Jaidee');
  assert.equal(paymentSlipDisplayName({ firstNameEn: 'Somchai', middleNameEn: 'A', lastNameEn: 'Jaidee' }), 'Somchai A Jaidee');
});

test('school batch slip names use the school name', () => {
  assert.equal(paymentSlipDisplayName({ isSchoolBatch: true, schoolName: 'โรงเรียนตัวอย่าง', firstNameEn: 'First', lastNameEn: 'Candidate' }), 'โรงเรียนตัวอย่าง');
});

test('payment slip filenames use safe applicant text, validated extensions, and per-year suffixes', () => {
  assert.equal(paymentSlipFileName('สมชาย ใจดี', 'image/jpeg', 0), 'สมชาย ใจดี.jpg');
  assert.equal(paymentSlipFileName('สมชาย/ใจดี', 'application/pdf', 2), 'สมชาย-ใจดี_2.pdf');
  assert.equal(paymentSlipFileName('Somchai Jaidee', 'image/png', 1), 'Somchai Jaidee_1.png');
  assert.throws(() => paymentSlipFileName('Name', 'text/plain', 0), /Unsupported payment slip type/);
});
