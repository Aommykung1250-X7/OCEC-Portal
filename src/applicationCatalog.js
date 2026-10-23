import { getExamRoundType } from "./examUtils.js";

/** The application offers only the rounds configured in the exam catalog. */
export function getFormCompetitions(examCatalog, competitionCatalog, roundType, options = {}) {
  const choices = new Map((competitionCatalog || []).map((choice) => [choice.id, choice]));
  const roundIds = Array.isArray(options.roundIds) ? new Set(options.roundIds) : null;
  const matchingExams = (examCatalog || []).filter((exam) => getExamRoundType(exam) === roundType
    && (!options.openOnly || exam.isOpen)
    && (!options.year || exam.year === options.year)
    && (!roundIds || roundIds.has(exam.id)));
  const uniqueExams = [...new Map(matchingExams.map((exam) => [exam.competitionId || exam.id, exam])).values()];
  return uniqueExams.map((exam) => {
    const id = exam.competitionId || exam.id;
    const choice = choices.get(id);
    const name = exam.title || choice?.name || id;
    return {
      id,
      short: choice?.short || (name.length > 18 ? `${name.slice(0, 16)}…` : name),
      name,
      subject: choice?.subject || '',
      grades: Array.isArray(exam.gradeOptions) ? [...exam.gradeOptions] : [],
      centerIds: exam.centerIds || [],
      year: exam.year,
      roundId: exam.id,
    };
  });
}

/** Resolve the exact catalog round carried by an application form listing. */
export function getApplicationExamRound(examCatalog, listing, year, roundType) {
  const matchingRounds = (examCatalog || []).filter((exam) => (exam.competitionId || exam.id) === listing?.id
    && exam.year === year && getExamRoundType(exam) === roundType);
  if (listing?.roundId) return matchingRounds.find((exam) => exam.id === listing.roundId) || null;
  return matchingRounds.find((exam) => exam.year === year) || matchingRounds.find((exam) => exam.isOpen) || matchingRounds[0] || null;
}
