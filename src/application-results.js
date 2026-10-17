function isHeatItem(item) {
  return !item?.roundType || item.roundType === "HEAT";
}

function findPublishedResult(application, competition, publishedResults, heatItemCountForCompetition) {
  const candidates = (publishedResults || []).filter((result) => result.applicationId === application.id
    && String(result.year) === String(application.year)
    && (!result.roundType || result.roundType === "HEAT")
    && result.competitionId === competition.id);
  if (competition.applicationItemId) {
    const exact = candidates.find((result) => result.applicationItemId === competition.applicationItemId);
    if (exact) return exact;
    if (heatItemCountForCompetition > 1) return null;
  }
  return candidates.find((result) => !result.applicationItemId) || null;
}

export function getApplicationHeatResultState(application, publishedResults = [], today = "") {
  if (application?.kind !== "Heat") return null;
  const heatCompetitions = (application.competitions || []).filter(isHeatItem);
  if (!heatCompetitions.length) return null;

  const countsByCompetition = new Map();
  heatCompetitions.forEach((item) => countsByCompetition.set(item.id, (countsByCompetition.get(item.id) || 0) + 1));
  const items = heatCompetitions.map((competition) => {
    const result = findPublishedResult(application, competition, publishedResults, countsByCompetition.get(competition.id));
    const examDayPassed = Boolean(competition.examDate && today && competition.examDate < today);
    return {
      competition,
      result,
      status: result ? "published" : examDayPassed ? "waiting" : "upcoming",
    };
  });

  const resultPhaseStarted = items.some((item) => item.result || item.status === "waiting");
  if (!resultPhaseStarted) return { status: "before-exam", items };
  return {
    status: items.every((item) => item.result) ? "published" : "waiting",
    items,
  };
}
