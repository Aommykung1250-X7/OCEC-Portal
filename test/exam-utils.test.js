import test from 'node:test';
import assert from 'node:assert/strict';
import * as examUtils from '../src/examUtils.js';

test('exam round type recognizes explicit and legacy Final X labels', () => {
  assert.equal(examUtils.getExamRoundType({ roundType: 'FINAL_X' }), 'FINAL_X');
  assert.equal(examUtils.getExamRoundType({ round: 'Final X Round' }), 'FINAL_X');
  assert.equal(examUtils.getExamRoundType({ round: 'FINAL ROUND' }), 'FINAL');
  assert.equal(examUtils.getExamRoundType({ round: 'HEAT ROUND' }), 'HEAT');
});

test('Thai exam date formatting keeps the unspecified and academic-year values', () => {
  assert.equal(examUtils.formatThaiDate(null), 'ยังไม่กำหนด');
  assert.equal(examUtils.formatThaiDate('2026-12-13'), '13 ธันวาคม 2569');
});
