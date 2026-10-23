import assert from 'node:assert/strict';
import test from 'node:test';
import { getApplicationExamRound, getFormCompetitions } from '../src/applicationCatalog.js';
import { getCommonCenters } from '../src/centers.js';
import { formatExamSession, getCompetitionExamPrice, selectedExamDateText } from '../src/features/applications/formUtils.js';
import { formatThaiDate } from '../src/examUtils.js';

test('application choices reflect configured open rounds and their grades', () => {
  const choices = [
    { id: 'bbb', short: 'BBB', name: 'Old name', subject: 'Mathematics' },
    { id: 'new', short: 'NEW', name: 'New exam', subject: 'Science' },
  ];
  const exams = [
    { id: 'bbb-heat', competitionId: 'bbb', title: 'Renamed in admin', year: '2569', roundType: 'HEAT', isOpen: true, gradeOptions: ['Primary 4'], centerIds: ['center-1'] },
    { id: 'new-heat', competitionId: 'new', title: 'New exam', year: '2569', roundType: 'HEAT', isOpen: true, gradeOptions: ['Secondary 2'], centerIds: [] },
    { id: 'old-heat', competitionId: 'old', title: 'Closed exam', year: '2569', roundType: 'HEAT', isOpen: false, gradeOptions: ['Primary 1'] },
    { id: 'bbb-final', competitionId: 'bbb', title: 'Final exam', year: '2569', roundType: 'FINAL', isOpen: true, gradeOptions: ['Primary 5'] },
  ];

  assert.deepEqual(getFormCompetitions(exams, choices, 'HEAT', { year: '2569', openOnly: true }).map(({ id, name, grades }) => ({ id, name, grades })), [
    { id: 'bbb', name: 'Renamed in admin', grades: ['Primary 4'] },
    { id: 'new', name: 'New exam', grades: ['Secondary 2'] },
  ]);
  assert.deepEqual(getFormCompetitions(exams, choices, 'FINAL', { year: '2569' })[0].grades, ['Primary 5']);
});

test('an empty catalog or unconfigured grades never inject demo choices', () => {
  assert.deepEqual(getFormCompetitions([], [], 'HEAT', { openOnly: true }), []);
  assert.deepEqual(getFormCompetitions([
    { id: 'custom-heat', competitionId: 'custom', title: 'Custom exam', year: '2569', roundType: 'HEAT', isOpen: true },
  ], [], 'HEAT', { openOnly: true })[0].grades, []);
});

test('a Final invitation keeps its exact round for grades, centers, and price', () => {
  const exams = [
    { id: 'bbb-final-invited', competitionId: 'bbb', title: 'BBB Final', year: '2569', roundType: 'FINAL', examDate: '2026-12-20', gradeOptions: ['Primary 6'], centerIds: ['center-invited'], prices: { paperBased: 1200 } },
    { id: 'bbb-final-other', competitionId: 'bbb', title: 'BBB Final', year: '2569', roundType: 'FINAL', examDate: '2027-01-20', gradeOptions: ['Secondary 1'], centerIds: ['center-other'], prices: { paperBased: 1800 } },
  ];
  const [competition] = getFormCompetitions(exams, [], 'FINAL', {
    year: '2569', roundIds: ['bbb-final-invited'],
  });

  assert.equal(competition.roundId, 'bbb-final-invited');
  assert.deepEqual(competition.grades, ['Primary 6']);
  assert.equal(getApplicationExamRound(exams, { ...competition, roundId: 'bbb-final-other' }, '2569', 'FINAL'), exams[1]);
  assert.deepEqual(getCommonCenters(['bbb'], exams, [
    { id: 'center-invited', name: 'Invited Center', active: true },
    { id: 'center-other', name: 'Other Center', active: true },
  ], { year: '2569', roundType: 'FINAL', roundId: competition.roundId }).map(({ id }) => id), ['center-invited']);
  assert.equal(getCompetitionExamPrice(exams, 'bbb', 'FINAL', 'Paper-Based', {}, '2569', competition.roundId), 1200);
  assert.equal(selectedExamDateText(exams, 'FINAL', '2569', ['bbb'], [competition.roundId]), formatThaiDate('2026-12-20'));
  assert.equal(formatExamSession(exams.find((exam) => exam.id === competition.roundId)), `${formatThaiDate('2026-12-20')} · ยังไม่กำหนดเวลา`);
});
