export function registrationCountdown(closeDate, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(closeDate || '') || !/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return null;
  const days = (Date.parse(`${closeDate}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000;
  if (!Number.isFinite(days)) return null;
  if (days < 0) return 'ปิดรับสมัครแล้ว';
  return days === 0 ? 'สมัครได้วันสุดท้าย' : `เหลือเวลาสมัคร ${days} วัน`;
}

export function toThaiYear(year) {
  const num = Number(year);
  if (!Number.isFinite(num) || num <= 0) return String(year || '2569');
  return String(num < 2400 ? num + 543 : num);
}

export function formatShortThaiDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}

export function splitThaiDate(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T12:00:00`);
  const day = new Intl.DateTimeFormat('th-TH', { day: 'numeric' }).format(parsed);
  const monthYear = new Intl.DateTimeFormat('th-TH', { month: 'long', year: 'numeric' }).format(parsed);
  return { day, monthYear };
}

const COMPETITION_META = {
  timo: {
    short: 'TIMO',
    thaiName: 'คณิตศาสตร์นานาชาติ',
    englishName: 'Thailand International Mathematical Olympiad',
  },
  bbb: {
    short: 'BBB',
    thaiName: 'แข่งขันคณิตศาสตร์ BBB',
    englishName: 'Big Bay Bei Mathematical Olympiad',
  },
  hkimo: {
    short: 'HKIMO',
    thaiName: 'คณิตศาสตร์โอลิมปิกฮ่องกง',
    englishName: 'Hong Kong International Mathematical Olympiad',
  },
  hkiso: {
    short: 'HKISO',
    thaiName: 'วิทยาศาสตร์โอลิมปิกฮ่องกง',
    englishName: 'Hong Kong International Science Olympiad',
  },
  hkico: {
    short: 'HKICO',
    thaiName: 'คอมพิวเตอร์โอลิมปิกฮ่องกง',
    englishName: 'Hong Kong International Computational Olympiad',
  },
};

export function getCompetitionDisplayMeta(exam, competition) {
  const id = String(exam?.competitionId || competition?.id || '').toLowerCase();
  const known = COMPETITION_META[id];
  const short = competition?.short || known?.short || (exam?.title || competition?.name || 'OCEC').split(/\s+/)[0];
  const thaiName = known?.thaiName || competition?.name || exam?.title || short;
  const englishName = known?.englishName || exam?.description || competition?.name || '';
  return { id, short, thaiName, englishName };
}
