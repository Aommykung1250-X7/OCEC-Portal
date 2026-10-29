import assert from 'node:assert/strict';
import test from 'node:test';
import { isFinalEligible } from '../server/results.js';

test('non-BBB competitions qualify only Gold, Silver, and Bronze awards', () => {
  for (const award of ['GOLD AWARD', 'SILVER AWARD', 'BRONZE AWARD']) {
    assert.equal(isFinalEligible(award, 'hkico'), true, award);
  }
  for (const award of ['MERIT AWARD', 'PARTICIPATION', '1ST AWARD', '2ND AWARD', '3RD AWARD', '']) {
    assert.equal(isFinalEligible(award, 'hkico'), false, award);
  }
});

test('BBB qualifies only 1st, 2nd, and 3rd awards', () => {
  for (const award of ['1ST AWARD', '2ND AWARD', '3RD AWARD']) {
    assert.equal(isFinalEligible(award, 'bbb'), true, award);
  }
  for (const award of ['GOLD AWARD', 'SILVER AWARD', 'BRONZE AWARD', 'MERIT AWARD', 'PARTICIPATION', '']) {
    assert.equal(isFinalEligible(award, 'bbb'), false, award);
  }
});

test('BBB Final medals qualify for Final X, while ordinal awards and Final X results do not', () => {
  for (const award of ['GOLD', 'SILVER AWARD', 'BRONZE MEDAL', ' silver medal ']) {
    assert.equal(isFinalEligible(award, 'bbb', 'FINAL'), true, award);
  }
  for (const award of ['1ST AWARD', '2ND AWARD', '3RD AWARD', 'MERIT AWARD', 'PARTICIPATION', '']) {
    assert.equal(isFinalEligible(award, 'bbb', 'FINAL'), false, award);
  }
  assert.equal(isFinalEligible('GOLD AWARD', 'hkiso', 'FINAL'), false);
  assert.equal(isFinalEligible('GOLD AWARD', 'bbb', 'FINAL_X'), false);
});


test('other competitions end at Final and BBB ends at Final X, regardless of award', () => {
  for (const competition of ['hkiso','hkico','hkimo','timo']) {
    for (const award of ['GOLD AWARD','SILVER MEDAL','BRONZE','1ST AWARD']) {
      assert.equal(isFinalEligible(award, competition, 'FINAL'), false);
    }
  }
  for (const award of ['GOLD AWARD','1ST AWARD']) assert.equal(isFinalEligible(award, 'bbb', 'FINAL_X'), false);
});
