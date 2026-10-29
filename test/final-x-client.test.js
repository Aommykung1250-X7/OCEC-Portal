import assert from 'node:assert/strict';
import test from 'node:test';
import { getEligibleFinalRounds, getCertificatePhotoAvailability } from '../src/features/applications/applicationUtils.js';

const application = { id: 'source', kind: 'Final', roundType: 'FINAL', year: '2026', competitions: [{ id: 'bbb', applicationItemId: 'source-item' }] };
const exam = { id: 'bbb-x', competitionId: 'bbb', year: '2026', roundType: 'FINAL_X', openDate: '2026-10-01', closeDate: '2026-11-01' };
const result = { applicationId: 'source', applicationItemId: 'source-item', competitionId: 'bbb', roundType: 'FINAL', year: '2026', award: 'SILVER MEDAL', eligibleForFinal: true };

test('Final X requires the same BBB Final item and year, medal, open dates and no manual closure', () => {
  const eligible = (round = exam, row = result) => getEligibleFinalRounds(application, [round], [row], '2026-10-29');
  assert.equal(eligible().length, 1);
  for (const row of [{ award: '1ST AWARD' }, { roundType: 'HEAT' }, { competitionId: 'hkiso' }, { applicationItemId: 'other' }, { year: '2027' }, { eligibleForFinal: false }]) {
    assert.equal(eligible(exam, { ...result, ...row }).length, 0, JSON.stringify(row));
  }
  for (const patch of [{ finalManuallyClosed: true }, { closeDate: '2026-10-28' }, { openDate: '2026-10-30' }, { roundType: 'FINAL' }, { year: '2027' }]) {
    assert.equal(eligible({ ...exam, ...patch }).length, 0, JSON.stringify(patch));
  }
});

test('Final X certificate photo availability uses its own close date and assigned number', () => {
  const x = { ...application, roundType: 'FINAL_X', competitions: [{ id: 'bbb', roundId: exam.id, examNumber: '123' }] };
  assert.equal(getCertificatePhotoAvailability(x, [exam], '2026-11-02').canUpload, true);
  assert.equal(getCertificatePhotoAvailability(x, [exam], '2026-11-01').canUpload, false);
});
