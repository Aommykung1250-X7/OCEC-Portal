export function registrationCountdown(closeDate, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closeDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return null;
  const days = (Date.parse(`${closeDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  if (!Number.isFinite(days)) return null;
  if (days < 0) return 'ปิดรับสมัครแล้ว';
  return days === 0 ? 'สมัครได้วันสุดท้าย' : `เหลือเวลาสมัคร ${days} วัน`;
}
