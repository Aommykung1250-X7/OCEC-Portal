import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ONLINE_CENTER_CODE,
  parseCenterRows,
  getCommonCenters,
  getCenterByApplication,
  buildCenterSummaryRows,
  isOnlineCenter,
} from '../src/centers.js';

const centers = [
  { id: 'center-500', code: '500', name: 'Online : Home Base', active: true },
  { id: 'center-554', code: '554', name: 'Bangkok', active: true },
  { id: 'center-555', code: '555', name: 'Buriram', active: true },
  { id: 'center-556', code: '556', name: 'Closed', active: false },
];

test('identifies online centers from their catalog identity or saved name', () => {
  assert.equal(isOnlineCenter(centers[0]), true);
  assert.equal(isOnlineCenter('Online : Home Base'), true);
  assert.equal(isOnlineCenter('Online Exam'), true);
  assert.equal(isOnlineCenter(centers[1]), false);
});

test('center import preserves existing identity, trims cells, and adds online center', () => {
  const result = parseCenterRows([
    ['Center', 'Code'],
    [' Bangkok New ', ' 554 '],
    ['New Center', '590'],
  ], centers);
  assert.deepEqual(result.issues, []);
  assert.deepEqual(result.centers.map(({ id, code, name }) => ({ id, code, name })), [
    { id: 'center-500', code: '500', name: 'Online : Home Base' },
    { id: 'center-554', code: '554', name: 'Bangkok New' },
    { id: 'center-590', code: '590', name: 'New Center' },
  ]);
});

test('center import reports invalid rows with spreadsheet row numbers', () => {
  const result = parseCenterRows([
    ['Center', 'Code'],
    ['No code', ''],
    ['Incomplete', '000'],
    ['Bangkok', '554'],
    ['Duplicate', '554'],
  ]);
  assert.deepEqual(result.issues.map(({ row }) => row), [2, 3, 5]);
  assert.match(result.issues[0].message, /ชื่อศูนย์สอบและรหัส/);
  assert.match(result.issues[1].message, /000/);
  assert.match(result.issues[2].message, /ซ้ำ/);
  assert.equal(result.centers.filter(({ code }) => code === '554').length, 1);
});

test('center import preview rejects codes that cannot form a three-digit Heat prefix', () => {
  const result = parseCenterRows([
    ['Center', 'Code'],
    ['Too short', '55'],
    ['Not numeric', 'ABC'],
    ['Too long', '1234'],
  ]);
  assert.deepEqual(result.issues.map(({ row }) => row), [2, 3, 4]);
  assert.deepEqual(result.centers.map(({ code }) => code), ['500']);
});

test('common paper centers use the intersection of selected exams and exclude inactive and online centers', () => {
  const exams = [
    { competitionId: 'A', year: 2026, roundType: 'HEAT', centerIds: ['center-554', 'center-555'] },
    { competitionId: 'B', year: 2026, roundType: 'HEAT', centerIds: ['center-555', 'center-556'] },
  ];
  assert.deepEqual(getCommonCenters(['A', 'B'], exams, centers, { year: 2026, roundType: 'HEAT' }).map(({ code }) => code), ['555']);
  assert.deepEqual(getCommonCenters(['A', 'missing'], exams, centers), []);
  assert.deepEqual(getCommonCenters([], exams, centers), []);
});

test('application keeps its historical center snapshot after catalog changes', () => {
  const application = {
    competitions: [{ id: 'A', centerSnapshot: { id: 'center-554', code: '554', name: 'Old Bangkok' } }],
  };
  assert.deepEqual(getCenterByApplication(application, centers, 'A'), application.competitions[0].centerSnapshot);
  assert.equal(getCenterByApplication({ format: 'Online' }, [], 'A').code, ONLINE_CENTER_CODE);
});

test('center report counts each selected competition once by center and grade', () => {
  const applications = [
    { year: 2026, kind: 'Heat', competitions: [{ id: 'A', grade: 'G1', centerSnapshot: { id: 'center-554', code: '554', name: 'Bangkok' } }, { id: 'B', grade: 'G2' }] },
    { year: 2026, kind: 'Heat', competitions: [{ id: 'A', grade: 'G1', centerSnapshot: { id: 'center-554', code: '554', name: 'Bangkok' } }] },
    { year: 2025, kind: 'Heat', competitions: [{ id: 'A', grade: 'G1' }] },
  ];
  assert.deepEqual(buildCenterSummaryRows(applications, { competitionId: 'A', year: 2026, roundType: 'HEAT' }, centers), [
    { centerId: 'center-554', centerCode: '554', centerName: 'Bangkok', grade: 'G1', count: 2 },
  ]);
});
