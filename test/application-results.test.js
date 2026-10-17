import assert from 'node:assert/strict';
import test from 'node:test';
import { getApplicationHeatResultState } from '../src/application-results.js';

const application = {
  id: 'application-1',
  year: '2569',
  kind: 'Heat',
  competitions: [
    { id: 'bbb', applicationItemId: 'item-bbb', roundType: 'HEAT', examDate: '2026-10-10', short: 'BBB' },
    { id: 'hkico', applicationItemId: 'item-hkico', roundType: 'HEAT', examDate: '2026-10-12', short: 'HKICO' },
  ],
};

function result(applicationItemId, competitionId) {
  return { applicationId: application.id, applicationItemId, competitionId, roundType: 'HEAT', year: '2569', award: 'GOLD AWARD' };
}

test('Heat cards wait for a result after each item exam date and announce once all results are published', () => {
  const partial = getApplicationHeatResultState(application, [result('item-bbb', 'bbb')], '2026-10-13');
  assert.equal(partial.status, 'waiting');
  assert.deepEqual(partial.items.map(({ status }) => status), ['published', 'waiting']);

  const complete = getApplicationHeatResultState(application, [result('item-bbb', 'bbb'), result('item-hkico', 'hkico')], '2026-10-13');
  assert.equal(complete.status, 'published');
  assert.deepEqual(complete.items.map(({ status }) => status), ['published', 'published']);
});

test('Heat result rows are matched by application item, not only competition', () => {
  const sameCompetitionItems = {
    ...application,
    competitions: [
      { id: 'bbb', applicationItemId: 'item-bbb-1', roundType: 'HEAT', examDate: '2026-10-10' },
      { id: 'bbb', applicationItemId: 'item-bbb-2', roundType: 'HEAT', examDate: '2026-10-10' },
    ],
  };
  const state = getApplicationHeatResultState(sameCompetitionItems, [result('item-bbb-1', 'bbb')], '2026-10-13');
  assert.deepEqual(state.items.map(({ status }) => status), ['published', 'waiting']);
});

test('cards keep the application status before the exam date and ignore other applications results', () => {
  const beforeExam = getApplicationHeatResultState(application, [], '2026-10-10');
  assert.equal(beforeExam.status, 'before-exam');

  const otherApplicationResult = { ...result('item-bbb', 'bbb'), applicationId: 'other-application' };
  const waiting = getApplicationHeatResultState(application, [otherApplicationResult], '2026-10-13');
  assert.equal(waiting.items[0].status, 'waiting');
});
