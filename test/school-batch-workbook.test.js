import assert from 'node:assert/strict';
import test from 'node:test';
import { readWorkbook } from '../src/excel.js';
import { parseSchoolWorkbook } from '../src/schoolBatchWorkbook.js';

const catalog = {
  year: 2026,
  competitions: [{ id: 'bbb', short: 'BBB', grades: ['G1'], centerIds: ['center-554'] }],
  examCatalog: [{ id: 'bbb-heat', competitionId: 'bbb', year: 2026, roundType: 'HEAT', centerIds: ['center-554'] }],
  centerCatalog: [
    { id: 'center-500', code: '500', name: 'Online : Home Base', active: true },
    { id: 'center-554', code: '554', name: 'Bangkok', active: true },
  ],
  pastPaperCatalog: [{ id: 'paper-1', title: 'Past Paper', active: true }],
};
const headers = [
  'ENGLISH FIRST NAME', 'ENGLISH LAST NAME', 'THAI FIRST NAME', 'THAI LAST NAME', 'GENDER',
  'DATE OF BIRTH (YYYY-MM-DD)', 'SCHOOL NAME', 'EMAIL', 'PHONE', 'ADDRESS LINE 1',
  'DISTRICT / CITY', 'PROVINCE', 'POSTAL CODE',
  'สมัคร BBB [bbb]', 'ระดับชั้น BBB [bbb]', 'รูปแบบสอบ BBB [bbb]',
  'อีเมลเข้าสอบ BBB [bbb]', 'ศูนย์สอบ BBB [bbb]', 'ข้อสอบเก่า Past Paper [paper-1]',
];
const valid = [
  'Ada', 'Lovelace', 'เอด้า', 'เลิฟเลซ', 'Female', '2017-01-01', 'Bangkok Patana School',
  'ada@example.com', '0812345678', '1 Main Road', 'Bangkok', 'Bangkok', '10110',
  'สมัคร', 'G1', 'Paper-Based', '', '554', 'ซื้อ',
];

async function parse(row) {
  const csv = [headers, row].map((cells) => cells.join(',')).join('\n');
  const file = { name: 'registration.csv', type: 'text/csv', size: Buffer.byteLength(csv), text: async () => csv, arrayBuffer: async () => Buffer.from(csv) };
  return parseSchoolWorkbook(await readWorkbook(file), catalog);
}

test('school import previews applicant, selected exam, center, and past paper', async () => {
  const result = await parse(valid);
  assert.deepEqual(result.issues, []);
  assert.equal(result.applicants.length, 1);
  assert.equal(result.applicants[0].rowId, 'row-2');
  assert.deepEqual(result.applicants[0].competitionIds, ['bbb']);
  assert.deepEqual(result.applicants[0].grades, { bbb: 'G1' });
  assert.deepEqual(result.applicants[0].pastPaperIds, ['paper-1']);
  assert.equal(result.applicants[0].centerId, 'center-554');
});

test('school import identifies invalid fields on the correct row without silently accepting them', async () => {
  const invalid = [...valid];
  invalid[7] = 'invalid-email';
  invalid[8] = '123';
  invalid[14] = 'G9';
  invalid[18] = 'maybe';
  const result = await parse(invalid);
  assert.ok(result.issues.some(({ row, field }) => row === 2 && field === 'EMAIL'));
  assert.ok(result.issues.some(({ row, field }) => row === 2 && field === 'PHONE'));
  assert.ok(result.issues.some(({ row, field }) => row === 2 && field.includes('ระดับชั้น')));
  assert.ok(result.issues.some(({ row, field }) => row === 2 && field.includes('ข้อสอบเก่า')));
});

test('online school import assigns home base center and requires a valid exam email', async () => {
  const online = [...valid];
  online[15] = 'Online Exam';
  online[16] = 'exam@example.com';
  online[17] = '';
  online[18] = 'ไม่ซื้อ';
  const accepted = await parse(online);
  assert.deepEqual(accepted.issues, []);
  assert.equal(accepted.applicants[0].format, 'Online');
  assert.deepEqual(accepted.applicants[0].examEmailsByCompetition, { bbb: 'exam@example.com' });

  online[16] = 'bad-email';
  const rejected = await parse(online);
  assert.ok(rejected.issues.some(({ field }) => field.includes('อีเมลเข้าสอบ')));
});

test('paper school import rejects a center that is not offered for the selected exam', async () => {
  const wrongCenter = [...valid];
  wrongCenter[17] = '500';
  wrongCenter[18] = 'ไม่ซื้อ';
  const result = await parse(wrongCenter);
  assert.ok(result.issues.some(({ field, message }) => field.includes('ศูนย์สอบ') && /ไม่ได้เปิด/.test(message)));
});
