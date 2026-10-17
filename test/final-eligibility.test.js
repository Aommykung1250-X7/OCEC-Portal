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
