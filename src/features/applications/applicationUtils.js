import { isEligibleForNextRound, nextExamRoundType } from '../../../shared/examProgression.js';
import { getExamRoundType } from "../../examUtils.js";

export const EXAM_ROUND_LABELS = { HEAT: "HEAT ROUND", FINAL: "FINAL ROUND", FINAL_X: "FINAL X" };

export function getActiveExamYear(examCatalog, roundType, fallbackYear = "") {
  const roundExams = (examCatalog || []).filter((item) => getExamRoundType(item) === roundType);
  const openYears = [...new Set(roundExams.filter((item) => item.isOpen).map((item) => item.year).filter(Boolean))];
  const years = openYears.length ? openYears : [...new Set(roundExams.map((item) => item.year).filter(Boolean))];
  return years.sort((left, right) => Number(right) - Number(left))[0] || fallbackYear;
}

export function resultTargetLabel(target) {
  const title = target?.title || target?.competitionTitle || "รายการสอบ";
  const round = EXAM_ROUND_LABELS[target?.roundType] || target?.round || "รอบสอบ";
  return `${title} · ${round} · ปี ${target?.year || "ไม่ระบุ"}`;
}



export function normalizeAwardLabel(award) {
  const normalizedAward = String(award || "").trim().toUpperCase().replace(/\s+/g, " ");
  const medalMatch = normalizedAward.match(/^(GOLD|SILVER|BRONZE)(?: (?:MEDAL|AWARD))?$/);
  if (medalMatch) return `${medalMatch[1]} AWARD`;
  const ordinalMatch = normalizedAward.match(/^(1ST|2ND|3RD)(?: (?:AWARD|PLACE|PRIZE))?$/);
  return ordinalMatch ? ordinalMatch[1] : normalizedAward;
}

export function isFinalEligibleAward(award, competitionId = "", roundType = "HEAT") {
  return isEligibleForNextRound(award, competitionId, roundType);
}

export function getApplicationRoundType(application) {
  return application?.roundType || application?.competitions?.[0]?.roundType || (application?.kind === "Final" ? "FINAL" : "HEAT");
}

export function normalizeExamFormat(format, fallback = "Paper-Based") {
  if (["Online", "Online Exam"].includes(format)) return "Online";
  if (["Paper-Based", "On-site", "Onsite"].includes(format)) return "Paper-Based";
  return fallback;
}

export function getApplicationCompetitionFormat(application, competition) {
  return normalizeExamFormat(competition?.format, normalizeExamFormat(application?.format));
}

export function getApplicationCompetitionExamEmail(application, competition) {
  if (Object.prototype.hasOwnProperty.call(competition || {}, "examEmail")) {
    return String(competition.examEmail ?? "");
  }
  return String(application?.examEmail || application?.studentInformation?.examEmail || "");
}

export function getApplicationCompetitionCenter(application, competition) {
  const savedCenter = competition?.centerSnapshot?.name || competition?.center;
  if (savedCenter) return savedCenter;
  if (getApplicationCompetitionFormat(application, competition) === "Online") return "Online : Home Base";
  return application?.center || "";
}

export function getApplicationFormatSummary(application) {
  const formats = new Set((application?.competitions || []).map((competition) => getApplicationCompetitionFormat(application, competition)));
  if (formats.size > 1) return "Paper-Based + Online Exam";
  if (formats.has("Online")) return "Online Exam";
  if (formats.has("Paper-Based")) return "Paper-Based";
  return application?.format === "On-site" ? "Paper-Based" : application?.format || "ไม่ระบุรูปแบบ";
}

export function getApplicationCenterSummary(application) {
  const centers = [...new Set((application?.competitions || []).map((competition) => getApplicationCompetitionCenter(application, competition)).filter(Boolean))];
  return centers.length ? centers.join(" · ") : application?.center || "—";
}

