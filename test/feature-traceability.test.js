import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('feature matrix covers the public and admin menu groups', async () => {
  const matrix = await readFile(new URL('../docs/testing/feature-traceability.md', import.meta.url), 'utf8');
  for (const column of ['เมนู/การกระทำ', 'ชนิด', 'API หรือปลายทาง', 'กรณีทดสอบ']) assert.ok(matrix.includes(column), column);
  for (const group of ['Google', 'Heat', 'โรงเรียน', 'ใบสมัครของฉัน', 'สถานะ', 'รูปเกียรติบัตร', 'สลิป', 'Final', 'ผลสอบ', 'หมายเหตุ', 'บัญชีรับชำระเงิน', 'Sheets', 'ศูนย์ช่วยเหลือ', 'Excel/CSV']) {
    assert.ok(matrix.includes(group), group);
  }
  assert.ok(matrix.includes('https://lin.ee/3hzFg1z'));
  for (const row of matrix.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| ---') && !line.includes('เมนู/การกระทำ'))) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    assert.equal(cells.length, 4, row);
    assert.ok(cells.every(Boolean), row);
    assert.match(cells[3], /test\//, row);
    if (cells[1] === 'browser-only') assert.match(cells[2], /ไม่มีข้อมูลใหม่ที่ต้อง persist/);
    if (process.env.TRACEABILITY_REQUIRE_IMPLEMENTED === '1') {
      assert.ok(!row.includes('planned'), row);
      for (const [, path, name] of cells[3].matchAll(/(?:planned )?(test\/[^` ]+\.test\.js|test\/[^` ]+\.spec\.js) :: ([^`]+)`/g)) {
        const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
        assert.ok(source.includes(name), `${path}: ${name}`);
      }
    }
  }
});
