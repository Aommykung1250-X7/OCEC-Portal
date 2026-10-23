export function getExamRoundType(exam) {
  if (exam.roundType) return exam.roundType;
  const round = String(exam.round || '').toUpperCase();
  if (round.includes('FINAL X') || round.includes('FINAL_X')) return 'FINAL_X';
  if (round.includes('FINAL')) return 'FINAL';
  return 'HEAT';
}

export function formatThaiDate(date) {
  if (!date) return 'ยังไม่กำหนด';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T12:00:00`));
}