export function getBangkokTodayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getCertificatePhotoAvailability(application, examCatalog = [], today = getBangkokTodayISO()) {
  const roundType = getApplicationRoundType(application);
  const examItems = (application?.competitions || []).map((competition) => {
    const round = (examCatalog || []).find((exam) => exam.id === competition.roundId)
      || (examCatalog || []).find((exam) => exam.competitionId === competition.id
        && String(exam.year) === String(application?.year)
        && getExamRoundType(exam) === roundType);
    return {
      closeDate: competition.closeDate || round?.closeDate || "",
      examNumber: String(competition.examNumber || "").trim(),
    };
  });
  const hasRounds = examItems.length > 0;
  const hasCloseDates = hasRounds && examItems.every((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.closeDate));
  const closeDate = hasCloseDates ? examItems.map((item) => item.closeDate).sort().at(-1) : "";
  const registrationClosed = Boolean(closeDate && today > closeDate);
  const hasAllExamNumbers = hasRounds && examItems.every((item) => item.examNumber);

  return {
    closeDate,
    hasAllExamNumbers,
    canUpload: registrationClosed && hasAllExamNumbers,
    status: !hasCloseDates ? "missing-close-date" : !registrationClosed ? "before-close" : !hasAllExamNumbers ? "waiting-for-exam-numbers" : "ready",
  };
}

export function getApplicationEditDeadline(application, examCatalog) {
  if (application?.editDeadline !== undefined) return application.editDeadline || "";
  const roundType = getApplicationRoundType(application);
  const roundExams = (examCatalog || []).filter((exam) => exam.year === application?.year && getExamRoundType(exam) === roundType);
  const competitionIds = new Set((application?.competitions || []).map((item) => item.id));
  const matchingExams = roundExams.filter((exam) => competitionIds.has(exam.competitionId));
  return (matchingExams.length ? matchingExams : roundExams)
    .map((exam) => exam.editCloseDate)
    .filter(Boolean)
    .sort()[0] || "";
}

export function isApplicationEditable(application, examCatalog) {
  if (application?.status !== "confirmed") return false;
  if (typeof application?.canEdit === "boolean" && !application.canEdit) return false;
  const deadline = getApplicationEditDeadline(application, examCatalog);
  return Boolean(deadline && getBangkokTodayISO() <= deadline);
}

export function getApplicationPhone(application) {
  return application?.studentInformation?.phone || application?.phone || (application?.phoneLast4 ? `08X-XXX-${application.phoneLast4}` : "ไม่ระบุ");
}

export function isWithinRegistrationWindow(exam, today = getBangkokTodayISO()) {
  return Boolean(exam?.openDate && exam?.closeDate && today >= exam.openDate && today <= exam.closeDate);
}

export function isFinalConfirmationWindowOpen(exam, today = getBangkokTodayISO()) {
  return isWithinRegistrationWindow(exam, today) && !exam?.finalManuallyClosed;
}

export function getEligibleFinalRounds(application, examCatalog, publishedResults, today = getBangkokTodayISO()) {
  const sourceRoundType = getApplicationRoundType(application);
  return (examCatalog || []).filter((exam) => String(exam.year) === String(application?.year)
    && !exam.finalManuallyClosed && isFinalConfirmationWindowOpen(exam, today)
    && (application?.competitions || []).some((competition) => nextExamRoundType(competition.id, sourceRoundType) === getExamRoundType(exam)
      && exam.competitionId === competition.id
      && (publishedResults || []).some((result) => result.applicationId === application.id
        && String(result.year) === String(application.year)
        && (result.roundType || "HEAT") === sourceRoundType
        && result.competitionId === competition.id
        && (!result.applicationItemId || !competition.applicationItemId || result.applicationItemId === competition.applicationItemId)
        && isFinalEligibleAward(result.award, competition.id, sourceRoundType)
        && result.eligibleForFinal !== false)));
}

export function getApplicantEditValues(application) {
  const studentInformation = application?.studentInformation || {};
  const nameParts = application?.nameParts || {};
  const candidateParts = application?.candidate?.trim().split(/\s+/) || [];
  const phone = studentInformation.phone || application?.phone || (application?.phoneLast4 ? `08X-XXX-${application.phoneLast4}` : "");
  return {
    firstName: nameParts.firstName || studentInformation.firstName || candidateParts[0] || "",
    lastName: nameParts.lastName || studentInformation.lastName || candidateParts.slice(1).join(" "),
    thaiFirstName: studentInformation.thaiFirstName || "",
    thaiLastName: studentInformation.thaiLastName || "",
    school: application?.school || studentInformation.school || "",
    email: application?.contactEmail || studentInformation.email || "",
    phone,
    address1: studentInformation.address1 || "",
    address2: studentInformation.address2 || "",
    city: studentInformation.city || "",
    province: studentInformation.province || "",
    postalCode: studentInformation.postalCode || "",
  };
}
