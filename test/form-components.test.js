import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createLogger, createServer } from 'vite';

let vite;
let ApplicantProfileFields;
let ApplicationField;
let CompetitionFormatPicker;
let PaymentAccountCards;

before(async () => {
  vite = await createServer({ configFile: false, customLogger: createLogger('silent'), server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  ({ ApplicantProfileFields, ApplicationField } = await vite.ssrLoadModule('/src/features/applications/FormFields.jsx'));
  ({ CompetitionFormatPicker, PaymentAccountCards } = await vite.ssrLoadModule('/src/features/applications/FormOptions.jsx'));
});

after(async () => { await vite?.close(); });

test('application field styles controls for touch sizing and exposes disabled state', () => {
  const markup = renderToStaticMarkup(React.createElement(ApplicationField, { label: 'อีเมลติดต่อ', required: true, hint: 'ข้อความช่วยเหลือภาษาไทยยาวสำหรับการสมัคร' },
    React.createElement('input', { type: 'email', disabled: true, className: 'custom-control' }),
  ));
  assert.match(markup, /class="custom-control[^"]*min-h-11/);
  assert.match(markup, /text-base/);
  assert.match(markup, /focus:ring-4/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /aria-describedby="[^"]+-hint"/);
  assert.match(markup, /ข้อความช่วยเหลือภาษาไทยยาว/);
});

test('application field exposes an accessible inline validation state', () => {
  const markup = renderToStaticMarkup(React.createElement(ApplicationField, { label: 'อีเมล', error: 'กรุณากรอกอีเมลให้ถูกต้อง' },
    React.createElement('input', { type: 'email' }),
  ));
  assert.match(markup, /aria-invalid="true"/);
  assert.match(markup, /role="alert"/);
  assert.match(markup, /text-red-700/);
  assert.match(markup, /กรุณากรอกอีเมลให้ถูกต้อง/);
});

test('shared applicant fields render values and optional Thai name fields from props', () => {
  const values = { firstName: 'Ada', lastName: 'Lovelace', thaiFirstName: 'เอดา', thaiLastName: 'เลิฟเลซ', school: 'Analytical School', email: 'ada@example.test', phone: '0812345678', address1: '1 Example Road', address2: '', city: 'Bangkok', province: 'Bangkok', postalCode: '10100' };
  const markup = renderToStaticMarkup(React.createElement(ApplicantProfileFields, { values, onChange() {}, showThaiNames: true, disabled: true }));
  assert.match(markup, /value="Ada"/);
  assert.match(markup, /value="เอดา"/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /อีเมลติดต่อผู้เข้าสอบ/);
});

test('competition format picker reflects the selected format, prices, prefix, and disabled state', () => {
  const markup = renderToStaticMarkup(React.createElement(CompetitionFormatPicker, {
    competitionId: 'bbb', prefix: 'school-applicant-1', format: 'Online', paperPrice: 755, onlinePrice: 655, onChange() {}, disabled: true,
  }));
  assert.match(markup, /name="format-school-applicant-1-bbb"/);
  assert.match(markup, /Paper-Based/);
  assert.match(markup, /Online Exam/);
  assert.match(markup, /฿755/);
  assert.match(markup, /฿655/);
  assert.match(markup, /disabled="" name="format-school-applicant-1-bbb" checked=""/);
});

test('public competition choices and payment cards use Tailwind surface and selected states', () => {
  const options = renderToStaticMarkup(React.createElement(CompetitionFormatPicker, {
    competitionId: 'bbb', format: 'Paper-Based', paperPrice: 755, onlinePrice: 655, onChange() {}, variant: 'application',
  }));
  assert.match(options, /has-\[:checked\]:bg-ocec-brand-soft/);
  assert.match(options, /focus-within:ring-4/);

  const payments = renderToStaticMarkup(React.createElement(PaymentAccountCards, { accounts: [
    { id: 'visible', bankName: 'ธนาคารตัวอย่าง', accountName: 'ชื่อบัญชีที่ยาวเพื่อทดสอบการตัดบรรทัดบนหน้าจอมือถือ', accountNumber: '123-456-789012' },
  ] }));
  assert.match(payments, /rounded-xl border border-ocec-border bg-white p-4/);
  assert.match(payments, /\[overflow-wrap:anywhere\]/);
  assert.match(payments, /ธนาคารตัวอย่าง/);
});

test('payment account cards show only active accounts enabled for application forms', () => {
  const markup = renderToStaticMarkup(React.createElement(PaymentAccountCards, { accounts: [
    { id: 'visible', bankName: 'Kasikorn', accountName: 'OCEC', accountNumber: '123-4', active: true, showInForm: true },
    { id: 'inactive', bankName: 'Hidden Bank', accountName: 'Hidden', accountNumber: '000', active: false, showInForm: true },
    { id: 'not-shown', bankName: 'Another Bank', accountName: 'Hidden', accountNumber: '999', active: true, showInForm: false },
  ] }));
  assert.match(markup, /Kasikorn/);
  assert.match(markup, /123-4/);
  assert.doesNotMatch(markup, /Hidden Bank|Another Bank/);
  assert.match(renderToStaticMarkup(React.createElement(PaymentAccountCards, { accounts: [] })), /ยังไม่มีบัญชีรับโอน/);
});
