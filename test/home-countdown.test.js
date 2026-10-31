import assert from 'node:assert/strict';
import test from 'node:test';
import { registrationCountdown } from '../src/features/home/homeUtils.js';
test('registration countdown handles the closing day and calendar boundaries', () => {
  assert.equal(registrationCountdown('2026-11-01','2026-10-30'), 'เหลือเวลาสมัคร 2 วัน');
  assert.equal(registrationCountdown('2026-10-30','2026-10-30'), 'สมัครได้วันสุดท้าย');
  assert.equal(registrationCountdown('2026-10-29','2026-10-30'), 'ปิดรับสมัครแล้ว');
  assert.equal(registrationCountdown('2027-01-01','2026-12-31'), 'เหลือเวลาสมัคร 1 วัน');
  assert.equal(registrationCountdown('2028-03-01','2028-02-28'), 'เหลือเวลาสมัคร 2 วัน');
  assert.equal(registrationCountdown('','2026-10-30'), null);
});
