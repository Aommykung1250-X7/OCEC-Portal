import assert from 'node:assert/strict';
import test from 'node:test';
import { readWorkbook, worksheetRows } from '../src/excel.js';

function csvFile(name, contents) {
  return { name, type: 'text/csv', size: Buffer.byteLength(contents), text: async () => contents, arrayBuffer: async () => Buffer.from(contents) };
}

test('CSV import handles BOM, quoted delimiters, escaped quotes, and embedded newlines', async () => {
  const workbook = await readWorkbook(csvFile('applicants.csv', '\uFEFFName,School,Note\r\n"Lee, Ann","A ""School""","Line 1\nLine 2"\r\n'));
  assert.deepEqual(workbook.SheetNames, ['applicants']);
  assert.deepEqual(worksheetRows(workbook, 'applicants'), [
    ['Name', 'School', 'Note'],
    ['Lee, Ann', 'A "School"', 'Line 1\nLine 2'],
  ]);
});

test('CSV import detects semicolon and tab delimiters', async () => {
  const semicolon = await readWorkbook(csvFile('one.csv', 'Name;School\nAda;Example'));
  const tab = await readWorkbook(csvFile('two.csv', 'Name\tSchool\nAda\tExample'));
  assert.deepEqual(worksheetRows(semicolon, 'one')[1], ['Ada', 'Example']);
  assert.deepEqual(worksheetRows(tab, 'two')[1], ['Ada', 'Example']);
});

test('workbook import rejects missing files, obsolete Excel format, and files above 25 MB', async () => {
  await assert.rejects(readWorkbook(null), /เลือกไฟล์/);
  await assert.rejects(readWorkbook({ ...csvFile('old.xls', ''), type: 'application/vnd.ms-excel' }), /\.xlsx/);
  await assert.rejects(readWorkbook({ ...csvFile('large.csv', ''), size: 25 * 1024 * 1024 + 1 }), /25 MB/);
});
