import { DEFAULT_CENTER_CATALOG, ONLINE_CENTER_CODE, getCommonCenters, isOnlineCenter } from "../../centers.js";
import { formatThaiDate, getExamRoundType } from "../../examUtils.js";

export { DEFAULT_CENTER_CATALOG, ONLINE_CENTER_CODE, getCommonCenters, isOnlineCenter };

export function getSlipMimeType(file) {
  if (["application/pdf", "image/jpeg", "image/png"].includes(file?.type)) return file.type;
  if (file?.type) return "";
  if (/\.pdf$/i.test(file?.name || "")) return "application/pdf";
  if (/\.(jpe?g)$/i.test(file?.name || "")) return "image/jpeg";
  if (/\.png$/i.test(file?.name || "")) return "image/png";
  return "";
}

export function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && reader.result ? resolve(reader.result) : reject(new Error("ไม่สามารถอ่านหลักฐานการชำระเงินได้"));
    reader.onerror = () => reject(new Error("ไม่สามารถอ่านหลักฐานการชำระเงินได้"));
    reader.readAsDataURL(file);
  });
}

export function selectedExamDateText(examCatalog, roundType, year, competitionIds, roundIds) {
  const ids = new Set(competitionIds || []);
  const selectedRounds = Array.isArray(roundIds) ? new Set(roundIds) : null;
  const dates = [...new Set((examCatalog || [])
    .filter((exam) => getExamRoundType(exam) === roundType && exam.year === year && ids.has(exam.competitionId)
      && (!selectedRounds || selectedRounds.has(exam.id)))
    .map((exam) => exam.examDate).filter(Boolean))];
  if (dates.length === 1) return formatThaiDate(dates[0]);
  if (dates.length > 1) return "หลายวัน · ตรวจสอบแยกตามรายการสอบ";
  return "ตรวจสอบกำหนดการของรายการสอบ";
}

export function getCompetitionExamPrice(examCatalog, competitionId, roundType, format, competitionFees, year = "2569", roundId) {
  const roundExams = (examCatalog || []).filter((item) => item.competitionId === competitionId && getExamRoundType(item) === roundType);
  const exam = roundId
    ? roundExams.find((item) => item.id === roundId)
    : roundExams.find((item) => item.year === year) || roundExams.find((item) => item.isOpen) || roundExams[0];
  const priceKey = format === "Online" || format === "Online Exam" ? "onlineExam" : "paperBased";
  const configuredPrice = exam?.prices?.[priceKey];
  if (configuredPrice !== undefined && configuredPrice !== null && configuredPrice !== "") return Math.max(0, Number(configuredPrice) || 0);
  const legacyKey = roundType === "HEAT"
    ? (priceKey === "onlineExam" ? "heatOnline" : "heatOnsite")
    : (priceKey === "onlineExam" ? "finalOnline" : "finalOnsite");
  return Number(competitionFees?.[legacyKey] || 0);
}

export function getCompetitionExamEmailValue(emailsByCompetition, competitionId, fallback = "") {
  if (Object.prototype.hasOwnProperty.call(emailsByCompetition || {}, competitionId)) {
    return String(emailsByCompetition[competitionId] ?? "");
  }
  return String(fallback || "");
}

export function formatExamTime(exam) {
  if (exam?.examStartTime && exam?.examEndTime) return `${exam.examStartTime}–${exam.examEndTime} น.`;
  if (exam?.examStartTime) return `เริ่ม ${exam.examStartTime} น.`;
  if (exam?.examEndTime) return `ถึง ${exam.examEndTime} น.`;
  return "ยังไม่กำหนดเวลา";
}

export function formatExamSession(exam) {
  if (!exam) return "ยังไม่กำหนดวันสอบ";
  return `${formatThaiDate(exam.examDate)} · ${formatExamTime(exam)}`;
}

export function groupPastPaperCatalog(catalog) {
  return Object.values((catalog || []).filter((paper) => paper.active).reduce((groups, paper) => {
    const groupName = paper.group || "ข้อสอบเก่า";
    const id = groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "past-papers";
    groups[id] ||= { id, title: groupName, items: [] };
    groups[id].items.push({ id: paper.id, title: paper.title || paper.name, detail: paper.detail || "", price: Number(paper.price || 0) });
    return groups;
  }, {}));
}

export function createSchoolApplicant(id, prefill) {
  return {
    id,
    firstName: "",
    lastName: "",
    thaiFirstName: "",
    thaiLastName: "",
    gender: "",
    dateOfBirth: "",
    schoolName: "",
    certificateSchoolName: "",
    email: prefill?.contactEmail || "",
    examEmail: "",
    examEmailsByCompetition: {},
    address1: "",
    address2: "",
    city: "",
    province: "",
    postalCode: "",
    phone: "",
    competitionIds: [],
    grades: {},
    formats: {},
    centersByCompetition: {},
    format: "Paper-Based",
    center: prefill?.center || "",
    pastPaperIds: [],
  };
}
