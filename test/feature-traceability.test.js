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

test('authoritative business rules registry links every approved rule to an owner, date, and executable test', async () => {
  const registry = await readFile(new URL('../docs/business-rules-registry.md', import.meta.url), 'utf8');
  const ruleRows = registry.split('\n').filter((line) => line.startsWith('| BR-'));
  assert.ok(ruleRows.length >= 10, 'expected reconciled business rules in docs/business-rules-registry.md');
  for (const row of ruleRows) {
    const cells = row.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells[0].startsWith('BR-OPEN-')) {
      assert.equal(cells.length, 5, row);
      assert.ok(cells.every(Boolean), row);
      continue;
    }
    assert.equal(cells.length, 8, row);
    const [ruleId, , , , status, owner, decisionDate, testsCell] = cells;
    assert.equal(status, 'Approved', `${ruleId} must be Approved`);
    assert.ok(owner.length >= 3, `${ruleId} needs an owner`);
    assert.match(decisionDate, /^\d{4}-\d{2}-\d{2}$/, `${ruleId} needs an ISO decision date`);
    const refs = [...testsCell.matchAll(/(test\/[^` ]+\.test\.js|test\/[^` ]+\.spec\.js) :: ([^`]+)`/g)];
    assert.ok(refs.length > 0, `${ruleId} must cite at least one acceptance test`);
    if (process.env.TRACEABILITY_REQUIRE_IMPLEMENTED === '1') {
      for (const [, path, name] of refs) {
        const source = await readFile(new URL(`../${path}`, import.meta.url), 'utf8');
        assert.ok(source.includes(name), `${ruleId} -> ${path}: ${name}`);
      }
    }
  }
});
