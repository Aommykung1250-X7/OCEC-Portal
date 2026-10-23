import { getExamRoundType } from "../../examUtils.js";

export function getApplicationsForResultTarget(applications, target) {
  if (!target) return [];
  const kind = getExamRoundType(target) === "HEAT" ? "Heat" : "Final";
  return applications.filter((application) => application.kind === kind
    && application.year === target.year
    && ((application.competitions || []).some((competition) => competition.id === target.competitionId)
      || (application.examIds || []).includes(target.competitionId)));
}
