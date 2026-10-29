export function nextExamRoundType(competitionId, sourceRoundType = 'HEAT') {
  if (sourceRoundType === 'HEAT') return 'FINAL';
  return competitionId === 'bbb' && sourceRoundType === 'FINAL' ? 'FINAL_X' : null;
}

export function isEligibleForNextRound(award, competitionId, sourceRoundType = 'HEAT') {
  if (!nextExamRoundType(competitionId, sourceRoundType)) return false;
  const value = String(award ?? '').normalize('NFKC').trim().toUpperCase().replace(/\s+/g, ' ');
  if (competitionId === 'bbb' && sourceRoundType === 'HEAT') return /^(1ST|2ND|3RD)( (AWARD|PLACE|PRIZE))?$/.test(value);
  return /^(GOLD|SILVER|BRONZE)( (MEDAL|AWARD))?$/.test(value);
}
