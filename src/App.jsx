import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { DEFAULT_CENTER_CATALOG, ONLINE_CENTER_CODE, ONLINE_CENTER_ID, buildCenterSummaryRows, getCommonCenters, getCenterByApplication, isOnlineCenter, parseCenterRows } from "./centers.js";
import { downloadWorkbook, readWorkbook, worksheetRows } from "./excel.js";
import { downloadSchoolTemplate, parseSchoolWorkbook } from "./schoolBatchWorkbook.js";
import { getApplicationHeatResultState } from "./application-results.js";
import { NotFoundPage } from "./SystemPages.jsx";
import { ADMIN_PORTAL_PATH, isAdminPortalPath, pageLabels, routeFromLocation, routeUrlFor } from "./routes.js";

const BACKEND_ENABLED = import.meta.env.VITE_BACKEND_ENABLED === "true";
const DEMO_AVATAR_SRC = "/demo-google-avatar.svg";

function ProfileAvatar({ src, alt = "", className }) {
  const [failedSrc, setFailedSrc] = useState("");
  const imageSrc = src && failedSrc !== src ? src : DEMO_AVATAR_SRC;
  return <img className={className} src={imageSrc} alt={alt} onError={() => setFailedSrc(src || DEMO_AVATAR_SRC)} />;
}

const DEFAULT_PAYMENT_ACCOUNTS = [
  { id: "ocec-main-account", bankName: "Kasikorn Bank", accountName: "บจก. โอซีอีซี (ไทยแลนด์)", accountNumber: "219-3-78805-2", category: "president", showInForm: true, active: true },
];
const DEFAULT_COMPETITION_CATALOG = [
  { id: "hkimo", short: "HKIMO", name: "HKIMO", subject: "Mathematics", active: true },
  { id: "hkiso", short: "HKISO", name: "HKISO", subject: "Science", active: true },
  { id: "hkico", short: "HKICO", name: "HKICO", subject: "Computer", active: true },
  { id: "timo", short: "TIMO", name: "TIMO", subject: "Mathematics", active: true },
  { id: "bbb", short: "BBB", name: "Big Bay Bei (BBB)", subject: "Mathematics", active: true },
];

function PaymentAccountCards({ accounts }) {
  const visibleAccounts = (accounts || []).filter((account) => account.active !== false && account.showInForm !== false);
  return visibleAccounts.length ? <div className="payment-account-list">{visibleAccounts.map((account) => (
    <div className="bank-payment-card" key={account.id}>
      <div className="bank-payment-heading"><span className="bank-payment-icon"><Icon name="building" /></span><div><strong>โอนเงินผ่าน {account.bankName || "ธนาคาร"}</strong><small>กรุณาตรวจสอบยอดรวมก่อนชำระ</small></div></div>
      <div className="bank-payment-details"><span><small>ACCOUNT NAME</small><strong>{account.accountName || "—"}</strong></span><span><small>ACCOUNT NO.</small><strong>{account.accountNumber || "—"}</strong></span></div>
    </div>
  ))}</div> : <div className="payment-account-empty"><Icon name="info" size={15} />ขณะนี้ยังไม่มีบัญชีรับโอนที่เปิดแสดงในฟอร์ม</div>;
}

function getSlipMimeType(file) {
  if (["application/pdf", "image/jpeg", "image/png"].includes(file?.type)) return file.type;
  if (file?.type) return "";
  if (/\.pdf$/i.test(file?.name || "")) return "application/pdf";
  if (/\.(jpe?g)$/i.test(file?.name || "")) return "image/jpeg";
  if (/\.png$/i.test(file?.name || "")) return "image/png";
  return "";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" && reader.result ? resolve(reader.result) : reject(new Error("อ่านไฟล์สลิปไม่สำเร็จ"));
    reader.onerror = () => reject(new Error("อ่านไฟล์สลิปไม่สำเร็จ"));
    reader.readAsDataURL(file);
  });
}

const EXAM_ROUND_LABELS = { HEAT: "HEAT ROUND", FINAL: "FINAL ROUND", FINAL_X: "FINAL X" };
const RESULT_AWARDS = ["GOLD AWARD", "SILVER AWARD", "BRONZE AWARD", "MERIT AWARD", "PARTICIPATION"];
const FINAL_ELIGIBLE_AWARDS = new Set(["GOLD AWARD", "SILVER AWARD", "BRONZE AWARD"]);
const DEMO_COMPETITION_ROUNDS = [
  { competitionId: "bbb", title: "Big Bay Bei (BBB)", roundType: "HEAT", accent: "coral", examStartTime: "11:15", examEndTime: "12:30" },
  { competitionId: "hkiso", title: "HKISO", roundType: "HEAT", accent: "violet", examStartTime: "09:45", examEndTime: "10:45" },
  { competitionId: "hkico", title: "HKICO", roundType: "HEAT", accent: "yellow", examStartTime: "08:30", examEndTime: "09:30" },
];
const ROUND_SCHEDULES = {
  HEAT: { openDate: "2026-10-01", closeDate: "2026-11-30", examDate: "2026-12-13", editCloseDate: "2026-11-30" },
};
const demoExamCatalog = DEMO_COMPETITION_ROUNDS.map((competition) => ({
  id: `${competition.competitionId}-heat-2569`,
  competitionId: competition.competitionId,
  title: competition.title,
  year: "2569",
  roundType: competition.roundType,
  round: EXAM_ROUND_LABELS[competition.roundType],
  ...ROUND_SCHEDULES[competition.roundType],
  examStartTime: competition.examStartTime,
  examEndTime: competition.examEndTime,
  isOpen: true,
  accent: competition.accent,
  prices: { paperBased: 755, onlineExam: 655 },
  description: `${competition.title} · HEAT ROUND · ปีการศึกษา 2569`,
}));
function getExamRoundType(exam) {
  if (exam.roundType) return exam.roundType;
  const round = String(exam.round || "").toUpperCase();
  if (round.includes("FINAL X") || round.includes("FINAL_X")) return "FINAL_X";
  if (round.includes("FINAL")) return "FINAL";
  return "HEAT";
}

function normalizeAwardLabel(award) {
  const normalizedAward = String(award || "").trim().toUpperCase().replace(/\s+/g, " ");
  const medalMatch = normalizedAward.match(/^(GOLD|SILVER|BRONZE)(?: (?:MEDAL|AWARD))?$/);
  if (medalMatch) return `${medalMatch[1]} AWARD`;
  const ordinalMatch = normalizedAward.match(/^(1ST|2ND|3RD)(?: (?:AWARD|PLACE|PRIZE))?$/);
  return ordinalMatch ? ordinalMatch[1] : normalizedAward;
}

function isFinalEligibleAward(award, competitionId = "") {
  const normalizedAward = normalizeAwardLabel(award);
  if (competitionId === "bbb") return ["1ST", "2ND", "3RD"].includes(normalizedAward);
  if (FINAL_ELIGIBLE_AWARDS.has(normalizedAward)) return true;
  return false;
}

function getPublicResultStatus(row) {
  if (row.roundType === "HEAT") {
    return isFinalEligibleAward(row.award, row.competitionId)
      ? { label: "ผ่านรอบ HEAT ROUND", tone: "eligible" }
      : { label: "ไม่ผ่านรอบ HEAT ROUND", tone: "not-eligible" };
  }
  return { label: "ประกาศผลแล้ว", tone: "published" };
}

function getActiveExamYear(examCatalog, roundType, fallbackYear = "") {
  const roundExams = (examCatalog || []).filter((item) => getExamRoundType(item) === roundType);
  const openYears = [...new Set(roundExams.filter((item) => item.isOpen).map((item) => item.year).filter(Boolean))];
  const years = openYears.length ? openYears : [...new Set(roundExams.map((item) => item.year).filter(Boolean))];
  return years.sort((left, right) => Number(right) - Number(left))[0] || fallbackYear;
}

function selectedExamDateText(examCatalog, roundType, year, competitionIds) {
  const ids = new Set(competitionIds || []);
  const dates = [...new Set((examCatalog || [])
    .filter((exam) => getExamRoundType(exam) === roundType && exam.year === year && ids.has(exam.competitionId))
    .map((exam) => exam.examDate).filter(Boolean))];
  if (dates.length === 1) return formatThaiDate(dates[0]);
  if (dates.length > 1) return "หลายวัน · ตรวจสอบแยกตามรายการสอบ";
  return "ตรวจสอบกำหนดการของรายการสอบ";
}

function getCompetitionExamPrice(examCatalog, competitionId, roundType, format, competitionFees, year = "2569") {
  const roundExams = (examCatalog || []).filter((item) => item.competitionId === competitionId && getExamRoundType(item) === roundType);
  const exam = roundExams.find((item) => item.year === year) || roundExams.find((item) => item.isOpen) || roundExams[0];
  const priceKey = format === "Online" || format === "Online Exam" ? "onlineExam" : "paperBased";
  const configuredPrice = exam?.prices?.[priceKey];
  if (configuredPrice !== undefined && configuredPrice !== null && configuredPrice !== "") return Math.max(0, Number(configuredPrice) || 0);
  const legacyKey = roundType === "HEAT"
    ? (priceKey === "onlineExam" ? "heatOnline" : "heatOnsite")
    : (priceKey === "onlineExam" ? "finalOnline" : "finalOnsite");
  return Number(competitionFees?.[legacyKey] || 0);
}

function normalizeExamFormat(format, fallback = "Paper-Based") {
  if (["Online", "Online Exam"].includes(format)) return "Online";
  if (["Paper-Based", "On-site", "Onsite"].includes(format)) return "Paper-Based";
  return fallback;
}

function getApplicationCompetitionFormat(application, competition) {
  return normalizeExamFormat(competition?.format, normalizeExamFormat(application?.format));
}

function getCompetitionExamEmailValue(emailsByCompetition, competitionId, fallback = "") {
  if (Object.prototype.hasOwnProperty.call(emailsByCompetition || {}, competitionId)) {
    return String(emailsByCompetition[competitionId] ?? "");
  }
  return String(fallback || "");
}

function getApplicationCompetitionExamEmail(application, competition) {
  if (Object.prototype.hasOwnProperty.call(competition || {}, "examEmail")) {
    return String(competition.examEmail ?? "");
  }
  return String(application?.examEmail || application?.studentInformation?.examEmail || "");
}

function getApplicationCompetitionCenter(application, competition) {
  const savedCenter = competition?.centerSnapshot?.name || competition?.center;
  if (savedCenter) return savedCenter;
  if (getApplicationCompetitionFormat(application, competition) === "Online") return "Online : Home Base";
  return application?.center || "";
}

function getApplicationFormatSummary(application) {
  const formats = new Set((application?.competitions || []).map((competition) => getApplicationCompetitionFormat(application, competition)));
  if (formats.size > 1) return "Paper-Based + Online Exam";
  if (formats.has("Online")) return "Online Exam";
  if (formats.has("Paper-Based")) return "Paper-Based";
  return application?.format === "On-site" ? "Paper-Based" : application?.format || "ไม่ระบุรูปแบบ";
}

function getApplicationCenterSummary(application) {
  const centers = [...new Set((application?.competitions || []).map((competition) => getApplicationCompetitionCenter(application, competition)).filter(Boolean))];
  return centers.length ? centers.join(" · ") : application?.center || "—";
}

function CompetitionFormatPicker({ competitionId, format, paperPrice, onlinePrice, onChange, prefix = "form", disabled = false }) {
  return <fieldset className="competition-format-picker"><legend>รูปแบบสอบ <span className="required-mark">*</span></legend><div className="competition-format-options">
    <label className={format === "Paper-Based" ? "competition-format-option selected" : "competition-format-option"}>
      <input type="radio" name={`format-${prefix}-${competitionId}`} checked={format === "Paper-Based"} disabled={disabled} onChange={() => onChange("Paper-Based")} />
      <span><strong>Paper-Based</strong></span><b>฿{Number(paperPrice || 0).toLocaleString()}</b>
    </label>
    <label className={format === "Online" ? "competition-format-option selected" : "competition-format-option"}>
      <input type="radio" name={`format-${prefix}-${competitionId}`} checked={format === "Online"} disabled={disabled} onChange={() => onChange("Online")} />
      <span><strong>Online Exam</strong></span><b>฿{Number(onlinePrice || 0).toLocaleString()}</b>
    </label>
  </div></fieldset>;
}

function formatThaiDate(date) {
  if (!date) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function formatExamTime(exam) {
  if (exam?.examStartTime && exam?.examEndTime) return `${exam.examStartTime}–${exam.examEndTime} น.`;
  if (exam?.examStartTime) return `เริ่ม ${exam.examStartTime} น.`;
  if (exam?.examEndTime) return `ถึง ${exam.examEndTime} น.`;
  return "ยังไม่กำหนดเวลา";
}

function formatExamSession(exam) {
  if (!exam) return "ยังไม่กำหนดวันสอบ";
  return `${formatThaiDate(exam.examDate)} · ${formatExamTime(exam)}`;
}

function ExamScheduleNotice({ examCatalog = [], navigate }) {
  const exam = examCatalog.find((item) => getExamRoundType(item) === "HEAT" && item.isOpen && item.examDate)
    || examCatalog.find((item) => getExamRoundType(item) === "HEAT" && item.examDate);
  return <div className="landing-note"><Icon name="calendar" size={15} />{exam
    ? <span>รอบรับสมัครปีการศึกษา {exam.year} · สอบวันที่ {formatThaiDate(exam.examDate)}</span>
    : <a href="/#open-exams" onClick={(event) => { event.preventDefault(); navigate("home"); window.setTimeout(() => document.getElementById("open-exams")?.scrollIntoView(), 80); }}>ดูรายการสอบที่เปิดรับสมัคร</a>}</div>;
}

function getBangkokTodayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function millisecondsUntilBangkokMidnight() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const nextMidnightUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + 1) - 7 * 60 * 60 * 1000;
  return Math.max(1000, nextMidnightUtc - Date.now() + 100);
}

function getApplicationEditDeadline(application, examCatalog) {
  if (application?.editDeadline !== undefined) return application.editDeadline || "";
  const roundType = application?.kind === "Final" ? "FINAL" : "HEAT";
  const roundExams = (examCatalog || []).filter((exam) => exam.year === application?.year && getExamRoundType(exam) === roundType);
  const competitionIds = new Set((application?.competitions || []).map((item) => item.id));
  const matchingExams = roundExams.filter((exam) => competitionIds.has(exam.competitionId));
  return (matchingExams.length ? matchingExams : roundExams)
    .map((exam) => exam.editCloseDate)
    .filter(Boolean)
    .sort()[0] || "";
}

function isApplicationEditable(application, examCatalog) {
  if (application?.status !== "confirmed") return false;
  if (typeof application?.canEdit === "boolean" && !application.canEdit) return false;
  const deadline = getApplicationEditDeadline(application, examCatalog);
  return Boolean(deadline && getBangkokTodayISO() <= deadline);
}

function getApplicationsForResultTarget(applications, target) {
  if (!target) return [];
  const kind = getExamRoundType(target) === "HEAT" ? "Heat" : "Final";
  return applications.filter((application) => application.kind === kind
    && application.year === target.year
    && ((application.competitions || []).some((competition) => competition.id === target.competitionId)
      || (application.examIds || []).includes(target.competitionId)));
}

function getApplicationPhone(application) {
  return application?.studentInformation?.phone || application?.phone || (application?.phoneLast4 ? `08X-XXX-${application.phoneLast4}` : "ไม่ระบุ");
}

function resultTargetLabel(target) {
  const title = target?.title || target?.competitionTitle || "รายการสอบ";
  const round = EXAM_ROUND_LABELS[target?.roundType] || target?.round || "รอบสอบ";
  return `${title} · ${round} · ปี ${target?.year || "ไม่ระบุ"}`;
}

async function parseAdminWorkbook(file, includeAward = false) {
  const workbook = await readWorkbook(file);
  const sheet = worksheetRows(workbook, workbook.SheetNames[0]);
  const normalizeHeader = (value) => String(value || "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/gu, "");
  const aliases = {
    candidateNo: ["candidateno", "candidatenumber", "examnumber", "examno", "เลขประจำตัว", "เลขสอบ"],
    grade: ["grade", "ระดับชั้น", "ชั้น"],
    schoolName: ["schoolname", "school", "โรงเรียน"],
    candidateName: ["candidatename", "name", "studentname", "ชื่อผู้สมัคร", "ชื่อ"],
    award: ["award", "รางวัล"],
  };
  const required = includeAward ? ["candidateNo", "grade", "schoolName", "candidateName", "award"] : ["candidateNo", "schoolName", "candidateName"];
  const fields = includeAward || aliases.grade.some((alias) => sheet.slice(0, 30).some((row) => row.map(normalizeHeader).includes(normalizeHeader(alias)))) ? [...required, ...(required.includes("grade") ? [] : ["grade"])] : required;
  const headerIndex = sheet.slice(0, 30).findIndex((row) => {
    const values = row.map(normalizeHeader);
    return required.filter((key) => aliases[key].some((alias) => values.includes(normalizeHeader(alias)))).length === required.length;
  });
  if (headerIndex < 0) throw new Error(`ไม่พบหัวคอลัมน์ ${includeAward ? "CANDIDATE NO, GRADE, SCHOOL NAME, CANDIDATE NAME และ AWARD" : "CANDIDATE NO, GRADE, SCHOOL NAME และ CANDIDATE NAME"}`);
  const headers = sheet[headerIndex].map(normalizeHeader);
  const indexes = Object.fromEntries(fields.map((key) => [key, headers.findIndex((header) => aliases[key].some((alias) => header === normalizeHeader(alias)))]));
  const rows = sheet.slice(headerIndex + 1).map((row) => Object.fromEntries(fields.map((key) => [key, String(row[indexes[key]] ?? "").trim()]))).filter((row) => Object.values(row).some(Boolean));
  if (!rows.length) throw new Error("ไฟล์ไม่มีแถวข้อมูลผู้สมัคร");
  return rows;
}

function isWithinRegistrationWindow(exam, today = getBangkokTodayISO()) {
  return Boolean(exam?.openDate && exam?.closeDate && today >= exam.openDate && today <= exam.closeDate);
}

function isFinalConfirmationWindowOpen(exam, today = getBangkokTodayISO()) {
  return isWithinRegistrationWindow(exam, today) && !exam?.finalManuallyClosed;
}

function getEligibleFinalRounds(application, examCatalog, publishedHeatResults, today = getBangkokTodayISO()) {
  const passedCompetitions = new Set((application?.competitions || []).filter((competition) => (publishedHeatResults || []).some((result) => {
    const matchesItem = !result.applicationItemId || !competition.applicationItemId || result.applicationItemId === competition.applicationItemId;
    const eligible = typeof result.eligibleForFinal === "boolean" ? result.eligibleForFinal : isFinalEligibleAward(result.award, result.competitionId);
    return result.applicationId === application?.id
      && String(result.year) === String(application?.year)
      && (!result.roundType || result.roundType === "HEAT")
      && result.competitionId === competition.id
      && matchesItem
      && eligible;
  })).map((competition) => competition.id));
  const applicationCompetitions = new Set((application?.competitions || []).map((competition) => competition.id));
  return (examCatalog || []).filter((exam) => exam.year === application?.year
    && getExamRoundType(exam) === "FINAL"
    && !exam.finalManuallyClosed
    && passedCompetitions.has(exam.competitionId)
    && applicationCompetitions.has(exam.competitionId)
    && isFinalConfirmationWindowOpen(exam, today));
}

function getFinalRegistrationCatalog(examCatalog, applications, publishedHeatResults, today = getBangkokTodayISO()) {
  const eligibleFinalIds = new Set();
  const qualifiedFinalIds = new Set();
  const finalsByCompetitionYear = new Map();
  (examCatalog || []).filter((exam) => getExamRoundType(exam) === "FINAL").forEach((exam) => {
    const key = `${exam.competitionId}::${exam.year}`;
    finalsByCompetitionYear.set(key, [...(finalsByCompetitionYear.get(key) || []), exam]);
  });
  const applicationsById = new Map((applications || []).map((application) => [application.id, application]));
  const heatResultKeys = new Set();
  (publishedHeatResults || []).forEach((result) => {
    const key = `${result.competitionId}::${result.year}`;
    heatResultKeys.add(key);
    if (!isFinalEligibleAward(result.award, result.competitionId)) return;
    const application = applicationsById.get(result.applicationId);
    if (application?.kind !== "Heat" || application.year !== result.year
      || !(application.competitions || []).some((competition) => competition.id === result.competitionId)) return;
    (finalsByCompetitionYear.get(key) || []).forEach((exam) => {
      qualifiedFinalIds.add(exam.id);
      if (!exam.finalManuallyClosed && isWithinRegistrationWindow(exam, today)) eligibleFinalIds.add(exam.id);
    });
  });
  return (examCatalog || []).map((exam) => {
    if (getExamRoundType(exam) !== "FINAL") return { ...exam, isOpen: !exam.finalManuallyClosed && isWithinRegistrationWindow(exam, today) };
    const hasHeatResults = heatResultKeys.has(`${exam.competitionId}::${exam.year}`);
    let status = "waiting-results";
    if (exam.finalManuallyClosed) status = "closed-manual";
    else if (exam.openDate && today < exam.openDate) status = "not-open-yet";
    else if (!exam.closeDate || today > exam.closeDate) status = "closed-deadline";
    else if (eligibleFinalIds.has(exam.id)) status = "open";
    else if (hasHeatResults || qualifiedFinalIds.has(exam.id)) status = "no-eligible-applicants";
    return { ...exam, isOpen: status === "open", finalRegistrationStatus: status };
  });
}

function ExamLogo({ exam, className = "exam-type-mark", iconSize = 20 }) {
  return <span className={`${className}${exam.logoDataUrl ? " exam-logo-has-image" : ""}`}>{exam.logoDataUrl ? <img src={exam.logoDataUrl} alt={`โลโก้ ${exam.title}`} /> : <Icon name="award" size={iconSize} />}</span>;
}

const demoGoogleProfile = {
  name: "Nicha Srisawat",
  email: "nicha.student@example.com",
  picture: "/demo-google-avatar.svg",
};

const iconGlyphs = {
  home: "home",
  file: "file",
  book: "book",
  search: "search",
  check: "check",
  award: "medal",
  grid: "apps",
  users: "users",
  settings: "settings",
  upload: "upload",
  sync: "refresh",
  bell: "bell",
  arrow: "arrow-to-right",
  chevron: "angle-small-right",
  clock: "clock",
  lock: "lock",
  info: "circle-i",
  edit: "edit",
  plus: "add",
  menu: "menu-burger",
  mail: "envelope",
  phone: "phone-call",
  calendar: "calendar",
  building: "building",
  monitor: "monitor",
  download: "download",
  copy: "copy-alt",
  close: "cross-small",
  cursor: "cursor",
  trash: "trash",
  help: "interrogation",
  shield: "shield-check",
  hash: "hastag",
  sparkle: "sparkles",
  image: "picture",
};

function Icon({ name, size = 18, className = "" }) {
  const glyph = iconGlyphs[name] || iconGlyphs.file;
  return <i className={`ocec-icon fi fi-rr-${glyph} ${className}`} style={{ fontSize: `${size}px` }} aria-hidden="true" />;
}

function BrandMark() {
  return (
    <span className="brand-logo-window" role="img" aria-label="OCEC TH">
      <img src="/ocec-logo.png" alt="" />
    </span>
  );
}

function Button({ children, variant = "primary", icon, type = "button", onClick, disabled = false, className = "", ariaLabel, title }) {
  return (
    <button
      className={"button button-" + variant + " " + className}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
    >
      {icon ? <Icon name={icon} size={17} /> : null}
      <span>{children}</span>
    </button>
  );
}

function StatusBadge({ status }) {
  const rejected = status === "rejected";
  const pending = status !== "confirmed" && !rejected;
  return (
    <span className={"status-badge " + (rejected ? "status-rejected" : pending ? "status-pending" : "status-confirmed")}>
      <span className="status-dot" aria-hidden="true" />
      {rejected ? "ไม่อนุมัติ" : pending ? "รออนุมัติ/ตรวจสอบสลิป" : "ยืนยันใบสมัคร"}
    </span>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {action ? <div className="heading-action">{action}</div> : null}
    </div>
  );
}

function Field({ label, hint, required = false, children, className = "" }) {
  const id = useId();
  const hintId = id + "-hint";
  let assigned = false;
  function labelControl(element) {
    if (!React.isValidElement(element)) return element;
    if (!assigned && typeof element.type === "string" && ["input", "select", "textarea"].includes(element.type)) {
      assigned = true;
      return React.cloneElement(element, {
        id: element.props.id || id,
        "aria-labelledby": [element.props["aria-labelledby"], id + "-label"].filter(Boolean).join(" "),
        "aria-describedby": [element.props["aria-describedby"], hint ? hintId : ""].filter(Boolean).join(" ") || undefined,
      });
    }
    if (element.props.children) {
      return React.cloneElement(element, undefined, React.Children.map(element.props.children, labelControl));
    }
    return element;
  }
  const controls = React.Children.map(children, labelControl);
  return (
    <div className={"field " + className}>
      <label id={id + "-label"} htmlFor={id}>
        {label}{required ? <span className="required-mark"> *</span> : null}
      </label>
      {controls}
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
    </div>
  );
}

const FORM_COMPETITIONS = [
  { id: "bbb", short: "BBB", name: "Big Bay Bei (BBB)", subject: "Mathematics", grades: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
  { id: "hkiso", short: "HKISO", name: "HKISO", subject: "Science", grades: ["Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
  { id: "hkico", short: "HKICO", name: "HKICO", subject: "Computer", grades: ["Primary 2 — Scratch", "Primary 3 — Scratch", "Primary 4 — Scratch", "Primary 5 — Blockly", "Primary 6 — Blockly", "Secondary 1 — Blockly", "Secondary 2 — Python", "Secondary 3 — Python", "Senior Secondary — Python"] },
];
const DEFAULT_GRADE_CATALOG = [...new Set(FORM_COMPETITIONS.flatMap((competition) => competition.grades))];

function getFormCompetitions(examCatalog, roundType, options = {}) {
  const matchingExams = (examCatalog || []).filter((exam) => getExamRoundType(exam) === roundType && (!options.openOnly || exam.isOpen) && (!options.year || exam.year === options.year));
  if (!matchingExams.length) return examCatalog?.length ? [] : FORM_COMPETITIONS;
  const catalogById = new Map(FORM_COMPETITIONS.map((competition) => [competition.id, competition]));
  const uniqueExams = [...new Map(matchingExams.map((exam) => [exam.competitionId || exam.id, exam])).values()];
  return uniqueExams.map((exam) => ({ ...(catalogById.get(exam.competitionId) || ({
    id: exam.competitionId || exam.id,
    short: exam.title.length > 18 ? `${exam.title.slice(0, 16)}…` : exam.title,
    name: exam.title,
    subject: "Academic Competition",
    grades: DEFAULT_GRADE_CATALOG,
  })), grades: Array.isArray(exam.gradeOptions) ? exam.gradeOptions : (catalogById.get(exam.competitionId)?.grades || DEFAULT_GRADE_CATALOG), centerIds: exam.centerIds || [], year: exam.year }));
}

const FORM_PAST_PAPER_GROUPS = [
  { id: "hkiso", title: "HKISO Past Papers", items: [
    { id: "hkiso-2023", title: "HKISO Heat Round 2023–2024", detail: "English Version", price: 200 },
    { id: "hkiso-2024", title: "HKISO Heat Round 2024–2025", detail: "English Version", price: 200 },
  ] },
  { id: "hkico", title: "HKICO Past Papers", items: [
    { id: "hkico-2023", title: "HKICO Heat Round 2023–2024", detail: "English Version", price: 250 },
    { id: "hkico-2024", title: "HKICO Heat Round 2024–2025", detail: "English Version", price: 250 },
  ] },
  { id: "bbb", title: "Big Bay Bei Past Papers", items: [
    { id: "bbb-2024", title: "Qualifier Round 2024", detail: "PDF English + Thai · Thai VDO", price: 250 },
    { id: "bbb-2025", title: "Qualifier Round 2025", detail: "PDF English + Thai · Thai VDO", price: 250 },
    { id: "bbb-2026", title: "Qualifier Round 2026", detail: "PDF English + Thai · Thai VDO", price: 250 },
  ] },
];

const DEMO_PAST_PAPERS = FORM_PAST_PAPER_GROUPS.flatMap((group) => group.items.map((item) => ({ id: item.id, group: group.title, title: item.title, detail: item.detail, name: `${item.title} — ${item.detail}`, price: item.price, active: true })));

function groupPastPaperCatalog(catalog) {
  return Object.values((catalog || []).filter((paper) => paper.active).reduce((groups, paper) => {
    const groupName = paper.group || "ข้อสอบเก่า";
    const id = groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "past-papers";
    groups[id] ||= { id, title: groupName, items: [] };
    groups[id].items.push({ id: paper.id, title: paper.title || paper.name, detail: paper.detail || "", price: Number(paper.price || 0) });
    return groups;
  }, {}));
}

const FORM_SCHOOLS = ["AIT International School", "Aiyasiri School", "Amnuay Silpa School", "Bangkok Christian College", "Bangkok Patana School", "Chulalongkorn University Demonstration School", "Kasetsart University Laboratory School", "Satit Prasarnmit Demonstration School", "Triam Udom Suksa School", "Other"];

function createSchoolApplicant(id, prefill) {
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

function ApplicationCard({ application, onOpen, resultRows = [], examCatalog = [], today, authProfile, hasFinalApplication = false, onConfirmFinal }) {
  const resultState = getApplicationHeatResultState(application, resultRows, today);
  const finalRounds = application.kind === "Heat" ? getEligibleFinalRounds(application, examCatalog, resultRows, today) : [];
  const isOwnAccountApplication = Boolean(authProfile?.email
    && !authProfile?.isAdmin
    && application.source === "self"
    && application.contactEmail?.toLowerCase() === authProfile.email.toLowerCase());
  const canConfirmFinal = isOwnAccountApplication && !hasFinalApplication && finalRounds.length > 0 && typeof onConfirmFinal === "function";
  const hasFinalOpportunity = canConfirmFinal && resultState?.items.some(({ result, competition }) => result
    && finalRounds.some((round) => round.competitionId === competition.id));
  const resultStageLabel = resultState?.status === "waiting"
    ? "รอประกาศผลสอบ"
    : resultState?.status === "published" ? "ประกาศผลสอบ" : "";
  return (
    <article className={`application-card${hasFinalOpportunity ? " application-card-final-eligible" : ""}`}>
      <div className="application-card-top">
        <div className="candidate-avatar">{application.candidate.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
        <div className="application-card-title">
          <p className="application-kind">{application.kind} · {application.year}</p>
          <h3>{application.candidate}</h3>
          <p>{application.school}</p>
        </div>
        <div className="application-card-status-group">
          {resultStageLabel ? <span className={`application-result-stage ${resultState.status === "published" ? "is-published" : "is-waiting"}`}><span className="status-dot" aria-hidden="true" />{resultStageLabel}</span> : <StatusBadge status={application.status} />}
          {hasFinalOpportunity ? <div className="application-final-chip"><Icon name="award" size={15} /><span><strong>ได้รับสิทธิ์สมัครรอบ Final แล้ว</strong></span><Button variant="success" className="application-final-chip-button" onClick={() => onConfirmFinal(application, finalRounds)}>ยืนยัน</Button></div> : null}
        </div>
      </div>
      <div className="application-meta-grid">
        <div>
          <span>รายการสอบ</span>
          <strong>{application.exam}</strong>
        </div>
        <div>
          <span>เลขประจำตัวสอบ</span>
          <strong>{application.kind === "Final" ? (application.finalId || "รอเลขประจำตัว") : (application.heatId || "รอเลขประจำตัว")}</strong>
        </div>
        <div>
          <span>วันที่ส่งใบสมัคร</span>
          <strong>{application.submitted}</strong>
        </div>
      </div>
      {resultStageLabel ? <div className="application-card-results" aria-label="ผลสอบรายรายการ">
        {resultState.items.map(({ competition, result, status }) => {
          const outcome = result ? (typeof result.eligibleForFinal === "boolean" ? result.eligibleForFinal : result.result ? result.result === "pass" : isFinalEligibleAward(result.award, competition.id)) : null;
          const competitionName = competition.short || competition.name || competition.id;
          return <div className="application-card-result-row" key={competition.applicationItemId || competition.id}>
            <strong>{competitionName}{competition.grade ? ` · ${competition.grade}` : ""}</strong>
            {result ? <span className="application-card-result-copy"><span className="application-result-published">ประกาศผลสอบ</span><span className={`application-result-outcome ${outcome ? "is-passed" : "is-not-passed"}`}>{outcome ? "ผ่านรอบ HEAT ROUND" : "ไม่ผ่านรอบ HEAT ROUND"}</span></span>
              : status === "waiting" ? <span className="application-result-outcome is-waiting">รอประกาศผลสอบ</span>
                : <span className="application-result-upcoming">ยังไม่ถึงวันสอบ</span>}
          </div>;
        })}
      </div> : null}
      <div className="application-card-footer">
        <div className="application-card-footer-meta">
          <span className="muted-inline"><Icon name="building" size={15} />{getApplicationCenterSummary(application)}</span>
          <span className="muted-inline"><Icon name="phone" size={15} />{getApplicationPhone(application)}</span>
        </div>
        <Button variant="text" icon="arrow" onClick={onOpen}>ดูรายละเอียด</Button>
      </div>
    </article>
  );
}

function Sidebar({ page, persona, applications = [], navigate, open, onClose, notify, activeYear }) {
  const pendingReviewCount = applications.filter((item) => item.status === "pending").length;
  const mainItems = [
    { id: "home", label: "ภาพรวม", icon: "home" },
    { id: "apply-heat", label: "สมัครสอบ", icon: "plus" },
    { id: "applications", label: "ใบสมัครของฉัน", icon: "file", count: String(applications.filter((item) => persona === "coordinator" || item.owner === "candidate").length) },
    { id: "lookup-choice", label: "ค้นหา / แก้ไขใบสมัคร", icon: "search" },
    { id: "final-confirm", label: "ยืนยันสิทธิ์ Final", icon: "award" },
    { id: "results", label: "ประกาศผล", icon: "grid" },
  ];
  const adminGroups = [
    { label: "ภาพรวม", items: [{ id: "admin-home", label: "ภาพรวมแอดมิน", icon: "grid" }] },
    { label: "ใบสมัคร", items: [{ id: "admin-review", label: "ตรวจใบสมัคร", icon: "file", count: String(pendingReviewCount) }] },
    { label: "รอบสอบและข้อมูลตั้งต้น", items: [{ id: "admin-round", label: "รายการสอบและกำหนดการ", icon: "calendar" }, { id: "admin-form-options", label: "ข้อมูลตัวเลือกในฟอร์ม", icon: "settings" }] },
    { label: "ผลสอบและ Final", items: [{ id: "admin-results", label: "นำเข้าผลสอบ", icon: "award" }, { id: "admin-final-ids", label: "เลขประจำตัว Final", icon: "users" }] },
    { label: "รายงานและการจัดส่ง", items: [{ id: "admin-mock-papers", label: "รายชื่อ Mock และข้อสอบเก่า", icon: "book" }, { id: "admin-sheets", label: "Google Sheets", icon: "sync" }] },
  ];
  const renderItems = (items) => items.map((item) => (
    <a
      href={"#" + item.id}
      className={"nav-link " + (page === item.id ? "nav-link-active" : "")}
      key={item.id}
      title={persona === "admin" ? item.label : undefined}
      aria-current={page === item.id ? "page" : undefined}
      onClick={() => navigate(item.id)}
    >
      <Icon name={item.icon} size={18} />
      <span>{item.label}</span>
      {item.count ? <span className="nav-count">{item.count}</span> : null}
    </a>
  ));

  return (
    <>
      {open ? <button className="sidebar-scrim" aria-label="ปิดเมนู" onClick={onClose} /> : null}
      <aside className={"sidebar " + (open ? "sidebar-open" : "")}>
        <div className="brand-lockup">
          {persona === "admin" ? <span className="admin-brand-symbol" aria-hidden="true">O</span> : <BrandMark />}
          <div>
            <strong>OCEC Portal</strong>
            <span>ระบบสมัครสอบ</span>
          </div>
          <button className="icon-button sidebar-close" aria-label="ปิดเมนู" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="round-switch">
          <span className="round-icon"><Icon name="calendar" size={17} /></span>
          <div><span>รอบการสอบ</span><strong>{activeYear ? `ประจำปี ${activeYear}` : "ยังไม่กำหนดปี"}</strong></div>
          <span className="round-caret">⌄</span>
        </div>
        <nav aria-label={persona === "admin" ? "จัดการระบบ" : "เมนูหลัก"}>
          {persona !== "admin" ? <>
            <p className="nav-section-title">เมนูหลัก</p>
            <div className="nav-list">{renderItems(mainItems)}</div>
          </> : null}
          {persona === "admin" ? (
            adminGroups.map((group) => <section className="admin-nav-group" key={group.label}><p className="nav-section-title nav-section-admin">{group.label}</p><div className="nav-list">{renderItems(group.items)}</div></section>)
          ) : null}
        </nav>
        <div className="sidebar-bottom">
          {persona !== "admin" ? <div className="help-card">
            <span className="help-icon"><Icon name="help" size={17} /></span>
            <strong>ต้องการความช่วยเหลือ?</strong>
            <p>ดูคำแนะนำการสมัครและการใช้งาน</p>
            <a href="https://lin.ee/3hzFg1z" target="_blank" rel="noopener noreferrer">ศูนย์ช่วยเหลือ <Icon name="arrow" size={14} /></a>
          </div> : null}
          <div className="sidebar-version"><span className="online-dot" />ระบบพร้อมใช้งาน <span>v1.0</span></div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ title, persona, setPersona, menuOpen, setMenuOpen, navigate, authProfile, onSignOut, activeYear }) {
  const roleNames = {
    guest: "บุคคลทั่วไป",
    candidate: "ผู้สมัคร",
    coordinator: "ผู้ประสานงานโรงเรียน",
    admin: "ผู้ดูแลระบบ",
  };
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-menu-button"
          aria-label="เปิดเมนู"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name="menu" size={21} />
        </button>
        <div className="breadcrumb"><span>OCEC Portal</span><Icon name="chevron" size={14} /><strong>{title}</strong></div>
      </div>
      <div className="topbar-actions">
        <span className="topbar-round"><span className="online-dot" />{activeYear ? `รอบสอบ ${activeYear}` : "รอบสอบ"}</span>
        {BACKEND_ENABLED && persona === "admin" ? (
          <div className="admin-session-chip">
            <ProfileAvatar src={authProfile?.picture} alt="" />
            <span><strong>{authProfile?.name || "ผู้ดูแลระบบ"}</strong><small>{authProfile?.email || ""}</small></span>
            <button type="button" onClick={onSignOut}>ออกจากระบบ</button>
          </div>
        ) : <>
        {!BACKEND_ENABLED ? <label className="persona-control">
          <span className="sr-only">สลับมุมมองตัวอย่าง</span>
          <select value={persona} onChange={(event) => setPersona(event.target.value)}>
            {Object.keys(roleNames).map((key) => <option value={key} key={key}>{roleNames[key]}</option>)}
          </select>
        </label> : null}
        {persona === "guest" ? (
          <Button variant="outline" icon="shield" onClick={() => { setPersona("candidate"); }}>เข้าสู่ระบบด้วย Google</Button>
        ) : (
          <button className="profile-chip" onClick={() => navigate(persona === "admin" ? "admin-home" : "applications")} aria-label={persona === "admin" ? "เปิดภาพรวมแอดมิน" : "เปิดใบสมัครของฉัน"}>
            <span className="profile-avatar">{persona === "admin" ? "AD" : persona === "coordinator" ? "PK" : "NS"}</span>
            <span className="profile-name">{persona === "admin" ? "ผู้ดูแลระบบ" : persona === "coordinator" ? "Pimchanok K." : "Nicha S."}</span>
            <span className="profile-caret">⌄</span>
          </button>
        )}
        </>}
      </div>
    </header>
  );
}

function HomePage({ navigate, persona, applications }) {
  const activeCount = applications.filter((item) => item.status === "pending").length;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="ยินดีต้อนรับ"
        title={persona === "admin" ? "ศูนย์จัดการการสอบ" : "สวัสดี, ยินดีต้อนรับกลับ"}
        description={persona === "coordinator" ? "ติดตามใบสมัครของนักเรียนและจัดการทุกขั้นตอนได้ในที่เดียว" : "จัดการใบสมัครและติดตามข่าวสารการสอบของคุณได้ที่นี่"}
      />
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker"><span className="hero-kicker-dot" />เปิดรับสมัครรอบใหม่</span>
          <h2>ทุกขั้นตอนการสอบ<br /><span>อยู่ที่นี่ในที่เดียว</span></h2>
          <p>สมัครสอบ ติดตามสถานะ และรับข่าวสารจาก OCEC ได้อย่างสะดวกและปลอดภัย</p>
          <div className="hero-actions">
            <Button icon="arrow" onClick={() => navigate("apply-heat")}>เริ่มสมัครสอบ</Button>
            <Button variant="light" icon="search" onClick={() => navigate("lookup-choice")}>ตรวจสอบสถานะ</Button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-paper">
            <div className="paper-top"><span /><span /><span /></div>
            <div className="paper-seal"><Icon name="shield" size={28} /></div>
            <div className="paper-lines"><i /><i /><i /></div>
            <div className="paper-check"><Icon name="check" size={16} /></div>
          </div>
          <div className="hero-float hero-float-top"><span className="float-check"><Icon name="check" size={15} /></span><span><strong>สมัครสำเร็จ</strong><small>ใบสมัครของคุณถูกบันทึกแล้ว</small></span></div>
          <div className="hero-float hero-float-bottom"><span className="float-calendar"><Icon name="calendar" size={17} /></span><span><small>รอบสมัครปิด</small><strong>30 พฤศจิกายน 2569</strong></span></div>
        </div>
      </section>

      <div className="summary-grid">
        <div className="summary-card">
          <span className="summary-icon summary-blue"><Icon name="file" /></span>
          <div><span>ใบสมัครทั้งหมด</span><strong>{applications.length.toString().padStart(2, "0")} <small>ใบ</small></strong></div>
          <span className="summary-trend">ปี 2569</span>
        </div>
        <div className="summary-card">
          <span className="summary-icon summary-amber"><Icon name="clock" /></span>
          <div><span>รอตรวจสอบ</span><strong>{activeCount.toString().padStart(2, "0")} <small>ใบ</small></strong></div>
          <span className="summary-trend trend-amber">ต้องติดตาม</span>
        </div>
        <div className="summary-card">
          <span className="summary-icon summary-green"><Icon name="check" /></span>
          <div><span>ยืนยันแล้ว</span><strong>{(applications.length - activeCount).toString().padStart(2, "0")} <small>ใบ</small></strong></div>
          <span className="summary-trend trend-green">เรียบร้อย</span>
        </div>
      </div>

      <div className="home-content-grid">
        <section className="surface quick-panel">
          <div className="section-heading">
            <div><p className="eyebrow">เริ่มต้นใช้งาน</p><h2>คุณต้องการทำอะไร?</h2></div>
            <span className="section-index">01 / 04</span>
          </div>
          <div className="quick-action-grid">
            <button className="quick-action" onClick={() => navigate("apply-heat")}>
              <span className="quick-icon quick-blue"><Icon name="plus" /></span>
              <span><strong>สมัครสอบ Heat</strong><small>เริ่มสมัครสอบรอบคัดเลือก</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
            <button className="quick-action" onClick={() => navigate("applications")}>
              <span className="quick-icon quick-violet"><Icon name="file" /></span>
              <span><strong>ใบสมัครของฉัน</strong><small>ดูหรือแก้ไขใบสมัคร</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
            <button className="quick-action" onClick={() => navigate("final-confirm")}>
              <span className="quick-icon quick-teal"><Icon name="award" /></span>
              <span><strong>ยืนยันสิทธิ์ Final</strong><small>สำหรับผู้ผ่านรอบ Heat</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
            <button className="quick-action" onClick={() => navigate("results")}>
              <span className="quick-icon quick-amber"><Icon name="grid" /></span>
              <span><strong>ดูประกาศผลสอบ</strong><small>ค้นหาผลด้วยชื่อหรือเลขสอบ</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
          </div>
        </section>
        <aside className="surface schedule-panel">
          <div className="section-heading">
            <div><p className="eyebrow">กำหนดการ</p><h2>รอบสอบปัจจุบัน</h2></div>
            <span className="schedule-open">เปิดรับสมัคร</span>
          </div>
          <div className="schedule-name"><span className="schedule-mark"><Icon name="award" size={19} /></span><div><strong>OCEC Heat 2569</strong><span>รอบคัดเลือก · ปีการศึกษา 2569</span></div></div>
          <div className="schedule-line">
            <div className="schedule-step"><span className="step-dot step-done"><Icon name="check" size={12} /></span><div><strong>เปิดรับสมัคร</strong><small>1 ตุลาคม 2569</small></div></div>
            <div className="schedule-step"><span className="step-dot step-current" /><div><strong>ปิดรับสมัคร</strong><small>30 พฤศจิกายน 2569</small></div></div>
            <div className="schedule-step"><span className="step-dot" /><div><strong>ประกาศผล Heat</strong><small>15 ธันวาคม 2569</small></div></div>
          </div>
          <button className="schedule-link" onClick={() => navigate(persona === "admin" ? "admin-round" : "apply-heat")}>{persona === "admin" ? "ตั้งค่ารอบสอบ" : "ดูรายละเอียดและสมัคร"} <Icon name="arrow" size={15} /></button>
        </aside>
      </div>

      <section className="surface recent-panel">
        <div className="section-heading">
          <div><p className="eyebrow">อัปเดตล่าสุด</p><h2>ใบสมัครล่าสุด</h2></div>
          <Button variant="text" icon="arrow" onClick={() => navigate("applications")}>ดูใบสมัครทั้งหมด</Button>
        </div>
        <div className="recent-list">
          {applications.slice(0, 2).map((application) => (
            <button className="recent-row" key={application.id} onClick={() => navigate("application-detail", application.id)}>
              <span className="recent-icon"><Icon name={application.kind === "Final" ? "award" : "file"} /></span>
              <span className="recent-main"><strong>{application.candidate}</strong><small>{application.exam} · {application.school}</small></span>
              <StatusBadge status={application.status} />
              <span className="recent-date">{application.submitted}</span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function goToLandingSection(page, navigate, sectionId) {
  if (page === "home") {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  navigate("home");
  window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }), 80);
}

function GoogleMark() {
  return <span className="google-mark" aria-hidden="true">G</span>;
}

function PublicPortalHeader({ page, navigate, setPersona, authProfile, onSignIn, onSignOut }) {
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountRootRef = useRef(null);
  const dialogRef = useRef(null);
  const loginTriggerRef = useRef(null);
  const requiresRegistrationLogin = !authProfile && page === "apply-heat";

  useEffect(() => {
    setLoginDialogOpen(requiresRegistrationLogin);
  }, [requiresRegistrationLogin]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeOnOutsidePress = (event) => {
      if (!accountRootRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!loginDialogOpen) return undefined;
    const previousFocus = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.querySelector(".demo-account-choice")?.focus());
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        if (requiresRegistrationLogin) navigate("home");
        setLoginDialogOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscape);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [loginDialogOpen, requiresRegistrationLogin, navigate]);

  function keepFocusInsideDialog(event) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll("button:not([disabled]), a[href]");
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function dismissLoginDialog() {
    setLoginDialogOpen(false);
    if (requiresRegistrationLogin) navigate("home");
  }

  return (
    <header className="landing-header">
      <a className="landing-brand" href="/" aria-label="OCEC Portal หน้าแรก">
        <BrandMark />
        <span><strong>OCEC Portal</strong><small>ระบบสมัครสอบ</small></span>
      </a>
      <nav className="landing-nav" aria-label="เมนูหน้าเว็บ">
        <a href="#open-exams" onClick={(event) => { event.preventDefault(); goToLandingSection(page, navigate, "open-exams"); }}>รายการสอบ</a>
        <button onClick={() => navigate("lookup-choice")}>ค้นหาสถานะ</button>
        <button type="button" aria-current={page === "final-confirm" ? "page" : undefined} className={page === "final-confirm" ? "landing-nav-current" : ""} onClick={() => navigate("final-confirm")}>ยืนยันสิทธิ์</button>
        <button onClick={() => navigate("results")}>ประกาศผล</button>
      </nav>
      <div className="header-account" ref={accountRootRef}>
        {authProfile ? (
          <>
            <button
              className="account-menu-trigger"
              type="button"
              aria-haspopup="true"
              aria-expanded={accountMenuOpen}
              aria-controls="account-menu-panel"
              aria-label={`บัญชีผู้ใช้ ${authProfile.name} ${authProfile.email}`}
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <ProfileAvatar className="account-avatar" src={authProfile.picture} alt={`รูปโปรไฟล์ ${authProfile.name}`} />
              <span className="account-profile-copy"><strong>{authProfile.name}</strong><small>{authProfile.email}</small></span>
              <Icon name="chevron" size={16} className="account-chevron" />
            </button>
            {accountMenuOpen ? (
              <div className="account-menu-panel" id="account-menu-panel" aria-label="เมนูบัญชีผู้ใช้">
                <div className="account-menu-identity">
                  <ProfileAvatar className="account-avatar" src={authProfile.picture} alt="" />
                  <span><strong>{authProfile.name}</strong><small>{authProfile.email}</small></span>
                </div>
                <button type="button" onClick={() => { setPersona("candidate"); navigate("applications"); setAccountMenuOpen(false); }}><Icon name="file" size={16} />ใบสมัครของฉัน</button>
                <button type="button" onClick={() => { setAccountMenuOpen(false); onSignOut(); }}><Icon name="close" size={16} />ออกจากระบบ</button>
              </div>
            ) : null}
          </>
        ) : (
          <button className="google-signin-button" type="button" ref={loginTriggerRef} onClick={() => setLoginDialogOpen(true)}>
            <GoogleMark /><span>เข้าสู่ระบบ</span>
          </button>
        )}
      </div>
      {loginDialogOpen ? (
        <div className="auth-dialog-backdrop" onMouseDown={(event) => { if (!requiresRegistrationLogin && event.target === event.currentTarget) setLoginDialogOpen(false); }}>
          <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" ref={dialogRef} onKeyDown={keepFocusInsideDialog}>
            <button className="auth-dialog-close" type="button" aria-label={requiresRegistrationLogin ? "กลับหน้าหลัก" : "ปิดหน้าต่างเข้าสู่ระบบ"} onClick={dismissLoginDialog}><Icon name={requiresRegistrationLogin ? "arrow" : "close"} size={18} /></button>
            <span className="auth-dialog-mark"><GoogleMark /></span>
            <p className="eyebrow">เข้าสู่ระบบ OCEC Portal</p>
            <h2 id="auth-dialog-title">{requiresRegistrationLogin ? "เข้าสู่ระบบก่อนสมัคร" : BACKEND_ENABLED ? "เข้าสู่ระบบด้วย Google" : "เลือกบัญชี Google"}</h2>
            <p className="auth-dialog-description">{requiresRegistrationLogin ? "เข้าสู่ระบบเพื่อเริ่มกรอกใบสมัครและติดตามสถานะในบัญชีของคุณ หลังเข้าสู่ระบบแล้วจะกลับมาที่หน้านี้" : "ใช้บัญชีของคุณเพื่อดูใบสมัครและข้อมูลที่เกี่ยวข้อง"}</p>
            <button className="demo-account-choice" type="button" onClick={() => { onSignIn(demoGoogleProfile); setLoginDialogOpen(false); }}>
              {BACKEND_ENABLED ? <GoogleMark /> : <img src={demoGoogleProfile.picture} alt="" />}
              <span><strong>{BACKEND_ENABLED ? "ดำเนินการด้วยบัญชี Google" : demoGoogleProfile.name}</strong><small>{BACKEND_ENABLED ? "ยืนยันตัวตนผ่าน Google อย่างปลอดภัย" : demoGoogleProfile.email}</small></span>
              <Icon name="chevron" size={17} />
            </button>
            {!BACKEND_ENABLED ? <div className="auth-dialog-note"><Icon name="info" size={15} /><span>ตัวอย่างการเข้าสู่ระบบ · ยังไม่ได้เชื่อมต่อ Google OAuth จริง</span></div> : null}
            <button className="auth-dialog-cancel" type="button" onClick={dismissLoginDialog}>{requiresRegistrationLogin ? "กลับหน้าหลัก" : "ยกเลิก"}</button>
          </section>
        </div>
      ) : null}
    </header>
  );
}

function PublicPortalFooter() {
  return (
    <footer className="landing-footer">
      <a className="landing-footer-brand" href="/"><BrandMark /><span><strong>OCEC Portal</strong><small>ระบบสมัครสอบ</small></span></a>
      <span>© 2569 OCEC Portal</span>
      <a href="https://lin.ee/3hzFg1z" target="_blank" rel="noopener noreferrer">ศูนย์ช่วยเหลือ</a>
      <a className="flaticon-attribution" href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">UIcons by Flaticon</a>
    </footer>
  );
}

function AdminLoginPage({ authProfile, authChecked, backendEnabled, onSignIn, onSignOut }) {
  const isUnauthorized = authProfile && !authProfile.isAdmin;
  return (
    <main className="admin-login-page">
      <a className="admin-login-brand" href="/" aria-label="กลับหน้า OCEC Portal">
        <BrandMark /><span><strong>OCEC Portal</strong><small>ระบบสมัครสอบ</small></span>
      </a>
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <span className="admin-login-mark"><Icon name="shield" size={24} /></span>
        <p className="admin-login-eyebrow">พื้นที่เจ้าหน้าที่</p>
        <h1 id="admin-login-title">เข้าสู่ระบบแอดมิน</h1>
        <p className="admin-login-description">ใช้บัญชี Google ที่ได้รับอนุญาตเพื่อจัดการรายการสอบและใบสมัคร</p>
        {!backendEnabled ? (
          <div className="admin-login-message admin-login-message-error" role="alert">ระบบล็อกอินยังไม่เปิดใช้งาน · ตั้งค่า <code>VITE_BACKEND_ENABLED=true</code> แล้ว build เว็บใหม่</div>
        ) : !authChecked ? (
          <div className="admin-login-message" role="status"><span className="admin-login-spinner" />กำลังตรวจสอบบัญชี…</div>
        ) : isUnauthorized ? (
          <>
            <div className="admin-login-message admin-login-message-error" role="alert">
              บัญชี {authProfile.email} ไม่มีสิทธิ์เข้าหลังบ้าน กรุณาใช้อีเมลที่กำหนดใน <code>ADMIN_EMAILS</code>
            </div>
            <button className="admin-login-button admin-login-secondary" type="button" onClick={onSignOut}>ออกจากระบบเพื่อเลือกบัญชีอื่น</button>
          </>
        ) : authProfile?.isAdmin ? (
          <div className="admin-login-message" role="status">กำลังเปิดหน้าจัดการสำหรับ {authProfile.email}…</div>
        ) : (
          <>
            <button className="admin-login-button" type="button" onClick={onSignIn}>
              <GoogleMark /><span>เข้าสู่ระบบด้วย Google</span><Icon name="arrow" size={17} />
            </button>
            <p className="admin-login-hint">ตั้งอีเมลแอดมินใน <code>.env</code> ที่ <code>ADMIN_EMAILS</code> รองรับหลายอีเมลโดยคั่นด้วย comma</p>
          </>
        )}
      </section>
      <a className="admin-login-back" href="/">กลับไปหน้าเว็บไซต์</a>
    </main>
  );
}

function PublicPortalLayout({ page, navigate, setPersona, authProfile, onSignIn, onSignOut, toast, setToast, examCatalog, children }) {
  return (
    <div className="public-landing public-portal-page">
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหาหลัก</a>
      <ExamScheduleNotice examCatalog={examCatalog} navigate={navigate} />
      <PublicPortalHeader page={page} navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={onSignIn} onSignOut={onSignOut} />
      <main id="landing-main" className="public-page-main" tabIndex="-1">{children}</main>
      <PublicPortalFooter />
      {toast ? <div className="toast" role="status" aria-live="polite"><span><Icon name="check" size={16} /></span><p>{toast}</p><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div> : null}
    </div>
  );
}

function LandingPage({ navigate, setPersona, authProfile, onSignIn, onSignOut, onStartApplication, resultPublished, examCatalog }) {
  useEffect(() => {
    const section = document.getElementById("open-exams");
    const heading = section?.querySelector(".landing-gallery-toolbar");
    if (!section || !heading || !window.IntersectionObserver || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;

    section.classList.add("has-card-motion");
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      section.classList.add("cards-are-visible");
      observer.disconnect();
    }, { rootMargin: "0px 0px -65% 0px", threshold: 0 });
    observer.observe(heading);
    return () => {
      observer.disconnect();
      section.classList.remove("has-card-motion", "cards-are-visible");
    };
  }, []);

  useEffect(() => {
    const hero = document.querySelector(".public-landing-home .landing-gallery-hero");
    const exams = document.getElementById("open-exams");
    const desktopPointer = window.matchMedia("(min-width: 800px) and (hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!hero || !exams) return undefined;

    let accumulatedWheel = 0;
    let lastJumpAt = 0;
    let lastDirection = 0;
    const onWheel = (event) => {
      if (!desktopPointer.matches || reducedMotion.matches || event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      const direction = Math.sign(delta);
      if (!direction) return;
      const now = performance.now();
      if (now - lastJumpAt < 550 && direction === lastDirection) {
        event.preventDefault();
        return;
      }
      if (direction !== lastDirection) accumulatedWheel = 0;
      lastDirection = direction;

      const heroBottom = hero.getBoundingClientRect().bottom;
      const examsTop = exams.getBoundingClientRect().top;
      const movingToExams = direction > 0 && heroBottom > window.innerHeight * .35 && examsTop > 0;
      const movingToHero = direction < 0 && examsTop > -24 && examsTop < window.innerHeight * .85 && window.scrollY > 0;
      if (!movingToExams && !movingToHero) {
        accumulatedWheel = 0;
        return;
      }
      accumulatedWheel += Math.abs(delta);
      if (accumulatedWheel < 60) return;
      event.preventDefault();
      accumulatedWheel = 0;
      lastJumpAt = now;
      (movingToExams ? exams : hero).scrollIntoView({ behavior: "smooth" });
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const openExams = examCatalog.filter((exam) => exam.isOpen);
  const openExamCount = openExams.length;
  const featuredExam = openExams[0];
  const orderedExams = [...openExams];
  return (
    <div className="public-landing public-landing-home">
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหาหลัก</a>
      <PublicPortalHeader page="home" navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={onSignIn} onSignOut={onSignOut} />

      <main id="landing-main" tabIndex="-1">
        <section className="landing-hero landing-gallery-hero" aria-labelledby="homepage-title">
          <div className="landing-gallery-hero-inner">
            <p className="landing-gallery-kicker">OCEC EXAM PORTAL <span /> ปีการศึกษา {featuredExam?.year || "2569"}</p>
            <h1 id="homepage-title">ก้าวต่อไป<br />เริ่มที่นี่<span className="refero-title-dot">.</span></h1>
            <p className="landing-gallery-lead">เลือกวิชาที่สนใจ ตรวจสอบกำหนดการ และสมัครหลายรายการได้ในครั้งเดียว</p>
            <div className="landing-gallery-actions">
              <button className="landing-gallery-primary" type="button" onClick={onStartApplication}>เริ่มสมัครสอบ <Icon name="arrow" size={17} /></button>
              <button className="landing-gallery-secondary" type="button" onClick={() => navigate("lookup-choice")}>ตรวจสอบสถานะ <Icon name="arrow" size={17} /></button>
            </div>
            <div className="landing-gallery-assurance"><span><Icon name="check" size={14} />สมัครหลายรายการในครั้งเดียว</span><span><Icon name="check" size={14} />ติดตามใบสมัครได้ตลอด</span></div>
          </div>
          <img className="refero-hero-illustration" src="/ocec-exam-paper-cut-indigo.png" alt="ภาพประกอบนักเรียนเตรียมตัวสำหรับการสอบท่ามกลางต้นไม้และดอกไม้" />
          <button className="landing-scene-next" type="button" onClick={() => document.getElementById("open-exams")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}>เลื่อนดูรอบสอบที่เปิดรับ <Icon name="arrow" size={16} /></button>
        </section>

        <section className="landing-gallery-section" id="open-exams" aria-labelledby="open-exams-title">
          <div className="landing-gallery-toolbar">
            <div><p className="landing-gallery-toolbar-kicker">EXAM ROUNDS · รอบสอบปัจจุบัน</p><h2 id="open-exams-title">รอบสอบที่กำลังเปิดรับ</h2><p>{openExamCount ? "ตรวจสอบข้อมูลสำคัญก่อนเลือกสมัคร" : "เมื่อเปิดรับสมัคร รายการสอบและกำหนดการจะแสดงที่นี่"}</p></div>
            <div className="landing-gallery-summary"><span className={openExamCount ? "landing-gallery-open-count" : "landing-gallery-open-count is-empty"}><i />{openExamCount} รายการเปิดรับ</span></div>
          </div>
          {orderedExams.length === 0 ? <div className="landing-gallery-empty"><span className="landing-gallery-empty-icon"><Icon name="calendar" size={26} /></span><div><strong>ยังไม่มีรอบสอบที่เปิดรับ</strong><p>เมื่อเปิดรอบใหม่ รายการสอบและกำหนดการจะแสดงที่นี่</p></div></div> : <div className="landing-gallery-grid" aria-label="รายการสอบที่เปิดรับ">
            {orderedExams.map((exam, index) => {
              const roundType = getExamRoundType(exam);
              return <article className={`landing-gallery-card exam-card-${exam.accent}${exam.isOpen ? "" : " is-upcoming"}`} key={exam.id} style={{ "--exam-entrance-delay": `${Math.min(index, 8) * 110}ms` }}>
                <div className="landing-gallery-card-top"><ExamLogo exam={exam} className="landing-gallery-exam-mark" iconSize={22} /><span className={exam.isOpen ? "landing-gallery-status is-open" : "landing-gallery-status"}><i />{exam.isOpen ? "เปิดรับสมัคร" : exam.finalRegistrationStatus === "waiting-results" ? "รอประกาศผล HEAT" : exam.finalRegistrationStatus === "no-eligible-applicants" ? "ไม่มีผู้มีสิทธิ์ Final" : exam.finalRegistrationStatus === "closed-manual" ? "ปิดรับสมัครโดยแอดมิน" : exam.finalRegistrationStatus === "closed-deadline" ? "ปิดรับสมัครแล้ว" : "ยังไม่เปิดรับ"}</span></div>
                <p className="landing-gallery-card-round">{roundType === "HEAT" ? "HEAT ROUND · รอบคัดเลือก" : roundType === "FINAL" ? "FINAL ROUND · รอบชิงชนะเลิศ" : roundType === "FINAL_X" ? "FINAL X · รอบสอบ" : `${exam.round || roundType} · รอบสอบ`}</p>
                <h3>{exam.title}</h3>
                <p className="landing-gallery-card-description">{exam.description || `ปีการศึกษา ${exam.year}`}</p>
                <div className="landing-gallery-dates"><div><small>วันสอบ</small><strong>{formatThaiDate(exam.examDate)}</strong></div><div><small>ปิดรับสมัคร</small><strong>{formatThaiDate(exam.closeDate)}</strong></div></div>
                <div className="landing-gallery-card-foot"><span>ปีการศึกษา {exam.year}</span><span>{exam.isOpen ? "สมัครได้ในฟอร์มเดียว" : "ติดตามประกาศ"}</span></div>
              </article>;
            })}
          </div>}
          {resultPublished ? <button className="final-opportunity-link" onClick={() => navigate("final-confirm")}><span className="final-opportunity-icon"><Icon name="award" /></span><span><strong>ผ่าน OCEC Heat แล้วใช่ไหม?</strong><small>ตรวจสอบสิทธิ์และขั้นตอนสมัคร OCEC Final</small></span><Icon name="arrow" size={17} /></button> : null}
        </section>

      </main>
      <PublicPortalFooter setPersona={setPersona} navigate={navigate} />
    </div>
  );
}

function getSchoolApplicationGroups(applications) {
  const schoolGroups = new Map();
  applications.filter((application) => application.source === "school" && application.batchId).forEach((application) => {
    (application.competitions || []).forEach((competition) => {
      const key = `${application.batchId}:${competition.roundId || `${competition.id}:${competition.roundType}:${application.year}`}`;
      const group = schoolGroups.get(key) || { key, batchId: application.batchId, school: application.school, competition, year: application.year, rows: [] };
      group.rows.push({ application, competition });
      schoolGroups.set(key, group);
    });
  });
  return [...schoolGroups.values()];
}

function SchoolApplicationGroupPage({ applications, groupKey, navigate }) {
  const group = getSchoolApplicationGroups(applications).find((item) => item.key === groupKey);
  if (!group) return <div className="page-stack"><PageHeading eyebrow="ใบสมัครของฉัน" title="ไม่พบชุดใบสมัคร" action={<Button variant="outline" icon="arrow" onClick={() => navigate("applications")}>กลับไปใบสมัครของฉัน</Button>} /></div>;
  return <div className="page-stack">
    <PageHeading eyebrow={`สมัครผ่านโรงเรียน · ปีการศึกษา ${group.year}`} title={`${group.competition.name || group.competition.short} · รอบ ${group.competition.roundType === "FINAL" ? "Final" : "Heat"}`} description={`${group.school || "ไม่ระบุโรงเรียน"} · ผู้สมัคร ${group.rows.length} คน`} action={<Button variant="outline" icon="arrow" onClick={() => navigate("applications")}>กลับไปใบสมัครของฉัน</Button>} />
    <section className="surface school-application-detail" aria-label="รายชื่อผู้สมัครผ่านโรงเรียน">
      <div className="school-application-detail-heading"><span className="school-application-card-icon"><Icon name="users" size={23} /></span><div><strong>รายชื่อผู้สมัคร</strong><small>{group.competition.short} · {group.competition.roundType === "FINAL" ? "Final" : "Heat"} · {group.rows.length} คน</small></div></div>
      <div className="school-application-table-wrap"><table className="school-application-table"><thead><tr><th>เลขประจำตัวสอบ</th><th>ชื่อผู้สมัคร</th><th>ระดับชั้น</th><th>เบอร์โทร</th><th>สถานะ</th><th><span className="sr-only">รายละเอียด</span></th></tr></thead><tbody>{group.rows.map(({ application, competition }) => (
        <tr key={`${application.id}:${competition.applicationItemId || competition.id}`}>
          <td data-label="เลขประจำตัวสอบ"><strong className="mono-number">{competition.examNumber || "รอออกเลข"}</strong></td>
          <td data-label="ชื่อผู้สมัคร"><strong>{application.candidate}</strong></td>
          <td data-label="ระดับชั้น">{competition.grade || "—"}</td>
          <td data-label="เบอร์โทร">{getApplicationPhone(application) || "—"}</td>
          <td data-label="สถานะ"><StatusBadge status={application.status} /></td>
          <td><button type="button" className="school-application-open" onClick={() => navigate("application-detail", application.id)} aria-label={`ดูใบสมัครของ ${application.candidate}`}>ดูรายละเอียด <Icon name="arrow" size={15} /></button></td>
        </tr>
      ))}</tbody></table></div>
    </section>
  </div>;
}

function ApplicationsPage({ applications, navigate, resultRows = [], examCatalog = [], today, authProfile, onConfirmFinal }) {
  const [filter, setFilter] = useState("ทั้งหมด");
  const filters = ["ทั้งหมด", "รอตรวจ", "อนุมัติแล้ว"];
  const matchesFilter = (application) => filter === "ทั้งหมด" || (filter === "รอตรวจ" ? application.status === "pending" : application.status === "confirmed");
  const visibleSchoolGroups = getSchoolApplicationGroups(applications).filter((group) => group.rows.some(({ application }) => matchesFilter(application)));
  const visibleIndividuals = applications.filter((application) => !(application.source === "school" && application.batchId) && matchesFilter(application));
  const visibleCount = visibleSchoolGroups.length + visibleIndividuals.length;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="บัญชีของฉัน"
        title="ใบสมัครของฉัน"
        description="ติดตามสถานะและเปิดดูรายละเอียดใบสมัครของคุณ"
      />
      <div className="filter-toolbar">
        <div className="segmented-control" role="group" aria-label="กรองตามสถานะใบสมัคร">
          {filters.map((item) => <button key={item} className={filter === item ? "segment-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <span className="result-count">พบ {visibleCount} รายการ</span>
      </div>
      <div className="application-card-list">
        {visibleSchoolGroups.map((group) => (
          <button type="button" className="school-application-card" key={group.key} onClick={() => navigate("school-application-group", group.key)} aria-label={`ดูผู้สมัคร ${group.competition.name || group.competition.short} รอบ ${group.competition.roundType === "FINAL" ? "Final" : "Heat"} โรงเรียน ${group.school} ${group.rows.length} คน`}>
            <span className="school-application-card-summary">
              <span className="school-application-card-icon"><Icon name="users" size={23} /></span>
              <span className="school-application-card-heading"><small>สมัครผ่านโรงเรียน · ปีการศึกษา {group.year}</small><strong>{group.competition.name || group.competition.short}</strong><span>{group.competition.roundType === "FINAL" ? "รอบ Final" : "รอบ Heat"} · {group.competition.short}</span></span>
              <span className="school-application-card-count"><strong>{group.rows.length}</strong><small>คน</small></span>
              <span className="school-application-card-school"><Icon name="building" size={17} /><span>{group.school || "ไม่ระบุโรงเรียน"}</span></span>
              <span className="school-application-card-action">ดูรายชื่อ <Icon name="arrow" size={15} /></span>
            </span>
          </button>
        ))}
        {visibleIndividuals.map((application) => (
          <ApplicationCard
            key={application.id}
            application={application}
            onOpen={() => navigate("application-detail", application.id)}
            resultRows={resultRows}
            examCatalog={examCatalog}
            today={today}
            authProfile={authProfile}
            hasFinalApplication={applications.some((item) => item.kind === "Final" && item.sourceHeatId === application.id)}
            onConfirmFinal={onConfirmFinal}
          />
        ))}
        {visibleCount === 0 ? (
          <div className="empty-inline application-list-empty"><Icon name="file" size={17} />{filter === "ทั้งหมด" ? "ยังไม่มีใบสมัครในบัญชีนี้" : "ไม่พบใบสมัครตามสถานะที่เลือก"}</div>
        ) : null}
      </div>
    </div>
  );
}

function StatusLookupPage({ applications, navigate }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function search(event) {
    event.preventDefault();
    const name = query.trim();
    setSearched(true);
    setError("");
    setBusy(true);
    try {
      if (BACKEND_ENABLED) {
        const response = await fetch("/api/public/applications/status", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "ค้นหาสถานะไม่สำเร็จ");
        setResults(result.applications || []);
      } else {
        setResults(applications.filter((item) => item.candidate.toLowerCase().includes(name.toLowerCase())));
      }
    } catch (requestError) {
      setResults([]);
      setError(requestError?.message || "ค้นหาสถานะไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack narrow-page">
      <PageHeading eyebrow="บริการผู้สมัคร" title="ค้นหาสถานะใบสมัคร" description="ตรวจสอบสถานะล่าสุดของใบสมัครได้โดยไม่ต้องเข้าสู่ระบบ" />
      <section className="surface lookup-card">
        <div className="lookup-icon"><Icon name="search" size={22} /></div>
        <h2>ค้นหาด้วยชื่อภาษาอังกฤษ</h2>
        <p>กรอกชื่อผู้เข้าสอบตามที่ระบุในใบสมัคร ระบบจะแสดงรายการสอบ สถานะ และเหตุผลสั้น ๆ หากไม่อนุมัติ</p>
        <form onSubmit={search}>
          <Field label="ชื่อภาษาอังกฤษของผู้เข้าสอบ" required hint="ตัวอย่าง: Nicha Srisawat">
            <div className="input-with-icon"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="กรอกชื่อและนามสกุลภาษาอังกฤษ" minLength={3} required /></div>
          </Field>
          <Button type="submit" icon="search" className="button-full" disabled={busy}>{busy ? "กำลังค้นหา…" : "ค้นหาสถานะ"}</Button>
        </form>
        {searched ? (
          <div className="lookup-results" aria-live="polite">
            <div className="lookup-results-head"><strong>ผลการค้นหา</strong><span>{results.length} รายการ</span></div>
            {error ? <div className="empty-inline"><Icon name="info" /><span>{error}</span></div> : results.length ? results.map((application, index) => (
              <div className="status-result" key={`${application.id || application.candidate}-${index}`}>
                <div className="status-result-main"><strong>{application.candidate}</strong><span>{application.exam}</span></div>
                <div className="status-result-side"><StatusBadge status={application.status} />{application.status === "rejected" && application.reason ? <small className="status-rejected-reason">เหตุผล: {application.reason}</small> : null}</div>
              </div>
            )) : <div className="empty-inline"><Icon name="info" /><span>ไม่พบใบสมัครที่ตรงกับชื่อ กรุณาตรวจการสะกดชื่อภาษาอังกฤษอีกครั้ง</span></div>}
          </div>
        ) : null}
      </section>
      <section className="info-banner"><Icon name="shield" /><div><strong>ต้องการแก้ไขใบสมัคร?</strong><p>ยืนยันตัวตนด้วยชื่อภาษาอังกฤษและเลข 4 ตัวท้ายของเบอร์โทรศัพท์ก่อนเปิดข้อมูล</p></div><Button variant="outline" onClick={() => navigate("edit-verify")}>ไปหน้าแก้ไข</Button></section>
      <p className="privacy-note"><Icon name="lock" size={14} />หน้าค้นหานี้แสดงรายการสอบ สถานะ และเหตุผลสั้น ๆ เมื่อไม่อนุมัติ โดยไม่แสดงบันทึกภายในหรือรายละเอียดการชำระเงิน</p>
    </div>
  );
}

function LookupChoicePage({ navigate }) {
  return (
    <div className="page-stack narrow-page">
      <PageHeading eyebrow="บริการผู้สมัคร" title="ค้นหาหรือแก้ไขใบสมัคร" description="เลือกสิ่งที่ต้องการทำ ระบบจะแสดงเฉพาะข้อมูลที่จำเป็นในแต่ละขั้นตอน" />
      <div className="lookup-choice-grid">
        <button className="lookup-choice-card" onClick={() => navigate("check-status")}>
          <span className="lookup-choice-icon choice-search"><Icon name="search" size={22} /></span>
          <span className="lookup-choice-copy"><strong>ค้นหาสถานะใบสมัคร</strong><small>ตรวจสอบสถานะทั่วไปได้ทันที ไม่ต้องเข้าสู่ระบบ</small><em>ใช้ชื่อภาษาอังกฤษของผู้เข้าสอบ</em></span>
          <span className="lookup-choice-arrow"><Icon name="arrow" /></span>
        </button>
        <button className="lookup-choice-card" onClick={() => navigate("edit-verify")}>
          <span className="lookup-choice-icon choice-edit"><Icon name="edit" size={21} /></span>
          <span className="lookup-choice-copy"><strong>แก้ไขข้อมูลใบสมัคร</strong><small>ยืนยันตัวตนก่อนดูข้อมูลและแก้ไขส่วนที่อนุญาต</small><em>ใช้ชื่อภาษาอังกฤษและเบอร์โทรศัพท์</em></span>
          <span className="lookup-choice-arrow"><Icon name="arrow" /></span>
        </button>
      </div>
      <div className="notice notice-blue"><Icon name="lock" /><div><strong>ข้อมูลส่วนตัวได้รับการปกป้อง</strong><p>การค้นหาสถานะแสดงเฉพาะรายการสอบและสถานะอนุมัติ ส่วนการแก้ไขต้องยืนยันชื่อกับเบอร์โทรศัพท์</p></div></div>
      <button className="back-link" onClick={() => navigate("home")}><Icon name="arrow" size={15} />กลับหน้าภาพรวม</button>
    </div>
  );
}

function EditVerifyPage({ applications, onVerified, navigate }) {
  const [name, setName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (BACKEND_ENABLED) {
        const response = await fetch("/api/public/applications/edit-access", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ candidateName: name.trim(), phoneLast4: lastFour }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจชื่อและเบอร์โทรศัพท์อีกครั้ง");
        onVerified(result.application, { candidateName: result.application.candidate, phoneLast4: lastFour });
      } else {
        const match = applications.find((item) => item.candidate.toLowerCase() === name.trim().toLowerCase() && item.phoneLast4 === lastFour);
        if (!match) throw new Error("ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจชื่อภาษาอังกฤษและเลข 4 ตัวท้ายอีกครั้ง");
        onVerified(match, { candidateName: match.candidate, phoneLast4: lastFour });
      }
    } catch (requestError) {
      setError(requestError?.message || "ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจชื่อและเบอร์โทรศัพท์อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page-stack narrow-page">
      <PageHeading eyebrow="ยืนยันตัวตน" title="แก้ไขข้อมูลใบสมัคร" description="กรอกข้อมูลตรงกับใบสมัครเพื่อยืนยันตัวตนก่อนเปิดรายละเอียด" />
      <section className="surface verify-card">
        <div className="verify-steps"><span className="verify-step verify-step-active"><b>1</b>ยืนยันตัวตน</span><i /><span className="verify-step"><b>2</b>ตรวจสอบใบสมัคร</span><i /><span className="verify-step"><b>3</b>แก้ไขข้อมูล</span></div>
        <form onSubmit={verify}>
          <Field label="ชื่อภาษาอังกฤษตามใบสมัคร" required hint="กรอกชื่อและนามสกุลให้ตรงกับใบสมัคร">
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="เช่น Nicha Srisawat" minLength={3} required />
          </Field>
          <Field label="เลข 4 ตัวท้ายของเบอร์โทรศัพท์" required hint="เบอร์โทรศัพท์ที่ระบุไว้ในใบสมัคร">
            <input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" required />
          </Field>
          {error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}
          <Button type="submit" icon="shield" className="button-full" disabled={busy}>{busy ? "กำลังตรวจสอบ…" : "ยืนยันและค้นหาใบสมัคร"}</Button>
        </form>
        <button className="back-link" onClick={() => navigate("lookup-choice")}><Icon name="arrow" size={15} />กลับไปเลือกบริการ</button>
      </section>
      <div className="privacy-note"><Icon name="lock" size={14} />ระบบตรวจชื่อและเลข 4 ตัวท้ายกับข้อมูลในใบสมัครโดยตรง และจำกัดการลองซ้ำ</div>
    </div>
  );
}

function getApplicantEditValues(application) {
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

function ApplicantProfileFields({ values, onChange, disabled = false, showThaiNames = false }) {
  const field = (key) => (event) => onChange(key, event.target.value);
  return (
    <div className="admin-edit-person-grid">
      <Field label="ชื่อจริงภาษาอังกฤษ" required><input value={values.firstName} disabled={disabled} autoComplete="given-name" onChange={field("firstName")} /></Field>
      <Field label="นามสกุลภาษาอังกฤษ" required><input value={values.lastName} disabled={disabled} autoComplete="family-name" onChange={field("lastName")} /></Field>
      {showThaiNames ? <><Field label="ชื่อภาษาไทย" hint={values.thaiFirstName ? undefined : "ไม่มีข้อมูลเดิมในใบสมัคร กรุณากรอกชื่อภาษาไทย"}><input value={values.thaiFirstName} disabled={disabled} onChange={field("thaiFirstName")} placeholder="ชื่อจริงภาษาไทย" /></Field><Field label="นามสกุลภาษาไทย" hint={values.thaiLastName ? undefined : "ไม่มีข้อมูลเดิมในใบสมัคร กรุณากรอกนามสกุลภาษาไทย"}><input value={values.thaiLastName} disabled={disabled} onChange={field("thaiLastName")} placeholder="นามสกุลภาษาไทย" /></Field></> : null}
      <Field label="โรงเรียน" required><input value={values.school} disabled={disabled} onChange={field("school")} /></Field>
      <Field label="อีเมลติดต่อผู้เข้าสอบ" required hint="ใช้รับอีเมลสรุปใบสมัครและผลตรวจสลิป"><input type="email" value={values.email} disabled={disabled} autoComplete="email" onChange={field("email")} /></Field>
      <Field label="เบอร์โทรศัพท์" required><input type="tel" inputMode="tel" autoComplete="tel" value={values.phone} disabled={disabled} onChange={field("phone")} placeholder="(000) 000-0000" /></Field>
      <Field label="ที่อยู่ (บ้านเลขที่ / หมู่บ้าน / ถนน)"><input value={values.address1} disabled={disabled} autoComplete="street-address" onChange={field("address1")} placeholder="ระบุบ้านเลขที่ หมู่บ้าน และถนน" /></Field>
      <Field label="อาคาร / ซอย / รายละเอียดเพิ่มเติม"><input value={values.address2} disabled={disabled} onChange={field("address2")} placeholder="ถ้ามี" /></Field>
      <Field label="เขต / อำเภอ"><input value={values.city} disabled={disabled} onChange={field("city")} /></Field>
      <Field label="จังหวัด"><input value={values.province} disabled={disabled} autoComplete="address-level1" onChange={field("province")} /></Field>
      <Field label="รหัสไปรษณีย์"><input value={values.postalCode} disabled={disabled} inputMode="numeric" autoComplete="postal-code" onChange={field("postalCode")} /></Field>
    </div>
  );
}

function EditApplicationPage({ application, onSave, navigate, examCatalog, publicAccess = false, publicCredentials = null }) {
  const [form, setForm] = useState(() => getApplicantEditValues(application));
  const [error, setError] = useState("");
  const editDeadline = getApplicationEditDeadline(application, examCatalog);
  const editable = isApplicationEditable(application, examCatalog);
  const updateField = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError(""); };
  const editReason = application.status === "pending"
    ? "ใบสมัครอยู่ระหว่างตรวจสอบ สามารถดูสถานะได้ แต่ยังแก้ไขข้อมูลไม่ได้"
    : !application.canEdit
      ? "ใบสมัครนี้ไม่ได้เปิดสิทธิ์แก้ข้อมูล"
      : !editDeadline
        ? "ยังไม่ได้กำหนดวันปิดแก้ไขของรอบนี้"
        : "รอบแก้ไขข้อมูลปิดแล้ว";

  function submit(event) {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) { setError("กรุณากรอกชื่อและนามสกุลภาษาอังกฤษ"); return; }
    if (!form.school.trim()) { setError("กรุณากรอกชื่อโรงเรียน"); return; }
    if (!form.email.trim()) { setError("กรุณากรอกอีเมลติดต่อ"); return; }
    if (!form.phone.trim()) { setError("กรุณากรอกเบอร์โทรศัพท์"); return; }
    const nameParts = { firstName: form.firstName.trim(), lastName: form.lastName.trim() };
    const studentInformation = { ...application.studentInformation, ...form, ...nameParts, school: form.school.trim(), email: form.email.trim(), phone: form.phone.trim() };
    onSave(application.id, {
      candidate: `${nameParts.firstName} ${nameParts.lastName}`,
      nameParts,
      school: form.school.trim(),
      contactEmail: form.email.trim(),
      phone: form.phone.trim(),
      phoneLast4: form.phone.replace(/\D/g, "").slice(-4),
      studentInformation,
    }, publicCredentials);
  }

  const competitionNames = application.competitions?.map((item) => item.short || item.name).filter(Boolean).join(", ");
  const examNames = [competitionNames, application.kind === "Final" ? "FINAL ROUND" : "HEAT ROUND"].filter(Boolean).join(" · ");
  return (
    <div className="page-stack admin-edit-application-page user-edit-application-page">
      <PageHeading eyebrow={publicAccess ? "บริการผู้สมัคร" : "ใบสมัครของฉัน"} title="แก้ไขข้อมูลใบสมัคร" description={`${application.candidate} · ${application.exam}`} action={<Button variant="outline" icon="arrow" onClick={() => navigate(publicAccess ? "check-status" : "application-detail", application.id)}>{publicAccess ? "กลับไปค้นหาสถานะ" : "กลับไปใบสมัคร"}</Button>} />
      {!editable ? <div className="notice notice-amber"><Icon name="lock" /><div><strong>ยังไม่สามารถแก้ไขใบสมัครนี้ได้</strong><p>{editReason}</p></div></div> : null}
      <form className="user-edit-form" onSubmit={submit}>
        <section className="surface admin-edit-section">
          <div className="admin-edit-section-heading"><span><Icon name="edit" size={16} /></span><div><h2>ข้อมูลผู้เข้าสอบ</h2><p>แก้ไขข้อมูลติดต่อและที่อยู่ได้ตามกำหนด</p></div></div>
          <ApplicantProfileFields values={form} onChange={updateField} disabled={!editable} showThaiNames />
        </section>
        <section className="surface admin-edit-section user-edit-locked-section">
          <div className="admin-edit-section-heading"><span><Icon name="lock" size={16} /></span><div><h2>ข้อมูลที่ล็อกหลังอนุมัติ</h2><p>ข้อมูลส่วนนี้ไม่สามารถแก้ไขได้ด้วยตนเอง</p></div></div>
          <div className="locked-chip-row"><span>รายการสอบ <b>{examNames}</b></span><span>ระดับชั้น <b>{application.grade}</b></span><span>รูปแบบรวม <b>{getApplicationFormatSummary(application)}</b></span><span>ศูนย์สอบ <b>{getApplicationCenterSummary(application)}</b></span></div>
          <div className="detail-competition-list">{(application.competitions || []).map((competition) => <div className="detail-competition-item" key={competition.id}><strong>{competition.short || competition.name}</strong><span>{competition.grade || "ไม่ระบุชั้น"}</span><span>{getApplicationCompetitionFormat(application, competition) === "Online" ? "Online Exam" : "Paper-Based"}</span><small>{getApplicationCompetitionCenter(application, competition) || "—"}</small></div>)}</div>
        </section>
        <section className="notice notice-blue user-edit-support-note"><Icon name="info" /><div><strong>ต้องการแก้ไขข้อมูลที่ล็อกไว้?</strong><p>หากประสงค์แก้ไขรายการสอบ ระดับชั้น รูปแบบการสอบ หรือศูนย์สอบ กรุณาติดต่อผู้ดูแลระบบผ่าน LINE Official Account</p><a href="https://lin.ee/3hzFg1z" target="_blank" rel="noreferrer">OCEC_Thailand <Icon name="arrow" size={14} /></a></div></section>
        {error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}
        {editable ? <div className="admin-edit-footer user-edit-footer"><span><Icon name="info" size={15} />แก้ไขได้ถึง {formatThaiDate(editDeadline)} · การแก้ไขจะไม่ทำให้ใบสมัครกลับไปรอตรวจสอบ</span><Button variant="outline" type="button" onClick={() => navigate(publicAccess ? "check-status" : "application-detail", application.id)}>ยกเลิก</Button><Button type="submit" icon="check">บันทึกการแก้ไข</Button></div> : null}
      </form>
    </div>
  );
}

function ApplicationDetailPage({ application, navigate, resultRows = [], examCatalog, today, authProfile, hasFinalApplication = false, onConfirmFinal, onSaveCertificatePhoto }) {
  if (!application) return <div className="surface empty-state">ไม่พบใบสมัครที่เลือก</div>;
  const canEdit = isApplicationEditable(application, examCatalog);
  const applicationResults = resultRows.filter((result) => result.applicationId === application.id);
  const finalRounds = application.kind === "Heat" ? getEligibleFinalRounds(application, examCatalog, resultRows, today) : [];
  const isOwnAccountApplication = Boolean(authProfile?.email
    && !authProfile?.isAdmin
    && application.source === "self"
    && application.contactEmail?.toLowerCase() === authProfile.email.toLowerCase());
  const canConfirmFinal = isOwnAccountApplication && !hasFinalApplication && finalRounds.length > 0 && typeof onConfirmFinal === "function";
  const studentInformation = application.studentInformation || {};
  const applicantAddress = [studentInformation.address1, studentInformation.address2, studentInformation.city, studentInformation.province, studentInformation.postalCode].filter(Boolean).join(", ");
  const resultSummary = applicationResults.length
    ? applicationResults.map((result) => `${result.competitionTitle} ${EXAM_ROUND_LABELS[result.roundType] || result.roundType}: ${result.result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}`).join(" · ")
    : "ยังไม่ประกาศผล";
  return (
    <div className="page-stack">
      <PageHeading eyebrow={application.kind + " · ปีการศึกษา " + application.year} title="รายละเอียดใบสมัคร" description={application.candidate + " · " + application.school} action={<Button variant="outline" icon="arrow" onClick={() => navigate("applications")}>กลับไปใบสมัครของฉัน</Button>} />
      <div className="detail-layout">
        <div className="detail-main">
          <section className="surface detail-summary">
            <div className="detail-avatar">{application.candidate.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
            <div className="detail-ident"><span className="application-kind">{application.exam}</span><h2>{application.candidate}</h2><p>{application.school}</p></div>
            <StatusBadge status={application.status} />
            <div className="exam-number-box"><span>เลขประจำตัวสอบ</span><strong>{application.kind === "Final" ? (application.finalId || "รอเลขประจำตัว") : (application.heatId || "รอเลขประจำตัว")}</strong></div>
          </section>
          {application.status === "pending" ? <div className="notice notice-amber"><Icon name="clock" /><div><strong>ใบสมัครอยู่ระหว่างตรวจสอบ</strong><p>ตรวจสอบสถานะได้ตามปกติ แต่ยังแก้ไขข้อมูลไม่ได้</p></div></div> : null}
          <section className="surface detail-section">
            <div className="section-heading"><div><p className="eyebrow">ข้อมูลใบสมัคร</p><h2>ข้อมูลผู้เข้าสอบ</h2></div>{canEdit ? <Button variant="outline" icon="edit" onClick={() => navigate("edit-application", application.id)}>แก้ไขข้อมูล</Button> : null}</div>
            <div className="detail-info-grid">
              <div><span>ชื่อภาษาอังกฤษ</span><strong>{application.candidate}</strong></div>
              <div><span>ชื่อภาษาไทย</span><strong>{[studentInformation.thaiFirstName, studentInformation.thaiLastName].filter(Boolean).join(" ") || "ยังไม่ได้ระบุ"}</strong></div>
              <div><span>โรงเรียน</span><strong>{application.school}</strong></div>
              <div><span>ระดับชั้น</span><strong>{application.grade}</strong></div>
              <div><span>รูปแบบการสอบ</span><strong>{getApplicationFormatSummary(application)}</strong></div>
              <div><span>ศูนย์สอบ</span><strong>{getApplicationCenterSummary(application)}</strong></div>
              <div><span>อีเมลติดต่อ</span><strong>{application.contactEmail}</strong></div>
              <div><span>เบอร์โทรศัพท์</span><strong>{getApplicationPhone(application)}</strong></div>
              <div><span>ที่อยู่</span><strong>{applicantAddress || "ยังไม่ได้ระบุข้อมูลที่อยู่"}</strong></div>
              <div><span>วันที่ส่งใบสมัคร</span><strong>{application.submitted}</strong></div>
              <div><span>สถานะผลสอบ</span><strong>{resultSummary}</strong></div>
            </div>
            <div className="detail-competition-list">{(application.competitions || []).map((competition) => { const online = getApplicationCompetitionFormat(application, competition) === "Online"; const examEmail = getApplicationCompetitionExamEmail(application, competition); return <div className="detail-competition-item" key={competition.id}><strong>{competition.short || competition.name}</strong><span>{competition.grade || "ไม่ระบุชั้น"}</span><span>{online ? "Online Exam" : "Paper-Based"}</span><small>{getApplicationCompetitionCenter(application, competition) || "—"}</small>{online ? <small>อีเมลเข้าสอบ: {examEmail || "ยังไม่ได้ระบุ"}</small> : null}</div>; })}</div>
          </section>
          {application.status === "confirmed" ? <CertificatePhotoSection application={application} canEdit={canEdit} onSave={(certificatePhoto) => onSaveCertificatePhoto(application.id, certificatePhoto)} /> : null}
        </div>
        <aside className="surface timeline-card">
          <p className="eyebrow">ความคืบหน้า</p><h2>ขั้นตอนใบสมัคร</h2>
          <div className="timeline">
            <div className="timeline-item timeline-done"><span><Icon name="check" size={13} /></span><div><strong>ส่งใบสมัครแล้ว</strong><small>{application.submitted}</small></div></div>
            <div className={"timeline-item " + (application.status === "confirmed" ? "timeline-done" : "timeline-current")}><span>{application.status === "confirmed" ? <Icon name="check" size={13} /> : "2"}</span><div><strong>{application.status === "confirmed" ? "ตรวจสอบและยืนยันแล้ว" : "รอตรวจใบสมัครและสลิป"}</strong><small>{application.status === "confirmed" ? "ตรวจสอบเรียบร้อย" : "เจ้าหน้าที่กำลังตรวจสอบ"}</small></div></div>
            <div className={"timeline-item " + (applicationResults.length ? "timeline-done" : "")}><span>{applicationResults.length ? <Icon name="check" size={13} /> : "3"}</span><div><strong>ประกาศผลสอบ</strong><small>{applicationResults.length ? resultSummary : "รอประกาศผล"}</small></div></div>
          </div>
          {canConfirmFinal ? <div className="detail-final-confirm">
            <div><span className="detail-final-confirm-icon"><Icon name="award" size={18} /></span><span><strong>ได้รับสิทธิ์สมัครรอบ Final</strong><small>ยืนยันสิทธิ์เพื่อไปสมัครสอบ Final</small></span></div>
            <Button icon="arrow" onClick={() => onConfirmFinal(application, finalRounds)}>ยืนยันสิทธิ์ Final</Button>
          </div> : null}
          <div className="timeline-contact"><Icon name="mail" size={16} /><span>แจ้งเตือนส่งไปที่<br /><strong>{application.contactEmail}</strong></span></div>
        </aside>
      </div>
    </div>
  );
}

function CertificatePhotoSection({ application, canEdit, onSave }) {
  const photo = application.certificatePhoto;
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function choosePhoto(file) {
    setError("");
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError("กรุณาเลือกไฟล์รูปภาพ JPG, PNG หรือ WebP");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("ไฟล์รูปภาพต้องมีขนาดไม่เกิน 10 MB");
      return;
    }
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("อ่านไฟล์รูปภาพไม่สำเร็จ"));
      reader.readAsDataURL(file);
    }).catch((readError) => {
      setError(readError.message || "อ่านไฟล์รูปภาพไม่สำเร็จ");
      return "";
    });
    if (dataUrl) {
      setBusy(true);
      try { await onSave({ fileName: file.name, mimeType: file.type, dataBase64: dataUrl.split(",")[1] || "" }); }
      catch (uploadError) { setError(uploadError?.message || "อัปโหลดรูปไม่สำเร็จ"); }
      finally { setBusy(false); }
    }
  }
  return (
    <section className="surface certificate-photo-section">
      <div className="certificate-photo-copy"><span className="certificate-photo-icon"><Icon name="image" /></span><div><p className="eyebrow">หลังอนุมัติใบสมัคร</p><h2>รูปสำหรับจัดทำเกียรติบัตร</h2><p>ผู้สมัครหรือผู้ประสานงานโรงเรียนอัปโหลดรูปให้ OCEC ใช้จัดทำใบประกาศรางวัลได้ตามต้องการ</p><small>รองรับ JPG, PNG หรือ WebP · ไม่เกิน 10 MB · จัดเก็บใน Google Drive</small></div></div>
      {photo?.url ? <div className="certificate-photo-preview"><img src={photo.url} alt={`รูปสำหรับเกียรติบัตรของ ${application.candidate}`} /><span><strong>{photo.name}</strong><small>อัปโหลดแล้ว · เลือกเปลี่ยนหรือลบรูปได้</small></span>{canEdit ? <label className="button button-outline certificate-photo-change"><Icon name="upload" size={16} /><span>{busy ? "กำลังอัปโหลด…" : "เปลี่ยนรูป"}</span><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { choosePhoto(event.target.files?.[0]); event.target.value = ""; }} /></label> : null}{canEdit ? <Button variant="text" icon="close" className="certificate-photo-remove" disabled={busy} onClick={() => onSave(null)}>ลบรูป</Button> : null}</div> : canEdit ? <label className="file-drop file-drop-inline certificate-photo-upload"><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={(event) => { choosePhoto(event.target.files?.[0]); event.target.value = ""; }} /><span className="file-drop-icon"><Icon name="upload" /></span><span className="file-drop-copy"><strong>{busy ? "กำลังอัปโหลดรูป…" : "เพิ่มรูปสำหรับเกียรติบัตร (ไม่บังคับ)"}</strong><small>รูปจะถูกจัดเก็บในโฟลเดอร์ Google Drive ตามรายการสอบและรอบ</small></span><span className="file-select-label">เลือกไฟล์</span></label> : <div className="notice notice-amber"><Icon name="lock" /><div><strong>ปิดรับการแก้ไขรูปแล้ว</strong><p>อัปโหลดหรือเปลี่ยนรูปได้ถึงวันปิดแก้ไข: {application.editDeadline || "—"}</p></div></div>}
      {error ? <p className="inline-error certificate-photo-error" role="alert"><Icon name="info" size={15} />{error}</p> : null}
    </section>
  );
}

function SlipReplacementPage() {
  const tokenParams = new URLSearchParams(window.location.search);
  const token = tokenParams.get("token") || tokenParams.get("slipReplacement") || "";
  const [linkStatus, setLinkStatus] = useState("loading");
  const [details, setDetails] = useState(null);
  const [slipFile, setSlipFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  useEffect(() => {
    if (!token || !BACKEND_ENABLED) { setLinkStatus("invalid"); return; }
    let active = true;
    fetch("/api/slip-replacements/validate", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }),
    }).then(async (response) => {
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "ลิงก์นี้ใช้ไม่ได้หรือหมดอายุแล้ว");
      if (active) { setDetails(result); setLinkStatus("valid"); }
    }).catch((reason) => { if (active) { setError(reason.message || "ลิงก์นี้ใช้ไม่ได้หรือหมดอายุแล้ว"); setLinkStatus("invalid"); } });
    return () => { active = false; };
  }, [token]);

  async function selectSlip(file) {
    if (!file) return;
    const mimeType = getSlipMimeType(file);
    if (!mimeType) { setSlipFile(null); setFileError("รองรับไฟล์ JPG, PNG หรือ PDF เท่านั้น"); return; }
    if (file.size > 10 * 1024 * 1024) { setSlipFile(null); setFileError("ไฟล์มีขนาดเกิน 10 MB"); return; }
    setFileError(""); setError("");
    try { setSlipFile({ fileName: file.name, mimeType, dataBase64: await readFileAsDataUrl(file) }); }
    catch (reason) { setSlipFile(null); setFileError(reason.message || "อ่านไฟล์สลิปไม่สำเร็จ"); }
  }

  async function uploadSlip() {
    if (!slipFile || !token || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/slip-replacements/submit", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, slip: slipFile }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "อัปโหลดสลิปไม่สำเร็จ");
      setUploaded(true);
    } catch (reason) { setError(reason.message || "อัปโหลดสลิปไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setBusy(false); }
  }

  return <div className="page-stack narrow-page">
    <PageHeading eyebrow="ลิงก์ปลอดภัย" title="ส่งสลิปชำระเงินใหม่" description="อัปโหลดสลิปเพื่อแทนที่ไฟล์เดิม ใบสมัครที่ยังรอตรวจจะกลับเข้าคิวตรวจสอบ" />
    <section className="surface upload-card">
      {linkStatus === "loading" ? <div className="empty-inline"><Icon name="sync" /><span>กำลังตรวจสอบลิงก์…</span></div> : null}
      {linkStatus === "invalid" ? <div className="notice notice-amber"><Icon name="info" /><div><strong>ลิงก์นี้ใช้ไม่ได้</strong><p>{error || "ลิงก์หมดอายุ ถูกใช้ไปแล้ว หรือยังไม่ได้เปิดใช้งาน backend"}</p></div></div> : null}
      {linkStatus === "valid" && !uploaded ? <>
        <div className="upload-token"><span className="upload-token-icon"><Icon name="upload" /></span><div><strong>{details?.schoolName ? `บิลโรงเรียน ${details.schoolName}` : "สลิปใบสมัคร"}</strong><small>{details?.applicationCount || 1} ใบสมัครที่รอการตรวจสลิป · ลิงก์ใช้ได้ครั้งเดียว</small></div></div>
        <label className="file-drop"><input type="file" accept="image/jpeg,image/png,application/pdf,.pdf" onChange={(event) => { selectSlip(event.target.files?.[0]); event.target.value = ""; }} /><span className="file-drop-icon"><Icon name="upload" size={22} /></span><strong>{slipFile?.fileName || "เลือกไฟล์สลิปใหม่"}</strong><small>รองรับ JPG, PNG หรือ PDF · ขนาดไม่เกิน 10 MB</small></label>
        {fileError || error ? <p className="inline-error" role="alert"><Icon name="info" size={15} />{fileError || error}</p> : null}
        <div className="notice notice-blue"><Icon name="lock" /><div><strong>ลิงก์นี้ใช้สำหรับเปลี่ยนสลิปเท่านั้น</strong><p>กรณีชุดโรงเรียน การอัปโหลดครั้งนี้จะแทนสลิปของทั้งบิล ใบสมัครที่อนุมัติแล้วจะคงสถานะเดิม</p></div></div>
        <Button className="button-full" icon="upload" disabled={!slipFile || busy} onClick={uploadSlip}>{busy ? "กำลังส่งสลิป…" : "ส่งสลิปใหม่"}</Button>
      </> : null}
      {uploaded ? <div className="upload-success"><p>ได้รับสลิปใหม่แล้ว ใบสมัครที่ยังรอตรวจกลับเข้าสู่คิวตรวจสอบ และลิงก์นี้ถูกปิดแล้ว</p></div> : null}
    </section>
    <div className="privacy-note"><Icon name="lock" size={14} />ลิงก์หมดอายุภายใน 3 วันและใช้งานได้ครั้งเดียว</div>
  </div>;
}

function ApiFinalConfirmationPage({ authProfile, onContinue, onSignIn, navigate, resultPublished, examCatalog }) {
  const [path, setPath] = useState("school");
  const [query, setQuery] = useState("");
  const [choices, setChoices] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [authorized, setAuthorized] = useState([]);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authProfile) { setAuthorized([]); return undefined; }
    const controller = new AbortController();
    fetch("/api/applications/final-eligibility", { credentials: "same-origin", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("โหลดสิทธิ์ Final ไม่สำเร็จ"); return response.json(); })
      .then((result) => { if (!controller.signal.aborted) setAuthorized(result.choices || []); })
      .catch((requestError) => { if (!controller.signal.aborted) setError(requestError.message); });
    return () => controller.abort();
  }, [authProfile?.id]);

  async function search(event) {
    event.preventDefault();
    setBusy(true); setError(""); setChoices([]); setSelectedRoundId(""); setVerified(false);
    try {
      const response = await fetch("/api/public/final-eligibility/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidateName: query.trim() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "ค้นหาสิทธิ์ไม่สำเร็จ");
      setChoices(result.choices || []);
    } catch (requestError) { setError(requestError.message || "ค้นหาสิทธิ์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  async function verify(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/public/final-eligibility/verify", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidateName: query.trim(), finalRoundId: selectedRoundId, phoneLast4: lastFour }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "ยืนยันสิทธิ์ไม่สำเร็จ");
      setVerified(true);
    } catch (requestError) { setError(requestError.message || "ยืนยันสิทธิ์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }

  const accountChoices = authorized.filter((choice) => !choice.schoolGrant);
  const schoolChoices = authorized.filter((choice) => choice.schoolGrant);
  const activeYear = getActiveExamYear(examCatalog, "FINAL", "2569");
  return <div className="page-stack final-rights-page">
    <section className="final-rights-hero" aria-labelledby="final-rights-title">
      <div className="final-rights-hero-copy">
        <span className="final-rights-kicker"><Icon name="award" size={16} /> OCEC FINAL {activeYear}</span>
        <h1 id="final-rights-title">ก้าวต่อไปของคุณ<br /><em>เริ่มที่การยืนยันสิทธิ์</em></h1>
        <p>สำหรับผู้ผ่านรอบ Heat ตรวจสอบข้อมูลให้ตรงกับใบสมัครเดิม แล้วเริ่มสมัคร Final ในขั้นตอนเดียว</p>
        <div className="final-rights-hero-meta"><span><Icon name="check" size={17} /> ใช้ข้อมูล Heat เดิม</span><span><Icon name="shield" size={17} /> ยืนยันตัวตนก่อนสมัคร</span></div>
      </div>
      <div className="final-rights-hero-art" aria-hidden="true"><span className="final-rights-orbit" /><span className="final-rights-medal"><Icon name="award" size={48} /></span><span className="final-rights-star final-rights-star-one">✦</span><span className="final-rights-star final-rights-star-two">✦</span><span className="final-rights-final-word">FINAL</span></div>
    </section>
    <div className="final-rights-info-row"><div><span className={resultPublished ? "final-rights-live" : "final-rights-waiting"}><i />{resultPublished ? "ตรวจสอบสิทธิ์ Final" : "รอประกาศผล Heat"}</span><span className="final-rights-deadline"><Icon name="calendar" size={17} /> วันปิดยืนยันสิทธิ์แยกตามรายการสอบและรอบ</span></div><Button variant="text" onClick={() => navigate("results")}>ดูประกาศผล <Icon name="arrow" size={16} /></Button></div>
    <div className="final-rights-layout">
      <div className="final-rights-main">
        <section className="surface final-rights-workspace final-rights-api-workspace" aria-labelledby="final-rights-workspace-title">
          <div className="final-rights-workspace-heading"><div><p className="eyebrow">ยืนยันสิทธิ์เข้าสอบ Final</p><h2 id="final-rights-workspace-title">คุณสมัคร Heat แบบไหน?</h2><p>เลือกวิธีที่ตรงกับใบสมัคร Heat ของคุณ</p></div><span className="final-rights-step-number">01 / 03</span></div>
          <div className="final-rights-paths" role="tablist" aria-label="วิธียืนยันสิทธิ์">
            <button type="button" role="tab" aria-selected={path === "account"} className={path === "account" ? "final-rights-path selected" : "final-rights-path"} onClick={() => { setPath("account"); setError(""); }}><span className="final-rights-path-icon"><Icon name="users" /></span><strong>สมัครด้วยบัญชีตนเอง</strong><small>เปิดใบสมัครของฉันแล้วไปต่อได้เลย</small></button>
            <button type="button" role="tab" aria-selected={path === "school"} className={path === "school" ? "final-rights-path selected" : "final-rights-path"} onClick={() => { setPath("school"); setError(""); }}><span className="final-rights-path-icon"><Icon name="building" /></span><strong>โรงเรียนสมัครให้</strong><small>ค้นหาชื่อและยืนยันเบอร์โทรศัพท์</small></button>
          </div>
          {error ? <p className="inline-error" role="alert">{error}</p> : null}
          {path === "account" ? <div role="tabpanel" className="final-rights-account-panel">
            {!authProfile ? <div className="final-rights-signin"><span className="final-rights-signin-icon"><GoogleMark /></span><div><strong>เข้าสู่ระบบเพื่อดูสิทธิ์ของฉัน</strong><p>ใช้บัญชี Google เดิมที่สมัคร Heat</p></div><Button variant="outline" onClick={() => onSignIn(demoGoogleProfile)}>เข้าสู่ระบบ Google</Button></div> :
              accountChoices.length ? <div className="final-rights-match-list">{accountChoices.map((choice) => <div className="final-rights-match" key={`${choice.sourceHeatApplicationId}-${choice.item.roundId}`}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{choice.applicant.firstNameEn} {choice.applicant.lastNameEn}</strong><small>{choice.item.competition} · {choice.item.year}</small></div><Button icon="arrow" onClick={() => onContinue(choice)}>สมัคร Final</Button></div>)}</div> : <div className="final-rights-empty"><Icon name="info" /><div><strong>ไม่พบสิทธิ์ Final ที่เปิดอยู่ในบัญชีนี้</strong><p>หากโรงเรียนเป็นผู้สมัครให้ เลือกแท็บ “โรงเรียนสมัครให้” เพื่อค้นหาด้วยชื่อ</p></div></div>}
          </div> : <div role="tabpanel" className="final-rights-school-panel">
            {schoolChoices.length ? <div className="final-rights-match-list">{schoolChoices.map((choice) => <div className="final-rights-match" key={`${choice.sourceHeatApplicationId}-${choice.item.roundId}`}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{choice.applicant.firstNameEn} {choice.applicant.lastNameEn}</strong><small>{choice.item.competition} · {choice.item.year}</small></div><Button icon="arrow" onClick={() => onContinue(choice)}>สมัคร Final</Button></div>)}</div> : verified ? <div className="notice notice-blue"><Icon name="check" /><div><strong>ยืนยันเบอร์โทรศัพท์แล้ว</strong><p>เข้าสู่ระบบด้วยบัญชี Google ที่ต้องการเก็บใบสมัคร Final</p><Button onClick={() => window.location.assign(`/api/auth/google/start?flow=final&returnTo=${encodeURIComponent("/final/confirm")}`)}>เข้าสู่ระบบ Google แล้วสมัคร</Button></div></div> : <>
              <div className="final-rights-section-label"><span>02</span><div><strong>ค้นหาใบสมัคร Heat</strong><small>ใช้ชื่อภาษาอังกฤษตามใบสมัคร</small></div></div>
              <form className="final-rights-eligibility-search" onSubmit={search}><Field label="ชื่อและนามสกุลภาษาอังกฤษ" required><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} minLength={3} maxLength={255} required autoComplete="off" placeholder="เช่น Thanakorn Wattanakul" /></div></Field><Button type="submit" icon="search" disabled={busy}>{busy ? "กำลังค้นหา…" : "ค้นหาสิทธิ์ Final"}</Button></form>
              {choices.length ? <form className="final-rights-verify-form" onSubmit={verify}><div className="final-rights-section-label"><span>03</span><div><strong>ยืนยันตัวตน</strong><small>ใช้เบอร์โทรศัพท์ในใบสมัคร Heat</small></div></div><Field label="เลือกรายการสอบ" required><select value={selectedRoundId} onChange={(event) => setSelectedRoundId(event.target.value)} required><option value="">เลือกรายการสอบ</option>{choices.map((choice) => <option value={choice.finalRoundId} key={choice.finalRoundId}>{choice.competition} · {choice.round} · {choice.year}</option>)}</select></Field><Field label="เลข 4 ตัวท้ายของเบอร์โทรศัพท์" required><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} required placeholder="••••" /></Field><Button type="submit" icon="shield" disabled={busy || !selectedRoundId}>{busy ? "กำลังยืนยัน…" : "ยืนยันตัวตน"}</Button></form> : <div className="final-rights-search-hint"><Icon name="info" size={16} />ค้นหาชื่อเพื่อตรวจสอบสิทธิ์ Final</div>}
            </>}
          </div>}
        </section>
      </div>
      <aside className="final-rights-aside"><section className="surface final-rights-guide"><p className="eyebrow">ขั้นตอนสั้น ๆ</p><h2>จาก Heat สู่ Final</h2><ol><li><span>01</span><div><strong>ตรวจสอบสิทธิ์</strong><small>ดูใบสมัครในบัญชี หรือค้นหาชื่อ</small></div></li><li><span>02</span><div><strong>ยืนยันตัวตน</strong><small>ผู้สมัครผ่านโรงเรียนใช้เลขโทรศัพท์ 4 ตัวท้าย</small></div></li><li><span>03</span><div><strong>สมัคร Final</strong><small>ตรวจข้อมูลเดิม ชำระเงิน และแนบสลิปใหม่</small></div></li></ol></section><div className="final-rights-help"><Icon name="info" size={18} /><p>ใบสมัคร Final เป็นใบสมัครใหม่ แยกจาก Heat และรอเจ้าหน้าที่ตรวจสลิปอีกครั้ง</p></div></aside>
    </div>
  </div>;
}

function FinalConfirmationPage({ applications, applicationHint, onContinue, navigate, publishedHeatResults = [], examCatalog, authProfile, onSignIn }) {
  const [path, setPath] = useState(applicationHint?.source === "self" ? "account" : "school");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const localToday = getBangkokTodayISO();
  const hasPublishedHeat = publishedHeatResults.length > 0;
  const eligibleApplications = applications.filter((item) => item.kind === "Heat" && getEligibleFinalRounds(item, examCatalog, publishedHeatResults, localToday).length > 0);
  const canConfirm = hasPublishedHeat && eligibleApplications.length > 0;
  const pendingReason = !hasPublishedHeat ? "รอประกาศผล Heat" : "ปิดยืนยันสิทธิ์ครบแล้ว";
  const accountMatches = canConfirm ? eligibleApplications.filter((item) => item.source === "self" && authProfile && item.contactEmail?.toLowerCase() === authProfile.email.toLowerCase()) : [];
  const eligible = canConfirm ? eligibleApplications.filter((item) => item.source === "school" && item.candidate.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const selected = applications.find((item) => item.id === selectedId);
  const selectedFinalRounds = selected ? getEligibleFinalRounds(selected, examCatalog, publishedHeatResults, localToday) : [];
  const finalRoundDeadlineText = (application) => getEligibleFinalRounds(application, examCatalog, publishedHeatResults, localToday)
    .map((exam) => `${exam.title}: ${exam.finalConfirmCloseDate ? formatThaiDate(exam.finalConfirmCloseDate) : "ไม่กำหนดวันปิด"}`)
    .join(" · ");

  function verify(event) {
    event.preventDefault();
    if (!selected || selected.phoneLast4 !== lastFour) {
      setError("เลข 4 ตัวท้ายไม่ตรงกับใบสมัคร Heat กรุณาตรวจสอบอีกครั้ง");
      return;
    }
    setError("");
    setVerified(true);
  }

  return (
    <div className="page-stack final-rights-page">
      <section className="final-rights-hero" aria-labelledby="final-rights-title">
        <div className="final-rights-hero-copy">
          <span className="final-rights-kicker"><Icon name="award" size={16} /> OCEC FINAL 2569</span>
          <h1 id="final-rights-title">ก้าวต่อไปของคุณ<br /><em>เริ่มที่การยืนยันสิทธิ์</em></h1>
          <p>สำหรับผู้ผ่านรอบ Heat ตรวจสอบข้อมูลให้ตรงกับใบสมัครเดิม แล้วเริ่มสมัคร Final ในขั้นตอนเดียว</p>
          <div className="final-rights-hero-meta"><span><Icon name="check" size={17} /> ใช้ข้อมูล Heat เดิม</span><span><Icon name="shield" size={17} /> ยืนยันตัวตนก่อนสมัคร</span></div>
        </div>
        <div className="final-rights-hero-art" aria-hidden="true"><span className="final-rights-orbit" /><span className="final-rights-medal"><Icon name="award" size={48} /></span><span className="final-rights-star final-rights-star-one">✦</span><span className="final-rights-star final-rights-star-two">✦</span><span className="final-rights-final-word">FINAL</span></div>
      </section>

      <div className="final-rights-info-row"><div><span className={canConfirm ? "final-rights-live" : "final-rights-waiting"}><i />{canConfirm ? "เปิดยืนยันสิทธิ์" : pendingReason}</span><span className="final-rights-deadline"><Icon name="calendar" size={17} /> วันปิดยืนยันสิทธิ์แยกตามรายการสอบและรอบ</span></div><Button variant="text" onClick={() => navigate("results")}>ดูประกาศผล <Icon name="arrow" size={16} /></Button></div>

      <div className="final-rights-layout">
        <div className="final-rights-main">
          {!canConfirm ? <div className="notice notice-amber final-rights-pending"><Icon name="clock" /><div><strong>{pendingReason}</strong><p>{!hasPublishedHeat ? "ระบบจะเปิดยืนยันสิทธิ์ให้อัตโนมัติทันทีหลังแอดมินประกาศผล Heat" : "วันปิดยืนยันสิทธิ์ของทุกรายการที่เกี่ยวข้องผ่านแล้ว"} ขณะนี้แสดงขั้นตอนตัวอย่างเพื่อดูหน้าจอ</p></div><Button variant="outline" onClick={() => setShowPreview((value) => !value)}>{showPreview ? "ซ่อนตัวอย่าง" : "ดูตัวอย่างขั้นตอน"}</Button></div> : null}
          {canConfirm || showPreview ? (
            <section className="surface final-rights-workspace" aria-labelledby="final-rights-workspace-title">
              <div className="final-rights-workspace-heading"><div><p className="eyebrow">ยืนยันสิทธิ์เข้าสอบ Final</p><h2 id="final-rights-workspace-title">คุณสมัคร Heat แบบไหน?</h2><p>เลือกวิธีที่ตรงกับใบสมัคร Heat ของคุณ</p></div><span className="final-rights-step-number">01 / 03</span></div>
              <div className="final-rights-paths" role="tablist" aria-label="วิธีค้นหาใบสมัคร Heat">
                <button type="button" role="tab" aria-selected={path === "account"} className={path === "account" ? "final-rights-path selected" : "final-rights-path"} onClick={() => { setPath("account"); setVerified(false); setError(""); }}><span className="final-rights-path-icon"><Icon name="users" /></span><strong>สมัครด้วยบัญชีตนเอง</strong><small>เปิดใบสมัครของฉันแล้วไปต่อได้เลย</small></button>
                <button type="button" role="tab" aria-selected={path === "school"} className={path === "school" ? "final-rights-path selected" : "final-rights-path"} onClick={() => { setPath("school"); setVerified(false); setError(""); }}><span className="final-rights-path-icon"><Icon name="building" /></span><strong>โรงเรียนสมัครให้</strong><small>ค้นหาชื่อและยืนยันเบอร์โทรศัพท์</small></button>
              </div>

              {path === "account" ? (
                <div className="final-rights-account-panel" role="tabpanel">
                  {authProfile ? <><div className="final-rights-account-identity"><ProfileAvatar src={authProfile.picture} alt="" /><div><small>บัญชีที่เข้าสู่ระบบ</small><strong>{authProfile.name}</strong><span>{authProfile.email}</span></div></div>{accountMatches.length ? <div className="final-rights-match-list">{accountMatches.map((item) => <div className="final-rights-match" key={item.id}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{item.candidate}</strong><small>เลขสอบ {item.heatId} · {item.school}</small><small>{finalRoundDeadlineText(item)}</small></div><Button disabled={!canConfirm} icon="arrow" onClick={() => onContinue(item, "account", null, getEligibleFinalRounds(item, examCatalog, publishedHeatResults, localToday))}>ยืนยันสิทธิ์</Button></div>)}</div> : <div className="final-rights-empty"><Icon name="info" /><div><strong>ยังไม่พบใบสมัคร Heat ที่ผ่านในบัญชีนี้</strong><p>หากโรงเรียนเป็นผู้สมัครให้ เลือกแท็บ “โรงเรียนสมัครให้” เพื่อค้นหาด้วยชื่อ</p></div></div>}</> : <div className="final-rights-signin"><span className="final-rights-signin-icon"><GoogleMark /></span><div><strong>เข้าสู่ระบบเพื่อดูใบสมัครของฉัน</strong><p>ผู้ที่สมัคร Heat ด้วยบัญชีตนเองไม่ต้องยืนยันเบอร์โทรศัพท์ซ้ำ</p></div><Button variant="outline" onClick={() => onSignIn(demoGoogleProfile)}>เข้าสู่ระบบตัวอย่าง</Button></div>}
                </div>
              ) : verified ? (
                <div className="final-rights-verified" role="tabpanel"><span className="final-rights-verified-icon"><Icon name="check" size={28} /></span><p className="eyebrow">ตัวอย่างขั้นตอน</p><h3>พร้อมสมัคร OCEC Final</h3><p>ข้อมูลจากใบสมัคร Heat ของ <strong>{selected?.candidate}</strong> จะถูกเติมในฟอร์ม Final ให้ตรวจสอบก่อนส่ง</p><div className="final-rights-verified-summary"><span>เลขสอบ Heat <strong>{selected?.heatId}</strong></span><span>โรงเรียน <strong>{selected?.school}</strong></span><span className="final-rights-deadline-list">รอบที่ยืนยันได้<strong>{selectedFinalRounds.map((exam) => `${exam.title} · ปิด ${exam.finalConfirmCloseDate ? formatThaiDate(exam.finalConfirmCloseDate) : "ไม่กำหนด"}`).join(" / ")}</strong></span></div><div className="final-rights-verified-actions"><Button disabled={!canConfirm || !selectedFinalRounds.length} icon="arrow" onClick={() => onContinue(selected, "google", { name: selected?.candidate, email: selected?.contactEmail, picture: demoGoogleProfile.picture }, selectedFinalRounds)}>เข้าสู่ระบบ Google แล้วสมัคร</Button></div><button type="button" className="back-link" onClick={() => { setVerified(false); setSelectedId(""); setLastFour(""); }}><Icon name="arrow" size={15} />ค้นหารายชื่ออื่น</button></div>
              ) : (
                <div className="final-rights-school-panel" role="tabpanel"><div className="final-rights-section-label"><span>02</span><div><strong>ค้นหาใบสมัคร Heat</strong><small>ใช้ชื่อภาษาอังกฤษตามใบสมัคร</small></div></div><Field label="ชื่อและนามสกุลภาษาอังกฤษ" required><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); setLastFour(""); setError(""); }} placeholder="เช่น Thanakorn Wattanakul" autoComplete="off" /></div></Field>{query.trim() ? <div className="final-rights-results" aria-live="polite"><p>{eligible.length ? `พบ ${eligible.length} รายการ · ตรวจเลขสอบและโรงเรียนก่อนเลือก` : "ไม่พบรายชื่อที่ตรงกับคำค้น"}</p>{eligible.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? "final-rights-result selected" : "final-rights-result"} aria-pressed={selectedId === item.id} onClick={() => { setSelectedId(item.id); setLastFour(""); setError(""); }}><span className="final-rights-result-radio" /><span><strong>{item.candidate}</strong><small>เลขสอบ {item.heatId} · {item.school}</small><small>{finalRoundDeadlineText(item)}</small></span><Icon name="chevron" size={18} /></button>)}</div> : <div className="final-rights-search-hint"><Icon name="info" size={16} />เริ่มพิมพ์ชื่อเพื่อดูใบสมัครที่ผ่านรอบ Heat</div>}{selected ? <form onSubmit={verify} className="final-rights-verify-form"><div className="final-rights-section-label"><span>03</span><div><strong>ยืนยันตัวตน</strong><small>ใช้เบอร์โทรศัพท์ในใบสมัคร Heat ที่เลือก</small></div></div><Field label="เลข 4 ตัวท้ายของเบอร์โทรศัพท์" required hint="กรอกเฉพาะตัวเลข 4 หลักสุดท้าย"><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => { setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} placeholder="••••" required /></Field>{error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}<Button type="submit" disabled={!canConfirm} icon="shield">ยืนยันตัวตน</Button></form> : null}</div>
              )}
            </section>
          ) : <section className="surface final-rights-locked"><span><Icon name="lock" size={26} /></span><h2>การยืนยันสิทธิ์ยังไม่เปิด</h2><p>เมื่อประกาศผล Heat แล้ว ผู้ผ่านจะค้นหาชื่อและเริ่มขั้นตอนนี้ได้ทันที</p><Button variant="outline" onClick={() => setShowPreview(true)}>ดูตัวอย่างหน้าจอ</Button></section>}
        </div>
        <aside className="final-rights-aside"><section className="surface final-rights-guide"><p className="eyebrow">ขั้นตอนสั้น ๆ</p><h2>จาก Heat สู่ Final</h2><ol><li><span>01</span><div><strong>ตรวจสอบสิทธิ์</strong><small>ดูใบสมัครในบัญชี หรือค้นหาชื่อ</small></div></li><li><span>02</span><div><strong>ยืนยันตัวตน</strong><small>ผู้สมัครผ่านโรงเรียนใช้เลขโทรศัพท์ 4 ตัวท้าย</small></div></li><li><span>03</span><div><strong>สมัคร Final</strong><small>ตรวจข้อมูลเดิม ชำระเงิน และแนบสลิปใหม่</small></div></li></ol></section><div className="final-rights-help"><Icon name="info" size={18} /><p>ใบสมัคร Final เป็นใบสมัครใหม่ แยกจาก Heat และรอเจ้าหน้าที่ตรวจสลิปอีกครั้ง</p></div></aside>
      </div>
    </div>
  );
}

function PublicResultsPage({ resultRows = [] }) {
  const [query, setQuery] = useState("");
  const resultsTableRef = useRef(null);
  const publishedTargets = [...new Map(resultRows.map((row) => [row.targetId, {
    targetId: row.targetId,
    competitionId: row.competitionId,
    competitionTitle: row.competitionTitle,
    roundType: row.roundType,
    round: row.round,
    year: row.year,
    publishedAt: row.publishedAt,
  }])).values()].sort((left, right) => Date.parse(right.publishedAt || 0) - Date.parse(left.publishedAt || 0));
  const competitionKey = (target) => `${target.competitionId}::${target.year}`;
  const latestTarget = publishedTargets[0];
  const [selectedCompetition, setSelectedCompetition] = useState(() => latestTarget ? competitionKey(latestTarget) : "all");
  const [selectedRound, setSelectedRound] = useState(() => latestTarget?.roundType || "all");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 100;
  function changePage(nextPage) {
    setPage(nextPage);
    window.requestAnimationFrame(() => resultsTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  const competitionOptions = [...new Map(publishedTargets.map((target) => [competitionKey(target), {
    key: competitionKey(target),
    title: target.competitionTitle,
    year: target.year,
  }])).values()];
  const targetMatchesCompetition = (target) => selectedCompetition === "all" || competitionKey(target) === selectedCompetition;
  const roundOptions = [...new Set(publishedTargets.filter(targetMatchesCompetition).map((target) => target.roundType))];
  const targetMatchesRound = (target) => selectedRound === "all" || target.roundType === selectedRound;
  const gradeOptions = [...new Set(resultRows.filter((row) => {
    const target = publishedTargets.find((item) => item.targetId === row.targetId);
    return target && targetMatchesCompetition(target) && targetMatchesRound(target);
  }).map((row) => row.grade).filter(Boolean))].sort((left, right) => left.localeCompare(right, "en"));
  const searchTerm = query.trim().toLowerCase();
  const results = resultRows.filter((row) => {
    const target = publishedTargets.find((item) => item.targetId === row.targetId);
    const matchesSearch = !searchTerm || (row.candidateName || row.candidate || "").toLowerCase().includes(searchTerm) || String(row.candidateNo || row.examNumber || "").toLowerCase().includes(searchTerm);
    return target && targetMatchesCompetition(target) && targetMatchesRound(target)
      && (selectedGrade === "all" || row.grade === selectedGrade) && matchesSearch;
  });
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const resultsOnPage = results.slice(pageStart, pageStart + pageSize);
  const rangeStart = results.length ? pageStart + 1 : 0;
  const rangeEnd = Math.min(pageStart + pageSize, results.length);
  const pageItems = totalPages <= 6
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : currentPage <= 4
      ? [1, 2, 3, 4, "ellipsis", totalPages]
      : currentPage >= totalPages - 3
        ? [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
  const resultGroups = publishedTargets.filter((target) => targetMatchesCompetition(target) && targetMatchesRound(target))
    .map((target) => ({ target, rows: resultsOnPage.filter((row) => row.targetId === target.targetId) }))
    .filter((group) => group.rows.length);
  return (
    <div className="page-stack">
      <PageHeading eyebrow="ผลการคัดเลือก" title="ประกาศผลสอบ OCEC" description="ตรวจผลสอบทุกระดับรางวัล ค้นหาด้วยชื่อภาษาอังกฤษหรือ CANDIDATE NO และกรองรายการสอบ รอบสอบ และระดับชั้นได้" />
      {!publishedTargets.length ? (
        <section className="surface results-pending">
          <span className="results-pending-icon"><Icon name="clock" /></span>
          <h2>รอประกาศผลอย่างเป็นทางการ</h2>
          <p>เมื่อมีการประกาศผลรายการสอบแล้ว จะสามารถเลือกดูผลของแต่ละรายการและรอบได้จากหน้านี้</p>
          <span className="result-date"><Icon name="calendar" size={15} />ประกาศผลตามกำหนดการของแต่ละรายการ</span>
        </section>
      ) : (
        <>
          <section className="surface results-public-filter-card">
            <div className="results-public-filter-heading"><div><p className="eyebrow">ค้นหาผลสอบ</p><h2>เลือกตัวกรองที่ต้องการ</h2></div><span className="result-announced"><span />ประกาศแล้ว</span></div>
            {latestTarget ? <div className="latest-result-hint"><Icon name="clock" size={14} /><span>เริ่มจากผลที่ประกาศล่าสุด: <strong>{resultTargetLabel(latestTarget)}</strong> · เลือกรายการสอบหรือรอบอื่นเพื่อดูผลเพิ่มเติม</span></div> : null}
            <div className="results-public-filters">
              <label className="results-public-search"><span>ค้นหาชื่อภาษาอังกฤษหรือ CANDIDATE NO</span><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="เช่น Kanya Rattanasuk หรือ 6000012" /></div></label>
              <label><span>รายการสอบ</span><select value={selectedCompetition} onChange={(event) => { const value = event.target.value; setSelectedCompetition(value); const newestExamRound = value === "all" ? "all" : publishedTargets.find((target) => competitionKey(target) === value)?.roundType || "all"; setSelectedRound(newestExamRound); setSelectedGrade("all"); setPage(1); }}><option value="all">ทุกรายการสอบ</option>{competitionOptions.map((option) => <option key={option.key} value={option.key}>{option.title} · ปี {option.year}</option>)}</select></label>
              <label><span>รอบสอบ</span><select value={selectedRound} onChange={(event) => { setSelectedRound(event.target.value); setSelectedGrade("all"); setPage(1); }}><option value="all">ทุกรอบสอบ</option>{roundOptions.map((round) => <option key={round} value={round}>{EXAM_ROUND_LABELS[round] || round}</option>)}</select></label>
              <label><span>ระดับชั้น</span><select value={selectedGrade} onChange={(event) => { setSelectedGrade(event.target.value); setPage(1); }}><option value="all">ทุกระดับชั้น</option>{gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label>
            </div>
          </section>
          <section className="results-hero">
            <div><span className="result-announced"><span />ประกาศผลอย่างเป็นทางการ</span><h2>ผลสอบผู้เข้าสอบทั้งหมด</h2><p>ผู้ได้ GOLD, SILVER หรือ BRONZE ผ่านรอบ HEAT ROUND ยกเว้น BBB ซึ่งใช้เกณฑ์อันดับ 1st–3rd</p></div>
            <div className="result-total"><strong>{results.length.toString().padStart(2, "0")}</strong><span>รายชื่อที่พบ</span></div>
          </section>
          <section className="surface results-table-card" ref={resultsTableRef}>
            <div className="results-public-table-heading"><div><strong>ผลการสอบ</strong><small>แสดง {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} จาก {results.length.toLocaleString()} รายชื่อ · สูงสุด {pageSize} รายการต่อหน้า</small></div></div>
            <div className="responsive-table"><table>
              <thead><tr><th>CANDIDATE NO</th><th>GRADE</th><th>SCHOOL NAME</th><th>CANDIDATE NAME</th><th>AWARD</th><th>ผลการสอบ / RESULT</th></tr></thead>
              {results.length ? resultGroups.map((group) => <tbody key={group.target.targetId}>
                <tr className="result-target-group-row"><th colSpan="6" scope="rowgroup">{resultTargetLabel(group.target)}</th></tr>
                {group.rows.map((item) => {
                  const resultStatus = getPublicResultStatus(item);
                  return <tr key={`${item.applicationId}-${item.targetId}`}>
                    <td><strong className="mono-number">{item.candidateNo || item.examNumber}</strong></td>
                    <td>{item.grade}</td>
                    <td>{item.schoolName || item.school}</td>
                    <td>{item.candidateName || item.candidate}</td>
                    <td><span className={`award-badge award-${String(item.award || "").toLowerCase().replaceAll(" ", "-")}`}>{item.award}</span></td>
                    <td><span className={`result-outcome result-outcome-${resultStatus.tone}`}>{resultStatus.tone === "eligible" ? <Icon name="check" size={12} /> : null}{resultStatus.label}</span></td>
                  </tr>;
                })}
              </tbody>) : <tbody><tr><td colSpan="6"><div className="results-empty-state"><span><Icon name="search" /></span><strong>ไม่พบผลสอบที่ตรงกับคำค้นหาหรือตัวกรอง</strong><small>ลองเปลี่ยนชื่อหรือเลขสอบ หรือเลือกตัวกรองเป็น “ทั้งหมด”</small><Button variant="text" onClick={() => { setQuery(""); setSelectedCompetition("all"); setSelectedRound("all"); setSelectedGrade("all"); setPage(1); }}>ล้างคำค้นและตัวกรอง</Button></div></td></tr></tbody>}
            </table></div>
            {results.length ? <div className="results-pagination"><span>หน้า {currentPage.toLocaleString()} จาก {totalPages.toLocaleString()}</span>{totalPages > 1 ? <nav aria-label="แบ่งหน้าผลสอบ"><button type="button" className="pagination-step" aria-label="หน้าก่อนหน้า" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>ก่อนหน้า</button>{pageItems.map((item, index) => item === "ellipsis" ? <span className="pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</span> : <button type="button" key={item} className={`pagination-page${currentPage === item ? " is-active" : ""}`} aria-label={`หน้า ${item}`} aria-current={currentPage === item ? "page" : undefined} onClick={() => changePage(item)}>{item}</button>)}<button type="button" className="pagination-step" aria-label="หน้าถัดไป" disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)}>ถัดไป</button></nav> : null}</div> : null}
            <div className="table-footnote"><Icon name="info" size={15} />ผู้ได้ GOLD, SILVER หรือ BRONZE (ยกเว้น BBB) และผู้ได้อันดับ 1st–3rd ของ BBB สามารถยืนยันสิทธิ์ Final ได้หลังประกาศผล HEAT</div>
          </section>
        </>
      )}
    </div>
  );
}

function ApplicationFormPage({ kind, prefill, applicationMode, allowedRoundIds, onSubmit, navigate, competitionFees, examCatalog, centerCatalog, pastPaperCatalog, paymentAccounts }) {
  const isFinal = kind === "Final";
  const examRoundType = isFinal ? "FINAL" : "HEAT";
  const examYear = isFinal && prefill?.year ? prefill.year : getActiveExamYear(examCatalog, examRoundType);
  // Final applications are reached only through a verified Heat result; show the matching Final rounds
  // after that gate even when the public registration card is still marked closed.
  const catalogCompetitions = getFormCompetitions(examCatalog, examRoundType, { openOnly: !isFinal, year: examYear });
  const allowedFinalRounds = Array.isArray(allowedRoundIds) ? new Set(allowedRoundIds) : null;
  const openCompetitions = isFinal
    ? catalogCompetitions.filter((competition) => {
      const finalRound = examCatalog.find((exam) => exam.competitionId === competition.id && exam.year === examYear && getExamRoundType(exam) === "FINAL");
      return finalRound && !finalRound.finalManuallyClosed && isFinalConfirmationWindowOpen(finalRound) && (!allowedFinalRounds || allowedFinalRounds.has(finalRound.id));
    })
    : catalogCompetitions;
  const competitions = isFinal && prefill?.competitions?.length
    ? openCompetitions.filter((competition) => prefill.competitions.some((selected) => selected.id === competition.id))
    : openCompetitions;
  const pastPaperGroups = groupPastPaperCatalog(pastPaperCatalog);
  const formPaymentAccounts = (paymentAccounts || []).filter((account) => account.active !== false && account.showInForm !== false);
  const activeCenterCatalog = centerCatalog?.length ? centerCatalog : BACKEND_ENABLED ? [] : DEFAULT_CENTER_CATALOG;
  const schools = FORM_SCHOOLS;
  const [applicationSource, setApplicationSource] = useState("self");
  const [schoolBatch, setSchoolBatch] = useState(() => {
    const firstApplicant = createSchoolApplicant("school-applicant-1", prefill);
    return { applicants: [firstApplicant], activeId: firstApplicant.id, confirmDetails: false, marketingConsent: false, paymentSlipFileName: "", paymentSlipFile: null, paymentSlipError: "", source: "manual" };
  });
  const [form, setForm] = useState(() => ({
    source: applicationMode === "guest" ? "guest" : "self",
    firstName: prefill?.studentInformation?.firstName || prefill?.candidate?.split(" ")[0] || "",
    lastName: prefill?.studentInformation?.lastName || prefill?.candidate?.split(" ").slice(1).join(" ") || "",
    thaiFirstName: prefill?.studentInformation?.thaiFirstName || "",
    thaiLastName: prefill?.studentInformation?.thaiLastName || "",
    gender: prefill?.studentInformation?.gender || "",
    dateOfBirth: prefill?.studentInformation?.dateOfBirth || "",
    schoolName: prefill?.school && FORM_SCHOOLS.includes(prefill.school) ? prefill.school : prefill?.school ? "Other" : "",
    certificateSchoolName: prefill?.studentInformation?.certificateSchoolName || (prefill?.school && !FORM_SCHOOLS.includes(prefill.school) ? prefill.school : ""),
    email: prefill?.studentInformation?.email || prefill?.contactEmail || "",
    examEmail: prefill?.examEmail || "",
    examEmailsByCompetition: Object.fromEntries((prefill?.competitions || []).filter((competition) => getApplicationCompetitionFormat(prefill, competition) === "Online").map((competition) => [competition.id, getApplicationCompetitionExamEmail(prefill, competition)])),
    address1: prefill?.studentInformation?.address1 || "",
    address2: prefill?.studentInformation?.address2 || "",
    city: prefill?.studentInformation?.city || "",
    province: prefill?.studentInformation?.province || "",
    postalCode: prefill?.studentInformation?.postalCode || "",
    phone: prefill?.studentInformation?.phone || "",
    competitionIds: isFinal ? (prefill?.competitions || []).map((competition) => competition.id) : [],
    grades: isFinal ? Object.fromEntries((prefill?.competitions || []).map((competition) => [competition.id, competition.grade])) : {},
    format: normalizeExamFormat(prefill?.format),
    formats: isFinal ? Object.fromEntries((prefill?.competitions || []).map((competition) => [competition.id, normalizeExamFormat(competition.format, normalizeExamFormat(prefill?.format))])) : {},
    centersByCompetition: isFinal ? Object.fromEntries((prefill?.competitions || []).map((competition) => [competition.id, normalizeExamFormat(competition.format, normalizeExamFormat(prefill?.format)) === "Paper-Based" ? (competition.center || prefill?.center || "") : ""])) : {},
    center: prefill?.center && prefill.center !== "Online Exam" ? prefill.center : "",
    pastPaperIds: [],
    confirmDetails: false,
    marketingConsent: false,
  }));
  const [fileName, setFileName] = useState("");
  const [slipFile, setSlipFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const selectedCompetitions = competitions.filter((competition) => form.competitionIds.includes(competition.id));
  const allPastPapers = pastPaperGroups.flatMap((group) => group.items);
  const formatForCompetition = (competitionId, state = form) => normalizeExamFormat(state.formats?.[competitionId], normalizeExamFormat(state.format));
  const examEmailForCompetition = (competitionId, state = form) => getCompetitionExamEmailValue(state.examEmailsByCompetition, competitionId, state.examEmail);
  const centerForCompetition = (competitionId, state = form) => state.centersByCompetition?.[competitionId] || (state.center && state.competitionIds?.length === 1 ? state.center : "");
  const centersForCompetition = (competitionId) => getCommonCenters([competitionId], examCatalog, activeCenterCatalog, { year: examYear, roundType: examRoundType });
  const priceForCompetition = (competition, format = formatForCompetition(competition.id)) => getCompetitionExamPrice(examCatalog, competition.id, examRoundType, format, competitionFees, examYear);
  const pastPapersTotal = allPastPapers.filter((paper) => form.pastPaperIds.includes(paper.id)).reduce((sum, paper) => sum + paper.price, 0);
  const registrationFee = selectedCompetitions.reduce((sum, competition) => sum + priceForCompetition(competition), 0);
  const selectedFormats = new Set(selectedCompetitions.map((competition) => formatForCompetition(competition.id)));
  const formatSummary = selectedFormats.size > 1 ? "Paper-Based + Online Exam" : selectedFormats.has("Online") ? "Online Exam" : "Paper-Based";
  const scheduleExam = (examCatalog || []).find((exam) => exam.year === examYear && getExamRoundType(exam) === examRoundType);
  const totalPayment = pastPapersTotal + registrationFee;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  async function selectSlip(file) {
    if (!file) return;
    const fileType = getSlipMimeType(file);
    if (!fileType) {
      setFileName("");
      setSlipFile(null);
      setFileError("รองรับไฟล์ JPG, PNG หรือ PDF เท่านั้น");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileName("");
      setSlipFile(null);
      setFileError("ไฟล์มีขนาดเกิน 10 MB");
      return;
    }
    setFileName("กำลังอ่านไฟล์สลิป…");
    setSlipFile(null);
    setFileError("");
    try {
      setSlipFile({ name: file.name, type: fileType, dataUrl: await readFileAsDataUrl(file) });
      setFileName(file.name);
      setFileError("");
    } catch (error) {
      setFileName("");
      setSlipFile(null);
      setFileError(error.message || "อ่านไฟล์สลิปไม่สำเร็จ");
    }
  }
  function toggleCompetition(id) {
    setForm((current) => {
      const competitionIds = current.competitionIds.includes(id)
        ? current.competitionIds.filter((competitionId) => competitionId !== id)
        : [...current.competitionIds, id];
      return { ...current, competitionIds };
    });
    setSelectionError("");
  }
  function updateCompetitionFormat(competitionId, format) {
    setForm((current) => {
      const currentCenter = current.centersByCompetition?.[competitionId]
        || (current.competitionIds?.length === 1 ? current.center : "");
      const centersByCompetition = format === "Online" || isOnlineCenter(currentCenter)
        ? { ...current.centersByCompetition, [competitionId]: "" }
        : current.centersByCompetition;
      return { ...current, formats: { ...current.formats, [competitionId]: format }, centersByCompetition };
    });
    setPaymentError("");
  }
  function updateCompetitionCenter(competitionId, centerName) {
    setForm((current) => ({ ...current, centersByCompetition: { ...current.centersByCompetition, [competitionId]: centerName } }));
    setPaymentError("");
  }
  function updateCompetitionExamEmail(competitionId, email) {
    setForm((current) => ({ ...current, examEmailsByCompetition: { ...current.examEmailsByCompetition, [competitionId]: email } }));
    setPaymentError("");
  }
  function togglePastPaper(id) {
    setForm((current) => ({ ...current, pastPaperIds: current.pastPaperIds.includes(id) ? current.pastPaperIds.filter((paperId) => paperId !== id) : [...current.pastPaperIds, id] }));
  }
  async function submit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    if (selectedCompetitions.length === 0) {
      setSelectionError("กรุณาเลือกรายการสอบอย่างน้อย 1 รายการ");
      return;
    }
    if (selectedCompetitions.some((competition) => !form.grades[competition.id])) {
      setSelectionError("กรุณาเลือกระดับชั้นให้ครบทุกวิชาที่สมัคร");
      return;
    }
    const missingCenter = selectedCompetitions.find((competition) => formatForCompetition(competition.id) === "Paper-Based"
      && !centersForCompetition(competition.id).some((center) => center.name === centerForCompetition(competition.id)));
    if (missingCenter) {
      setPaymentError(`กรุณาเลือกศูนย์สอบที่เปิดสำหรับ ${missingCenter.short || missingCenter.name}`);
      return;
    }
    const invalidOnlineEmail = selectedCompetitions.find((competition) => formatForCompetition(competition.id) === "Online"
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(examEmailForCompetition(competition.id).trim()));
    if (invalidOnlineEmail) {
      setPaymentError(`กรุณากรอกอีเมลเข้าสอบที่ถูกต้องสำหรับ ${invalidOnlineEmail.short || invalidOnlineEmail.name}`);
      return;
    }
    if (!formPaymentAccounts.length) {
      setPaymentError("ขณะนี้ยังไม่มีบัญชีรับโอนที่เปิดแสดงในฟอร์ม กรุณาติดต่อผู้ดูแลระบบ");
      return;
    }
    if (!form.confirmDetails) {
      setPaymentError("กรุณายืนยันว่าตรวจสอบข้อมูลและยอดชำระเรียบร้อยแล้ว");
      return;
    }
    if (!fileName || !slipFile?.dataUrl) {
      setFileError("กรุณาแนบสลิปการชำระเงินก่อนส่งใบสมัคร");
      return;
    }
    setFileError("");
    const candidate = `${form.firstName} ${form.lastName}`.trim();
    const school = form.schoolName === "Other" ? form.certificateSchoolName : form.schoolName;
    const examListings = selectedCompetitions.map((competition) => {
      const format = formatForCompetition(competition.id);
      const selectedCenter = format === "Online"
        ? activeCenterCatalog.find((center) => center.code === ONLINE_CENTER_CODE) || (!BACKEND_ENABLED ? DEFAULT_CENTER_CATALOG.find((center) => center.code === ONLINE_CENTER_CODE) : null)
        : centersForCompetition(competition.id).find((center) => center.name === centerForCompetition(competition.id));
      const fee = priceForCompetition(competition);
      return { ...competition, grade: form.grades[competition.id], format, examEmail: format === "Online" ? examEmailForCompetition(competition.id).trim() : "", fee, chargedFee: fee, center: selectedCenter?.name || "", centerId: selectedCenter?.id || "", centerCode: selectedCenter?.code || "", centerSnapshot: selectedCenter ? { id: selectedCenter.id, code: selectedCenter.code, name: selectedCenter.name } : null };
    });
    const formats = new Set(examListings.map((listing) => listing.format));
    const centersSummary = [...new Set(examListings.map((listing) => listing.center).filter(Boolean))].join(" · ");
    const legacyCenter = formats.size === 1 && formats.has("Online")
      ? activeCenterCatalog.find((center) => center.code === ONLINE_CENTER_CODE) || (!BACKEND_ENABLED ? DEFAULT_CENTER_CATALOG[0] : null)
      : examListings[0]?.centerSnapshot || null;
    const legacyFormat = formats.size > 1 ? "Mixed" : formats.has("Online") ? "Online Exam" : "On-site";
    setIsSubmitting(true);
    try {
      await onSubmit({ ...form, examEmail: examListings.find((listing) => listing.format === "Online")?.examEmail || "", format: legacyFormat, kind, examYear, candidate, school, contactEmail: form.email, grade: selectedCompetitions.map((competition) => `${competition.short}: ${form.grades[competition.id]}`).join(" · "), center: centersSummary, centerId: legacyCenter?.id || "", centerCode: legacyCenter?.code || "", centerSnapshot: legacyCenter || null, examListings, pastPaperSelections: allPastPapers.filter((paper) => form.pastPaperIds.includes(paper.id)), pastPapersTotal, registrationFee, totalPayment, fileName, slipFile, paymentAccountsSnapshot: formPaymentAccounts.map((account) => ({ ...account })), sourceHeatId: prefill?.id || "" });
    } finally {
      setIsSubmitting(false);
    }
  }
  if (!isFinal && applicationSource === "school") {
    return <SchoolBatchForm kind={kind} prefill={prefill} batch={schoolBatch} setBatch={setSchoolBatch} onSubmit={onSubmit} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} examYear={examYear} centerCatalog={centerCatalog} pastPaperCatalog={pastPaperCatalog} paymentAccounts={paymentAccounts} competitions={competitions} schools={schools} onBack={() => { setApplicationSource("self"); update("source", "self"); }} />;
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow={isFinal ? `OCEC Final ${examYear}` : `เปิดรับสมัคร · ปีการศึกษา ${examYear}`}
        title={isFinal ? "สมัครสอบ Final" : "สมัครสอบ OCEC"}
        description={isFinal ? "ตรวจสอบข้อมูลและกรอกข้อมูลผู้เข้าสอบ รายการสอบ และการชำระเงินให้ครบในฟอร์มเดียว" : "เลือกรายการที่เปิดรับสมัครและเลือกระดับชั้นแยกกันได้ในฟอร์มเดียว"}
        action={<Button variant="outline" icon="arrow" onClick={() => navigate(isFinal ? "final-confirm" : "home")}>ยกเลิก</Button>}
      />
      <div className="form-layout">
        <form className="surface form-surface registration-form" onSubmit={submit}>
          <section className="form-zone" aria-labelledby="zone-student">
          <div className="form-progress"><span className="form-progress-number">01</span><div><strong id="zone-student">Student Information <span>/ ข้อมูลผู้สมัคร</span></strong><small>กรอกชื่อให้ตรงกับเอกสารที่จะใช้ในการสอบและออกใบประกาศ</small></div><span className="required-note"><span className="required-mark">*</span> จำเป็น</span></div>
          {!isFinal ? (
            <div className="source-choice">
              <span className="field-title">สมัครในนาม</span>
              <div className="source-choice-grid">
                <label className={applicationSource === "self" ? "source-selected" : ""}><input type="radio" name="source" checked={applicationSource === "self"} onChange={() => { setApplicationSource("self"); update("source", "self"); }} /><span className="source-option-icon"><Icon name="users" /></span><span><strong>ผู้สมัครเอง</strong><small>ใช้บัญชีส่วนตัว</small></span></label>
                <label className={applicationSource === "school" ? "source-selected" : ""}><input type="radio" name="source" checked={applicationSource === "school"} onChange={() => { setApplicationSource("school"); update("source", "school"); }} /><span className="source-option-icon"><Icon name="building" /></span><span><strong>โรงเรียน</strong><small>ผู้ประสานงานส่งแทน</small></span></label>
              </div>
            </div>
          ) : (
            <div className="notice notice-blue"><Icon name="info" /><div><strong>ข้อมูลจากใบสมัคร Heat · เลขสอบ {prefill?.heatId}</strong><p>ตรวจสอบข้อมูลที่เติมให้แล้ว และกรอกช่องที่ยังว่างก่อนส่งใบสมัคร Final ใบใหม่</p></div></div>
          )}
          <div className="form-grid">
            <Field label="English First Name" required><input autoComplete="given-name" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} placeholder="First name" required /></Field>
            <Field label="English Last Name" required><input autoComplete="family-name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} placeholder="Last name" required /></Field>
            <Field label="ชื่อ (ภาษาไทย)" required><input value={form.thaiFirstName} onChange={(event) => update("thaiFirstName", event.target.value)} placeholder="ชื่อจริงภาษาไทย" required /></Field>
            <Field label="นามสกุล (ภาษาไทย)" required><input value={form.thaiLastName} onChange={(event) => update("thaiLastName", event.target.value)} placeholder="นามสกุลภาษาไทย" required /></Field>
            <fieldset className="gender-fieldset"><legend className="field-title">Gender / เพศ <span className="required-mark">*</span></legend><div className="gender-options">{[["Male", "ชาย"], ["Female", "หญิง"], ["Prefer not to say", "ไม่ประสงค์ระบุ"]].map(([value, label]) => <label key={value}><input type="radio" name="gender" value={value} checked={form.gender === value} onChange={() => update("gender", value)} required /><span>{label}</span></label>)}</div></fieldset>
            <Field label="Date of Birth / วันเกิด" required><input type="date" autoComplete="bday" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} required /></Field>
            <Field label="School Name / โรงเรียน" required hint="เลือกชื่อโรงเรียนจากรายการ หากไม่มีชื่อให้เลือก Other แล้วกรอกช่องด้านขวา"><select value={form.schoolName} onChange={(event) => { const schoolName = event.target.value; setForm((current) => ({ ...current, schoolName, certificateSchoolName: schoolName === "Other" ? "" : current.certificateSchoolName })); }} required><option value="">เลือกโรงเรียน</option>{schools.map((school) => <option key={school} value={school}>{school === "Other" ? "Other / ไม่พบโรงเรียน" : school}</option>)}</select></Field>
            <Field label={form.schoolName === "Other" ? "School Name in English / ชื่อโรงเรียน" : "School Name in English for Certificate"} required={form.schoolName === "Other"} hint={form.schoolName === "Other" ? "พิมพ์ชื่อโรงเรียนภาษาอังกฤษที่ไม่พบในรายการ" : "กรอกหากต้องการใช้ชื่อโรงเรียนภาษาอังกฤษแบบอื่นบนใบประกาศ"}><input value={form.certificateSchoolName} onChange={(event) => update("certificateSchoolName", event.target.value)} placeholder={form.schoolName === "Other" ? "พิมพ์ชื่อโรงเรียนที่นี่" : "ชื่อโรงเรียนภาษาอังกฤษบนใบประกาศ"} required={form.schoolName === "Other"} /></Field>
            <Field label="Email / อีเมล" required hint="ระบบจะส่งข้อมูลเข้าใช้งานข้อสอบเก่าภายใน 3–5 วันหลังสมัคร"><input type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="student@example.com" required /></Field>
            <Field label="Phone Number / เบอร์โทรศัพท์" required hint="รูปแบบตัวอย่าง (000) 000-0000"><input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(000) 000-0000" required /></Field>
            <section className="address-subzone" aria-labelledby="address-subzone-title">
              <div className="address-subzone-heading"><span className="address-subzone-icon"><Icon name="building" size={15} /></span><div><h3 id="address-subzone-title">Address <span>/ ที่อยู่</span></h3><p>กรอกที่อยู่สำหรับติดต่อ</p></div></div>
              <div className="address-subzone-grid">
                <Field label="Address Line 1 / ที่อยู่" required><input autoComplete="address-line1" value={form.address1} onChange={(event) => update("address1", event.target.value)} placeholder="บ้านเลขที่ ถนน" required /></Field>
                <Field label="Address Line 2 / ที่อยู่เพิ่มเติม"><input autoComplete="address-line2" value={form.address2} onChange={(event) => update("address2", event.target.value)} placeholder="อาคาร หมู่บ้าน (ถ้ามี)" /></Field>
                <Field label="District / City / เขตหรืออำเภอ" required><input autoComplete="address-level2" value={form.city} onChange={(event) => update("city", event.target.value)} required /></Field>
                <Field label="Province / จังหวัด" required><input autoComplete="address-level1" value={form.province} onChange={(event) => update("province", event.target.value)} required /></Field>
                <Field label="Postal Code / รหัสไปรษณีย์" required><input autoComplete="postal-code" inputMode="numeric" maxLength={10} value={form.postalCode} onChange={(event) => update("postalCode", event.target.value.replace(/[^\d-]/g, ""))} required /></Field>
              </div>
            </section>
          </div>
          </section>
          <section className="form-zone" aria-labelledby="zone-competition">
            <div className="form-progress"><span className="form-progress-number">02</span><div><strong id="zone-competition">Competition Selection <span>/ เลือกรายการสอบและระดับชั้น</span></strong><small>เลือกรายการที่ต้องการสมัคร แล้วเลือกระดับชั้นแยกในแต่ละรายการ</small></div></div>
            <div className="competition-list">
              {competitions.map((competition) => {
                const selected = form.competitionIds.includes(competition.id);
                const competitionExam = (examCatalog || []).find((exam) => exam.competitionId === competition.id && exam.year === examYear && getExamRoundType(exam) === examRoundType);
                const format = formatForCompetition(competition.id);
                const competitionCenters = selected && format === "Paper-Based" ? centersForCompetition(competition.id) : [];
                return <article className={`competition-card${selected ? " competition-card-selected" : ""}`} key={competition.id}>
                  <label className="competition-select"><input type="checkbox" checked={selected} onChange={() => toggleCompetition(competition.id)} /><span className="competition-check-mark" aria-hidden="true" /><span><strong>{competition.name}</strong><small>{competition.subject}</small><small className="competition-session"><Icon name="clock" size={12} />สอบ {formatExamSession(competitionExam)}</small></span><span className="competition-fee">฿{priceForCompetition(competition).toLocaleString()}<small> / รายการ</small></span></label>
                  {selected ? <div className="competition-card-options">
                    <CompetitionFormatPicker competitionId={competition.id} format={format} paperPrice={priceForCompetition(competition, "Paper-Based")} onlinePrice={priceForCompetition(competition, "Online")} onChange={(nextFormat) => updateCompetitionFormat(competition.id, nextFormat)} />
                    {format === "Paper-Based" ? <Field label={`ศูนย์สอบ ${competition.short}`} required className="competition-center-field"><select value={centerForCompetition(competition.id)} onChange={(event) => updateCompetitionCenter(competition.id, event.target.value)} required><option value="">เลือกศูนย์สอบ</option>{centerForCompetition(competition.id) && !isOnlineCenter(centerForCompetition(competition.id)) && !competitionCenters.some((center) => center.name === centerForCompetition(competition.id)) ? <option value={centerForCompetition(competition.id)}>{centerForCompetition(competition.id)} · กรุณาเลือกศูนย์ที่เปิด</option> : null}{competitionCenters.map((center) => <option key={center.id} value={center.name}>{center.name}</option>)}</select>{!competitionCenters.length ? <small className="field-hint-error">รายการนี้ยังไม่มีศูนย์สอบที่เปิดใช้งาน</small> : null}</Field> : <div className="competition-online-fields"><Field label={`อีเมลเข้าสอบ ${competition.short}`} required className="competition-exam-email" hint="ใช้อีเมลเดียวกับรายการอื่นได้ หากใช้บัญชีเดียวกัน"><input type="email" autoComplete="email" value={examEmailForCompetition(competition.id)} onChange={(event) => updateCompetitionExamEmail(competition.id, event.target.value)} placeholder="student@gmail.com" required /></Field></div>}
                    <Field label={`ระดับชั้น ${competition.short}`} required className="competition-grade"><select value={form.grades[competition.id] || ""} onChange={(event) => { setForm((current) => ({ ...current, grades: { ...current.grades, [competition.id]: event.target.value } })); setSelectionError(""); }} required><option value="">เลือกระดับชั้น</option>{form.grades[competition.id] && !competition.grades.includes(form.grades[competition.id]) ? <option value={form.grades[competition.id]}>{form.grades[competition.id]} (จาก Heat)</option> : null}{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}</select></Field>
                  </div> : null}
                </article>;
              })}
              {!competitions.length ? <div className="empty-inline"><Icon name="calendar" /><span>ขณะนี้ยังไม่มีรายการสอบรอบนี้ที่เปิดรับสมัคร</span></div> : null}
            </div>
            <div className="schedule-note"><Icon name="calendar" size={16} /><div><strong>{isFinal ? "การสมัครรอบ Final" : "กำหนดการรอบสอบ"}</strong><span>{isFinal ? "ใบสมัคร Final แยกจาก Heat และต้องแนบสลิปชำระเงินใหม่" : `ปิดรับสมัคร ${formatThaiDate(scheduleExam?.closeDate)} · วันสอบ ${formatThaiDate(scheduleExam?.examDate)}`}</span><small>{isFinal ? "ตรวจรายการสอบและระดับชั้นจาก Heat ก่อนส่งใบสมัคร" : "เวลาเข้าสอบแสดงไว้บนการ์ดของแต่ละรายการ"}</small></div></div>
            {selectionError ? <p className="inline-error selection-error" role="alert"><Icon name="info" size={16} />{selectionError}</p> : null}
          </section>
          {selectedCompetitions.length ? <p className="form-helper-note">ตรวจสอบระดับชั้น รูปแบบ ศูนย์สอบ หรืออีเมลเข้าสอบภายในการ์ดของแต่ละรายการก่อนชำระเงิน</p> : null}
          <section className="form-zone" aria-labelledby="zone-papers">
            <div className="form-progress"><span className="form-progress-number">04</span><div><strong id="zone-papers">Past Papers <span>/ ข้อสอบเก่า</span></strong><small>เลือกซื้อเพิ่มเติมได้ รายการที่เลือกจะส่งข้อมูลเข้าใช้งานทางอีเมล</small></div><span className="paper-total-chip">รวม ฿{pastPapersTotal.toLocaleString()}</span></div>
            <div className="past-paper-grid">{pastPaperGroups.map((group) => <fieldset className="past-paper-group" key={group.id}><legend>{group.title}</legend><div>{group.items.map((paper) => <label className="past-paper-option" key={paper.id}><input type="checkbox" checked={form.pastPaperIds.includes(paper.id)} onChange={() => togglePastPaper(paper.id)} /><span className="past-paper-copy"><strong>{paper.title}</strong><small>{paper.detail}</small></span><b>฿{paper.price}</b></label>)}</div></fieldset>)}</div>
            <div className="past-paper-info"><strong>📚 ข้อมูลข้อสอบเก่า</strong><p><b>HKISO / HKICO:</b> English Version · <b>Big Bay Bei:</b> English + Thai Version พร้อม VDO ภาษาไทย</p><p>เข้าใช้งานผ่าน <a href="https://www.learnocecth.com/" target="_blank" rel="noreferrer">Learn OCEC Thailand</a> โดยเจ้าหน้าที่จะส่งข้อมูลทางอีเมลภายใน 3–5 วันหลังสมัคร</p><small>ข้อสอบที่ซื้อจะตรงกับระดับชั้นที่สมัคร · หากต้องการข้อสอบระดับชั้นเพิ่มเติม ติดต่อ LINE Official: <b>@ocecth</b> · กรุณาตรวจ Junk / Spam Mail</small></div>
          </section>
          <section className="form-zone form-zone-payment" aria-labelledby="zone-payment">
            <div className="form-progress"><span className="form-progress-number">05</span><div><strong id="zone-payment">Payment and Confirmation <span>/ ชำระเงินและยืนยัน</span></strong><small>ตรวจยอดชำระให้ครบก่อนแนบหลักฐาน</small></div></div>
            <div className="payment-total-grid"><div><span>ข้อสอบเก่า</span><small>Past Papers Total</small><strong>฿{pastPapersTotal.toLocaleString()}</strong></div><div><span>ค่าสมัครสอบ</span><small>Competition Registration Fee</small><strong>฿{registrationFee.toLocaleString()}</strong></div><div className="payment-total-grand"><span>ยอดที่ต้องชำระ</span><small>Total Payment</small><strong>฿{totalPayment.toLocaleString()}</strong></div></div>
            <PaymentAccountCards accounts={formPaymentAccounts} />
            <div className="refund-warning"><Icon name="info" /><div><strong>REGISTRATION FEES: NON-REFUNDABLE</strong><span>ค่าธรรมเนียมการสมัครขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนชำระเงิน</span></div></div>
            <label className={`file-drop file-drop-inline registration-slip${slipFile?.dataUrl ? " slip-file-ready" : ""}`}>
              <input type="file" accept="image/jpeg,image/png,application/pdf,.pdf" onChange={(event) => { selectSlip(event.target.files?.[0]); event.target.value = ""; }} aria-label="แนบหลักฐานการชำระเงิน" />
              <span className="file-drop-icon"><Icon name={slipFile?.dataUrl ? "check" : "upload"} /></span>
              <span className="file-drop-copy" aria-live="polite"><strong>{slipFile?.dataUrl ? "แนบสลิปแล้ว" : fileName || "แนบหลักฐานการชำระเงิน"}</strong>{slipFile?.dataUrl ? <small className="slip-file-name" title={fileName}>{fileName} · พร้อมส่งพร้อมใบสมัคร</small> : null}<small>รองรับ JPG, PNG หรือ PDF · ไม่เกิน 10 MB · แอดมินจะเห็นภาพสลิปในใบสมัคร</small></span>
              <span className="file-select-label">{slipFile?.dataUrl ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}</span>
            </label>
            {fileError ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{fileError}</p> : null}
            <label className="confirm-check"><input type="checkbox" checked={form.confirmDetails} onChange={(event) => { update("confirmDetails", event.target.checked); setSelectionError(""); setPaymentError(""); }} /><span>ข้าพเจ้ารับทราบและตรวจสอบข้อมูลเรียบร้อยแล้ว และต้องการยืนยันส่งแบบฟอร์มนี้ <b>*</b></span></label>
            <label className="confirm-check confirm-check-optional"><input type="checkbox" checked={form.marketingConsent} onChange={(event) => update("marketingConsent", event.target.checked)} /><span>ข้าพเจ้ายินยอมให้ OCEC Thailand เผยแพร่ชื่อผู้สมัคร ผลการแข่งขัน และรางวัล ผ่านช่องทางประชาสัมพันธ์อย่างเป็นทางการของ OCEC Thailand และรายการแข่งขัน</span></label>
            {paymentError ? <p className="inline-error selection-error" role="alert"><Icon name="info" size={16} />{paymentError}</p> : null}
          <div className="form-footer form-footer-submit"><span><Icon name="lock" size={14} />ข้อมูลถูกใช้เพื่อดำเนินการสมัครสอบ</span><Button type="submit" icon={isSubmitting ? undefined : "arrow"} disabled={isSubmitting}>{isSubmitting ? "กำลังส่ง..." : "ส่งใบสมัคร"}</Button></div>
          </section>
        </form>
        <aside className="surface side-note form-side-note">
          <span className="side-note-icon"><Icon name="shield" /></span><h3>สรุปการสมัคร</h3>
          <div className="live-total"><span>รายการสอบ</span><strong>{selectedCompetitions.length} รายการ</strong>{selectedCompetitions.map((competition) => <small key={competition.id}>{competition.short}{form.grades[competition.id] ? ` · ${form.grades[competition.id]}` : " · เลือกระดับชั้น"}</small>)}</div>
          <div className="live-total"><span>รูปแบบสอบ</span><strong>{formatSummary}</strong>{selectedCompetitions.map((competition) => <small key={competition.id}>{competition.short} · {formatForCompetition(competition.id) === "Online" ? `Online Exam · ${examEmailForCompetition(competition.id) || "กรอกอีเมลในรายการสอบ"}` : `Paper-Based · ${centerForCompetition(competition.id) || "เลือกศูนย์สอบ"}`}</small>)}</div>
          <div className="live-total live-total-highlight"><span>ยอดรวมปัจจุบัน</span><strong>฿{totalPayment.toLocaleString()}</strong><small>ค่าสอบ ฿{registrationFee.toLocaleString()} + ข้อสอบเก่า ฿{pastPapersTotal.toLocaleString()}</small></div>
          <hr /><div className="side-deadline"><Icon name="calendar" /><span><small>วันสอบ</small><strong>{selectedExamDateText(examCatalog, examRoundType, examYear, form.competitionIds)}</strong></span></div>
          <p className="side-note-small">หลังสมัคร ข้อมูลสรุปและรายละเอียดข้อสอบเก่าจะส่งไปยังอีเมลที่กรอกไว้</p>
        </aside>
      </div>
    </div>
  );
}

function SchoolBatchForm({ kind, prefill, batch, setBatch, onSubmit, navigate, onBack, competitionFees, examCatalog, examYear, centerCatalog, pastPaperCatalog, paymentAccounts, competitions, schools }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [errorSection, setErrorSection] = useState("");
  const [excelPreview, setExcelPreview] = useState(null);
  const [excelImportMessage, setExcelImportMessage] = useState("");
  const activeExamYear = examYear || getActiveExamYear(examCatalog, "HEAT");
  const pastPaperGroups = groupPastPaperCatalog(pastPaperCatalog);
  const formPaymentAccounts = (paymentAccounts || []).filter((account) => account.active !== false && account.showInForm !== false);
  const allPastPapers = pastPaperGroups.flatMap((group) => group.items);
  const activeCenterCatalog = centerCatalog?.length ? centerCatalog : BACKEND_ENABLED ? [] : DEFAULT_CENTER_CATALOG;
  const activeApplicant = batch.applicants.find((applicant) => applicant.id === batch.activeId) || batch.applicants[0];
  const activeIndex = Math.max(0, batch.applicants.findIndex((applicant) => applicant.id === activeApplicant.id));
  const centersForCompetition = (competitionId) => getCommonCenters([competitionId], examCatalog, activeCenterCatalog, { year: activeExamYear, roundType: "HEAT" });
  const formatForApplicantCompetition = (applicant, competitionId) => normalizeExamFormat(applicant.formats?.[competitionId], normalizeExamFormat(applicant.format));
  const examEmailForApplicantCompetition = (applicant, competitionId) => getCompetitionExamEmailValue(applicant.examEmailsByCompetition, competitionId, applicant.examEmail);
  const centerForApplicantCompetition = (applicant, competitionId) => applicant.centersByCompetition?.[competitionId] || (applicant.competitionIds?.length === 1 ? applicant.center || "" : "");
  const examScheduleSummary = competitions.map((competition) => {
    const exam = examCatalog.find((item) => item.competitionId === competition.id && item.year === activeExamYear && getExamRoundType(item) === "HEAT");
    return `${competition.short} ${formatExamTime(exam)}`;
  }).join(" · ");

  async function stageSchoolWorkbook(file) {
    setExcelPreview(null);
    setExcelImportMessage("");
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setExcelImportMessage("ไฟล์ Excel ต้องมีขนาดไม่เกิน 20 MB");
      return;
    }
    try {
      const workbook = await readWorkbook(file);
      const parsed = parseSchoolWorkbook(workbook, {
        centerCatalog: activeCenterCatalog,
        competitions,
        examCatalog,
        pastPaperCatalog,
        schools,
        year: activeExamYear,
      });
      setExcelPreview({ ...parsed, fileName: file.name });
      setExcelImportMessage(parsed.issues.length ? `พบ ${parsed.issues.length} จุดที่ต้องแก้ในไฟล์ก่อนนำเข้า` : `อ่านข้อมูล ${parsed.applicants.length} คนแล้ว · ตรวจสอบตัวอย่างก่อนแทนชุดข้อมูลปัจจุบัน`);
    } catch (error) {
      setExcelImportMessage(error?.message || "เปิดไฟล์ Excel ไม่ได้ กรุณาตรวจสอบไฟล์แล้วลองอีกครั้ง");
    }
  }

  function importSchoolWorkbookPreview() {
    if (!excelPreview || excelPreview.issues.length || !excelPreview.applicants.length) return;
    const applicants = excelPreview.applicants.map((applicant, index) => ({ ...applicant, id: `school-excel-${Date.now()}-${index + 1}` }));
    setBatch((current) => ({
      ...current,
      applicants,
      activeId: applicants[0].id,
      confirmDetails: false,
      marketingConsent: excelPreview.consent,
      paymentSlipFileName: "",
      paymentSlipFile: null,
      paymentSlipError: "",
      source: "excel",
    }));
    setExcelImportMessage(`นำเข้าข้อมูล ${applicants.length} คนจาก ${excelPreview.fileName} แล้ว · แนบสลิปรวม 1 ไฟล์ก่อนส่ง`);
    setExcelPreview(null);
    setFormError("");
    setErrorSection("");
  }

  function applicantIssue(applicant) {
    if (!applicant.firstName.trim()) return "กรุณากรอกชื่อภาษาอังกฤษ";
    if (!applicant.lastName.trim()) return "กรุณากรอกนามสกุลภาษาอังกฤษ";
    if (!applicant.thaiFirstName.trim()) return "กรุณากรอกชื่อภาษาไทย";
    if (!applicant.thaiLastName.trim()) return "กรุณากรอกนามสกุลภาษาไทย";
    if (!applicant.gender) return "กรุณาเลือกเพศ";
    if (!applicant.dateOfBirth) return "กรุณากรอกวันเกิด";
    if (!applicant.schoolName) return "กรุณาเลือกโรงเรียน";
    if (applicant.schoolName === "Other" && !applicant.certificateSchoolName.trim()) return "กรุณากรอกชื่อโรงเรียนภาษาอังกฤษ";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) return "กรุณากรอกอีเมลให้ถูกต้อง";
    if (applicant.phone.replace(/\D/g, "").length < 7) return "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง";
    if (!applicant.address1.trim()) return "กรุณากรอกที่อยู่";
    if (!applicant.city.trim()) return "กรุณากรอกเขตหรืออำเภอ";
    if (!applicant.province.trim()) return "กรุณากรอกจังหวัด";
    if (!applicant.postalCode.trim()) return "กรุณากรอกรหัสไปรษณีย์";
    if (applicant.competitionIds.length === 0) return "กรุณาเลือกรายการสอบอย่างน้อย 1 รายการ";
    const selectedCompetitions = competitions.filter((competition) => applicant.competitionIds.includes(competition.id));
    if (selectedCompetitions.some((competition) => !applicant.grades[competition.id])) return "กรุณาเลือกระดับชั้นให้ครบทุกวิชาที่สมัคร";
    const missingCenter = selectedCompetitions.find((competition) => formatForApplicantCompetition(applicant, competition.id) === "Paper-Based"
      && !centersForCompetition(competition.id).some((center) => center.name === centerForApplicantCompetition(applicant, competition.id)));
    if (missingCenter) return `กรุณาเลือกศูนย์สอบที่เปิดสำหรับ ${missingCenter.short || missingCenter.name}`;
    const invalidOnlineEmail = selectedCompetitions.find((competition) => formatForApplicantCompetition(applicant, competition.id) === "Online"
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(examEmailForApplicantCompetition(applicant, competition.id).trim()));
    if (invalidOnlineEmail) return `กรุณากรอกอีเมลเข้าสอบที่ถูกต้องสำหรับ ${invalidOnlineEmail.short || invalidOnlineEmail.name}`;
    return "";
  }

  function totalsFor(applicant) {
    const selectedCompetitions = competitions.filter((competition) => applicant.competitionIds.includes(competition.id));
    const selectedPapers = allPastPapers.filter((paper) => applicant.pastPaperIds.includes(paper.id));
    const papersTotal = selectedPapers.reduce((sum, paper) => sum + paper.price, 0);
    const registrationFee = selectedCompetitions.reduce((sum, competition) => sum + getCompetitionExamPrice(examCatalog, competition.id, "HEAT", formatForApplicantCompetition(applicant, competition.id), competitionFees, activeExamYear), 0);
    return { selectedCompetitions, selectedPapers, papersTotal, registrationFee, totalPayment: papersTotal + registrationFee };
  }

  const applicantTotals = batch.applicants.map((applicant) => totalsFor(applicant));
  const batchTotals = applicantTotals.reduce((sum, item) => ({
    papersTotal: sum.papersTotal + item.papersTotal,
    registrationFee: sum.registrationFee + item.registrationFee,
    totalPayment: sum.totalPayment + item.totalPayment,
  }), { papersTotal: 0, registrationFee: 0, totalPayment: 0 });

  function updateApplicant(id, key, value) {
    setBatch((current) => ({
      ...current,
      applicants: current.applicants.map((applicant) => applicant.id === id ? { ...applicant, [key]: value } : applicant),
    }));
    setFormError("");
    setErrorSection("");
  }

  function toggleCompetition(id) {
    const applicant = activeApplicant;
    const competitionIds = applicant.competitionIds.includes(id)
      ? applicant.competitionIds.filter((competitionId) => competitionId !== id)
      : [...applicant.competitionIds, id];
    setBatch((current) => ({ ...current, applicants: current.applicants.map((item) => item.id === applicant.id ? { ...item, competitionIds } : item) }));
    setFormError("");
    setErrorSection("");
  }

  function updateApplicantFormat(competitionId, format) {
    setBatch((current) => ({ ...current, applicants: current.applicants.map((applicant) => {
      if (applicant.id !== activeApplicant.id) return applicant;
      const currentCenter = applicant.centersByCompetition?.[competitionId]
        || (applicant.competitionIds?.length === 1 ? applicant.center : "");
      const centersByCompetition = format === "Online" || isOnlineCenter(currentCenter)
        ? { ...applicant.centersByCompetition, [competitionId]: "" }
        : applicant.centersByCompetition;
      return { ...applicant, formats: { ...applicant.formats, [competitionId]: format }, centersByCompetition };
    }) }));
    setFormError("");
    setErrorSection("");
  }

  function togglePastPaper(id) {
    const applicant = activeApplicant;
    updateApplicant(applicant.id, "pastPaperIds", applicant.pastPaperIds.includes(id)
      ? applicant.pastPaperIds.filter((paperId) => paperId !== id)
      : [...applicant.pastPaperIds, id]);
  }

  function addApplicant() {
    setBatch((current) => {
      const id = `school-applicant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const applicant = createSchoolApplicant(id, prefill);
      return { ...current, applicants: [...current.applicants, applicant], activeId: id };
    });
    setFormError("");
    setErrorSection("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeApplicant(id) {
    setBatch((current) => {
      if (current.applicants.length <= 1) return current;
      const index = current.applicants.findIndex((applicant) => applicant.id === id);
      const applicants = current.applicants.filter((applicant) => applicant.id !== id);
      return { ...current, applicants, activeId: current.activeId === id ? applicants[Math.max(0, index - 1)].id : current.activeId };
    });
    setFormError("");
    setErrorSection("");
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const invalidApplicantIndex = batch.applicants.findIndex((applicant) => applicantIssue(applicant));
    if (invalidApplicantIndex >= 0) {
      const invalidApplicant = batch.applicants[invalidApplicantIndex];
      setBatch((current) => ({ ...current, activeId: invalidApplicant.id }));
      const name = `${invalidApplicant.firstName} ${invalidApplicant.lastName}`.trim();
      const label = name || `ผู้เข้าสอบคนที่ ${invalidApplicantIndex + 1}`;
      setFormError(`${label}: ${applicantIssue(invalidApplicant)}`);
      setErrorSection("applicant");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const schoolFor = (applicant) => (applicant.schoolName === "Other" ? applicant.certificateSchoolName : applicant.schoolName).normalize("NFKC").trim().replace(/\s+/g, " ");
    const firstSchool = schoolFor(batch.applicants[0]);
    const differentSchoolIndex = batch.applicants.findIndex((applicant) => schoolFor(applicant).toLowerCase() !== firstSchool.toLowerCase());
    if (differentSchoolIndex >= 0) {
      const applicant = batch.applicants[differentSchoolIndex];
      setBatch((current) => ({ ...current, activeId: applicant.id }));
      setFormError(`ชื่อโรงเรียนในชุดใบสมัครต้องตรงกันทุกคน: ${applicant.firstName} ${applicant.lastName} ระบุ “${schoolFor(applicant)}” แต่คนแรกระบุ “${firstSchool}” กรุณาแก้ชื่อโรงเรียนของผู้สมัครคนนี้`);
      setErrorSection("applicant");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!formPaymentAccounts.length) {
      setFormError("ขณะนี้ยังไม่มีบัญชีรับโอนที่เปิดแสดงในฟอร์ม กรุณาติดต่อผู้ดูแลระบบ");
      setErrorSection("payment");
      return;
    }
    if (!batch.paymentSlipFileName || !batch.paymentSlipFile?.dataUrl) {
      setFormError("กรุณาแนบสลิปสำหรับยอดชำระรวมของชุดใบสมัคร");
      setErrorSection("payment");
      document.getElementById("school-payment-zone")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!batch.confirmDetails) {
      setFormError("กรุณายืนยันว่าตรวจสอบข้อมูลและยอดชำระของผู้สมัครทุกคนเรียบร้อยแล้ว");
      setErrorSection("payment");
      return;
    }
    setFormError("");
    setErrorSection("");
    const batchId = `school-batch-${Date.now()}`;
    const batchApplications = batch.applicants.map((applicant) => {
      const totals = totalsFor(applicant);
      const school = applicant.schoolName === "Other" ? applicant.certificateSchoolName.trim() : applicant.schoolName;
      const examListings = totals.selectedCompetitions.map((competition) => {
        const format = formatForApplicantCompetition(applicant, competition.id);
        const selectedCenter = format === "Online"
          ? activeCenterCatalog.find((center) => center.code === ONLINE_CENTER_CODE) || (!BACKEND_ENABLED ? DEFAULT_CENTER_CATALOG.find((center) => center.code === ONLINE_CENTER_CODE) : null)
          : centersForCompetition(competition.id).find((center) => center.name === centerForApplicantCompetition(applicant, competition.id));
        const fee = getCompetitionExamPrice(examCatalog, competition.id, "HEAT", format, competitionFees, activeExamYear);
        return { ...competition, grade: applicant.grades[competition.id], format, examEmail: format === "Online" ? examEmailForApplicantCompetition(applicant, competition.id).trim() : "", fee, chargedFee: fee, center: selectedCenter?.name || "", centerId: selectedCenter?.id || "", centerCode: selectedCenter?.code || "", centerSnapshot: selectedCenter ? { id: selectedCenter.id, code: selectedCenter.code, name: selectedCenter.name } : null };
      });
      const formats = new Set(examListings.map((listing) => listing.format));
      const centerSummary = [...new Set(examListings.map((listing) => listing.center).filter(Boolean))].join(" · ");
      const singleCenter = examListings[0]?.centerSnapshot || null;
      return {
        ...applicant,
        source: "school",
        kind,
        examYear: activeExamYear,
        candidate: `${applicant.firstName} ${applicant.lastName}`.trim(),
        school,
        contactEmail: applicant.email,
        grade: examListings.map((competition) => `${competition.short}: ${competition.grade}`).join(" · "),
        format: formats.size > 1 ? "Mixed" : formats.has("Online") ? "Online Exam" : "On-site",
        center: centerSummary,
        centerId: singleCenter?.id || "",
        centerCode: singleCenter?.code || "",
        centerSnapshot: singleCenter,
        examListings,
        examEmail: examListings.find((listing) => listing.format === "Online")?.examEmail || "",
        pastPaperSelections: totals.selectedPapers,
        pastPapersTotal: totals.papersTotal,
        registrationFee: totals.registrationFee,
        totalPayment: totals.totalPayment,
        marketingConsent: Boolean(batch.marketingConsent),
        sourceHeatId: prefill?.id || "",
        batchId,
      };
    });
    setIsSubmitting(true);
    try {
      const outcome = await onSubmit({
        source: "school",
        kind,
        batchId,
        batchApplications,
        totalPayment: batchTotals.totalPayment,
        paymentAccountsSnapshot: formPaymentAccounts.map((account) => ({ ...account })),
        schoolBatch: { source: batch.source || "manual", paymentSlipFileName: batch.paymentSlipFileName, paymentSlipFile: batch.paymentSlipFile, marketingConsent: Boolean(batch.marketingConsent) },
      });
      if (outcome?.ok === false) {
        setFormError(outcome.error);
        setErrorSection("payment");
        document.getElementById("school-payment-zone")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const fullName = `${activeApplicant.firstName} ${activeApplicant.lastName}`.trim();
  const activeTotals = totalsFor(activeApplicant);
  const totalLabel = (value) => `฿${value.toLocaleString()}`;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow={`สมัครผ่านโรงเรียน · ปีการศึกษา ${examYear}`}
        title={kind === "Final" ? "สมัครสอบ Final แบบโรงเรียน" : "สมัครสอบแบบโรงเรียน"}
        description="เพิ่มผู้เข้าสอบได้หลายคน กรอกข้อมูลและเลือกรายการสอบแยกสำหรับแต่ละคน"
        action={<div className="school-form-actions" role="group" aria-label="การดำเนินการสมัคร">
          <Button icon="arrow" className="school-mode-return-button" onClick={onBack}>กลับไปสมัครด้วยตนเอง</Button>
          <Button variant="outline" icon="close" onClick={() => navigate(kind === "Final" ? "final-confirm" : "home")}>ยกเลิก</Button>
        </div>}
      />
      <div className="form-layout school-batch-layout">
        <form className="surface form-surface registration-form school-batch-form" onSubmit={handleSubmit} noValidate>
          <section className="form-zone" aria-labelledby="school-zone-student">
            <div className="form-progress"><span className="form-progress-number">01</span><div><strong id="school-zone-student">Student Information <span>/ ข้อมูลผู้สมัคร</span></strong><small>สร้างใบสมัครแยก 1 ใบต่อผู้เข้าสอบ</small></div><span className="applicant-count-chip"><Icon name="users" size={14} />{batch.applicants.length} คน</span></div>
            <div className="school-mode-note"><Icon name="info" size={17} /><span>แต่ละคนมีข้อมูล รายการสอบ และระดับชั้นของตนเอง · กดสลับชื่อเพื่อแก้ไขข้อมูล</span></div>
            <section className="school-import-panel" aria-labelledby="school-excel-heading">
              <div className="school-import-copy"><span className="school-import-icon"><Icon name="file" /></span><div><strong id="school-excel-heading">นำเข้ารายชื่อจาก Excel</strong><small>ใช้ชีตเดียว · 1 แถวต่อผู้เข้าสอบ · เลือกรายการสอบ ระดับชั้น รูปแบบสอบ ศูนย์สอบ และอีเมลเข้าสอบออนไลน์แยกตามรายการในแถวเดียวกัน</small></div></div>
              <div className="school-import-actions">
                <Button variant="outline" icon="download" onClick={() => downloadSchoolTemplate({ centerCatalog: activeCenterCatalog, competitions, pastPaperCatalog, schools }, `ocec-school-registration-${activeExamYear}.xlsx`)}>ดาวน์โหลด Template Excel</Button>
                <label htmlFor="school-batch-excel-upload" className="button button-outline school-excel-upload-button"><Icon name="upload" size={17} /><span>{excelPreview ? "เปลี่ยนไฟล์ Excel" : "เลือกไฟล์ Excel"}</span><input id="school-batch-excel-upload" type="file" accept=".xlsx" onChange={(event) => { stageSchoolWorkbook(event.target.files?.[0]); event.target.value = ""; }} /></label>
              </div>
              {excelImportMessage ? <p className={`school-excel-message${excelPreview?.issues.length ? " school-excel-message-error" : ""}`} role="status">{excelImportMessage}</p> : null}
              {excelPreview ? <div className="school-excel-preview"><div className="school-excel-preview-head"><strong>ตัวอย่างข้อมูลจาก {excelPreview.fileName}</strong><span>{excelPreview.applicants.length} คน · {excelPreview.issues.length} จุดที่ต้องแก้</span></div>
                {excelPreview.applicants.length ? <div className="school-excel-preview-names">{excelPreview.applicants.slice(0, 4).map((applicant, index) => <span key={`${applicant.rowId}-${index}`}>{applicant.rowId} · {applicant.candidate || `${applicant.firstName} ${applicant.lastName}`}</span>)}{excelPreview.applicants.length > 4 ? <small>และอีก {excelPreview.applicants.length - 4} คน</small> : null}</div> : null}
                {excelPreview.issues.length ? <ul className="school-excel-issues">{excelPreview.issues.slice(0, 12).map((issue, index) => <li key={`${issue.sheet}-${issue.row}-${issue.field}-${index}`}>{issue.sheet} · แถว {issue.row}{issue.field ? ` · ${issue.field}` : ""}: {issue.message}</li>)}{excelPreview.issues.length > 12 ? <li>และอีก {excelPreview.issues.length - 12} จุด</li> : null}</ul> : excelPreview.applicants.length ? <Button icon="check" onClick={importSchoolWorkbookPreview}>ใช้ข้อมูล Excel แทนรายชื่อในฟอร์ม</Button> : <p className="school-excel-message-error">ไม่พบรายชื่อผู้สมัครในไฟล์นี้</p>}
              </div> : null}
            </section>
            <div className="school-applicant-switcher" role="group" aria-label="เลือกผู้เข้าสอบ">
              {batch.applicants.map((applicant, index) => {
                const applicantName = `${applicant.firstName} ${applicant.lastName}`.trim();
                const complete = !applicantIssue(applicant);
                return <div className={`school-applicant-tab-wrap${applicant.id === activeApplicant.id ? " school-applicant-tab-active" : ""}`} key={applicant.id}>
                  <button type="button" aria-pressed={applicant.id === activeApplicant.id} className="school-applicant-tab" onClick={() => { setBatch((current) => ({ ...current, activeId: applicant.id })); setFormError(""); setErrorSection(""); }}>
                    <span className="applicant-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="school-applicant-copy"><strong>{applicantName || `ผู้เข้าสอบคนที่ ${index + 1}`}</strong><small>{applicant.schoolName === "Other" ? applicant.certificateSchoolName || "รอระบุโรงเรียน" : applicant.schoolName || "ยังไม่ได้เลือกโรงเรียน"} · {applicant.competitionIds.length} รายการสอบ</small></span>
                    <span className={complete ? "applicant-status applicant-status-ready" : "applicant-status"}>{complete ? "ข้อมูลครบ" : "กำลังกรอก"}</span>
                  </button>
                  {batch.applicants.length > 1 ? <button type="button" className="remove-applicant-button" aria-label={`ลบใบสมัครของผู้เข้าสอบคนที่ ${index + 1}`} onClick={() => removeApplicant(applicant.id)}><Icon name="close" size={16} /></button> : null}
                </div>;
              })}
            </div>
            <Button variant="outline" icon="plus" className="add-applicant-button" onClick={addApplicant}>เพิ่มผู้เข้าสอบ</Button>
            {formError && errorSection === "applicant" ? <p className="inline-error school-form-error" role="alert"><Icon name="info" size={16} />{formError}</p> : null}
            <div className="student-entry-card">
              <div className="student-entry-heading"><span className="student-entry-index">{String(activeIndex + 1).padStart(2, "0")}</span><div><strong>{fullName || `ผู้เข้าสอบคนที่ ${activeIndex + 1}`}</strong><small>ใบสมัครที่ {activeIndex + 1} จาก {batch.applicants.length}</small></div><span className="student-entry-total">รวม {totalLabel(activeTotals.totalPayment)}</span></div>
              <div className="form-grid">
                <Field label="English First Name" required><input autoComplete="given-name" value={activeApplicant.firstName} onChange={(event) => updateApplicant(activeApplicant.id, "firstName", event.target.value)} placeholder="First name" /></Field>
                <Field label="English Last Name" required><input autoComplete="family-name" value={activeApplicant.lastName} onChange={(event) => updateApplicant(activeApplicant.id, "lastName", event.target.value)} placeholder="Last name" /></Field>
                <Field label="ชื่อ (ภาษาไทย)" required><input value={activeApplicant.thaiFirstName} onChange={(event) => updateApplicant(activeApplicant.id, "thaiFirstName", event.target.value)} placeholder="ชื่อจริงภาษาไทย" /></Field>
                <Field label="นามสกุล (ภาษาไทย)" required><input value={activeApplicant.thaiLastName} onChange={(event) => updateApplicant(activeApplicant.id, "thaiLastName", event.target.value)} placeholder="นามสกุลภาษาไทย" /></Field>
                <fieldset className="gender-fieldset"><legend className="field-title">Gender / เพศ <span className="required-mark">*</span></legend><div className="gender-options">{[["Male", "ชาย"], ["Female", "หญิง"], ["Prefer not to say", "ไม่ประสงค์ระบุ"]].map(([value, label]) => <label key={value}><input type="radio" name={`gender-${activeApplicant.id}`} value={value} checked={activeApplicant.gender === value} onChange={() => updateApplicant(activeApplicant.id, "gender", value)} /><span>{label}</span></label>)}</div></fieldset>
                <Field label="Date of Birth / วันเกิด" required><input type="date" autoComplete="bday" value={activeApplicant.dateOfBirth} onChange={(event) => updateApplicant(activeApplicant.id, "dateOfBirth", event.target.value)} /></Field>
                <Field label="School Name / โรงเรียน" required hint="เลือกจากรายการ หากไม่มีชื่อให้เลือก Other แล้วกรอกช่องด้านขวา"><select value={activeApplicant.schoolName} onChange={(event) => { const schoolName = event.target.value; setBatch((current) => ({ ...current, applicants: current.applicants.map((applicant) => applicant.id === activeApplicant.id ? { ...applicant, schoolName, certificateSchoolName: schoolName === "Other" ? "" : applicant.certificateSchoolName } : applicant) })); setFormError(""); setErrorSection(""); }}><option value="">เลือกโรงเรียน</option>{FORM_SCHOOLS.map((school) => <option key={school} value={school}>{school === "Other" ? "Other / ไม่พบโรงเรียน" : school}</option>)}</select></Field>
                <Field label={activeApplicant.schoolName === "Other" ? "School Name in English / ชื่อโรงเรียน" : "School Name in English for Certificate"} required={activeApplicant.schoolName === "Other"} hint={activeApplicant.schoolName === "Other" ? "พิมพ์ชื่อโรงเรียนภาษาอังกฤษที่ไม่พบในรายการ" : "กรอกหากต้องการใช้ชื่อโรงเรียนภาษาอังกฤษแบบอื่นบนใบประกาศ"}><input value={activeApplicant.certificateSchoolName} onChange={(event) => updateApplicant(activeApplicant.id, "certificateSchoolName", event.target.value)} placeholder={activeApplicant.schoolName === "Other" ? "พิมพ์ชื่อโรงเรียนที่นี่" : "ชื่อโรงเรียนภาษาอังกฤษบนใบประกาศ"} /></Field>
                <Field label="Email / อีเมล" required hint="ระบบส่งข้อมูลข้อสอบเก่าไปยังอีเมลของผู้เข้าสอบ"><input type="email" autoComplete="email" value={activeApplicant.email} onChange={(event) => updateApplicant(activeApplicant.id, "email", event.target.value)} placeholder="student@example.com" /></Field>
                <Field label="Phone Number / เบอร์โทรศัพท์" required hint="รูปแบบตัวอย่าง (000) 000-0000"><input type="tel" inputMode="tel" autoComplete="tel" value={activeApplicant.phone} onChange={(event) => updateApplicant(activeApplicant.id, "phone", event.target.value)} placeholder="(000) 000-0000" /></Field>
                <section className="address-subzone" aria-labelledby={`address-${activeApplicant.id}`}>
                  <div className="address-subzone-heading"><span className="address-subzone-icon"><Icon name="building" size={15} /></span><div><h3 id={`address-${activeApplicant.id}`}>Address <span>/ ที่อยู่</span></h3><p>กรอกที่อยู่สำหรับติดต่อ</p></div></div>
                  <div className="address-subzone-grid">
                    <Field label="Address Line 1 / ที่อยู่" required><input autoComplete="address-line1" value={activeApplicant.address1} onChange={(event) => updateApplicant(activeApplicant.id, "address1", event.target.value)} placeholder="บ้านเลขที่ ถนน" /></Field>
                    <Field label="Address Line 2 / ที่อยู่เพิ่มเติม"><input autoComplete="address-line2" value={activeApplicant.address2} onChange={(event) => updateApplicant(activeApplicant.id, "address2", event.target.value)} placeholder="อาคาร หมู่บ้าน (ถ้ามี)" /></Field>
                    <Field label="District / City / เขตหรืออำเภอ" required><input autoComplete="address-level2" value={activeApplicant.city} onChange={(event) => updateApplicant(activeApplicant.id, "city", event.target.value)} /></Field>
                    <Field label="Postal Code / รหัสไปรษณีย์" required><input autoComplete="postal-code" inputMode="numeric" maxLength={10} value={activeApplicant.postalCode} onChange={(event) => updateApplicant(activeApplicant.id, "postalCode", event.target.value.replace(/[^\d-]/g, ""))} /></Field>
                  </div>
                </section>
              </div>
            </div>
          </section>

          <section className="form-zone" aria-labelledby={`school-zone-competition-${activeApplicant.id}`}>
            <div className="form-progress"><span className="form-progress-number">02</span><div><strong id={`school-zone-competition-${activeApplicant.id}`}>Competition Selection <span>/ รายการสอบและระดับชั้น</span></strong><small>เลือกได้หลายรายการ และเลือกระดับชั้นแยกในแต่ละรายการ</small></div></div>
            <div className="competition-list">{competitions.map((competition) => {
              const selected = activeApplicant.competitionIds.includes(competition.id);
              const competitionExam = examCatalog.find((exam) => exam.competitionId === competition.id && exam.year === activeExamYear && getExamRoundType(exam) === "HEAT");
              const format = formatForApplicantCompetition(activeApplicant, competition.id);
              const availableCenters = selected && format === "Paper-Based" ? centersForCompetition(competition.id) : [];
              return <article className={`competition-card${selected ? " competition-card-selected" : ""}`} key={competition.id}>
                <label className="competition-select"><input type="checkbox" checked={selected} onChange={() => toggleCompetition(competition.id)} /><span className="competition-check-mark" aria-hidden="true" /><span><strong>{competition.name}</strong><small>{competition.subject}</small><small className="competition-session"><Icon name="clock" size={12} />สอบ {formatExamSession(competitionExam)}</small></span><span className="competition-fee">฿{getCompetitionExamPrice(examCatalog, competition.id, "HEAT", format, competitionFees, activeExamYear).toLocaleString()}<small> / รายการ</small></span></label>
                {selected ? <div className="competition-card-options">
                  <CompetitionFormatPicker competitionId={competition.id} prefix={activeApplicant.id} format={format} paperPrice={getCompetitionExamPrice(examCatalog, competition.id, "HEAT", "Paper-Based", competitionFees, activeExamYear)} onlinePrice={getCompetitionExamPrice(examCatalog, competition.id, "HEAT", "Online", competitionFees, activeExamYear)} onChange={(nextFormat) => updateApplicantFormat(competition.id, nextFormat)} />
                  {format === "Paper-Based" ? <Field label={`ศูนย์สอบ ${competition.short}`} required className="competition-center-field"><select value={centerForApplicantCompetition(activeApplicant, competition.id)} onChange={(event) => updateApplicant(activeApplicant.id, "centersByCompetition", { ...activeApplicant.centersByCompetition, [competition.id]: event.target.value })}><option value="">เลือกศูนย์สอบ</option>{centerForApplicantCompetition(activeApplicant, competition.id) && !isOnlineCenter(centerForApplicantCompetition(activeApplicant, competition.id)) && !availableCenters.some((center) => center.name === centerForApplicantCompetition(activeApplicant, competition.id)) ? <option value={centerForApplicantCompetition(activeApplicant, competition.id)}>{centerForApplicantCompetition(activeApplicant, competition.id)} · กรุณาเลือกศูนย์ที่เปิด</option> : null}{availableCenters.map((center) => <option key={center.id} value={center.name}>{center.name}</option>)}</select>{!availableCenters.length ? <small className="field-hint-error">รายการนี้ยังไม่มีศูนย์สอบที่เปิดใช้งาน</small> : null}</Field> : <div className="competition-online-fields"><Field label={`อีเมลเข้าสอบ ${competition.short}`} required className="competition-exam-email" hint="ใช้อีเมลเดียวกับรายการอื่นได้ หากใช้บัญชีเดียวกัน"><input type="email" autoComplete="email" value={examEmailForApplicantCompetition(activeApplicant, competition.id)} onChange={(event) => updateApplicant(activeApplicant.id, "examEmailsByCompetition", { ...activeApplicant.examEmailsByCompetition, [competition.id]: event.target.value })} placeholder="student@gmail.com" required /></Field></div>}
                  <Field label={`ระดับชั้น ${competition.short}`} required className="competition-grade"><select value={activeApplicant.grades[competition.id] || ""} onChange={(event) => updateApplicant(activeApplicant.id, "grades", { ...activeApplicant.grades, [competition.id]: event.target.value })}><option value="">เลือกระดับชั้น</option>{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}</select></Field>
                </div> : null}
              </article>;
            })}{!competitions.length ? <div className="empty-inline"><Icon name="calendar" /><span>ขณะนี้ยังไม่มีรายการสอบรอบ HEAT ที่เปิดรับสมัคร</span></div> : null}</div>
            <div className="schedule-note"><Icon name="calendar" size={16} /><div><strong>กำหนดการรอบสอบ</strong><span>ปิดรับสมัคร {formatThaiDate(examCatalog.find((exam) => exam.year === activeExamYear && getExamRoundType(exam) === "HEAT")?.closeDate)} · วันสอบ {formatThaiDate(examCatalog.find((exam) => exam.year === activeExamYear && getExamRoundType(exam) === "HEAT")?.examDate)}</span><small>{examScheduleSummary}</small></div></div>
          </section>

          <section className="form-zone" aria-labelledby={`school-zone-papers-${activeApplicant.id}`}>
            <div className="form-progress"><span className="form-progress-number">04</span><div><strong id={`school-zone-papers-${activeApplicant.id}`}>Past Papers <span>/ ข้อสอบเก่า</span></strong><small>เลือกรายการให้ผู้เข้าสอบคนนี้</small></div><span className="paper-total-chip">รวม {totalLabel(activeTotals.papersTotal)}</span></div>
            <div className="past-paper-grid">{pastPaperGroups.map((group) => <fieldset className="past-paper-group" key={group.id}><legend>{group.title}</legend><div>{group.items.map((paper) => <label className="past-paper-option" key={paper.id}><input type="checkbox" checked={activeApplicant.pastPaperIds.includes(paper.id)} onChange={() => togglePastPaper(paper.id)} /><span className="past-paper-copy"><strong>{paper.title}</strong><small>{paper.detail}</small></span><b>฿{paper.price}</b></label>)}</div></fieldset>)}</div>
            <div className="past-paper-info"><strong>ข้อมูลข้อสอบเก่า</strong><p><b>HKISO / HKICO:</b> English Version · <b>Big Bay Bei:</b> English + Thai Version พร้อม VDO ภาษาไทย</p><p>เจ้าหน้าที่ส่งข้อมูลเข้าใช้งานทางอีเมลภายใน 3–5 วันหลังสมัคร กรุณาตรวจ Junk / Spam Mail</p></div>
          </section>

          <section className="form-zone form-zone-payment" id="school-payment-zone" aria-labelledby="school-zone-payment">
            <div className="form-progress"><span className="form-progress-number">05</span><div><strong id="school-zone-payment">Payment and Confirmation <span>/ ชำระเงินและยืนยัน</span></strong><small>ชำระรวม 1 บิลสำหรับผู้เข้าสอบ {batch.applicants.length} คน</small></div></div>
            <div className="payment-total-grid"><div><span>ข้อสอบเก่า</span><small>Past Papers Total · รวมทุกคน</small><strong>{totalLabel(batchTotals.papersTotal)}</strong></div><div><span>ค่าสมัครสอบ</span><small>Competition Registration Fee · รวมทุกคน</small><strong>{totalLabel(batchTotals.registrationFee)}</strong></div><div className="payment-total-grand"><span>ยอดที่ต้องชำระ</span><small>Total Payment · รวมทุกคน</small><strong>{totalLabel(batchTotals.totalPayment)}</strong></div></div>
            <div className="school-payment-breakdown"><div className="school-breakdown-heading"><strong>สรุปยอดแยกตามผู้เข้าสอบ</strong><small>รายการนี้รวมชำระด้วยบิลและสลิปเดียว</small></div>{batch.applicants.map((applicant, index) => {
              const totals = totalsFor(applicant);
              const applicantName = `${applicant.firstName} ${applicant.lastName}`.trim() || `ผู้เข้าสอบคนที่ ${index + 1}`;
              return <div className="school-breakdown-row" key={applicant.id}><div><strong>{String(index + 1).padStart(2, "0")} · {applicantName}</strong><small>{totals.selectedCompetitions.length} รายการสอบ · ข้อสอบเก่า {totalLabel(totals.papersTotal)}</small></div><b>{totalLabel(totals.totalPayment)}</b></div>;
            })}</div>
            <PaymentAccountCards accounts={formPaymentAccounts} />
            <div className="refund-warning"><Icon name="info" /><div><strong>REGISTRATION FEES: NON-REFUNDABLE</strong><span>ค่าธรรมเนียมการสมัครขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนชำระเงิน</span></div></div>
            <label className={`file-drop file-drop-inline school-batch-slip registration-slip${batch.paymentSlipFile?.dataUrl ? " slip-file-ready" : ""}`}><input type="file" accept="image/jpeg,image/png,application/pdf,.pdf" aria-label="แนบสลิปยอดรวมของชุดใบสมัคร" onChange={async (event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              input.value = "";
              if (!file) return;
              const fileType = getSlipMimeType(file);
              if (!fileType) {
                setBatch((current) => ({ ...current, paymentSlipFileName: "", paymentSlipFile: null, paymentSlipError: "รองรับ JPG, PNG หรือ PDF เท่านั้น" }));
                return;
              }
              if (file.size > 10 * 1024 * 1024) {
                setBatch((current) => ({ ...current, paymentSlipFileName: "", paymentSlipFile: null, paymentSlipError: "ไฟล์มีขนาดเกิน 10 MB" }));
                return;
              }
              setBatch((current) => ({ ...current, paymentSlipFileName: "กำลังอ่านไฟล์สลิป…", paymentSlipFile: null, paymentSlipError: "" }));
              try {
                const paymentSlipFile = { name: file.name, type: fileType, dataUrl: await readFileAsDataUrl(file) };
                setBatch((current) => ({ ...current, paymentSlipFileName: file.name, paymentSlipFile, paymentSlipError: "" }));
                setFormError("");
              } catch (error) {
                setBatch((current) => ({ ...current, paymentSlipFileName: "", paymentSlipFile: null, paymentSlipError: error.message || "อ่านไฟล์สลิปไม่สำเร็จ" }));
              }
            }} /><span className="file-drop-icon"><Icon name={batch.paymentSlipFile?.dataUrl ? "check" : "upload"} /></span><span className="file-drop-copy" aria-live="polite"><strong>{batch.paymentSlipFile?.dataUrl ? "แนบสลิปแล้ว" : batch.paymentSlipFileName || "แนบสลิปยอดชำระรวม 1 ไฟล์"}</strong>{batch.paymentSlipFile?.dataUrl ? <small className="slip-file-name" title={batch.paymentSlipFileName}>{batch.paymentSlipFileName} · พร้อมส่งพร้อมใบสมัคร</small> : null}<small>ยอด {totalLabel(batchTotals.totalPayment)} · JPG, PNG หรือ PDF · ไม่เกิน 10 MB{batch.paymentSlipError ? ` · ${batch.paymentSlipError}` : ""}</small></span><span className="file-select-label">{batch.paymentSlipFile?.dataUrl ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}</span></label>
            <label className="confirm-check"><input type="checkbox" checked={batch.confirmDetails} onChange={(event) => { setBatch((current) => ({ ...current, confirmDetails: event.target.checked })); setFormError(""); setErrorSection(""); }} /><span>ข้าพเจ้าตรวจสอบข้อมูลผู้สมัครทุกคน ยอดชำระรวม และสลิปเรียบร้อยแล้ว <b>*</b></span></label>
            <label className="confirm-check confirm-check-optional"><input type="checkbox" checked={batch.marketingConsent} onChange={(event) => setBatch((current) => ({ ...current, marketingConsent: event.target.checked }))} /><span>ข้าพเจ้ายินยอมให้ OCEC Thailand เผยแพร่ชื่อผู้สมัคร ผลการแข่งขัน และรางวัล ผ่านช่องทางประชาสัมพันธ์อย่างเป็นทางการ</span></label>
            {formError && errorSection === "payment" ? <p className="inline-error school-form-error" role="alert"><Icon name="info" size={16} />{formError}</p> : null}
            <div className="form-footer form-footer-submit"><span><Icon name="lock" size={14} />แยกใบสมัครรายคน · รวมชำระหนึ่งบิล</span><Button type="submit" icon={isSubmitting ? undefined : "arrow"} disabled={isSubmitting}>{isSubmitting ? "กำลังส่ง..." : `ส่งใบสมัคร ${batch.applicants.length} คน`}</Button></div>
          </section>
        </form>
        <aside className="surface side-note form-side-note school-batch-summary">
          <span className="side-note-icon"><Icon name="users" /></span><h3>สรุปชุดใบสมัคร</h3>
          <div className="live-total"><span>ผู้เข้าสอบ</span><strong>{batch.applicants.length} คน</strong>{batch.applicants.map((applicant, index) => {
            const name = `${applicant.firstName} ${applicant.lastName}`.trim();
            const totals = totalsFor(applicant);
            return <small key={applicant.id}>{index + 1}. {name || "ยังไม่ระบุชื่อ"} · {totals.selectedCompetitions.length} รายการ</small>;
          })}</div>
          <div className="live-total live-total-highlight"><span>ยอดชำระรวม</span><strong>{totalLabel(batchTotals.totalPayment)}</strong><small>ค่าสอบ {totalLabel(batchTotals.registrationFee)} + ข้อสอบเก่า {totalLabel(batchTotals.papersTotal)}</small></div>
          <div className="side-deadline"><Icon name="calendar" /><span><small>วันสอบ</small><strong>{selectedExamDateText(examCatalog, kind === "Final" ? "FINAL" : "HEAT", examYear, [...new Set(batch.applicants.flatMap((applicant) => applicant.competitionIds || []))])}</strong></span></div>
          <p className="side-note-small">ใบสมัครแยกตามผู้เข้าสอบ แต่ใช้ยอดชำระรวมและแนบสลิปเพียงไฟล์เดียวต่อชุด</p>
        </aside>
      </div>
    </div>
  );
}

function AdminHomePage({ applications, examCatalog, resultWorkflows, navigate, resultPublished }) {
  const pendingPaymentsFor = (item) => (item.paymentRecords || []).filter((payment) => payment.status === "pending");
  const pendingApps = applications.filter((item) => item.status === "pending" || pendingPaymentsFor(item).length);
  const confirmedApps = applications.filter((item) => item.status === "confirmed");
  const heatApps = applications.filter((item) => item.kind === "Heat");
  const finalApps = applications.filter((item) => item.kind === "Final");
  const issueApps = applications.filter((item) => item.slipIssue);
  const resultIssueCount = Object.values(resultWorkflows || {}).reduce((count, workflow) => count + ((workflow.rows || []).filter((row) => row.matchStatus !== "matched").length || Number(workflow.hasConflict && !workflow.conflictResolved)), 0);
  const finalIdsWaiting = finalApps.filter((item) => !item.finalId).length;
  const openRounds = examCatalog.filter((item) => item.isOpen);
  const paperlessCount = applications.filter((item) => (item.competitions || []).some((competition) => getApplicationCompetitionFormat(item, competition) === "Online")).length;
  const competitionCounts = applications.reduce((counts, item) => {
    (item.competitions || []).forEach((competition) => { counts[competition.short || competition.name] = (counts[competition.short || competition.name] || 0) + 1; });
    return counts;
  }, {});
  const tasks = [
    { id: "admin-review", icon: "file", tone: "amber", title: "คิวตรวจสลิป", detail: `${pendingApps.length} ใบสมัคร · เปิดคิวเพื่อตรวจและยืนยัน`, count: pendingApps.length },
    { id: "admin-results", icon: "info", tone: "violet", title: "รายการผลสอบที่ต้องตรวจ", detail: resultIssueCount ? `${resultIssueCount} รายการจากฉบับร่าง · กดเพื่อตรวจสอบก่อนประกาศ` : "ยังไม่มีรายการจากผลสอบที่ต้องตรวจ", count: resultIssueCount },
    { id: "admin-results", icon: "award", tone: "violet", title: resultPublished ? "ดูผลสอบที่ประกาศแล้ว" : "เตรียมผลสอบ", detail: resultPublished ? "ประกาศแล้ว · ข้อมูลผลสอบล็อก" : "เลือกรายการและรอบ นำเข้าฉบับร่างเพื่อตรวจสอบ", count: resultPublished ? 0 : 1 },
    { id: "admin-final-ids", icon: "users", tone: "blue", title: "นำเข้าเลขประจำตัว Final", detail: `${finalIdsWaiting} รายการยังไม่มีเลข`, count: finalIdsWaiting },
    { id: "admin-sheets", icon: "sync", tone: "blue", title: "คิวอีเมลและ Google Sheets", detail: "ตรวจสถานะงานจริงและเริ่มงานที่ล้มเหลวใหม่", count: "↗" },
  ];
  const byYear = Object.values(examCatalog.reduce((groups, item) => {
    groups[item.year] ||= { year: item.year, total: 0, open: 0 };
    groups[item.year].total += 1;
    groups[item.year].open += item.isOpen ? 1 : 0;
    return groups;
  }, {}));
  const totalDue = pendingApps.reduce((sum, item) => {
    const payments = pendingPaymentsFor(item);
    return sum + (payments.length
      ? payments.reduce((paymentSum, payment) => paymentSum + Number(payment.expectedAmount || 0), 0)
      : Number(item.totalPayment || 0));
  }, 0);
  const pendingStatusCount = applications.filter((item) => item.status === "pending").length;
  const otherStatusCount = Math.max(0, applications.length - confirmedApps.length - pendingStatusCount);
  const confirmedPercent = applications.length ? Math.round(confirmedApps.length / applications.length * 100) : 0;
  const confirmedSlice = applications.length ? confirmedApps.length / applications.length * 100 : 0;
  const pendingSlice = applications.length ? pendingStatusCount / applications.length * 100 : 0;
  const competitionLeaders = Object.entries(competitionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const largestCompetition = competitionLeaders[0]?.[1] || 1;
  const openAdminPage = (event, target) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(target);
  };

  return (
    <div className="page-stack admin-home-page">
      <div className="admin-home-intro">
        <PageHeading eyebrow={BACKEND_ENABLED ? "OCEC WORKSPACE · ข้อมูลจริง" : "OCEC WORKSPACE · โหมดตัวอย่าง"} title="ภาพรวมแอดมิน" description="ติดตามใบสมัคร คิวตรวจ และความพร้อมของรอบสอบในที่เดียว" action={<Button icon="calendar" onClick={() => navigate("admin-round")}>จัดการรายการสอบ</Button>} />
        <nav className="admin-home-nav" aria-label="ทางลัดหน้าแอดมิน">
          <a href={routeUrlFor("admin-home")} className="active" aria-current="page">ภาพรวม</a>
          <a href={routeUrlFor("admin-review")} onClick={(event) => openAdminPage(event, "admin-review")}>ตรวจใบสมัคร</a>
          <a href={routeUrlFor("admin-round")} onClick={(event) => openAdminPage(event, "admin-round")}>รอบสอบ</a>
          <a href={routeUrlFor("admin-results")} onClick={(event) => openAdminPage(event, "admin-results")}>ผลสอบ</a>
          <a href={routeUrlFor("admin-sheets")} onClick={(event) => openAdminPage(event, "admin-sheets")}>คิวระบบ</a>
        </nav>
      </div>
      <section className="admin-home-hero" aria-labelledby="admin-home-hero-title">
        <div className="admin-hero-main">
          <span className="admin-hero-kicker"><Icon name="sparkle" size={15} /> ภาพรวมการรับสมัคร</span>
          <h2 id="admin-home-hero-title">ทุกงานสำคัญ<br />อยู่ในมุมมองเดียว</h2>
          <p>เริ่มจากคิวที่ต้องดำเนินการ แล้วติดตามความคืบหน้าของใบสมัครและรอบสอบ</p>
          <button type="button" className="admin-hero-action" onClick={() => navigate("admin-review")}>เปิดคิวตรวจใบสมัคร <Icon name="arrow" size={15} /></button>
        </div>
        <div className="admin-hero-progress">
          <span>ใบสมัครที่ยืนยันแล้ว</span>
          <strong>{confirmedPercent}<small>%</small></strong>
          <div className="admin-hero-track" role="progressbar" aria-label="สัดส่วนใบสมัครที่ยืนยันแล้ว" aria-valuenow={confirmedPercent} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${confirmedPercent}%` }} /></div>
          <small>{confirmedApps.length.toLocaleString("th-TH")} จาก {applications.length.toLocaleString("th-TH")} ใบสมัคร</small>
        </div>
      </section>
      <div className="admin-stat-grid">
        <div className="admin-stat-card"><span className="admin-stat-icon stat-blue"><Icon name="file" /></span><div><span>ใบสมัครทั้งหมด</span><strong>{applications.length}</strong><small>Heat {heatApps.length} · Final {finalApps.length}</small></div><span className="stat-ok"><Icon name="users" size={13} />{applications.filter((item) => item.source === "school").length} ผ่านโรงเรียน</span></div>
        <div className="admin-stat-card"><span className="admin-stat-icon stat-amber"><Icon name="clock" /></span><div><span>รอตรวจสลิป</span><strong>{pendingApps.length}</strong><small>ยอดรอตรวจ ฿{totalDue.toLocaleString()}</small></div><button className="stat-link" onClick={() => navigate("admin-review")}>เปิดคิว <Icon name="arrow" size={14} /></button></div>
        <div className="admin-stat-card"><span className="admin-stat-icon stat-green"><Icon name="check" /></span><div><span>ยืนยันใบสมัครแล้ว</span><strong>{confirmedApps.length}</strong><small>พร้อมส่งข้อมูลเข้าชีต</small></div><span className="stat-ok"><Icon name="check" size={13} />{applications.length ? Math.round(confirmedApps.length / applications.length * 100) : 0}%</span></div>
        <div className="admin-stat-card"><span className="admin-stat-icon stat-violet"><Icon name="calendar" /></span><div><span>รอบที่เปิดรับ</span><strong>{openRounds.length}</strong><small>จากทั้งหมด {examCatalog.length} รายการ</small></div><button className="stat-link" onClick={() => navigate("admin-round")}>จัดการ <Icon name="arrow" size={14} /></button></div>
      </div>
      <div className="admin-insight-grid">
        <section className="surface admin-insight-card" aria-labelledby="admin-status-title">
          <div className="section-heading"><div><p className="eyebrow">APPLICATION ANALYTICS</p><h2 id="admin-status-title">สถานะใบสมัคร</h2></div><span className="admin-insight-total">ทั้งหมด {applications.length.toLocaleString("th-TH")}</span></div>
          <div className="admin-status-body">
            <div className="admin-status-chart" role="img" aria-label={`ยืนยันแล้ว ${confirmedApps.length} รอตรวจ ${pendingStatusCount} สถานะอื่น ${otherStatusCount}`} style={{ background: applications.length ? `conic-gradient(#fb693b 0 ${confirmedSlice}%, #202027 ${confirmedSlice}% ${confirmedSlice + pendingSlice}%, #e9e8eb ${confirmedSlice + pendingSlice}% 100%)` : "#e9e8eb" }}><div><strong>{applications.length.toLocaleString("th-TH")}</strong><span>ใบสมัคร</span></div></div>
            <div className="admin-status-legend"><div><i className="status-confirmed-dot" /><span>ยืนยันแล้ว</span><strong>{confirmedApps.length.toLocaleString("th-TH")}</strong></div><div><i className="status-pending-dot" /><span>รอตรวจ</span><strong>{pendingStatusCount.toLocaleString("th-TH")}</strong></div><div><i className="status-other-dot" /><span>สถานะอื่น</span><strong>{otherStatusCount.toLocaleString("th-TH")}</strong></div></div>
          </div>
        </section>
        <section className="surface admin-insight-card" aria-labelledby="admin-competition-title">
          <div className="section-heading"><div><p className="eyebrow">TOP COMPETITIONS</p><h2 id="admin-competition-title">รายการสอบที่เลือกมากที่สุด</h2></div><Icon name="grid" size={18} /></div>
          {competitionLeaders.length ? <div className="admin-competition-bars">{competitionLeaders.map(([name, count]) => <div className="admin-competition-bar" key={name}><div><span title={name}>{name}</span><strong>{count.toLocaleString("th-TH")}</strong></div><div className="admin-bar-track"><span style={{ width: `${count / largestCompetition * 100}%` }} /></div></div>)}</div> : <p className="admin-insight-empty">ยังไม่มีข้อมูลรายการสอบ</p>}
        </section>
      </div>
      <div className="admin-home-grid">
        <section className="surface admin-queue-card">
          <div className="section-heading"><div><p className="eyebrow">คิวงาน</p><h2>รายการที่ต้องดำเนินการ</h2></div><Button variant="text" icon="arrow" onClick={() => navigate("admin-review")}>เปิดคิวตรวจ</Button></div>
          {tasks.length ? <div className="admin-task-list">{tasks.map((task) => (
            <button key={task.title} onClick={() => navigate(task.id, task.targetId)}><span className={`task-icon task-${task.tone}`}><Icon name={task.icon} /></span><span><strong>{task.title}</strong><small>{task.detail}</small></span><span className="task-count">{String(task.count).padStart(2, "0")}</span></button>
          ))}</div> : <div className="admin-clear-state"><span><Icon name="check" /></span><div><strong>ไม่มีงานค้าง</strong><small>คิวตรวจสอบและงานหลังสอบเรียบร้อยแล้ว</small></div></div>}
        </section>
        <section className="surface round-status-card">
          <div className="section-heading"><div><p className="eyebrow">รายการสอบ</p><h2>สถานะรับสมัคร</h2></div><span className={openRounds.length ? "schedule-open" : "closed-badge"}>{openRounds.length ? `เปิด ${openRounds.length} รายการ` : "ปิดรับสมัคร"}</span></div>
          <div className="admin-round-summary-list">{byYear.map((group) => <div className="admin-round-summary" key={group.year}><div><strong>รายการสอบปี {group.year}</strong><small>{group.open} รอบเปิดรับ · รวม {group.total} การ์ด</small></div><span>{group.open ? <i className="online-dot" /> : <i className="offline-dot" />}{group.open ? "เปิด" : "รอเปิด"}</span></div>)}</div>
          <div className="round-status-rows"><div><span><Icon name="users" />ใบสมัครออนไลน์</span><strong>{paperlessCount} รายการ</strong></div><div><span><Icon name="grid" />ผลสอบ Heat</span><strong>{resultPublished ? "ประกาศแล้ว" : "รอเตรียมฉบับร่าง"}</strong></div><div><span><Icon name="building" />ศูนย์สอบ</span><strong>{examCatalog.some((item) => item.isOpen) ? "ล็อกตามรอบที่เปิด" : "แก้ไขได้"}</strong></div></div>
          <Button variant="outline" className="button-full" onClick={() => navigate("admin-round")}>ตั้งค่ารอบสอบและศูนย์</Button>
        </section>
      </div>
      <section className="surface admin-exception-queue"><div className="section-heading"><div><p className="eyebrow">ต้องติดตามเป็นพิเศษ</p><h2>คิวปัญหาใบสมัคร</h2></div><span className="conflict-count">{issueApps.length} รายการ</span></div>{issueApps.length ? <div className="admin-exception-list">{issueApps.map((item) => <button type="button" className="admin-exception-row" key={item.id} onClick={() => navigate("admin-review", item.id)}><span className="task-icon task-amber"><Icon name="file" /></span><span><strong>{item.candidate}</strong><small>{item.exam} · {item.school}</small><em>{item.slipIssue}</em></span><span>เปิดใบสมัคร <Icon name="arrow" size={14} /></span></button>)}</div> : <div className="admin-clear-state"><span><Icon name="check" /></span><div><strong>ไม่มีใบสมัครที่มีปัญหา</strong><small>ความผิดปกติของชื่อโรงเรียนในไฟล์ผลสอบจะแสดงในหน้านำเข้าผลสอบ</small></div></div>}</section>
      <section className="surface sync-banner"><span className="sync-banner-icon"><Icon name="sync" /></span><div><strong>คิวงานระบบ</strong><p>ดูผลการส่งอีเมลและการซิงก์ Google Sheets จากข้อมูลจริงในหน้าสถานะ</p></div><Button variant="text" onClick={() => navigate("admin-sheets")}>ดูสถานะ</Button></section>
    </div>
  );
}

function AdminMockPapersPage({ applications, notify }) {
  const [tab, setTab] = useState("mock");
  const [search, setSearch] = useState("");
  const [examFilter, setExamFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [paperFilter, setPaperFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mockBusy, setMockBusy] = useState(false);
  const [mockMessage, setMockMessage] = useState("");
  const [mockSheetUrl, setMockSheetUrl] = useState("");
  useEffect(() => { setMockMessage(""); setMockSheetUrl(""); }, [examFilter, yearFilter, gradeFilter, startDate, endDate]);
  const fmtMoney = (value) => `฿${Number(value || 0).toLocaleString()}`;
  const submissionDay = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const part = (name) => parts.find((item) => item.type === name)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const examOptions = [...new Set(tab === "mock" ? applications.flatMap((item) => (item.competitions || []).map((competition) => competition.short || competition.name)) : applications.map((item) => item.exam))].filter(Boolean).sort();
  const years = [...new Set(applications.map((item) => item.year).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const grades = [...new Set(applications.filter((item) => yearFilter === "all" || item.year === yearFilter).flatMap((item) => (item.competitions || []).filter((competition) => examFilter === "all" || (competition.short || competition.name) === examFilter).map((competition) => competition.grade)))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const paperNames = [...new Set(applications.flatMap((item) => (item.pastPapers || []).map((paper) => paper.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const applicantRows = applications.filter((item) => item.status === "confirmed").flatMap((application) => (application.competitions || []).map((competition) => ({ application, competition }))).filter(({ application, competition }) => {
    const query = search.trim().toLowerCase();
    const day = submissionDay(application.submitted);
    return (!query || [application.candidate, application.school, competition.short, competition.name, competition.grade].filter(Boolean).some((value) => value.toLowerCase().includes(query)))
      && (examFilter === "all" || (competition.short || competition.name) === examFilter)
      && (yearFilter === "all" || application.year === yearFilter)
      && (gradeFilter === "all" || competition.grade === gradeFilter)
      && (!startDate || day >= startDate)
      && (!endDate || day <= endDate);
  });
  const paperRows = applications.flatMap((application) => (application.pastPapers || []).map((paper) => ({ application, paper, quantity: 1 }))).filter(({ application, paper }) => {
    const query = search.trim().toLowerCase();
    return (!query || [application.candidate, application.school, application.exam, paper.name].filter(Boolean).some((value) => value.toLowerCase().includes(query)))
      && (examFilter === "all" || application.exam === examFilter)
      && (yearFilter === "all" || application.year === yearFilter)
      && (paperFilter === "all" || paper.name === paperFilter);
  });
  const totalPaperSets = paperRows.reduce((sum, row) => sum + row.quantity, 0);
  const breakdown = tab === "mock"
    ? Object.entries(applicantRows.reduce((counts, { competition }) => { const name = competition.short || competition.name; counts[name] = (counts[name] || 0) + 1; return counts; }, {}))
    : Object.entries(paperRows.reduce((counts, row) => { counts[row.paper.name] = (counts[row.paper.name] || 0) + row.quantity; return counts; }, {}));
  const paperGroupsByExamYear = Object.values(paperRows.reduce((groups, row) => {
    const key = `${row.application.exam}|${row.application.year}`;
    groups[key] ||= { exam: row.application.exam, year: row.application.year, sets: 0, total: 0 };
    groups[key].sets += row.quantity;
    groups[key].total += Number(row.paper.fee || 0);
    return groups;
  }, {}));
  const filterReset = () => { setSearch(""); setExamFilter("all"); setYearFilter("all"); setGradeFilter("all"); setPaperFilter("all"); setStartDate(""); setEndDate(""); setMockMessage(""); setMockSheetUrl(""); };
  const mockFiltersReady = examFilter !== "all" && yearFilter !== "all" && gradeFilter !== "all" && startDate && endDate && startDate <= endDate;
  async function addToMockSheet() {
    if (!mockFiltersReady) { setMockMessage("เลือกรายการสอบ ปี ระดับชั้น และช่วงวันที่ให้ครบก่อนเพิ่มเข้าชีต"); return; }
    setMockBusy(true); setMockMessage(""); setMockSheetUrl("");
    try {
      const response = await fetch("/api/admin/mock-sheets/add", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ year: yearFilter, competition: examFilter, grade: gradeFilter, startDate, endDate }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "เพิ่มรายชื่อเข้า Google Sheet ไม่สำเร็จ");
      setMockMessage(result.selected ? `เพิ่มใหม่ ${result.inserted} รายการ · อัปเดต ${result.updated} รายการในแท็บ ${result.tab}` : "ไม่พบใบสมัครที่อนุมัติแล้วตามตัวกรองนี้");
      setMockSheetUrl(result.spreadsheetUrl || "");
    } catch (error) { setMockMessage(error.message || "เพิ่มรายชื่อเข้า Google Sheet ไม่สำเร็จ"); }
    finally { setMockBusy(false); }
  }
  async function exportReport() {
    if (!BACKEND_ENABLED) {
      notify("เปิด VITE_BACKEND_ENABLED และเชื่อมฐานข้อมูลก่อนส่งออกรายงานจริง");
      return;
    }
    const rows = [["APPLICATION ID", "CANDIDATE NAME", "EMAIL", "SCHOOL", "COMPETITION", "PAST PAPER", "DETAIL", "QUANTITY", "UNIT PRICE (THB)", "ACADEMIC YEAR"], ...paperRows.map(({ application, paper, quantity }) => [application.id, application.candidate, application.contactEmail, application.school, application.exam, paper.name, paper.detail || "", quantity, Number(paper.fee || 0), application.year])];
    const yearPart = yearFilter === "all" ? "all-years" : yearFilter;
    const fileName = `ocec-past-papers-${yearPart}.xlsx`;
    try {
      await downloadWorkbook([{ name: "Past Papers", rows }], fileName);
      notify(`สร้างไฟล์ ${rows.length - 1} รายการแล้ว`);
    } catch (error) {
      notify(error.message || "ส่งออกรายงานไม่สำเร็จ");
    }
  }

  return (
    <div className="page-stack admin-mock-page">
      <PageHeading eyebrow={BACKEND_ENABLED ? "รายงานจากฐานข้อมูล" : "รายงานใบสมัคร"} title="รายชื่อ Mock และข้อสอบเก่า" description="เลือกชุดใบสมัครที่อนุมัติแล้วเพื่อเพิ่มลง Google Sheet สำหรับส่ง Mock หรือส่งออกรายการข้อสอบเก่า" action={tab === "mock" ? <Button icon="sync" disabled={!BACKEND_ENABLED || !mockFiltersReady || mockBusy || !applicantRows.length} onClick={addToMockSheet}>{mockBusy ? "กำลังเพิ่ม…" : "เพิ่มเข้า Google Sheet"}</Button> : <Button icon="download" disabled={!BACKEND_ENABLED || !paperRows.length} onClick={exportReport}>ส่งออก Excel</Button>} />
      <div className="admin-mock-stat-grid">
        <article className="admin-mock-stat"><span className="admin-mock-stat-icon mock-icon-violet"><Icon name="users" /></span><div><small>ผู้สมัครทั้งหมด</small><strong>{applications.length}</strong><span>รวม Heat และ Final</span></div></article>
        <article className="admin-mock-stat"><span className="admin-mock-stat-icon mock-icon-pink"><Icon name="building" /></span><div><small>สมัครผ่านโรงเรียน</small><strong>{applications.filter((item) => item.source === "school").length}</strong><span>ใบสมัครรายบุคคล</span></div></article>
        <article className="admin-mock-stat"><span className="admin-mock-stat-icon mock-icon-gold"><Icon name="book" /></span><div><small>ชุดข้อสอบเก่าที่เลือก</small><strong>{applications.reduce((sum, item) => sum + (item.pastPapers || []).length, 0)}</strong><span>นับเป็น 1 ชุดต่อรายการที่เลือก</span></div></article>
      </div>
      <section className="surface admin-mock-workspace">
        <div className="admin-mock-tabs" role="tablist" aria-label="ประเภทข้อมูล">
          <button type="button" role="tab" aria-selected={tab === "mock"} className={tab === "mock" ? "admin-mock-tab active" : "admin-mock-tab"} onClick={() => { setTab("mock"); filterReset(); }}><Icon name="users" size={17} />รายชื่อส่ง Mock <span>{applications.filter((item) => item.status === "confirmed").reduce((sum, item) => sum + (item.competitions || []).length, 0)}</span></button>
          <button type="button" role="tab" aria-selected={tab === "papers"} className={tab === "papers" ? "admin-mock-tab active" : "admin-mock-tab"} onClick={() => { setTab("papers"); filterReset(); }}><Icon name="book" size={17} />รายการซื้อข้อสอบเก่า <span>{applications.reduce((sum, item) => sum + (item.pastPapers || []).length, 0)}</span></button>
        </div>
        <div className="admin-mock-toolbar"><div><p className="eyebrow">{tab === "mock" ? "รายชื่อผู้สมัคร" : "รายการจัดส่งข้อสอบเก่า"}</p><h2>{tab === "mock" ? `พบ ${applicantRows.length} รายการสอบ` : `พบ ${totalPaperSets} ชุด`}</h2><small>{tab === "mock" ? "หนึ่งแถวต่อรายการสอบ · นับวันที่ส่งใบสมัครตามเวลาไทย · เพิ่มเข้าชีตเมื่อกดปุ่มเท่านั้น · สถานะเลือกใน Google Sheet" : "แต่ละแถวคือข้อสอบเก่าหนึ่งชุดที่ผู้สมัครเลือกไว้"}</small></div>{tab === "papers" ? <label className="admin-mock-search"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ โรงเรียน หรือข้อสอบเก่า" /></label> : null}</div>
        <div className="admin-mock-filters">
          <label><span>รายการสอบ</span><select value={examFilter} onChange={(event) => { setExamFilter(event.target.value); setGradeFilter("all"); }}><option value="all">ทุกรายการสอบ</option>{examOptions.map((exam) => <option key={exam}>{exam}</option>)}</select></label>
          <label><span>ปีการศึกษา</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">ทุกปี</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
          {tab === "mock" ? <label><span>ระดับชั้น</span><select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option value="all">ทุกระดับชั้น</option>{grades.map((grade) => <option key={grade}>{grade}</option>)}</select></label> : <label><span>ชื่อข้อสอบเก่า</span><select value={paperFilter} onChange={(event) => setPaperFilter(event.target.value)}><option value="all">ทุกรายการ</option>{paperNames.map((paper) => <option key={paper}>{paper}</option>)}</select></label>}
          {tab === "mock" ? <><label><span>วันที่เริ่มต้น</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>วันที่สิ้นสุด</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label></> : null}
          <button type="button" className="admin-mock-reset" onClick={filterReset}>ล้างตัวกรอง</button>
        </div>
        {tab === "mock" && mockMessage ? <div className="admin-mock-sheet-result" role="status"><span>{mockMessage}</span>{mockSheetUrl ? <a href={mockSheetUrl} target="_blank" rel="noreferrer">เปิด Google Sheet</a> : null}</div> : null}
        {breakdown.length ? <div className="admin-mock-breakdown"><span>{tab === "mock" ? "จำนวนผู้สมัครตามรายการสอบ" : "จำนวนชุดตามชื่อข้อสอบ"}</span><div>{breakdown.map(([name, count]) => <span className="admin-mock-breakdown-chip" key={name}><strong>{count}</strong>{name}</span>)}</div></div> : null}
        {tab === "papers" ? <div className="admin-mock-breakdown admin-mock-exam-year-breakdown"><span>สรุปข้อสอบเก่าตามรายการสอบและปี</span><div>{paperGroupsByExamYear.length ? paperGroupsByExamYear.map((group) => <span className="admin-mock-breakdown-chip" key={`${group.exam}-${group.year}`}><strong>{group.sets} ชุด</strong>{group.exam} · {group.year} · ฿{group.total.toLocaleString()}</span>) : <small>ไม่มีรายการซื้อข้อสอบเก่าตามตัวกรอง</small>}</div></div> : null}
        {tab === "mock" ? (
          <div className="admin-mock-table-wrap"><table className="admin-mock-table"><thead><tr><th>วันที่ส่งใบสมัคร</th><th>ชื่อ</th><th>อีเมล</th><th>เบอร์โทร</th><th>รายการสอบ</th><th>ระดับชั้น</th></tr></thead><tbody>{applicantRows.map(({ application, competition }) => <tr key={competition.applicationItemId || `${application.id}-${competition.id}`}><td>{submissionDay(application.submitted) || "—"}</td><td><strong>{application.candidate}</strong></td><td>{application.contactEmail || "—"}</td><td>{application.studentInformation?.phone || "—"}</td><td>{competition.short || competition.name}{competition.roundType ? ` ${competition.roundType}` : ""}</td><td>{competition.grade || "—"}</td></tr>)}{applicantRows.length === 0 ? <tr><td colSpan="6"><div className="admin-mock-empty"><Icon name="search" /><strong>ไม่พบรายชื่อที่ตรงกับตัวกรอง</strong><span>ลองเปลี่ยนคำค้นหรือกดล้างตัวกรอง</span></div></td></tr> : null}</tbody></table></div>
        ) : (
          <div className="admin-mock-table-wrap"><table className="admin-mock-table"><thead><tr><th>ผู้สมัคร</th><th>โรงเรียน</th><th>รายการสอบ</th><th>ข้อสอบเก่าที่เลือก</th><th>จำนวน</th><th>ราคา</th><th>ปี</th></tr></thead><tbody>{paperRows.map(({ application, paper }, index) => <tr key={`${application.id}-${paper.id}-${index}`}><td><strong>{application.candidate}</strong><small>{application.contactEmail}</small></td><td>{application.school}</td><td>{application.exam}</td><td><strong>{paper.name}</strong><small>{paper.detail || "ข้อสอบเก่าสำหรับผู้สมัคร"}</small></td><td><span className="admin-mock-quantity">1 ชุด</span></td><td>{fmtMoney(paper.fee)}</td><td>{application.year}</td></tr>)}{paperRows.length === 0 ? <tr><td colSpan="7"><div className="admin-mock-empty"><Icon name="book" /><strong>ไม่มีรายการข้อสอบเก่าที่ตรงกับตัวกรอง</strong><span>ลองเปลี่ยนคำค้นหรือกดล้างตัวกรอง</span></div></td></tr> : null}</tbody></table></div>
        )}
        <div className="admin-mock-footer"><span><Icon name="info" size={15} />{tab === "mock" ? `${applicantRows.length} รายการสอบตามตัวกรอง · เฉพาะใบสมัครที่อนุมัติแล้ว` : `${totalPaperSets} ชุดข้อสอบเก่าตามตัวกรอง`}{BACKEND_ENABLED ? " · ข้อมูลปัจจุบันจากฐานข้อมูล" : " · เปิด backend ก่อนใช้งานจริง"}</span>{tab === "mock" ? <Button variant="outline" icon="sync" disabled={!BACKEND_ENABLED || !mockFiltersReady || mockBusy || !applicantRows.length} onClick={addToMockSheet}>{mockBusy ? "กำลังเพิ่ม…" : "เพิ่มเข้า Google Sheet"}</Button> : <Button variant="outline" icon="download" disabled={!BACKEND_ENABLED || !paperRows.length} onClick={exportReport}>ส่งออก Excel</Button>}</div>
      </section>
    </div>
  );
}

function getAdminReviewExamLabel(item) {
  const competitionNames = (item.competitions || []).map((competition) => competition.short || competition.name).filter(Boolean);
  const examName = competitionNames.join(" : ") || item.exam || "รายการสอบ";
  const kind = String(item.kind || "").trim().toUpperCase();
  const round = kind ? (kind.includes("ROUND") ? kind : `${kind} ROUND`) : "ไม่ระบุรอบ";
  const format = getApplicationFormatSummary(item);

  return `${examName} ${round} · ${format}`;
}

function getReviewCompetitionKey(competition) {
  return String(competition?.short || competition?.name || competition?.id || "").trim().toLocaleUpperCase("en");
}

function DemoTransferSlip({ application, amount }) {
  const displayAmount = Number(amount || 0).toLocaleString("th-TH");
  const recipient = application.paymentAccountType === "president" ? "บัญชีประธาน" : "บัญชีอื่น";
  return (
    <svg className="review-slip-demo-image" viewBox="0 0 440 640" role="img" aria-label={`ภาพสลิปตัวอย่าง ยอด ${displayAmount} บาท`} xmlns="http://www.w3.org/2000/svg">
      <rect width="440" height="640" rx="18" fill="#edf0f8" />
      <rect x="22" y="18" width="396" height="604" rx="18" fill="#fff" />
      <path d="M40 18h360a18 18 0 0 1 18 18v83H22V36a18 18 0 0 1 18-18Z" fill="#45499a" />
      <circle cx="68" cy="58" r="19" fill="#fff" fillOpacity=".16" />
      <path d="m59 58 6 6 12-14" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <text x="99" y="55" fill="#fff" fontFamily="Kanit, sans-serif" fontSize="16" fontWeight="700">โอนเงินสำเร็จ</text>
      <text x="99" y="78" fill="#e2e5ff" fontFamily="Kanit, sans-serif" fontSize="11">สลิปตัวอย่าง · ข้อมูลจำลอง</text>
      <text x="220" y="155" fill="#7a8799" textAnchor="middle" fontFamily="Kanit, sans-serif" fontSize="12">จำนวนเงินที่โอน</text>
      <text x="220" y="198" fill="#263554" textAnchor="middle" fontFamily="Kanit, sans-serif" fontSize="34" fontWeight="700">฿{displayAmount}</text>
      <line x1="52" y1="226" x2="388" y2="226" stroke="#e9ecf2" strokeDasharray="4 5" />
      <text x="54" y="263" fill="#8692a3" fontFamily="Kanit, sans-serif" fontSize="11">จาก</text>
      <text x="54" y="286" fill="#34465f" fontFamily="Kanit, sans-serif" fontSize="14" fontWeight="600">{application.candidate || "ผู้สมัคร"}</text>
      <text x="54" y="327" fill="#8692a3" fontFamily="Kanit, sans-serif" fontSize="11">ไปยัง</text>
      <text x="54" y="350" fill="#34465f" fontFamily="Kanit, sans-serif" fontSize="14" fontWeight="600">OCEC Thailand · {recipient}</text>
      <text x="54" y="391" fill="#8692a3" fontFamily="Kanit, sans-serif" fontSize="11">วันและเวลา</text>
      <text x="54" y="414" fill="#34465f" fontFamily="Kanit, sans-serif" fontSize="13" fontWeight="600">{application.transferDateTime || "ยังไม่มีข้อมูลเวลาโอน"}</text>
      <line x1="52" y1="448" x2="388" y2="448" stroke="#e9ecf2" />
      <text x="54" y="484" fill="#8692a3" fontFamily="Kanit, sans-serif" fontSize="11">เลขอ้างอิง</text>
      <text x="54" y="507" fill="#34465f" fontFamily="Kanit, sans-serif" fontSize="13">DEMO-{String(application.id || "SLIP").slice(-8).toUpperCase()}</text>
      <rect x="54" y="542" width="332" height="42" rx="9" fill="#fff6df" />
      <text x="220" y="568" fill="#8a641d" textAnchor="middle" fontFamily="Kanit, sans-serif" fontSize="11" fontWeight="600">ใช้แสดงตัวอย่างหน้าตรวจสอบเท่านั้น</text>
    </svg>
  );
}

function ReviewSlipDialog({ application, amount, fileName, dataUrl, fileType, onClose }) {
  const dialogRef = useRef(null);
  const title = `สลิปโอนเงินของ ${application.candidate}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function closeDialog() {
    if (dialogRef.current?.open) dialogRef.current.close();
  }

  return (
    <dialog ref={dialogRef} className="review-slip-dialog" aria-label={title} onClose={onClose} onClick={(event) => { if (event.target === dialogRef.current) closeDialog(); }}>
      <div className="review-slip-dialog-head">
        <div><strong>สลิปโอนเงิน</strong><small>{fileName}</small></div>
        <button type="button" className="review-slip-dialog-close" aria-label="ปิดภาพสลิป" onClick={closeDialog}><Icon name="close" size={17} /></button>
      </div>
      <div className="review-slip-dialog-content">
        {dataUrl && fileType.startsWith("image/") ? <img className="review-slip-dialog-image" src={dataUrl} alt={title} />
          : dataUrl && fileType === "application/pdf" ? <iframe className="review-slip-dialog-pdf" src={dataUrl} title={title} />
            : BACKEND_ENABLED ? <div className="review-slip-empty"><Icon name="info" /><strong>ไม่พบไฟล์สลิปใน Portal</strong><small>ตรวจสอบข้อมูลไฟล์บน Google Drive หรืออัปโหลดสลิปใหม่</small></div> : <DemoTransferSlip application={application} amount={amount} />}
      </div>
    </dialog>
  );
}

function ReviewRejectDialog({ application, onReject, onClose }) {
  const dialogRef = useRef(null);
  const reasonId = useId();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function closeDialog() {
    if (!busy && dialogRef.current?.open) dialogRef.current.close();
  }

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      if (await onReject(application.id, reason.trim())) dialogRef.current?.close();
    } finally { setBusy(false); }
  }

  return <dialog ref={dialogRef} className="review-reject-dialog" aria-labelledby="review-reject-title" onClose={onClose} onCancel={(event) => { if (busy) event.preventDefault(); }} onClick={(event) => { if (event.target === dialogRef.current) closeDialog(); }}>
    <form onSubmit={submit}>
      <div className="review-reject-dialog-heading"><span className="review-reject-dialog-icon"><Icon name="close" size={20} /></span><button type="button" className="review-slip-dialog-close" aria-label="ปิดหน้าต่าง" disabled={busy} onClick={closeDialog}><Icon name="close" size={17} /></button></div>
      <h2 id="review-reject-title">ไม่อนุมัติใบสมัคร?</h2>
      <p>ใบสมัครของ <strong>{application.candidate}</strong> จะเปลี่ยนเป็นสถานะไม่อนุมัติ และระบบจะส่งอีเมลแจ้งผล</p>
      <label htmlFor={reasonId}>เหตุผลที่ไม่อนุมัติ <span>(ไม่บังคับ)</span></label>
      <textarea id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={240} placeholder="ระบุเหตุผลเพิ่มเติม หากต้องการแจ้งผู้สมัคร" autoFocus />
      <small>{reason.length}/240 ตัวอักษร · เว้นว่างได้</small>
      <div className="review-reject-dialog-actions"><Button type="button" variant="outline" disabled={busy} onClick={closeDialog}>ยกเลิก</Button><Button type="submit" disabled={busy}>{busy ? "กำลังบันทึก…" : "ยืนยันไม่อนุมัติ"}</Button></div>
    </form>
  </dialog>;
}

function AdminReviewPage({ applications, schoolBatches = [], onApprove, onReject, onSlipIssue, notify, navigate, activeApplicationId }) {
  const hasUnreviewedPayment = (item) => (item.paymentRecords || []).some((payment) => payment.status === "pending");
  const pendingApps = applications.filter((item) => item.status === "pending" || hasUnreviewedPayment(item));
  const [selectedId, setSelectedId] = useState(activeApplicationId || pendingApps[0]?.id || applications[0]?.id || "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(activeApplicationId ? "all" : "pending");
  const [kindFilter, setKindFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [competitionFilters, setCompetitionFilters] = useState([]);
  const [reviewView, setReviewView] = useState("all");
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [slipPreviewOpen, setSlipPreviewOpen] = useState(false);
  const [loadedSlip, setLoadedSlip] = useState(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [rejectApplicationId, setRejectApplicationId] = useState("");
  const schoolApplications = applications.filter((item) => item.source === "school");
  const schoolGroups = Object.values(schoolApplications.reduce((groups, item) => {
    const key = `${item.year}|${item.exam}`;
    groups[key] ||= { key, year: item.year, exam: item.exam, applications: [] };
    groups[key].applications.push(item);
    return groups;
  }, {})).map((group) => ({ ...group, pending: group.applications.filter((item) => item.status === "pending" || hasUnreviewedPayment(item)).length }));
  const selectedGroup = schoolGroups.find((group) => group.key === selectedGroupKey);
  const competitionOptions = [...new Map(applications.flatMap((item) => item.competitions || [])
    .map((competition) => [getReviewCompetitionKey(competition), competition.short || competition.name || competition.id])
    .filter(([key]) => key)).entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
  const reviewPool = reviewView === "school-groups"
    ? selectedGroup?.applications || []
    : applications;
  const filteredApplications = reviewPool.filter((item) => {
    const query = search.trim().toLowerCase();
    const applicationNumber = `OC-${item.year}-${String(item.id || "").toUpperCase()}`;
    const competitionTerms = (item.competitions || []).flatMap((competition) => [competition.short, competition.name, competition.subject]).filter(Boolean);
    const matchesSearch = !query || [item.candidate, item.id, applicationNumber, item.school, item.contactEmail, item.heatId, item.finalId, item.exam, item.year, ...competitionTerms].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "pending" ? item.status === "pending" || hasUnreviewedPayment(item) : item.status === statusFilter && !hasUnreviewedPayment(item));
    const matchesCompetition = reviewView !== "all" || competitionFilters.length === 0
      || (item.competitions || []).some((competition) => competitionFilters.includes(getReviewCompetitionKey(competition)));
    return matchesSearch && matchesStatus && matchesCompetition && (kindFilter === "all" || item.kind === kindFilter) && (sourceFilter === "all" || (sourceFilter === "school" ? item.source === "school" : item.source !== "school"));
  });
  const selected = filteredApplications.find((item) => item.id === selectedId) || filteredApplications[0];
  const rejectTarget = applications.find((item) => item.id === rejectApplicationId);
  const selectedSchoolBatch = selected?.batchId ? schoolBatches.find((item) => item.id === selected.batchId) : null;
  const paymentRecords = selected?.paymentRecords || [];
  const selectedPayment = paymentRecords.find((payment) => payment.id === selectedPaymentId) || paymentRecords[0] || null;
  const slipMetadata = paymentRecords.length ? selectedPayment?.slipFile || null : selectedSchoolBatch?.paymentSlipFile || selected?.slipFile || null;
  const selectedSlipKey = `${selected?.id || ""}:${selectedPayment?.id || ""}:${slipMetadata?.id || ""}`;
  const selectedSlipFile = slipMetadata?.dataUrl ? slipMetadata : loadedSlip?.key === selectedSlipKey ? loadedSlip : slipMetadata;
  const selectedSlipDataUrl = selectedSlipFile?.dataUrl || "";
  const selectedSlipType = selectedSlipFile?.type || "";
  const selectedSlipFileName = selectedSlipFile?.name || selectedSchoolBatch?.paymentSlipFileName || selected?.slipFileName || (BACKEND_ENABLED ? "ไม่พบไฟล์สลิป" : `payment-slip-${selected?.id || "application"}.pdf`);
  const [slipLoadError, setSlipLoadError] = useState("");
  const hasReviewableSlip = !BACKEND_ENABLED || Boolean(selectedSlipDataUrl);
  const pendingAdditionalPayment = selected?.status === "confirmed" && selectedPayment?.status === "pending";
  const pendingCount = applications.filter((item) => item.status === "pending" || hasUnreviewedPayment(item)).length;
  const schoolPendingCount = schoolApplications.filter((item) => item.status === "pending" || hasUnreviewedPayment(item)).length;
  const scopedStatusCount = (status) => reviewPool.filter((item) => status === "all" || (status === "pending" ? item.status === "pending" || hasUnreviewedPayment(item) : item.status === status && !hasUnreviewedPayment(item))).length;
  const fmtMoney = (value) => `฿${Number(value || 0).toLocaleString()}`;
  const firstName = selected?.nameParts?.firstName || selected?.studentInformation?.firstName || selected?.candidate?.trim().split(/\s+/)[0] || "";
  const lastName = selected?.nameParts?.lastName || selected?.studentInformation?.lastName || selected?.candidate?.trim().split(/\s+/).slice(1).join(" ") || "";
  const candidateExamNumber = selected?.kind === "Final" ? selected?.finalId : selected?.heatId;
  const expectedTransferAmount = selectedPayment
    ? Number(selectedPayment.expectedAmount || 0)
    : selectedSchoolBatch ? Number(selectedSchoolBatch.invoiceTotal || 0) : Number(selected?.totalPayment || 0);
  const submittedDate = selected?.submitted ? new Date(selected.submitted) : null;
  const submittedAtISO = submittedDate && Number.isFinite(submittedDate.getTime()) ? submittedDate.toISOString() : "";
  const submittedAtLabel = submittedAtISO
    ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }).format(submittedDate)
    : String(selected?.submitted || "ไม่ระบุ");

  useEffect(() => {
    setSlipPreviewOpen(false);
    setSelectedPaymentId("");
  }, [selected?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!selected || !slipMetadata?.url || slipMetadata.dataUrl) {
      if (!slipMetadata?.url) setLoadedSlip(null);
      setSlipLoadError("");
      return undefined;
    }
    setLoadedSlip(null);
    setSlipLoadError("");
    fetch(slipMetadata.url, { credentials: "same-origin" })
      .then((response) => { if (!response.ok) throw new Error("เปิดไฟล์สลิปจากฐานข้อมูลไม่สำเร็จ"); return response.blob(); })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("อ่านไฟล์สลิปไม่สำเร็จ"));
        reader.readAsDataURL(blob);
      }))
      .then((dataUrl) => { if (!cancelled) setLoadedSlip({ key: selectedSlipKey, applicationId: selected.id, paymentId: selectedPayment?.id, name: slipMetadata.name, type: slipMetadata.type, dataUrl }); })
      .catch((error) => { if (!cancelled) setSlipLoadError(error.message || "เปิดไฟล์สลิปไม่สำเร็จ"); });
    return () => { cancelled = true; };
  }, [selected?.id, selectedPayment?.id, selectedSlipKey, slipMetadata?.url, slipMetadata?.dataUrl]);



  async function copyApplicantField(label, value) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      notify(`คัดลอก${label}แล้ว`);
    } catch {
      notify("เบราว์เซอร์นี้ไม่อนุญาตให้คัดลอกข้อมูล");
    }
  }
  return (
    <div className="page-stack">
      <PageHeading eyebrow="จัดการใบสมัคร · คิวตรวจ" title="ตรวจใบสมัครและสลิป" description="เปิดดูข้อมูลแต่ละผู้สมัคร ตรวจรายการสอบและยอดชำระ ก่อนอนุมัติหรือแจ้งปัญหาสลิป" action={<span className="queue-indicator"><span />รอตรวจ {pendingCount} ใบ</span>} />
      <div className="review-layout">
        <section className="surface review-queue">
          <div className="admin-review-mode" role="tablist" aria-label="มุมมองคิวใบสมัคร">
            <button type="button" role="tab" aria-selected={reviewView === "all"} className={reviewView === "all" ? "active" : ""} onClick={() => { setReviewView("all"); setSelectedGroupKey(""); setSearch(""); }}>ใบสมัครทั้งหมด <span>{applications.length}</span></button>
            <button type="button" role="tab" aria-label={`ส่งผ่านโรงเรียน · ${schoolApplications.length} ใบสมัครทั้งหมด`} aria-selected={reviewView === "school-groups"} className={reviewView === "school-groups" ? "active" : ""} onClick={() => { setReviewView("school-groups"); setSelectedGroupKey(""); setSearch(""); setSourceFilter("all"); setKindFilter("all"); }}>ส่งผ่านโรงเรียน <span title={`${schoolApplications.length} ใบสมัครจากโรงเรียนทั้งหมด`}>{schoolApplications.length}</span></button>
          </div>
          {reviewView === "school-groups" && !selectedGroup ? (
            <>
              <div className="review-queue-head"><div><h2>กลุ่มรายการสอบ</h2><p>เลือกกลุ่มเพื่อเปิดรายชื่อผู้สมัคร</p></div><span className="queue-pill" title={`${schoolPendingCount} ใบสมัครจากโรงเรียนรอตรวจ`} aria-label={`${schoolPendingCount} ใบสมัครจากโรงเรียนรอตรวจ`}>{schoolPendingCount}</span></div>
              <div className="review-group-list">{schoolGroups.map((group) => <button type="button" key={group.key} className="review-group-card" onClick={() => { setSelectedGroupKey(group.key); setSelectedId(""); setStatusFilter("pending"); setKindFilter("all"); }}><span className="review-group-mark"><Icon name={group.applications[0]?.kind === "Final" ? "award" : "file"} /></span><span className="review-group-copy"><small>ปีการศึกษา {group.year} · {group.applications[0]?.kind}</small><strong>{group.exam}</strong><em className={group.pending ? "review-group-pending" : "review-group-clear"}>{group.pending ? `${group.pending} ใบ รอตรวจ` : "ไม่มีงานค้าง"}</em></span><span className="review-group-count">{group.applications.length}<small>ใบสมัคร</small></span><Icon name="chevron" size={18} /></button>)}{schoolGroups.length === 0 ? <div className="review-empty-filter"><Icon name="building" /><strong>ยังไม่มีใบสมัครจากโรงเรียน</strong></div> : null}</div>
            </>
          ) : (
            <>
              <div className="review-queue-head"><div>{reviewView === "school-groups" ? <button type="button" className="review-back-groups" onClick={() => { setSelectedGroupKey(""); setSearch(""); }}><Icon name="arrow" size={15} />กลับไปกลุ่ม</button> : null}<h2>{selectedGroup?.exam || "ใบสมัคร"}</h2><p>{selectedGroup ? `ปีการศึกษา ${selectedGroup.year} · ${filteredApplications.length} จาก ${reviewPool.length} ใบ` : `${filteredApplications.length} จาก ${applications.length} รายการ`}</p></div><span className="queue-pill">{reviewPool.filter((item) => item.status === "pending").length}</span></div>
              <label className="input-with-icon review-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ โรงเรียน หรือเลขสอบ" /></label>
              <div className="review-filter-row" role="group" aria-label="กรองสถานะใบสมัคร">{[{ id: "pending", label: "รอตรวจ" }, { id: "confirmed", label: "ยืนยันแล้ว" }, { id: "all", label: "ทั้งหมด" }].map((filter) => <button type="button" key={filter.id} className={statusFilter === filter.id ? "review-filter-active" : ""} aria-pressed={statusFilter === filter.id} onClick={() => setStatusFilter(filter.id)}>{filter.label}<span>{scopedStatusCount(filter.id)}</span></button>)}</div>
              <div className="review-filter-selects"><label><span>ประเภท</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">Heat และ Final</option><option value="Heat">Heat</option><option value="Final">Final</option></select></label>{reviewView === "all" ? <label><span>ผู้สมัคร</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">ทุกช่องทาง</option><option value="school">ผ่านโรงเรียน</option><option value="self">สมัครด้วยตนเอง</option></select></label> : null}</div>
              {reviewView === "all" && competitionOptions.length > 0 ? <fieldset className="review-competition-filter">
                <legend>รายการสอบ</legend>
                <div className="review-competition-filter-heading"><span>เลือกได้หลายรายการ · ตรงอย่างน้อย 1 รายการจะแสดง · ไม่เลือกคือทั้งหมด</span>{competitionFilters.length > 0 ? <button type="button" onClick={() => setCompetitionFilters([])}>ล้างที่เลือก</button> : null}</div>
                <div className="review-competition-options">{competitionOptions.map((option) => <label key={option.key} className={competitionFilters.includes(option.key) ? "selected" : ""}><input type="checkbox" checked={competitionFilters.includes(option.key)} onChange={(event) => { const checked = event.target.checked; setCompetitionFilters((current) => checked ? [...current, option.key] : current.filter((key) => key !== option.key)); }} /><span>{option.label}</span></label>)}</div>
              </fieldset> : null}
              <div className="review-list">
                {filteredApplications.map((item) => (
                  <button className={`review-list-item ${selected?.id === item.id ? "review-list-selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)}>
                    <span className={`review-status-avatar ${item.status === "confirmed" && !hasUnreviewedPayment(item) ? "review-status-avatar-confirmed" : item.slipIssue ? "review-status-avatar-issue" : "review-status-avatar-pending"}`} title={hasUnreviewedPayment(item) ? "มียอดชำระรอตรวจสอบ" : item.status === "confirmed" ? "ยืนยันใบสมัคร" : item.slipIssue ? `ต้องตรวจสอบ: ${item.slipIssue}` : "รออนุมัติ/ตรวจสอบสลิป"} aria-label={hasUnreviewedPayment(item) ? "มียอดชำระรอตรวจสอบ" : item.status === "confirmed" ? "ยืนยันใบสมัคร" : item.slipIssue ? `ต้องตรวจสอบ: ${item.slipIssue}` : "รออนุมัติ/ตรวจสอบสลิป"}>
                      <Icon name={item.status === "confirmed" && !hasUnreviewedPayment(item) ? "check" : item.slipIssue ? "info" : "clock"} size={16} />
                    </span>
                    <span className="review-list-copy"><strong>{item.candidate}</strong><small>{getAdminReviewExamLabel(item)}</small><small>{item.source === "school" ? "ส่งผ่านโรงเรียน" : "สมัครด้วยตนเอง"} · {(item.competitions || []).length} รายการ · {fmtMoney(item.totalPayment)}</small>{hasUnreviewedPayment(item) && item.status === "confirmed" ? <small className="review-list-payment-pending">มียอดชำระเพิ่มรอตรวจ</small> : null}</span>
                  </button>
                ))}
                {!filteredApplications.length ? <div className="review-empty-filter"><Icon name="search" /><strong>ไม่พบใบสมัคร</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div> : null}
              </div>
            </>
          )}
        </section>
        {selected ? (
          <section className="surface review-detail">
            <div className="review-detail-head">
              <div>
                <p className="eyebrow">{selected.kind} · {selected.source === "school" ? "ส่งผ่านโรงเรียน" : "สมัครด้วยตนเอง"}</p>
                <h2>{selected.candidate}</h2>
                <span>{selected.school}{selected.batchId ? ` · ชุด ${selected.batchId}` : ""}</span>
              </div>
              <div className="review-detail-actions"><StatusBadge status={selected.status} /><Button variant="outline" icon="edit" onClick={() => navigate("admin-application-edit", selected.id)}>แก้ไขใบสมัคร</Button></div>
            </div>
            {selected.slipIssue ? <div className="review-record-issue"><Icon name="info" size={16} /><span><strong>สลิปมีปัญหา</strong> · {selected.slipIssue} · ผู้รับลิงก์จะอัปโหลดผ่านอีเมล</span></div> : null}
            <div className="review-detail-body">
              <section className="review-profile-strip" aria-label="ข้อมูลผู้สมัคร">
                <div className="review-section-heading">
                  <span className="review-section-icon"><Icon name="users" size={16} /></span>
                  <div><strong>ข้อมูลผู้สมัคร</strong><small>ใบสมัคร OC-{selected.year}-{selected.id.toUpperCase()}</small></div>
                  <time className="review-submitted-at" dateTime={submittedAtISO || undefined}><Icon name="clock" size={14} /><span><small>สมัครเมื่อ</small><strong>{submittedAtLabel}</strong></span></time>
                </div>
                <div className="review-copy-grid">
                  {[["ชื่อ", firstName], ["นามสกุล", lastName], ["เบอร์โทรศัพท์", getApplicationPhone(selected)], ["รหัสประจำตัว", candidateExamNumber || "ยังไม่กำหนด"], ["อีเมล", selected.contactEmail]].map(([label, value]) => (
                    <div className={`review-copy-field${label === "อีเมล" ? " review-copy-email" : ""}`} key={label}>
                      <span>{label}</span><strong title={value}>{value || "—"}</strong>
                      {(label !== "รหัสประจำตัว" || candidateExamNumber) ? <button type="button" className="review-copy-button" aria-label={`คัดลอก${label}`} title={`คัดลอก${label}`} disabled={!value} onClick={() => copyApplicantField(label, value)}><Icon name="copy" size={14} /></button> : null}
                    </div>
                  ))}
                </div>
              </section>
              <section className="review-exam-panel" aria-label="รายละเอียดการสมัคร">
                <div className="review-section-heading"><span className="review-section-icon review-section-icon-violet"><Icon name="book" size={16} /></span><div><strong>รายการสอบและรูปแบบ</strong><small>ปีการศึกษา {selected.year} · {selected.kind} ROUND</small></div></div>
                <div className="review-exam-list">
                  {selected.competitions?.length ? selected.competitions.map((competition) => {
                    const online = getApplicationCompetitionFormat(selected, competition) === "Online";
                    const examEmail = getApplicationCompetitionExamEmail(selected, competition);
                    return <div className="review-exam-row" key={competition.id}>
                      <span><strong>{competition.short || competition.name}</strong><small>{competition.name}</small><small>{competition.grade || "ไม่ระบุชั้น"} · {online ? "Online Exam" : "Paper-Based"} · {getApplicationCompetitionCenter(selected, competition) || "—"}</small>{online ? <small className="review-exam-email">อีเมลเข้าสอบ: {examEmail || "ยังไม่ได้ระบุ"}</small> : null}</span><b>{fmtMoney(competition.fee)}</b>
                    </div>;
                  }) : <p className="review-no-data">ไม่มีรายละเอียดรายการสอบในใบสมัครนี้</p>}
                </div>
                <div className="review-papers-row">
                  <div className="review-papers-heading"><strong>ข้อสอบเก่าที่เลือก</strong><span className="review-paper-count">{selected.pastPapers?.length || 0} ชุด</span></div>
                  {selected.pastPapers?.length ? (
                    <table className="review-papers-table">
                      <thead><tr><th scope="col">รายการข้อสอบเก่า</th><th scope="col">ราคา</th></tr></thead>
                      <tbody>{selected.pastPapers.map((paper) => <tr key={paper.id}><td>{paper.name}</td><td>{fmtMoney(paper.fee)}</td></tr>)}</tbody>
                    </table>
                  ) : <p className="review-no-papers">ไม่ได้ซื้อข้อสอบเก่า</p>}
                </div>
                <div className="review-fee-summary"><span>ค่าสมัคร <b>{fmtMoney(selected.registrationFee)}</b></span><span>ข้อสอบเก่า <b>{fmtMoney(selected.pastPapersTotal)}</b></span>{Number(selected.nonRefundableAdjustment || 0) > 0 ? <span>ส่วนต่างไม่คืน/ไม่นำไปหัก <b>{fmtMoney(selected.nonRefundableAdjustment)}</b></span> : null}<strong>ยอดที่ต้องชำระ <b>{fmtMoney(expectedTransferAmount)}</b></strong></div>
              </section>
              <section className="review-payment-panel" aria-label="สลิปโอนเงิน">
                <div className="review-section-heading"><span className="review-section-icon review-section-icon-amber"><Icon name="image" size={16} /></span><div><strong>สลิปโอนเงิน</strong><small>ตรวจสอบหลักฐานการชำระเงิน</small></div></div>
                {paymentRecords.length > 1 ? <div className="review-payment-switcher" aria-label="เลือกสลิปที่ต้องการตรวจสอบ">{paymentRecords.map((payment, index) => <button type="button" key={payment.id} className={selectedPayment?.id === payment.id ? "active" : ""} aria-pressed={selectedPayment?.id === payment.id} onClick={() => { setSelectedPaymentId(payment.id); setLoadedSlip(null); setSlipLoadError(""); }}><span>{payment.status === "confirmed" ? "ยืนยันแล้ว" : "รอตรวจ"} · {index === 0 && selected.status === "confirmed" ? "ยอดล่าสุด" : `รายการชำระ ${paymentRecords.length - index}`}</span><strong>{fmtMoney(payment.expectedAmount)}</strong></button>)}</div> : null}
                {selectedPayment ? <div className="review-payment-amount"><span>ยอดของสลิปนี้</span><strong>{fmtMoney(expectedTransferAmount)}</strong><small>{selectedPayment.status === "confirmed" ? "ยืนยันยอดแล้ว" : "รอตรวจสอบยอดนี้"}</small></div> : null}
                <div className="review-slip-only">
                  <div className="review-slip-column">
                    <button type="button" className="review-slip-preview" aria-label={"ขยายดูสลิปของ " + selected.candidate} title="กดเพื่อขยายดูสลิป" disabled={!selectedSlipDataUrl && BACKEND_ENABLED} onClick={() => setSlipPreviewOpen(true)}>
                      {selectedSlipDataUrl && selectedSlipType.startsWith("image/") ? <img className="review-slip-image" src={selectedSlipDataUrl} alt={"สลิปโอนเงินของ " + selected.candidate} />
                        : selectedSlipDataUrl && selectedSlipType === "application/pdf" ? <span className="review-slip-pdf-card"><Icon name="file" size={25} /><strong>PDF</strong><small>กดเพื่อเปิดดูสลิปเต็ม</small></span>
                          : BACKEND_ENABLED ? <span className="review-slip-empty"><Icon name="info" /><strong>ไม่พบไฟล์สลิปใน Portal</strong><small>ตรวจสอบไฟล์บน Google Drive</small></span> : <DemoTransferSlip application={selected} amount={expectedTransferAmount} />}
                    </button>
                    {slipLoadError ? <small className="review-slip-load-error">{slipLoadError}</small> : null}
                  </div>
                </div>
              </section>
            </div>
            <details className="review-history-collapsible"><summary>ประวัติการแก้ไข · {(selected.changeHistory || []).length} ครั้ง</summary>{selected.changeHistory?.length ? <div className="review-history-list">{selected.changeHistory.map((entry) => <article className="review-history-entry" key={entry.id}><div className="review-history-meta"><strong>{entry.editor}</strong><time>{entry.at}</time></div><div className="review-history-changes">{entry.changes.map((change, index) => <div key={`${entry.id}-${index}`}><span>{change.label}</span><div><del>{change.oldValue || "—"}</del><Icon name="arrow" size={13} /><strong>{change.newValue || "—"}</strong></div></div>)}</div></article>)}</div> : <p className="review-history-empty">ยังไม่มีประวัติการแก้ไข</p>}</details>
            <div className="review-actions">
              <div className="review-action-label"><strong>ผลการตรวจสอบ</strong><small>{pendingAdditionalPayment ? "ใบสมัครอนุมัติแล้ว · ตรวจสลิปยอดชำระเพิ่ม" : selected.status === "confirmed" ? "ใบสมัครนี้อนุมัติแล้ว" : selected.slipIssue ? "รอสลิปใหม่ก่อนอนุมัติ" : !hasReviewableSlip ? "ยังเปิดสลิปไม่ได้ จึงยังอนุมัติไม่ได้" : "ตรวจสอบสลิปแล้วอนุมัติใบสมัคร"}</small></div>
              <div className="review-action-buttons">
                {selected.status !== "confirmed" && !selected.slipIssue && selectedPayment?.status !== "confirmed" ? <div className="template-menu"><span>ส่งเทมเพลตแจ้งปัญหาสลิป</span><div><Button variant="outline" icon="mail" onClick={() => onSlipIssue(selected.id, "สลิปไม่ถูกต้อง", selectedPayment?.id)}>สลิปไม่ถูกต้อง</Button><Button variant="outline" icon="mail" onClick={() => onSlipIssue(selected.id, "เปิดสลิปไม่ได้", selectedPayment?.id)}>เปิดสลิปไม่ได้</Button></div></div> : null}
                <div className="review-decision-buttons">
                  <Button icon="check" disabled={(selected.status === "confirmed" && !pendingAdditionalPayment) || Boolean(selected.slipIssue) || !hasReviewableSlip} onClick={() => onApprove(selected.id, selectedPayment?.id)} title={!hasReviewableSlip ? "เปิดสลิปก่อนอนุมัติ หรือแจ้งปัญหาสลิป" : undefined}>{pendingAdditionalPayment ? "ยืนยันยอดชำระเพิ่ม" : selected.status === "confirmed" ? "อนุมัติแล้ว" : "อนุมัติใบสมัคร"}</Button>
                  {selected.status !== "confirmed" && selected.status !== "rejected" ? <Button variant="outline" className="review-reject-trigger" onClick={() => setRejectApplicationId(selected.id)}>ไม่อนุมัติใบสมัคร</Button> : null}
                </div>
              </div>
            </div>
          </section>
        ) : reviewView === "school-groups" && !selectedGroup ? <section className="surface review-group-guide"><span><Icon name="grid" size={22} /></span><p className="eyebrow">ตรวจใบสมัครจากโรงเรียน</p><h2>เลือกกลุ่มรายการสอบ</h2><p>แต่ละกลุ่มรวมใบสมัครตามรายการสอบและปีการศึกษา เมื่อเลือกกลุ่มแล้วจะแสดงรายชื่อผู้สมัคร พร้อมตัวกรองสถานะและค้นหาชื่อ</p></section> : <div className="surface empty-state">เลือกใบสมัครเพื่อดูรายละเอียด</div>}
      </div>
      {slipPreviewOpen && selected ? <ReviewSlipDialog key={selected.id} application={selected} amount={expectedTransferAmount} fileName={selectedSlipFileName} dataUrl={selectedSlipDataUrl} fileType={selectedSlipType} onClose={() => setSlipPreviewOpen(false)} /> : null}
      {rejectTarget ? <ReviewRejectDialog key={rejectTarget.id} application={rejectTarget} onReject={onReject} onClose={() => setRejectApplicationId("")} /> : null}
    </div>
  );
}

function AdminApplicationEditPage({ application, onSave, navigate, competitionFees, examCatalog, centerCatalog, gradeCatalogEntries = [] }) {
  const savedCompetitions = application.competitions || [];
  const roundType = application.kind === "Final" ? "FINAL" : "HEAT";
  const catalogCompetitions = getFormCompetitions(examCatalog, roundType, { year: application.year }).filter((item) => {
    const existing = savedCompetitions.some((entry) => entry.id === item.id);
    const matchingRounds = (examCatalog || []).filter((exam) => (exam.competitionId || exam.id) === item.id
      && getExamRoundType(exam) === roundType && exam.year === application.year);
    return existing || matchingRounds.some((exam) => exam.isOpen) || (!BACKEND_ENABLED && !matchingRounds.length);
  });
  const byCatalog = new Map(catalogCompetitions.map((item) => [item.id, item]));
  const editCompetitions = [...catalogCompetitions.map((item) => {
    const saved = savedCompetitions.find((entry) => entry.id === item.id);
    const round = examCatalog.find((entry) => entry.id === saved?.roundId)
      || examCatalog.find((entry) => entry.competitionId === item.id && getExamRoundType(entry) === roundType && entry.year === application.year && entry.isOpen)
      || examCatalog.find((entry) => entry.competitionId === item.id && getExamRoundType(entry) === roundType && entry.year === application.year);
    return { ...item, roundId: saved?.roundId || round?.id || item.roundId || "", examDate: saved?.examDate || round?.examDate || "" };
  })];
  for (const saved of savedCompetitions) {
    if (!byCatalog.has(saved.id)) editCompetitions.push({ ...saved, roundId: saved.roundId, examDate: saved.examDate, grades: [...new Set([saved.grade, ...(saved.grade ? [] : DEFAULT_GRADE_CATALOG)])] });
  }
  const [profile, setProfile] = useState(() => getApplicantEditValues(application));
  const { firstName, lastName, school, email, phone } = profile;
  const updateProfileField = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const [selectedIds, setSelectedIds] = useState(savedCompetitions.map((item) => item.id));
  const [grades, setGrades] = useState(Object.fromEntries(savedCompetitions.map((item) => [item.id, item.grade || ""])));
  const [formats, setFormats] = useState(Object.fromEntries(savedCompetitions.map((item) => [item.id, getApplicationCompetitionFormat(application, item)])));
  const [centers, setCenters] = useState(Object.fromEntries(savedCompetitions.map((item) => [item.id, item.centerId || item.centerSnapshot?.id || ""])));
  const [examEmailsByCompetition, setExamEmailsByCompetition] = useState(Object.fromEntries(savedCompetitions.filter((item) => getApplicationCompetitionFormat(application, item) === "Online").map((item) => [item.id, getApplicationCompetitionExamEmail(application, item)])));
  const [additionalSlip, setAdditionalSlip] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const today = getBangkokTodayISO();
  const competitions = editCompetitions.filter((item) => selectedIds.includes(item.id));
  const formatFor = (id) => normalizeExamFormat(formats[id], normalizeExamFormat(application.format));
  const examEmailForCompetition = (id) => getCompetitionExamEmailValue(examEmailsByCompetition, id, application.examEmail || application.studentInformation?.examEmail);
  const roundFor = (item) => examCatalog.find((round) => round.id === item.roundId)
    || examCatalog.find((round) => round.competitionId === item.id && getExamRoundType(round) === roundType && round.year === application.year);
  const examDateFor = (item) => item.examDate || roundFor(item)?.examDate || "";
  const selectionLocked = (item) => Boolean(examDateFor(item) && today >= examDateFor(item));
  const formatLocked = (item) => Boolean(examDateFor(item) && today > examDateFor(item));
  const centersFor = (id) => getCommonCenters([id], examCatalog, centerCatalog, { year: application.year, roundType });
  const feeForCompetition = (competition) => {
    const previous = savedCompetitions.find((item) => item.id === competition.id);
    const format = formatFor(competition.id);
    if (previous && getApplicationCompetitionFormat(application, previous) === format && previous.fee !== undefined) return Number(previous.fee || 0);
    return getCompetitionExamPrice(examCatalog, competition.id, roundType, format, competitionFees, application.year);
  };
  const nextRegistrationFee = competitions.reduce((sum, competition) => sum + feeForCompetition(competition), 0);
  const pastPapersTotal = Number(application.pastPapersTotal || 0);
  const nextTotal = nextRegistrationFee + pastPapersTotal;
  const paidTotal = Number(application.totalPayment || 0);
  const currentRegistrationFee = savedCompetitions.reduce((sum, competition) => sum + Number(competition.fee || 0), 0);
  const currentTotal = currentRegistrationFee + pastPapersTotal;
  const delta = nextTotal - currentTotal;
  const previousFeeForCompetition = (competition) => Number(savedCompetitions.find((item) => item.id === competition.id)?.fee || 0);
  const additionalDue = competitions.reduce((sum, competition) => sum + Math.max(0, feeForCompetition(competition) - previousFeeForCompetition(competition)), 0);
  const amountAfterEdit = paidTotal + additionalDue;
  const nonRefundableAdjustment = Math.max(0, amountAfterEdit - nextTotal);
  const changedFormats = competitions.filter((item) => {
    const previous = savedCompetitions.find((entry) => entry.id === item.id);
    return previous && getApplicationCompetitionFormat(application, previous) !== formatFor(item.id);
  });
  const hasOnsiteToOnline = changedFormats.some((item) => getApplicationCompetitionFormat(application, savedCompetitions.find((entry) => entry.id === item.id)) === "Paper-Based" && formatFor(item.id) === "Online");

  function toggleCompetition(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setError("");
  }
  function readSlip(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        if (comma < 0) return reject(new Error("อ่านไฟล์สลิปไม่สำเร็จ"));
        const extensionType = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" }[file.name.split(".").pop()?.toLowerCase()];
        resolve({ fileName: file.name, mimeType: file.type || extensionType || "", dataBase64: result.slice(comma + 1) });
      };
      reader.onerror = () => reject(new Error("อ่านไฟล์สลิปไม่สำเร็จ"));
      reader.readAsDataURL(file);
    });
  }
  async function submit(event) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setError("กรอกชื่อจริงและนามสกุลภาษาอังกฤษ"); return; }
    if (!school.trim()) { setError("กรอกชื่อโรงเรียน"); return; }
    if (!email.trim()) { setError("กรอกอีเมลติดต่อผู้สมัคร"); return; }
    if (!phone.trim()) { setError("กรอกเบอร์โทรศัพท์ผู้สมัคร"); return; }
    if (!competitions.length) { setError("เลือกอย่างน้อย 1 รายการสอบ"); return; }
    if (competitions.some((item) => !grades[item.id])) { setError("เลือกระดับชั้นให้ครบทุกวิชาที่สมัคร"); return; }
    const invalidRound = competitions.find((item) => !item.roundId && !roundFor(item));
    if (invalidRound) { setError(`ไม่พบรอบสอบของ ${invalidRound.short || invalidRound.name}`); return; }
    const missingCenter = competitions.find((item) => formatFor(item.id) === "Paper-Based"
      && !centersFor(item.id).some((option) => option.id === centers[item.id])
      && !savedCompetitions.some((previous) => previous.id === item.id && previous.centerId === centers[item.id]
        && !isOnlineCenter(previous.centerSnapshot || { id: previous.centerId, code: previous.centerCode, name: previous.center })));
    if (missingCenter) { setError(`เลือกศูนย์สอบที่เปิดสำหรับ ${missingCenter.short || missingCenter.name}`); return; }
    const invalidOnlineEmail = competitions.find((item) => formatFor(item.id) === "Online" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(examEmailForCompetition(item.id).trim()));
    if (invalidOnlineEmail) { setError(`กรอกอีเมลเข้าสอบที่ถูกต้องสำหรับ ${invalidOnlineEmail.short || invalidOnlineEmail.name}`); return; }
    if (additionalDue > 0 && !additionalSlip) { setError("แนบสลิปเพิ่มเติมเพื่อบันทึกยอดชำระที่เพิ่มขึ้น"); return; }
    const onlineCenter = centerCatalog.find((item) => item.code === ONLINE_CENTER_CODE)
      || (!BACKEND_ENABLED ? DEFAULT_CENTER_CATALOG.find((item) => item.code === ONLINE_CENTER_CODE) : null);
    const updatedCompetitions = competitions.map((item) => {
      const previous = savedCompetitions.find((entry) => entry.id === item.id);
      const format = formatFor(item.id);
      const previousFormat = previous ? getApplicationCompetitionFormat(application, previous) : "";
      const selectedCenterId = centers[item.id] || previous?.centerId || previous?.centerSnapshot?.id || "";
      const availableCenter = centersFor(item.id).find((option) => option.id === selectedCenterId);
      const catalogCenter = centerCatalog.find((option) => option.id === selectedCenterId);
      const historicalCenter = previous?.centerId === selectedCenterId || previous?.centerSnapshot?.id === selectedCenterId
        ? previous.centerSnapshot || { id: selectedCenterId, code: previous.centerCode, name: previous.center }
        : null;
      const unavailableCenter = catalogCenter || historicalCenter;
      const selectedCenter = availableCenter || (isOnlineCenter(unavailableCenter) ? null : unavailableCenter);
      const center = format === "Online"
        ? (previousFormat === "Online" ? selectedCenter || onlineCenter : onlineCenter)
        : selectedCenter;
      const round = roundFor(item);
      const gradeId = gradeCatalogEntries.find((entry) => entry.label === grades[item.id])?.id || previous?.gradeId || "";
      return { ...item, applicationItemId: previous?.applicationItemId || null, roundId: previous?.roundId || round?.id || item.roundId, gradeId,
        grade: grades[item.id], format, examEmail: format === "Online" ? examEmailForCompetition(item.id).trim() : "", fee: feeForCompetition(item),
        center: center?.name || "", centerId: center?.id || "", centerCode: center?.code || "", centerSnapshot: center ? { id: center.id, code: center.code, name: center.name } : null };
    });
    if (updatedCompetitions.some((item) => !item.gradeId)) { setError("ไม่พบข้อมูลระดับชั้นในแค็ตตาล็อก"); return; }
    const missingRound = updatedCompetitions.find((item) => !item.roundId);
    if (missingRound) { setError(`ไม่พบข้อมูลรอบสอบของ ${missingRound.short || missingRound.name} กรุณาโหลดหน้าแอดมินใหม่แล้วลองอีกครั้ง`); return; }
    const missingCenterId = updatedCompetitions.find((item) => !item.centerId);
    if (missingCenterId) { setError(`ไม่พบข้อมูลศูนย์สอบของ ${missingCenterId.short || missingCenterId.name} กรุณาโหลดหน้าแอดมินใหม่แล้วลองอีกครั้ง`); return; }
    const formatSet = new Set(updatedCompetitions.map((item) => item.format));
    const legacyFormat = formatSet.size > 1 ? "Mixed" : formatSet.has("Online") ? "Online Exam" : "On-site";
    const centerNames = [...new Set(updatedCompetitions.map((item) => item.center).filter(Boolean))];
    const centerSummary = centerNames.join(" · ");
    const legacyExamEmail = updatedCompetitions.find((item) => item.format === "Online")?.examEmail || "";
    const candidate = [firstName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
    setSaving(true);
    setError("");
    try {
      const paymentSlip = additionalSlip && additionalDue > 0 ? await readSlip(additionalSlip) : null;
      await onSave(application.id, {
        candidate, nameParts: { firstName: firstName.trim(), lastName: lastName.trim() }, school: school.trim(), contactEmail: email.trim(), phone: phone.trim(),
        studentInformation: { ...application.studentInformation, ...profile, firstName: firstName.trim(), lastName: lastName.trim(), school: school.trim(), email: email.trim(), phone: phone.trim(), format: legacyFormat, center: centerSummary, examEmail: legacyExamEmail },
        examIds: updatedCompetitions.map((item) => item.id), competitions: updatedCompetitions,
        grade: updatedCompetitions.map((item) => `${item.short}: ${item.grade}`).join(" · "), format: legacyFormat, examEmail: legacyExamEmail,
        center: centerSummary, centerId: updatedCompetitions[0]?.centerId || "", centerCode: updatedCompetitions[0]?.centerCode || "",
        centerSnapshot: updatedCompetitions[0]?.centerSnapshot || null, registrationFee: nextRegistrationFee, totalPayment: amountAfterEdit,
        nonRefundableAdjustment, additionalFee: additionalDue, additionalSlipFileName: additionalSlip?.name || "",
        adminEditPayload: {
          profile: { firstNameEn: firstName.trim(), lastNameEn: lastName.trim(), firstNameTh: profile.thaiFirstName.trim(), lastNameTh: profile.thaiLastName.trim(), schoolName: school.trim(), contactEmail: email.trim(), contactPhone: phone.trim(),
            address: { address1: profile.address1, address2: profile.address2, city: profile.city, province: profile.province, postalCode: profile.postalCode } },
          items: updatedCompetitions.map((item) => ({ applicationItemId: item.applicationItemId, roundId: item.roundId, gradeId: item.gradeId,
            format: item.format === "Online" ? "online" : "paper", centerId: item.centerId, examEmail: item.examEmail })),
          ...(paymentSlip ? { paymentSlip } : {}),
        },
      });
    } catch (saveError) {
      setError(saveError?.message || "บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-stack admin-edit-application-page">
      <PageHeading eyebrow="งานแอดมิน · แก้ไขได้ทุกสถานะ" title="แก้ไขใบสมัคร" description={`${application.candidate} · ${application.exam} · ${application.school}`} action={<Button variant="outline" icon="arrow" onClick={() => navigate("admin-review", application.id)}>กลับไปตรวจใบสมัคร</Button>} />
      <form className="admin-edit-layout" onSubmit={submit}>
        <div className="admin-edit-main">
          <section className="surface admin-edit-section"><div className="admin-edit-section-heading"><span>01</span><div><h2>ข้อมูลผู้เข้าสอบ</h2><p>ผู้ดูแลระบบแก้ไขข้อมูลส่วนตัวได้ทุกสถานะ</p></div></div><ApplicantProfileFields values={profile} onChange={updateProfileField} showThaiNames /></section>
          <section className="surface admin-edit-section"><div className="admin-edit-section-heading"><span>02</span><div><h2>รายการสอบ รูปแบบ และศูนย์สอบ</h2><p>รายการและระดับชั้นล็อกเมื่อถึงวันสอบ · เปลี่ยนรูปแบบได้ตลอดวันสอบ</p></div></div>
            <div className="admin-edit-competition-list">{editCompetitions.map((competition) => {
              const active = selectedIds.includes(competition.id);
              const format = formatFor(competition.id);
              const previous = savedCompetitions.find((item) => item.id === competition.id);
              const lockedSelection = selectionLocked(competition);
              const lockedFormat = formatLocked(competition);
              const dependentFormatChange = previous && getApplicationCompetitionFormat(application, previous) !== format;
              const availableCenters = centersFor(competition.id);
              const centerLocked = lockedSelection && !dependentFormatChange;
              return <article className={`${active ? "admin-edit-competition active" : "admin-edit-competition"}${lockedSelection ? " admin-edit-competition-locked" : ""}`} key={competition.id}>
                <label><input type="checkbox" checked={active} disabled={lockedSelection || saving} onChange={() => toggleCompetition(competition.id)} /><span className="admin-edit-checkbox"><Icon name="check" size={13} /></span><span><strong>{competition.name}</strong><small>{competition.subject}{lockedSelection ? ` · ล็อกรายการ ${examDateFor(competition)}` : ""}</small></span><span className="admin-edit-fee">฿{feeForCompetition(competition).toLocaleString()}<small> / รายการ</small></span></label>
                {active ? <div className="admin-edit-competition-options">
                  <CompetitionFormatPicker competitionId={competition.id} prefix={`admin-${application.id}`} format={format}
                    disabled={lockedFormat || saving}
                    paperPrice={getCompetitionExamPrice(examCatalog, competition.id, roundType, "Paper-Based", competitionFees, application.year)}
                    onlinePrice={getCompetitionExamPrice(examCatalog, competition.id, roundType, "Online", competitionFees, application.year)}
                    onChange={(nextFormat) => {
                      setFormats((current) => ({ ...current, [competition.id]: nextFormat }));
                      if (nextFormat === "Paper-Based") {
                        const physicalCenters = centersFor(competition.id);
                        setCenters((current) => physicalCenters.some((center) => center.id === current[competition.id])
                          ? current
                          : { ...current, [competition.id]: physicalCenters[0]?.id || "" });
                      }
                      setError("");
                    }} />
                  {format === "Paper-Based" ? <Field label={`ศูนย์สอบ ${competition.short}`} required className="competition-center-field"><select value={centers[competition.id] || ""} disabled={centerLocked || saving} onChange={(event) => setCenters((current) => ({ ...current, [competition.id]: event.target.value }))}>
                    <option value="">เลือกศูนย์สอบ</option>{previous?.centerId && !isOnlineCenter(previous.centerSnapshot || { id: previous.centerId, code: previous.centerCode, name: previous.center }) && !availableCenters.some((item) => item.id === previous.centerId) ? <option value={previous.centerId}>{previous.center} · ปัจจุบัน</option> : null}{availableCenters.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.code}</option>)}
                  </select></Field> : <div className="competition-online-fields"><Field label={`อีเมลเข้าสอบ ${competition.short}`} required className="competition-exam-email" hint="ใช้อีเมลเดียวกับรายการอื่นได้ หากใช้บัญชีเดียวกัน"><input type="email" autoComplete="email" value={examEmailForCompetition(competition.id)} disabled={(lockedSelection && !dependentFormatChange) || saving} onChange={(event) => { setExamEmailsByCompetition((current) => ({ ...current, [competition.id]: event.target.value })); setError(""); }} placeholder="student@gmail.com" required /></Field></div>}
                  <Field label={`ระดับชั้น ${competition.short}`} required className="competition-grade"><select value={grades[competition.id] || ""} disabled={lockedSelection || saving} onChange={(event) => setGrades((current) => ({ ...current, [competition.id]: event.target.value }))}>
                    <option value="">เลือกระดับชั้น</option>{grades[competition.id] && !competition.grades.includes(grades[competition.id]) ? <option value={grades[competition.id]}>{grades[competition.id]} (ปัจจุบัน)</option> : null}{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}
                  </select></Field>
                </div> : null}
              </article>;
            })}</div>
          </section>
          {changedFormats.length || delta !== 0 || additionalDue > 0 ? <section className={hasOnsiteToOnline ? "notice notice-amber admin-edit-change-notice" : "notice notice-blue admin-edit-change-notice"}><Icon name={hasOnsiteToOnline ? "info" : "check"} /><div><strong>{changedFormats.length ? `เปลี่ยนรูปแบบสอบ ${changedFormats.length} รายการ` : additionalDue > 0 ? `ยอดชำระเพิ่ม ${fmtAdminMoney(additionalDue)}` : `ยอดสมัครเปลี่ยน ${delta > 0 ? "เพิ่ม" : "ลด"} ${fmtAdminMoney(Math.abs(delta))}`}</strong><p>{additionalDue > 0 ? `แนบสลิปยอดเพิ่ม ${fmtAdminMoney(additionalDue)} · ส่วนต่างจากการลดราคาไม่หักรายการอื่น` : delta < 0 ? `ยอดลดลง ${fmtAdminMoney(Math.abs(delta))} · ไม่คืนเงินและไม่นำส่วนต่างไปหักรายการที่เพิ่ม` : hasOnsiteToOnline ? "ส่วนต่างจากการเปลี่ยนเป็น Online ไม่คืนและไม่นำไปหักรายการอื่น" : "ยอดรวมไม่เปลี่ยน"}</p></div></section> : null}
          {additionalDue > 0 ? <label className="file-drop file-drop-inline admin-edit-slip"><input type="file" accept="image/jpeg,image/png,application/pdf" disabled={saving} onChange={(event) => { setAdditionalSlip(event.target.files?.[0] || null); setError(""); }} /><span className="file-drop-icon"><Icon name="upload" /></span><span className="file-drop-copy"><strong>{additionalSlip?.name || "แนบสลิปเพิ่มเติม"}</strong><small>หลักฐานยอดที่ชำระเพิ่ม · JPG, PNG หรือ PDF</small></span><span className="file-select-label">เลือกไฟล์</span></label> : null}
          {error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}
          <div className="admin-edit-footer"><span><Icon name="info" size={15} />บันทึกข้อมูลเข้าสู่ระบบและประวัติการแก้ไข</span><Button variant="outline" disabled={saving} onClick={() => navigate("admin-review", application.id)}>ยกเลิก</Button><Button type="submit" icon="check" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</Button></div>
        </div>
        <aside className="surface admin-edit-summary"><span className="side-note-icon"><Icon name="settings" /></span><p className="eyebrow">ตรวจยอดก่อนบันทึก</p><h2>สรุปยอดเปลี่ยนแปลง</h2><div className="admin-edit-total-row"><span>ยอดเดิมในใบสมัคร</span><strong>{fmtAdminMoney(paidTotal)}</strong></div><div className="admin-edit-total-row"><span>ข้อสอบเก่า</span><strong>{fmtAdminMoney(pastPapersTotal)}</strong></div><div className="admin-edit-total-row"><span>ค่าสมัครตามรายการใหม่ · {competitions.length} รายการ</span><strong>{fmtAdminMoney(nextRegistrationFee)}</strong></div>{nonRefundableAdjustment > 0 ? <div className="admin-edit-total-row"><span>ส่วนต่างที่ไม่คืน/ไม่นำไปหัก</span><strong>{fmtAdminMoney(nonRefundableAdjustment)}</strong></div> : null}<div className="admin-edit-total-row admin-edit-new-total"><span>ยอดชำระรวมหลังแก้ไข</span><strong>{fmtAdminMoney(amountAfterEdit)}</strong></div><div className={additionalDue > 0 ? "admin-edit-pay-now due" : "admin-edit-pay-now"}><small>ยอดที่ต้องชำระเพิ่ม</small><strong>{fmtAdminMoney(additionalDue)}</strong></div><p>ส่วนต่างจากการเปลี่ยนรูปแบบหรือการลดรายการไม่คืนและไม่นำไปหักค่าสมัครรายการใหม่</p></aside>
      </form>
    </div>
  );
}

function fmtAdminMoney(value) { return `฿${Number(value || 0).toLocaleString()}`; }

function AdminFormOptionAccordion({ title, description, count, panelClassName, children }) {
  return <details className="surface admin-form-option-accordion">
    <summary className="admin-form-option-summary">
      <span className="admin-form-option-copy"><strong>{title}</strong><small>{description}</small></span>
      <span className="admin-form-option-count">{count}</span>
      <Icon name="chevron" size={17} className="admin-form-option-chevron" />
    </summary>
    <div className={`admin-form-option-panel ${panelClassName || ""}`}>{children}</div>
  </details>;
}

function CenterSelectionList({ centers, selectedIds, onChange, label }) {
  const selectableCenters = (centers || []).filter((center) => center.active !== false && center.code !== ONLINE_CENTER_CODE);
  return (
    <fieldset className="admin-center-selection">
      <legend>{label}</legend>
      <div className="admin-center-selection-list">
        {selectableCenters.map((center) => (
          <label key={center.id}>
            <input
              type="checkbox"
              checked={(selectedIds || []).includes(center.id)}
              onChange={() => onChange((selectedIds || []).includes(center.id)
                ? selectedIds.filter((id) => id !== center.id)
                : [...(selectedIds || []), center.id])}
            />
            <span>{center.name}</span>
            <small>{center.code}</small>
          </label>
        ))}
        {!selectableCenters.length ? <span className="admin-center-selection-empty">ยังไม่มีศูนย์สอบที่เปิดใช้งาน</span> : null}
      </div>
      <small className="admin-center-online-hint">Online Exam ใช้ Online : Home Base · รหัส 500 อัตโนมัติ</small>
    </fieldset>
  );
}

function GradeSelectionList({ grades, selectedGrades, onChange, label }) {
  const selected = selectedGrades || [];
  return (
    <fieldset className="admin-center-selection admin-grade-selection">
      <legend>{label}</legend>
      <div className="admin-center-selection-list">
        {(grades || []).map((grade) => (
          <label key={grade}>
            <input
              type="checkbox"
              checked={selected.includes(grade)}
              onChange={() => onChange(selected.includes(grade) ? selected.filter((item) => item !== grade) : [...selected, grade])}
            />
            <span>{grade}</span>
          </label>
        ))}
        {!grades?.length ? <span className="admin-center-selection-empty">ยังไม่มีระดับชั้น · เพิ่มรายการได้ในข้อมูลตัวเลือกในฟอร์ม</span> : null}
      </div>
      <small className="admin-center-online-hint">เลือกเฉพาะระดับชั้นที่เปิดรับในรายการสอบนี้</small>
    </fieldset>
  );
}

function AdminRoundPage({ pageMode = "rounds", examCatalog, onUpdateExam, onSetManualClosed = async () => {}, onAddExam, onRemoveExam, onSaveCatalog, onSaveExam, onRequestAutoSave = () => {}, dirtyExamIds = [], catalogSaveState = { status: "idle", error: "" }, catalogDirty = false, registrationOpen, onGenerateHeatIds, centerCatalog, setCenterCatalog, gradeCatalog, setGradeCatalog, competitionCatalog = DEFAULT_COMPETITION_CATALOG, setCompetitionCatalog = () => {}, applications, pastPaperCatalog, setPastPaperCatalog, paymentAccounts = [], setPaymentAccounts = () => {}, notify }) {
  const [centerFile, setCenterFile] = useState("");
  const [centerPreview, setCenterPreview] = useState(null);
  const [pendingExamAction, setPendingExamAction] = useState(null);
  const [savingExamStatus, setSavingExamStatus] = useState(false);
  const [excludeCenterIssues, setExcludeCenterIssues] = useState(false);
  const [newCenterCode, setNewCenterCode] = useState("");
  const [newCenterName, setNewCenterName] = useState("");
  const [newPaperName, setNewPaperName] = useState("");
  const [newPaperPrice, setNewPaperPrice] = useState("250");
  const [newPaperGroup, setNewPaperGroup] = useState("Big Bay Bei Past Papers");
  const [newGradeName, setNewGradeName] = useState("");
  const [newPaymentAccount, setNewPaymentAccount] = useState({ bankName: "", accountName: "", accountNumber: "", category: "other", showInForm: true });
  const [showNewExamForm, setShowNewExamForm] = useState(false);
  const [showCompetitionManager, setShowCompetitionManager] = useState(false);
  const [newCompetitionName, setNewCompetitionName] = useState("");
  const [newExamLogo, setNewExamLogo] = useState("");
  const [newExamError, setNewExamError] = useState("");
  const selectedPaymentAccountId = paymentAccounts.find((account) => account.active !== false && account.showInForm !== false)?.id || "";
  function updatePaymentAccount(id, key, value) {
    setPaymentAccounts((current) => current.map((account) => key === "showInForm"
      ? { ...account, showInForm: value ? account.id === id : account.id === id ? false : account.showInForm }
      : account.id === id ? { ...account, [key]: value } : account));
  }
  function addPaymentAccount(event) {
    event.preventDefault();
    const accountNumber = newPaymentAccount.accountNumber.trim();
    if (!newPaymentAccount.bankName.trim() || !newPaymentAccount.accountName.trim() || !accountNumber) return;
    if (paymentAccounts.some((account) => String(account.accountNumber).replace(/\D/g, "") === accountNumber.replace(/\D/g, ""))) {
      notify("มีเลขบัญชีนี้อยู่แล้ว");
      return;
    }
    setPaymentAccounts((current) => [
      ...current.map((account) => newPaymentAccount.showInForm ? { ...account, showInForm: false } : account),
      { ...newPaymentAccount, id: `payment-account-${Date.now()}`, accountNumber, active: true },
    ]);
    setNewPaymentAccount({ bankName: "", accountName: "", accountNumber: "", category: "other", showInForm: true });
    notify("เพิ่มบัญชีแล้ว · กำลังบันทึกอัตโนมัติ");
  }
  useEffect(() => {
    if (!pendingExamAction) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPendingExamAction(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pendingExamAction]);
  const paperGroupOptions = [...new Set([
    ...FORM_PAST_PAPER_GROUPS.map((group) => group.title),
    ...pastPaperCatalog.map((paper) => paper.group),
    newPaperGroup,
  ].filter(Boolean))];
  const catalogYears = [...new Set(examCatalog.map((exam) => exam.year).filter(Boolean))].sort((left, right) => Number(right) - Number(left));
  const [yearFilter, setYearFilter] = useState(catalogYears[0] || "all");
  const activePhysicalCenterIds = centerCatalog.filter((center) => center.active !== false && center.code !== ONLINE_CENTER_CODE).map((center) => center.id);
  const [newExam, setNewExam] = useState({ competitionId: competitionCatalog.find((competition) => competition.active !== false)?.id || "", roundTypes: [], year: catalogYears[0] || "", openDate: "", closeDate: "", examDate: "", examStartTime: "", examEndTime: "", editCloseDate: "", gradeOptions: [], accent: "violet", description: "ตรวจสอบกำหนดการและรายละเอียดการสมัคร", centerIds: activePhysicalCenterIds, prices: { HEAT: { paperBased: 755, onlineExam: 655 }, FINAL: { paperBased: 1550, onlineExam: 1350 }, FINAL_X: { paperBased: 1550, onlineExam: 1350 } } });
  const selectedCompetition = competitionCatalog.find((competition) => competition.id === newExam.competitionId);
  const visibleExams = examCatalog.filter((exam) => yearFilter === "all" || exam.year === yearFilter);
  const examGroups = Object.values(visibleExams.reduce((groups, exam) => {
    const groupId = `${exam.competitionId || exam.title}-${exam.year}`;
    groups[groupId] ||= { id: groupId, title: exam.title, year: exam.year, rounds: [] };
    groups[groupId].rounds.push(exam);
    return groups;
  }, {})).sort((left, right) => Number(left.rounds.some((exam) => exam.competitionId === "bbb")) - Number(right.rounds.some((exam) => exam.competitionId === "bbb")));
  const selectedRoundLabels = newExam.roundTypes.map((roundType) => EXAM_ROUND_LABELS[roundType]);
  function readLogoFile(file, onSuccess) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      notify("รองรับไฟล์โลโก้ PNG, JPG หรือ WEBP เท่านั้น");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? onSuccess(reader.result) : notify("อ่านไฟล์โลโก้ไม่สำเร็จ");
    reader.onerror = () => notify("อ่านไฟล์โลโก้ไม่สำเร็จ ลองเลือกไฟล์อีกครั้ง");
    reader.readAsDataURL(file);
  }
  function updateNewExam(key, value) {
    setNewExam((current) => ({ ...current, [key]: value }));
    setNewExamError("");
  }
  function toggleNewExamRound(roundType) {
    updateNewExam("roundTypes", newExam.roundTypes.includes(roundType)
      ? newExam.roundTypes.filter((item) => item !== roundType)
      : [...newExam.roundTypes, roundType]);
  }
  function stageCenterFile(file) {
    if (!file) return;
    setCenterFile(file.name);
    setCenterPreview(null);
    setExcludeCenterIssues(false);
    readWorkbook(file).then((workbook) => {
      const sheetName = workbook.Sheets.Center ? "Center" : "";
      if (!sheetName) {
        setCenterPreview({ centers: [], issues: [{ row: 1, message: "ไม่พบชีตชื่อ Center ในไฟล์" }] });
        return;
      }
      setCenterPreview(parseCenterRows(worksheetRows(workbook, sheetName), centerCatalog));
    }).catch(() => setCenterPreview({ centers: [], issues: [{ row: 1, message: "อ่านไฟล์ไม่สำเร็จ กรุณาตรวจสอบไฟล์ Excel แล้วเลือกใหม่" }] }));
  }
  function applyCenterImport() {
    if (!centerPreview?.centers?.length || (centerPreview.issues.length && !excludeCenterIssues)) return;
    const importedByCode = new Map(centerPreview.centers.map((center) => [center.code, center]));
    const importedIds = new Set(centerPreview.centers.map((center) => center.id));
    setCenterCatalog((current) => {
      const oldByCode = new Map(current.map((center) => [center.code, center]));
      const merged = current.map((center) => {
        const incoming = importedByCode.get(center.code);
        return incoming ? { ...center, ...incoming, id: center.id, active: true } : { ...center, active: false };
      });
      centerPreview.centers.forEach((center) => {
        if (!oldByCode.has(center.code)) merged.push(center);
      });
      return merged;
    });
    examCatalog.forEach((exam) => onUpdateExam(exam.id, { centerIds: (exam.centerIds || []).filter((id) => importedIds.has(id)) }));
    setNewExam((current) => ({ ...current, centerIds: centerPreview.centers.filter((center) => center.code !== ONLINE_CENTER_CODE).map((center) => center.id) }));
    setCenterPreview(null);
    setCenterFile("");
    setExcludeCenterIssues(false);
    notify(`นำเข้าศูนย์สอบ ${centerPreview.centers.length} รายการแล้ว${centerPreview.issues.length ? ` · ข้าม ${centerPreview.issues.length} แถวที่เลือกไว้` : ""}`);
  }
  function slugForCompetition(title) {
    const normalized = title.trim().toLowerCase();
    return `custom-${normalized.replace(/[^a-z0-9ก-๙]+/g, "-").replace(/^-|-$/g, "") || Date.now()}`;
  }
  function addCompetitionChoice() {
    const name = newCompetitionName.trim();
    if (!name) return;
    const short = name.toUpperCase();
    if (competitionCatalog.some((competition) => competition.short.toLocaleLowerCase() === short.toLocaleLowerCase())) {
      notify("มีชื่อรายการสอบนี้อยู่แล้ว");
      return;
    }
    const baseId = slugForCompetition(name);
    const id = competitionCatalog.some((competition) => competition.id === baseId) ? `${baseId}-${Date.now()}` : baseId;
    const subject = /iso/i.test(name) ? "Science" : /ico/i.test(name) ? "Computer" : "Mathematics";
    setCompetitionCatalog((current) => [...current, { id, short, name, subject, active: true }]);
    updateNewExam("competitionId", id);
    setNewCompetitionName("");
    onRequestAutoSave();
    notify(`เพิ่มตัวเลือก ${short} แล้ว · กำลังบันทึกอัตโนมัติ`);
  }
  function updateCompetitionChoice(id, field, value) {
    const nextValue = String(value || "").trimStart();
    if (field === "short" && competitionCatalog.some((item) => item.id !== id && item.short.toLocaleLowerCase() === nextValue.trim().toLocaleLowerCase())) {
      notify("ชื่อย่อนี้มีอยู่แล้ว");
      return;
    }
    setCompetitionCatalog((current) => current.map((item) => item.id === id ? { ...item, [field]: nextValue } : item));
    onRequestAutoSave();
    const selected = competitionCatalog.find((item) => item.id === id);
    if (field === "name" && selected) examCatalog.filter((exam) => exam.competitionId === id).forEach((exam) => onUpdateExam(exam.id, { title: nextValue }));
  }
  function addExam() {
    if (!selectedCompetition || !newExam.roundTypes.length || !newExam.year.trim()) {
      setNewExamError("เลือกรายการสอบ เลือกรอบสอบอย่างน้อยหนึ่งรอบ และระบุปีการศึกษา");
      return;
    }
    if (!newExam.gradeOptions.length) {
      setNewExamError("เลือกระดับชั้นที่เปิดรับอย่างน้อยหนึ่งระดับ");
      return;
    }
    const title = selectedCompetition.name.trim();
    const competitionId = selectedCompetition.id;
    const duplicates = newExam.roundTypes.filter((roundType) => examCatalog.some((exam) => exam.competitionId === competitionId && exam.year === newExam.year.trim() && getExamRoundType(exam) === roundType));
    if (duplicates.length) {
      setNewExamError(`${title} ปี ${newExam.year} มี ${duplicates.map((roundType) => EXAM_ROUND_LABELS[roundType]).join(", ")} อยู่แล้ว`);
      return;
    }
    const createdAt = Date.now();
    newExam.roundTypes.forEach((roundType, index) => onAddExam({
      id: `exam-${createdAt}-${index}`,
      competitionId,
      roundType,
      title,
      round: EXAM_ROUND_LABELS[roundType],
      year: newExam.year.trim(),
      openDate: newExam.openDate,
      closeDate: newExam.closeDate,
      examDate: newExam.examDate,
      examStartTime: newExam.examStartTime,
      examEndTime: newExam.examEndTime,
      editCloseDate: newExam.editCloseDate,
      finalConfirmCloseDate: roundType === "FINAL" ? newExam.closeDate : "",
      isOpen: false,
      accent: newExam.accent,
      description: newExam.description.trim(),
      logoDataUrl: newExamLogo,
      centerIds: [...newExam.centerIds],
      gradeOptions: [...newExam.gradeOptions],
      prices: { ...newExam.prices[roundType] },
      closes: formatThaiDate(newExam.closeDate),
    }));
    setYearFilter(newExam.year.trim());
    setNewExam({ competitionId: competitionCatalog.find((competition) => competition.active !== false)?.id || "", roundTypes: [], year: catalogYears[0] || "", openDate: "", closeDate: "", examDate: "", examStartTime: "", examEndTime: "", editCloseDate: "", gradeOptions: [], accent: "violet", description: "ตรวจสอบกำหนดการและรายละเอียดการสมัคร", centerIds: [...activePhysicalCenterIds], prices: { HEAT: { paperBased: 755, onlineExam: 655 }, FINAL: { paperBased: 1550, onlineExam: 1350 }, FINAL_X: { paperBased: 1550, onlineExam: 1350 } } });
    setNewExamLogo("");
    setNewExamError("");
    setShowNewExamForm(false);
    onRequestAutoSave();
    notify(`เพิ่ม ${title} ${selectedRoundLabels.filter((_, index) => newExam.roundTypes[index]).join(" · ")} แล้ว · ปิดรับสมัครไว้จนกว่าจะเปิดจากการ์ด`);
  }
  function requestExamStatusChange(exam) {
    if (catalogDirty) {
      notify("บันทึกการเปลี่ยนแปลงของรายการสอบก่อนเปลี่ยนสถานะรับสมัคร");
      return;
    }
    const withinWindow = isWithinRegistrationWindow(exam);
    if (getExamRoundType(exam) === "FINAL") {
      if (!exam.isOpen || !withinWindow) return;
      setPendingExamAction({
        id: exam.id,
        title: exam.title,
        round: exam.round || EXAM_ROUND_LABELS.FINAL,
        year: exam.year,
        action: "final-close",
      });
      return;
    }
    const nextIsOpen = !exam.isOpen;
    if (nextIsOpen && !exam.gradeOptions?.length) {
      notify("เลือกระดับชั้นอย่างน้อยหนึ่งระดับก่อนเปิดรับสมัคร");
      return;
    }
    if (nextIsOpen && (!exam.openDate || !exam.closeDate)) {
      notify("ระบุวันเริ่มและวันปิดรับสมัครก่อนเปิดรับ");
      return;
    }
    if (nextIsOpen && !withinWindow) {
      notify("เปิดรับสมัครได้เฉพาะภายในช่วงวันที่กำหนด");
      return;
    }
    setPendingExamAction({
      id: exam.id,
      title: exam.title,
      round: exam.round || EXAM_ROUND_LABELS[getExamRoundType(exam)],
      year: exam.year,
      nextIsOpen,
    });
  }
  function requestHeatIdGeneration(exam) {
    if (catalogDirty) {
      notify("บันทึกการเปลี่ยนแปลงของรายการสอบก่อนสร้างเลขประจำตัวสอบ");
      return;
    }
    const registrationEnded = Boolean(exam.finalManuallyClosed || (exam.closeDate && getBangkokTodayISO() > exam.closeDate));
    if (!registrationEnded) {
      notify("ปิดรับสมัครก่อน หรือรอให้พ้นวันปิดรับสมัครจึงสร้างเลขประจำตัวสอบได้");
      return;
    }
    const missingCount = getApplicationsForResultTarget(applications, exam)
      .flatMap((application) => application.competitions || [])
      .filter((item) => item.roundId === exam.id && !item.examNumber).length;
    if (!missingCount) {
      notify("รายการสอบนี้ยังไม่มีเลขประจำตัวที่ต้องสร้าง");
      return;
    }
    setPendingExamAction({
      id: exam.id,
      title: exam.title,
      round: exam.round || EXAM_ROUND_LABELS.HEAT,
      year: exam.year,
      action: "heat-generate",
      applicantCount: missingCount,
    });
  }
  function restoreFinalAutoStatus(exam) {
    if (catalogDirty) {
      notify("บันทึกการเปลี่ยนแปลงของรายการสอบก่อนเปลี่ยนสถานะรับสมัคร");
      return;
    }
    if (!isWithinRegistrationWindow(exam)) {
      notify("คืนสถานะเปิดรับได้เฉพาะภายในช่วงวันที่กำหนด");
      return;
    }
    setPendingExamAction({
      id: exam.id,
      title: exam.title,
      round: exam.round || EXAM_ROUND_LABELS.FINAL,
      year: exam.year,
      action: "final-restore",
    });
  }
  async function confirmExamAction() {
    if (!pendingExamAction) return;
    const { id, title, round, action, nextIsOpen } = pendingExamAction;
    setSavingExamStatus(true);
    try {
      if (action === "heat-generate") {
        const generated = await onGenerateHeatIds(id);
        if (!generated) return;
      } else {
        const manualClosed = action === "final-close" || (!action && !nextIsOpen);
        await onSetManualClosed(id, manualClosed);
        notify(manualClosed ? `ปิดรับสมัคร ${title} ${round} แล้ว` : `เปิดรับ ${title} ${round} แล้ว · หน้าแรกอัปเดตแล้ว`);
      }
      setPendingExamAction(null);
    } catch (error) {
      notify(error?.message || "บันทึกสถานะรายการสอบไม่สำเร็จ");
    } finally {
      setSavingExamStatus(false);
    }
  }
  function updateCenter(id, key, value) { setCenterCatalog((current) => current.map((center) => center.id === id ? { ...center, [key]: value } : center)); }
  function changeCenterField(center, key, value) {
    const nextValue = String(value || "").trim();
    if (!nextValue) { notify(key === "code" ? "กรุณาระบุรหัสศูนย์สอบ" : "กรุณาระบุชื่อศูนย์สอบ"); return; }
    if (key === "code" && centerCatalog.some((item) => item.id !== center.id && item.code === nextValue)) { notify("รหัสศูนย์สอบนี้มีอยู่แล้ว"); return; }
    updateCenter(center.id, key, nextValue);
  }
  function addCenter() {
    if (!newCenterCode.trim() || !newCenterName.trim()) return;
    if (centerCatalog.some((center) => center.code === newCenterCode.trim())) { notify("รหัสศูนย์สอบนี้มีอยู่แล้ว"); return; }
    setCenterCatalog((current) => [...current, { id: `center-${newCenterCode.trim()}`, code: newCenterCode.trim(), name: newCenterName.trim(), active: true }]);
    setNewCenterCode(""); setNewCenterName(""); notify("เพิ่มศูนย์สอบตัวอย่างแล้ว");
  }
  function deactivateCenter(center) {
    if (!window.confirm(`ปิดใช้งานศูนย์สอบ ${center.name} หรือไม่?`)) return;
    setCenterCatalog((current) => current.map((item) => item.id === center.id ? { ...item, active: false } : item));
    examCatalog.forEach((exam) => onUpdateExam(exam.id, { centerIds: (exam.centerIds || []).filter((id) => id !== center.id) }));
    setNewExam((current) => ({ ...current, centerIds: current.centerIds.filter((id) => id !== center.id) }));
  }
  function downloadCenterSummary(exam) {
    const summary = buildCenterSummaryRows(applications, exam, centerCatalog);
    const total = summary.reduce((sum, row) => sum + row.count, 0);
    const rows = [
      ["สรุปจำนวนผู้สมัครตามศูนย์สอบ"],
      ["รายการสอบ", exam.title],
      ["รอบสอบ", exam.round || EXAM_ROUND_LABELS[getExamRoundType(exam)]],
      ["ปีการศึกษา", exam.year],
      [],
      ["CENTER CODE", "EXAM CENTER", "GRADE", "APPLICANT COUNT"],
      ...(summary.length ? summary.map((row) => [row.centerCode, row.centerName, row.grade, row.count]) : [["", "ไม่มีผู้สมัครในรายการนี้", "", 0]]),
      [],
      ["TOTAL", "", "", total],
    ];
    const stem = `${exam.competitionId || exam.title}-${getExamRoundType(exam)}-${exam.year}`.replace(/[^a-z0-9-]+/gi, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
    downloadWorkbook([{ name: "Center Summary", rows }], `center-summary-${stem}.xlsx`);
    notify(`ดาวน์โหลดสรุปศูนย์สอบ ${exam.title} ${exam.round} แล้ว · ${total} ใบสมัคร`);
  }
  function addPastPaper() {
    if (!newPaperName.trim()) return;
    setPastPaperCatalog((current) => [...current, { id: `paper-${Date.now()}`, group: newPaperGroup, name: newPaperName.trim(), price: Number(newPaperPrice) || 0, active: true }]);
    setNewPaperName(""); notify("เพิ่มรายการแล้ว · กำลังบันทึกอัตโนมัติ");
  }
  function removePastPaper(paper) {
    if (!window.confirm(`ลบข้อสอบเก่า ${paper.title || paper.name} หรือไม่?`)) return;
    setPastPaperCatalog((current) => current.filter((item) => item.id !== paper.id));
    notify(`นำ ${paper.title || paper.name} ออกจากรายการแล้ว · กำลังบันทึกอัตโนมัติ`);
  }
  function addGradeOption() {
    const grade = newGradeName.trim();
    if (!grade) return;
    if (gradeCatalog.some((item) => item.toLocaleLowerCase() === grade.toLocaleLowerCase())) {
      notify("ระดับชั้นนี้มีอยู่แล้ว");
      return;
    }
    setGradeCatalog((current) => [...current, grade]);
    setNewGradeName("");
    notify(`เพิ่มระดับชั้น ${grade} แล้ว`);
  }
  function removeGradeOption(grade) {
    const wouldEmptyOpenExam = examCatalog.some((exam) => exam.isOpen && (exam.gradeOptions || []).length === 1 && exam.gradeOptions.includes(grade));
    if (wouldEmptyOpenExam) {
      notify("ปิดรับสมัครรายการสอบที่ใช้ระดับชั้นนี้ก่อนลบระดับชั้นสุดท้าย");
      return;
    }
    if (!window.confirm(`ลบระดับชั้น ${grade} ออกจากตัวเลือกและรายการสอบที่ใช้หรือไม่?`)) return;
    setGradeCatalog((current) => current.filter((item) => item !== grade));
    examCatalog.filter((exam) => (exam.gradeOptions || []).includes(grade)).forEach((exam) => {
      onUpdateExam(exam.id, { gradeOptions: (exam.gradeOptions || []).filter((item) => item !== grade) });
    });
    setNewExam((current) => ({ ...current, gradeOptions: current.gradeOptions.filter((item) => item !== grade) }));
    notify(`นำระดับชั้น ${grade} ออกจากตัวเลือกและรายการสอบแล้ว`);
  }
  return (
    <div className="page-stack">
      <PageHeading eyebrow="รอบสอบและข้อมูลตั้งต้น" title={pageMode === "form-options" ? "ข้อมูลตัวเลือกในฟอร์ม" : "รายการสอบและกำหนดการ"} description={pageMode === "form-options" ? "จัดการระดับชั้น ศูนย์สอบ และข้อสอบเก่าที่ใช้เป็นตัวเลือกในฟอร์มสมัคร" : "แก้ไขรายการสอบและบันทึกการเปลี่ยนแปลงลงฐานข้อมูล"} action={pageMode === "form-options" ? <span className="admin-data-note"><Icon name="building" size={14} />ระดับชั้น {gradeCatalog.length} ระดับ · ศูนย์สอบ {centerCatalog.filter((center) => center.active !== false).length} แห่ง</span> : <span className={registrationOpen ? "schedule-open" : "closed-badge"}>{registrationOpen ? `เปิดรับ ${examCatalog.filter((exam) => exam.isOpen).length} รายการ` : "ปิดรับสมัครทั้งหมด"}</span>} />
      {catalogSaveState.status === "error" ? <p className="admin-save-feedback admin-save-feedback-error" role="alert">บันทึกไม่สำเร็จ: {catalogSaveState.error} <Button type="button" variant="outline" onClick={() => catalogSaveState.examId ? onSaveExam(catalogSaveState.examId) : onSaveCatalog()}>ลองอีกครั้ง</Button></p>
        : catalogSaveState.status === "saving" ? <p className="admin-save-feedback" role="status">กำลังบันทึกการเปลี่ยนแปลง…</p>
        : catalogDirty ? <p className="admin-save-feedback" role="status">{pageMode === "form-options" ? "มีการเปลี่ยนแปลง · จะบันทึกอัตโนมัติ" : "มีการเปลี่ยนแปลง · กดบันทึกในการ์ดรายการสอบ"}</p>
        : catalogSaveState.status === "saved" ? <p className="admin-save-feedback admin-save-feedback-saved" role="status">บันทึกแล้ว</p> : null}
      {pendingExamAction ? <div className="admin-status-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPendingExamAction(null); }}>
        <section className="admin-status-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="admin-status-confirm-title" aria-describedby="admin-status-confirm-message">
          <span className={`admin-status-confirm-icon${pendingExamAction.action === "heat-generate" ? " admin-status-confirm-icon-generate" : pendingExamAction.action === "final-restore" || pendingExamAction.nextIsOpen ? " admin-status-confirm-icon-open" : " admin-status-confirm-icon-close"}`}><Icon name={pendingExamAction.action === "heat-generate" ? "hash" : pendingExamAction.action === "final-restore" || pendingExamAction.nextIsOpen ? "check" : "close"} size={21} /></span>
          <div className="admin-status-confirm-copy">
            <p className="eyebrow">{pendingExamAction.action === "heat-generate" ? "สร้างเลขประจำตัวสอบ" : "ยืนยันการเปลี่ยนสถานะ"}</p>
            <h2 id="admin-status-confirm-title">{pendingExamAction.action === "heat-generate" ? "ยืนยันสร้างเลขประจำตัวสอบ?" : pendingExamAction.action === "final-close" ? "ปิดรับสมัคร Final ก่อนกำหนด?" : pendingExamAction.action === "final-restore" ? "คืนสถานะเปิดอัตโนมัติ?" : pendingExamAction.nextIsOpen ? "เปิดรับสมัครรายการนี้?" : "ปิดรับสมัครรายการนี้?"}</h2>
            <p id="admin-status-confirm-message"><strong>{pendingExamAction.title} {pendingExamAction.round} {pendingExamAction.year}</strong><br />{pendingExamAction.action === "heat-generate" ? `จะสร้างเลขให้ใบสมัครที่ส่งแล้วและยังไม่มีเลข ${pendingExamAction.applicantCount} ใบ รวมทั้งใบที่รออนุมัติ โดยเรียงตามศูนย์สอบ ระดับชั้น และชื่อผู้สมัคร` : pendingExamAction.action === "final-close" ? "ผู้ผ่าน Heat จะเริ่มสมัคร Final เพิ่มไม่ได้จนกว่าจะคืนสถานะอัตโนมัติ" : pendingExamAction.action === "final-restore" ? "ระบบจะเปิด Final ให้ผู้มีสิทธิ์ หากประกาศผล Heat แล้วและยังอยู่ในช่วงวันรับสมัคร" : pendingExamAction.nextIsOpen ? "ผู้สมัครจะเห็นรายการนี้และสมัครได้บนหน้าแรก" : "ผู้สมัครจะไม่สามารถสมัครรายการนี้เพิ่มได้"}</p>
          </div>
          <div className="admin-status-confirm-actions">
            <Button variant="outline" disabled={savingExamStatus} onClick={() => setPendingExamAction(null)}>ยกเลิก</Button>
            <Button disabled={savingExamStatus} icon={pendingExamAction.action === "heat-generate" ? "hash" : pendingExamAction.action === "final-restore" || pendingExamAction.nextIsOpen ? "check" : "close"} onClick={confirmExamAction}>{savingExamStatus ? "กำลังบันทึก…" : pendingExamAction.action === "heat-generate" ? "ยืนยันสร้างเลข" : pendingExamAction.action === "final-close" ? "ยืนยันปิดรับ" : pendingExamAction.action === "final-restore" ? "คืนสถานะอัตโนมัติ" : pendingExamAction.nextIsOpen ? "ยืนยันเปิดรับ" : "ยืนยันปิดรับ"}</Button>
          </div>
        </section>
      </div> : null}
      {pageMode === "rounds" ? <>
      <section className="surface admin-round-catalog">
        <div className="section-heading"><div><p className="eyebrow">แสดงบนหน้าสมัคร</p><h2>จัดการรายการสอบทั้งหมด</h2></div><div className="admin-exam-heading-actions"><span className="admin-data-note"><Icon name="info" size={14} />สถานะเปิดรับเชื่อมกับหน้าแรก</span><Button icon="plus" onClick={() => { setShowNewExamForm((current) => !current); setNewExamError(""); }}>{showNewExamForm ? "ปิดฟอร์ม" : "เพิ่มรายการสอบ"}</Button></div></div>
        {showNewExamForm ? <form className="admin-exam-create-form" onSubmit={(event) => { event.preventDefault(); addExam(); }}>
          <div className="admin-exam-create-heading"><span className="admin-exam-create-icon"><Icon name="plus" size={17} /></span><div><strong>เพิ่มรายการสอบใหม่</strong><small>รายการจะยังปิดรับสมัคร จนกว่าแอดมินจะกดเปิดรับจากการ์ด</small></div></div>
          <div className="admin-exam-create-fields">
            <div className="admin-exam-title-round-row">
              <fieldset className="admin-competition-choice"><legend>ชื่อรายการสอบ <b>*</b></legend><div><select aria-label="ชื่อรายการสอบ" value={newExam.competitionId} onChange={(event) => updateNewExam("competitionId", event.target.value)} required><option value="">เลือกรายการสอบ</option>{competitionCatalog.filter((competition) => competition.active !== false).map((competition) => <option key={competition.id} value={competition.id}>{competition.short || competition.name}</option>)}</select><Button type="button" variant="outline" icon="settings" onClick={() => setShowCompetitionManager((current) => !current)}>{showCompetitionManager ? "ปิดจัดการชื่อ" : "เพิ่ม/แก้ชื่อ"}</Button></div>
                {showCompetitionManager ? <section className="admin-competition-manager" aria-label="จัดการตัวเลือกรายการสอบ"><div className="admin-competition-manager-add"><label><span>เพิ่มชื่อรายการสอบ</span><input value={newCompetitionName} maxLength={255} onChange={(event) => setNewCompetitionName(event.target.value)} placeholder="เช่น HKIMO" /></label><Button type="button" icon="plus" onClick={addCompetitionChoice}>เพิ่มชื่อ</Button></div>{selectedCompetition ? <div className="admin-competition-manager-edit"><span className="admin-exam-field-label">แก้ไขตัวเลือกที่เลือก · {selectedCompetition.short}</span><label><span>ชื่อใน dropdown</span><input value={selectedCompetition.short || ""} maxLength={30} onChange={(event) => updateCompetitionChoice(selectedCompetition.id, "short", event.target.value)} /></label><label><span>ชื่อเต็มที่แสดงในรายการสอบ</span><input value={selectedCompetition.name || ""} maxLength={255} onChange={(event) => updateCompetitionChoice(selectedCompetition.id, "name", event.target.value)} /></label></div> : <small>เลือกรายการสอบด้านบนเพื่อแก้ไขชื่อ</small>}<div className="admin-competition-manager-save"><small>เพิ่มหรือแก้ชื่อแล้วระบบจะบันทึกอัตโนมัติ</small></div></section> : null}
              </fieldset>
              <fieldset className="admin-round-choice"><legend>รอบสอบ <b>*</b></legend><div>{Object.entries(EXAM_ROUND_LABELS).map(([roundType, label]) => <label key={roundType} className={newExam.roundTypes.includes(roundType) ? "admin-round-choice-selected" : ""}><input type="checkbox" checked={newExam.roundTypes.includes(roundType)} onChange={() => toggleNewExamRound(roundType)} /><span>{label}</span></label>)}</div><small>เลือกได้หลายรอบ ระบบจะแยกสร้างเป็นการ์ดคนละใบ</small></fieldset>
            </div>
            {newExam.roundTypes.map((roundType) => <fieldset className="admin-round-price-set" key={roundType}><legend>ราคาสมัคร · {EXAM_ROUND_LABELS[roundType]}</legend><label><span>Paper-Based</span><div><input aria-label={`${EXAM_ROUND_LABELS[roundType]} ราคา Paper-Based`} type="number" min="0" value={newExam.prices[roundType].paperBased} onChange={(event) => updateNewExam("prices", { ...newExam.prices, [roundType]: { ...newExam.prices[roundType], paperBased: Math.max(0, Number(event.target.value) || 0) } })} /><b>บาท</b></div></label><label><span>Online Exam</span><div><input aria-label={`${EXAM_ROUND_LABELS[roundType]} ราคา Online Exam`} type="number" min="0" value={newExam.prices[roundType].onlineExam} onChange={(event) => updateNewExam("prices", { ...newExam.prices, [roundType]: { ...newExam.prices[roundType], onlineExam: Math.max(0, Number(event.target.value) || 0) } })} /><b>บาท</b></div></label></fieldset>)}
            <label><span>ปีการศึกษา <b>*</b></span><input inputMode="numeric" value={newExam.year} onChange={(event) => updateNewExam("year", event.target.value)} placeholder="2569" required /></label>
            <fieldset className="admin-exam-schedule-fields"><legend>กำหนดวันสำคัญ</legend><div className="admin-exam-schedule-grid">
              <label><span>เริ่มรับสมัคร</span><input type="date" value={newExam.openDate} onChange={(event) => updateNewExam("openDate", event.target.value)} /></label>
              <label><span>ปิดรับสมัคร</span><input type="date" value={newExam.closeDate} onChange={(event) => updateNewExam("closeDate", event.target.value)} /></label>
              <label><span>วันสอบ</span><input type="date" value={newExam.examDate} onChange={(event) => updateNewExam("examDate", event.target.value)} /></label>
              <label><span>เวลาเริ่มสอบ</span><input type="time" value={newExam.examStartTime} onChange={(event) => updateNewExam("examStartTime", event.target.value)} /></label>
              <label><span>เวลาสิ้นสุด</span><input type="time" value={newExam.examEndTime} onChange={(event) => updateNewExam("examEndTime", event.target.value)} /></label>
              <label><span>ปิดแก้ไขข้อมูล</span><input type="date" value={newExam.editCloseDate} onChange={(event) => updateNewExam("editCloseDate", event.target.value)} /></label>
            </div></fieldset>
            <label className="admin-exam-description"><span>คำอธิบายบนการ์ด</span><input value={newExam.description} onChange={(event) => updateNewExam("description", event.target.value)} placeholder="รายละเอียดสั้นๆ ของรายการสอบ" /></label>
            <GradeSelectionList grades={gradeCatalog} selectedGrades={newExam.gradeOptions} onChange={(gradeOptions) => updateNewExam("gradeOptions", gradeOptions)} label="ระดับชั้นที่เปิดรับในรายการนี้" />
            <CenterSelectionList centers={centerCatalog} selectedIds={newExam.centerIds} onChange={(centerIds) => updateNewExam("centerIds", centerIds)} label="ศูนย์สอบที่เปิดในรอบนี้" />
            <div className="admin-exam-form-logo"><span className="admin-exam-field-label">โลโก้ประจำรายการ</span><div className="admin-exam-logo-control"><ExamLogo exam={{ ...newExam, logoDataUrl: newExamLogo }} iconSize={19} /><label className="admin-exam-logo-button"><Icon name="upload" size={15} />{newExamLogo ? "เปลี่ยนรูปโลโก้" : "เลือกรูปโลโก้"}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="เลือกรูปโลโก้รายการสอบใหม่" onChange={(event) => { readLogoFile(event.target.files?.[0], setNewExamLogo); event.target.value = ""; }} /></label><small>PNG, JPG หรือ WEBP · ไม่เกิน 5 MB</small>{newExamLogo ? <button type="button" className="admin-exam-remove-logo" onClick={() => setNewExamLogo("")}>เอารูปออก</button> : null}</div></div>
          </div>
          {newExamError ? <p className="admin-exam-error" role="alert"><Icon name="info" size={14} />{newExamError}</p> : null}
          <div className="admin-exam-form-footer"><span><Icon name="info" size={14} />เลือก {newExam.roundTypes.length || 0} รอบ · {newExam.gradeOptions.length} ระดับชั้น · รายการใหม่เริ่มต้นเป็นยังไม่เปิดรับ</span><div><Button type="button" variant="outline" onClick={() => { setShowNewExamForm(false); setNewExamError(""); }}>ยกเลิก</Button><Button type="submit" icon="check">เพิ่ม {newExam.roundTypes.length || "รายการ"} การ์ด</Button></div></div>
        </form> : null}
        <div className="admin-round-catalog-toolbar"><div><strong>{visibleExams.length} การ์ดรายการสอบ</strong><span>· {visibleExams.filter((exam) => exam.isOpen).length} รอบกำลังเปิดรับ</span></div><label>ปีการศึกษา<select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">ทุกปี</option>{catalogYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div>
        <div className="admin-round-groups">{examGroups.map((group) => <section className="admin-round-group" key={group.id}>
          <div className="admin-round-group-heading"><span className="admin-round-group-mark"><Icon name="award" size={17} /></span><div><strong>{group.title}</strong><small>ปีการศึกษา {group.year}</small></div><span className="admin-round-group-count">{group.rounds.length} รอบ</span></div>
          <div className="admin-round-accordion-list">{group.rounds.map((exam) => {
            const prices = exam.prices || (getExamRoundType(exam) === "HEAT" ? { paperBased: 755, onlineExam: 655 } : { paperBased: 1550, onlineExam: 1350 });
            const roundLabel = exam.round || EXAM_ROUND_LABELS[getExamRoundType(exam)];
            const isFinalRound = getExamRoundType(exam) === "FINAL";
            const finalStatusLabels = { open: "เปิดอัตโนมัติ", "waiting-results": "รอผล HEAT", "no-eligible-applicants": "ไม่มีผู้ผ่าน", "closed-manual": "ปิดโดยแอดมิน", "closed-deadline": "ปิดตามกำหนด", "not-open-yet": "ยังไม่ถึงวันเปิด" };
            const finalStatus = exam.finalRegistrationStatus || "waiting-results";
            const scheduleInWindow = isWithinRegistrationWindow(exam);
            const registrationEnded = Boolean(exam.finalManuallyClosed || (exam.closeDate && getBangkokTodayISO() > exam.closeDate));
            const statusLabel = isFinalRound ? finalStatusLabels[finalStatus] : exam.isOpen ? "เปิดรับ" : exam.finalManuallyClosed ? "ปิดโดยแอดมิน" : exam.openDate && getBangkokTodayISO() < exam.openDate ? "ยังไม่ถึงวันเปิด" : "ปิดรับแล้ว";
            const scheduleLabel = isFinalRound
              ? (finalStatus === "open" ? `ปิดรับ ${formatThaiDate(exam.closeDate)}` : statusLabel)
              : `${exam.openDate ? `เริ่ม ${formatThaiDate(exam.openDate)}` : "ยังไม่กำหนดวันเริ่ม"} · ${exam.closeDate ? `ปิด ${formatThaiDate(exam.closeDate)}` : "ยังไม่กำหนดวันปิด"}`;
            const isHeatRound = getExamRoundType(exam) === "HEAT";
            const heatApplications = isHeatRound ? getApplicationsForResultTarget(applications, exam) : [];
            const heatItems = heatApplications.flatMap((application) => application.competitions || []).filter((item) => item.roundId === exam.id);
            const heatIdsToGenerate = heatItems.filter((item) => !item.examNumber).length;
            const heatHasExistingNumbers = heatItems.some((item) => item.examNumber);
            return <details className={`admin-round-accordion${exam.isOpen ? " admin-round-accordion-open" : ""}`} key={exam.id}>
              <summary className="admin-round-accordion-summary">
                <ExamLogo exam={exam} className={`exam-type-mark exam-card-${exam.accent}`} iconSize={18} />
                <span className="admin-round-accordion-copy">
                  <strong>{exam.title} {roundLabel} {exam.year}</strong>
                  <small>{scheduleLabel} · Paper-Based ฿{Number(prices.paperBased || 0).toLocaleString()} · Online Exam ฿{Number(prices.onlineExam || 0).toLocaleString()}</small>
                </span>
                <span className={`admin-round-accordion-status ${exam.isOpen ? "schedule-open" : isFinalRound && finalStatus === "waiting-results" ? "draft-badge" : "closed-badge"}`}>{statusLabel}</span>
                <Icon name="chevron" size={17} className="admin-round-accordion-chevron" />
              </summary>
              <div className="admin-round-accordion-panel">
                <div className="admin-round-pricing-row">
                  <div className="admin-round-price-summary">
                    <span><small>Paper-Based</small><strong>฿{Number(prices.paperBased || 0).toLocaleString()}</strong></span>
                    <span><small>Online Exam</small><strong>฿{Number(prices.onlineExam || 0).toLocaleString()}</strong></span>
                  </div>
                  <div className="admin-round-actions">
                    {isFinalRound
                      ? exam.isOpen
                        ? <Button variant="outline" icon="close" onClick={() => requestExamStatusChange(exam)}>ปิดรับ Final</Button>
                        : finalStatus === "closed-manual"
                          ? <Button variant="outline" icon="check" disabled={!scheduleInWindow} title={scheduleInWindow ? "คืนสถานะเปิดรับอัตโนมัติ" : "เปิดคืนได้เฉพาะในช่วงวันที่กำหนด"} onClick={() => restoreFinalAutoStatus(exam)}>คืนสถานะอัตโนมัติ</Button>
                          : null
                      : <>
                        <Button variant={exam.isOpen ? "outline" : "primary"} icon={exam.isOpen ? "close" : "check"} disabled={!exam.isOpen && !scheduleInWindow} title={!exam.isOpen && !scheduleInWindow ? "เปิดรับได้เฉพาะในช่วงวันที่กำหนด" : ""} onClick={() => requestExamStatusChange(exam)}>{exam.isOpen ? "ปิดรับ" : "เปิดรับ"}</Button>
                        {isHeatRound ? <Button type="button" variant={heatIdsToGenerate ? "outline" : "success"} icon={heatIdsToGenerate ? "hash" : "check"} disabled={!registrationEnded || !heatIdsToGenerate} ariaLabel={`สร้างเลขประจำตัวสอบ ${exam.title} ${roundLabel} ปี ${exam.year}${!registrationEnded ? " · รอปิดรับสมัคร" : ""}`} title={!registrationEnded ? "ปิดรับสมัครก่อน หรือรอให้พ้นวันปิดรับสมัคร" : heatIdsToGenerate ? `สร้างเลขให้ ${heatIdsToGenerate} รายการสอบ` : "ไม่มีเลขประจำตัวที่ต้องสร้าง"} onClick={() => requestHeatIdGeneration(exam)}>{!registrationEnded ? "รอปิดรับก่อนสร้างเลข" : heatIdsToGenerate ? `สร้างเลขสอบ · ${heatIdsToGenerate} รายการ${heatHasExistingNumbers ? "ใหม่" : ""}` : heatItems.length ? "สร้างเลขแล้ว" : "ยังไม่มีผู้สมัคร"}</Button> : null}
                      </>}
                    {!exam.isOpen ? <Button type="button" variant="outline" icon="download" className="center-summary-download" onClick={() => downloadCenterSummary(exam)}>สรุปศูนย์สอบ</Button> : null}
                    <Button variant="outline" className="admin-round-delete" icon="trash" ariaLabel={`ลบ ${exam.title} ${exam.round || ""} ปี ${exam.year}`} title="ลบการ์ดรายการสอบนี้" onClick={() => { if (!window.confirm(`ลบ ${exam.title} ${roundLabel} ปี ${exam.year} หรือไม่?`)) return; onRemoveExam(exam.id); onRequestAutoSave(); notify(`ลบ ${exam.title} ${roundLabel} ปี ${exam.year} แล้ว · กำลังบันทึก`); }}>ลบ</Button>
                  </div>
                </div>
                {isFinalRound ? <div className="admin-final-auto-note"><Icon name="info" size={14} /><span>เมื่อประกาศผล HEAT ระบบเปิดสิทธิ์ให้ผู้ผ่านยืนยันได้ภายในช่วงวันรับสมัคร Final โดยใช้วันปิดรับสมัครเดียวกัน</span></div> : null}
                <div className="admin-round-accordion-config">
                  <strong>กำหนดการและรายละเอียดรอบสอบ</strong>
                  <div className="admin-round-fields">
                    <label><span>เริ่มรับสมัคร</span><input type="date" value={exam.openDate || ""} onChange={(event) => onUpdateExam(exam.id, { openDate: event.target.value })} /></label>
                    <label><span>ปิดรับสมัคร{isFinalRound ? " / ยืนยันสิทธิ์ Final" : ""}</span><input type="date" value={exam.closeDate || ""} onChange={(event) => onUpdateExam(exam.id, { closeDate: event.target.value, ...(isFinalRound ? { finalConfirmCloseDate: event.target.value } : {}), closes: formatThaiDate(event.target.value) })} /></label>
                    <label><span>วันสอบ</span><input type="date" value={exam.examDate || ""} onChange={(event) => onUpdateExam(exam.id, { examDate: event.target.value })} /></label>
                    <label><span>เวลาเริ่มสอบ</span><input type="time" value={exam.examStartTime || ""} onChange={(event) => onUpdateExam(exam.id, { examStartTime: event.target.value })} /></label>
                    <label><span>เวลาสิ้นสุด</span><input type="time" value={exam.examEndTime || ""} onChange={(event) => onUpdateExam(exam.id, { examEndTime: event.target.value })} /></label>
                    <label><span>ปิดแก้ไขข้อมูล</span><input type="date" value={exam.editCloseDate || ""} onChange={(event) => onUpdateExam(exam.id, { editCloseDate: event.target.value })} /></label>
                  </div>
                  <div className="admin-round-price-edit">
                    <label><span>Paper-Based</span><div><input type="number" min="0" value={prices.paperBased ?? 0} onChange={(event) => onUpdateExam(exam.id, { prices: { ...prices, paperBased: Math.max(0, Number(event.target.value) || 0) } })} /><b>บาท</b></div></label>
                    <label><span>Online Exam</span><div><input type="number" min="0" value={prices.onlineExam ?? 0} onChange={(event) => onUpdateExam(exam.id, { prices: { ...prices, onlineExam: Math.max(0, Number(event.target.value) || 0) } })} /><b>บาท</b></div></label>
                  </div>
                  <div className="admin-round-selection-grid">
                    <GradeSelectionList grades={gradeCatalog} selectedGrades={exam.gradeOptions || FORM_COMPETITIONS.find((competition) => competition.id === exam.competitionId)?.grades || []} onChange={(gradeOptions) => { if (exam.isOpen && !gradeOptions.length) { notify("รายการสอบที่เปิดรับต้องมีระดับชั้นอย่างน้อยหนึ่งระดับ"); return; } onUpdateExam(exam.id, { gradeOptions }); }} label="ระดับชั้นที่เปิดรับในรายการนี้" />
                    <CenterSelectionList centers={centerCatalog} selectedIds={exam.centerIds || []} onChange={(centerIds) => onUpdateExam(exam.id, { centerIds })} label="ศูนย์สอบ Paper-Based ที่เปิดในรอบนี้" />
                  </div>
                  <div className="admin-round-logo-row"><span>โลโก้รายการ</span><label className="admin-exam-logo-button"><Icon name="upload" size={14} />{exam.logoDataUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`อัปโหลดโลโก้ ${exam.title} ${exam.round}`} onChange={(event) => { readLogoFile(event.target.files?.[0], (logoDataUrl) => onUpdateExam(exam.id, { logoDataUrl })); event.target.value = ""; }} /></label><small>PNG · JPG · WEBP ไม่เกิน 5 MB</small></div>
                  <div className="admin-round-card-save"><span>{dirtyExamIds.includes(exam.id) ? "มีการเปลี่ยนแปลงในรอบนี้" : "ข้อมูลรอบนี้บันทึกแล้ว"}</span><Button type="button" variant="outline" icon="check" disabled={!dirtyExamIds.includes(exam.id) || catalogSaveState.status === "saving"} onClick={() => onSaveExam(exam.id)}>{catalogSaveState.status === "saving" ? "กำลังบันทึก…" : "บันทึกรอบนี้"}</Button></div>
                </div>
              </div>
            </details>;
          })}</div>
        </section>)}{!visibleExams.length ? <div className="empty-inline"><Icon name="calendar" /><span>ยังไม่มีรายการสอบในปีการศึกษานี้</span></div> : null}</div>
      </section>
      </> : null}
      {pageMode === "form-options" ? <div className="admin-form-options-accordions">
      <AdminFormOptionAccordion
        title="บัญชีรับโอน"
        description="เพิ่มหรือลบบัญชี และเลือกบัญชีเดียวที่จะแสดงในแบบฟอร์มสมัคร"
        count={`${paymentAccounts.length} บัญชี`}
        panelClassName="admin-payment-accounts"
      >
        <div className="admin-payment-account-list">
          {paymentAccounts.map((account) => <article className="admin-payment-account-row" key={account.id}>
            <div className="admin-payment-account-fields">
              <label><span>ธนาคาร</span><input aria-label={`ธนาคารของบัญชี ${account.accountNumber}`} value={account.bankName || ""} onChange={(event) => updatePaymentAccount(account.id, "bankName", event.target.value)} placeholder="เช่น Kasikorn Bank" /></label>
              <label><span>ชื่อบัญชี</span><input aria-label={`ชื่อบัญชี ${account.accountNumber}`} value={account.accountName || ""} onChange={(event) => updatePaymentAccount(account.id, "accountName", event.target.value)} /></label>
              <label><span>เลขบัญชี</span><input aria-label={`เลขบัญชี ${account.accountName}`} value={account.accountNumber || ""} onChange={(event) => updatePaymentAccount(account.id, "accountNumber", event.target.value)} /></label>
              <label><span>ประเภทบัญชี</span><select value={account.category === "president" ? "president" : "other"} onChange={(event) => updatePaymentAccount(account.id, "category", event.target.value)}><option value="president">บัญชีประธาน · ไม่ต้องลงบัญชี</option><option value="other">บัญชีอื่น · ต้องลงบัญชีภายนอก</option></select></label>
            </div>
            <div className="admin-payment-account-actions"><label className="admin-payment-show"><input type="radio" name="form-payment-account" checked={selectedPaymentAccountId === account.id} onChange={() => updatePaymentAccount(account.id, "showInForm", true)} /><span>แสดงในฟอร์มสมัคร</span></label><button type="button" className="admin-paper-delete" aria-label={`ลบบัญชี ${account.bankName} ${account.accountNumber}`} title="ลบบัญชีรับโอน" onClick={() => { if (window.confirm(`ลบบัญชี ${account.bankName} ${account.accountNumber} หรือไม่?`)) setPaymentAccounts((current) => current.filter((item) => item.id !== account.id)); }}><Icon name="close" size={15} /></button></div>
          </article>)}
          {!paymentAccounts.length ? <p className="admin-payment-empty">ยังไม่มีบัญชีรับโอน · เพิ่มบัญชีใหม่ด้านล่าง</p> : null}
        </div>
        <form className="admin-add-payment-account" onSubmit={addPaymentAccount}>
          <label><span>ธนาคาร</span><input value={newPaymentAccount.bankName} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, bankName: event.target.value }))} placeholder="เช่น Kasikorn Bank" required /></label>
          <label><span>ชื่อบัญชี</span><input value={newPaymentAccount.accountName} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, accountName: event.target.value }))} placeholder="ชื่อเจ้าของบัญชี" required /></label>
          <label><span>เลขบัญชี</span><input value={newPaymentAccount.accountNumber} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, accountNumber: event.target.value }))} placeholder="เลขบัญชีสำหรับโอน" required /></label>
          <label><span>ประเภท</span><select value={newPaymentAccount.category} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, category: event.target.value }))}><option value="president">บัญชีประธาน</option><option value="other">บัญชีอื่น</option></select></label>
          <label className="admin-payment-show"><input type="checkbox" checked={newPaymentAccount.showInForm} onChange={(event) => setNewPaymentAccount((current) => ({ ...current, showInForm: event.target.checked }))} /><span>แสดงในฟอร์มสมัคร</span></label>
          <Button type="submit" variant="outline" icon="plus">เพิ่มบัญชี</Button>
        </form>
          <div className="admin-fee-foot"><span><Icon name="info" size={14} />เลือกบัญชีที่จะแสดงในหน้าสมัครได้ครั้งละ 1 บัญชี · ระบบบันทึกอัตโนมัติ</span></div>
      </AdminFormOptionAccordion>
      <AdminFormOptionAccordion
        title="ข้อสอบเก่าและราคา"
        description="จัดการรายการข้อสอบเก่า ราคา และสถานะการขาย"
        count={`${pastPaperCatalog.length} รายการ`}
        panelClassName="admin-papers-catalog"
      >
        <div className="admin-paper-table-wrap"><table className="admin-paper-table"><thead><tr><th>กลุ่ม / รายการ</th><th>ราคา</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{pastPaperCatalog.length ? pastPaperCatalog.map((paper) => <tr key={paper.id}><td><small>{paper.group}</small><strong>{paper.name}</strong></td><td><label className="admin-paper-price"><span>฿</span><input aria-label={`ราคาของ ${paper.name}`} type="number" min="0" value={paper.price} onChange={(event) => setPastPaperCatalog((current) => current.map((item) => item.id === paper.id ? { ...item, price: Math.max(0, Number(event.target.value) || 0) } : item))} /></label></td><td><span className={paper.active ? "schedule-open" : "closed-badge"}>{paper.active ? "เปิดขาย" : "ปิดขาย"}</span></td><td><div className="admin-paper-actions"><Button variant="text" onClick={() => setPastPaperCatalog((current) => current.map((item) => item.id === paper.id ? { ...item, active: !item.active } : item))}>{paper.active ? "ปิดรายการ" : "เปิดรายการ"}</Button><button type="button" className="admin-paper-delete" aria-label={`ลบข้อสอบเก่า ${paper.title || paper.name}`} title={`ลบข้อสอบเก่า ${paper.title || paper.name}`} onClick={() => removePastPaper(paper)}><Icon name="close" size={15} /></button></div></td></tr>) : <tr><td className="admin-paper-empty" colSpan="4">ยังไม่มีรายการข้อสอบเก่า · เพิ่มรายการใหม่ได้ด้านล่าง</td></tr>}</tbody></table></div>
        <div className="admin-add-paper"><select aria-label="กลุ่มข้อสอบเก่า" value={newPaperGroup} onChange={(event) => setNewPaperGroup(event.target.value)}>{paperGroupOptions.map((group) => <option key={group}>{group}</option>)}</select><input aria-label="ชื่อรายการข้อสอบเก่าใหม่" placeholder="ชื่อข้อสอบเก่าใหม่" value={newPaperName} onChange={(event) => setNewPaperName(event.target.value)} /><label><span>ราคา</span><input type="number" min="0" value={newPaperPrice} onChange={(event) => setNewPaperPrice(event.target.value)} /></label><Button variant="outline" disabled={!newPaperName.trim()} onClick={addPastPaper}>เพิ่มข้อสอบเก่า</Button></div>
        <div className="admin-fee-foot"><span>รายการ ราคา และสถานะจะบันทึกอัตโนมัติ</span></div>
      </AdminFormOptionAccordion>
      <AdminFormOptionAccordion
        title="ระดับชั้น"
        description="ตัวเลือกระดับชั้นส่วนกลางสำหรับนำไปเลือกในแต่ละรายการสอบ"
        count={`${gradeCatalog.length} ระดับ`}
        panelClassName="admin-grade-catalog-card"
      >
          <div className="admin-grade-catalog-list">{gradeCatalog.map((grade) => {
            const usedBy = examCatalog.filter((exam) => (exam.gradeOptions || []).includes(grade)).length;
            return <div className="admin-grade-catalog-row" key={grade}><span>{grade}</span><small>{usedBy ? `ใช้ใน ${usedBy} รายการสอบ` : "ยังไม่ใช้ในรายการสอบ"}</small><button type="button" className="admin-grade-remove" aria-label={`ลบระดับชั้น ${grade}`} title={`ลบระดับชั้น ${grade}`} onClick={() => removeGradeOption(grade)}><Icon name="close" size={15} /></button></div>;
          })}</div>
          <form className="admin-add-grade" onSubmit={(event) => { event.preventDefault(); addGradeOption(); }}><label htmlFor="new-grade-option">เพิ่มระดับชั้น</label><input id="new-grade-option" value={newGradeName} onChange={(event) => setNewGradeName(event.target.value)} placeholder="เช่น Primary 1" /><Button type="submit" variant="outline" disabled={!newGradeName.trim()} icon="plus">เพิ่มระดับชั้น</Button></form>
          <div className="admin-grade-catalog-note"><Icon name="info" size={14} /><span>เมื่อลบระดับชั้น ระบบจะปิดการใช้งานและนำออกจากตัวเลือกรอบสอบ แต่ข้อมูลใบสมัครเดิมยังอยู่ · ระบบบันทึกอัตโนมัติ</span></div>
      </AdminFormOptionAccordion>
      <AdminFormOptionAccordion
        title="ศูนย์สอบกลาง"
        description="นำเข้า แก้ไข และจัดการสถานะศูนย์สอบ"
        count={`${centerCatalog.length} ศูนย์`}
        panelClassName="centers-card"
      >
          <div className="center-upload">
            <input id="center-file" type="file" accept=".xlsx" onChange={(event) => { stageCenterFile(event.target.files?.[0]); event.target.value = ""; }} />
            <label htmlFor="center-file" className="file-drop"><span className="file-drop-icon"><Icon name="upload" /></span><strong>{centerFile || "เลือกไฟล์ Excel ศูนย์สอบ"}</strong><small>ไฟล์ .xlsx · ต้องมีชีต Center โดยคอลัมน์ A เป็นชื่อและ B เป็นรหัส</small></label>
            {centerPreview ? <div className="center-import-preview" role="status">
              <strong>ตัวอย่างนำเข้า: {centerPreview.centers.length} ศูนย์ที่ใช้ได้ · {centerPreview.issues.length} แถวต้องตรวจ</strong>
              {centerPreview.issues.length ? <ul>{centerPreview.issues.map((issue) => <li key={`${issue.row}-${issue.code}`}>แถว {issue.row}: {issue.message}</li>)}</ul> : <p>ไม่พบแถวที่มีปัญหา</p>}
              {centerPreview.issues.length ? <label className="center-import-exclude"><input type="checkbox" checked={excludeCenterIssues} onChange={(event) => setExcludeCenterIssues(event.target.checked)} />นำเข้าเฉพาะแถวที่ถูกต้องและข้ามแถวที่แจ้งปัญหา</label> : null}
              <Button type="button" variant="outline" disabled={!centerPreview.centers.length || (centerPreview.issues.length > 0 && !excludeCenterIssues)} onClick={applyCenterImport}>นำเข้าศูนย์สอบ</Button>
            </div> : null}
          </div>
          <div className="centers-table"><div className="center-row center-row-head"><span>รหัส</span><span>ชื่อศูนย์สอบ</span><span>สถานะและจัดการ</span></div>{centerCatalog.map((center) => <div className={`center-row center-row-editable${center.active === false ? " center-row-inactive" : ""}`} key={center.id}><input aria-label={`รหัสศูนย์สอบ ${center.name}`} value={center.code} onChange={(event) => changeCenterField(center, "code", event.target.value)} /><input aria-label={`ชื่อศูนย์สอบ ${center.code}`} value={center.name} onChange={(event) => changeCenterField(center, "name", event.target.value)} /><div className="center-row-actions"><span className={center.active === false ? "closed-badge" : "schedule-open"}>{center.active === false ? "ปิดใช้" : "ใช้งาน"}</span>{center.active === false ? <Button type="button" variant="text" onClick={() => updateCenter(center.id, "active", true)}>เปิดใช้</Button> : <Button type="button" variant="text" className="center-delete-button" disabled={center.code === ONLINE_CENTER_CODE} onClick={() => deactivateCenter(center)}>ลบ</Button>}</div></div>)}</div>
          <div className="admin-add-center"><input aria-label="รหัสศูนย์สอบใหม่" placeholder="รหัสใหม่" value={newCenterCode} onChange={(event) => setNewCenterCode(event.target.value)} /><input aria-label="ชื่อศูนย์สอบใหม่" placeholder="ชื่อศูนย์สอบใหม่" value={newCenterName} onChange={(event) => setNewCenterName(event.target.value)} /><Button variant="outline" disabled={!newCenterCode.trim() || !newCenterName.trim()} onClick={addCenter}>เพิ่มศูนย์</Button></div>
          <div className="admin-fee-foot"><span>การปิดใช้ศูนย์จะไม่ลบข้อมูลใบสมัครเดิม · ระบบบันทึกอัตโนมัติ</span></div>
      </AdminFormOptionAccordion>
    </div> : null}
    </div>
  );
}

function AdminResultsPage({ applications, examCatalog, resultWorkflows, onImportDraft, onResolveConflict, onPublishResult, notify, navigate }) {
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const [busyImport, setBusyImport] = useState(false);
  const [manualMatches, setManualMatches] = useState({});
  const [targetId, setTargetId] = useState('');
  const selectedTarget = examCatalog.find((exam) => exam.id === targetId) || null;
  const targetOptions = [...examCatalog].sort((left, right) => Number(right.year) - Number(left.year) || left.title.localeCompare(right.title, 'th') || getExamRoundType(left).localeCompare(getExamRoundType(right)));
  const workflow = selectedTarget ? resultWorkflows[selectedTarget.id] || {} : {};
  const rows = workflow.rows || [];
  const finalEligibleRows = rows.filter((row) => isFinalEligibleAward(row.award, selectedTarget?.competitionId));
  const issueRows = rows.filter((row) => row.matchStatus !== 'matched');
  const hasConflict = issueRows.length > 0;
  const matchedRows = rows.filter((row) => row.matchStatus === 'matched');
  const awardBreakdown = (selectedTarget?.competitionId === 'bbb' ? ['1ST', '2ND', '3RD', 'MERIT AWARD', 'PARTICIPATION'] : RESULT_AWARDS).map((award) => ({
    award, count: rows.filter((row) => normalizeAwardLabel(row.award) === normalizeAwardLabel(award)).length,
  }));
  const isPublished = workflow.status === 'published' || Boolean(workflow.published);
  const targetApplications = selectedTarget ? getApplicationsForResultTarget(applications, selectedTarget) : [];
  const applicationItems = targetApplications.flatMap((application) => (application.competitions || [])
    .filter((item) => item.roundId === selectedTarget?.id && item.applicationItemId)
    .map((item) => ({ application, item })));

  async function importFile(file) {
    if (!file || !selectedTarget || busyImport) return;
    setBusyImport(true);
    try {
      const parsed = await parseAdminWorkbook(file, true);
      await onImportDraft(selectedTarget, file.name, parsed);
    } catch (error) { notify(error?.message || 'อ่านไฟล์ผลสอบไม่สำเร็จ'); }
    finally { setBusyImport(false); }
  }

  async function resolve(row, action, applicationItemId = '') {
    try {
      await onResolveConflict(selectedTarget.id, row.id, action, applicationItemId);
      setManualMatches((current) => ({ ...current, [row.id]: '' }));
    } catch (error) { notify(error?.message || 'แก้รายการจับคู่ไม่สำเร็จ'); }
  }

  return <div className="page-stack">
    <PageHeading eyebrow="ผลการสอบ · ฐานข้อมูลจริง" title="นำเข้าและประกาศผลสอบ" description="เลือกรายการสอบและรอบก่อนนำเข้า Excel เพื่อตรวจข้อมูลแล้วจึงประกาศผล" />
    <section className="surface results-import-setup" aria-label="เตรียมนำเข้าผลสอบ">
      <div className="results-import-setup-heading"><div><p className="eyebrow">นำเข้าผลสอบ</p><h2>เตรียมไฟล์สำหรับรอบสอบ</h2><p>เลือกการ์ดรายการสอบที่สร้างไว้ แล้วอัปโหลดผลสอบของรอบนั้น</p></div><span className={isPublished ? 'schedule-open' : workflow.id ? 'draft-badge' : 'closed-badge'}>{isPublished ? 'ประกาศผลแล้ว' : workflow.id ? 'มีฉบับร่าง' : selectedTarget ? 'พร้อมอัปโหลด' : 'รอเลือกรายการสอบ'}</span></div>
      <div className="results-import-setup-steps">
        <div className="results-import-setup-step"><div className="results-import-step-heading"><span className="results-import-step-number">1</span><div><strong>เลือกรายการสอบและรอบ</strong><small>รายชื่อดึงจากรายการสอบที่มีอยู่ในระบบ</small></div></div><select aria-label="เลือกรายการสอบและรอบเพื่อนำเข้าผลสอบ" value={selectedTarget?.id || ''} onChange={(event) => { setTargetId(event.target.value); setConflictsOpen(false); setManualMatches({}); }} required><option value="">เลือกรายการสอบและรอบ</option>{targetOptions.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} · {exam.round || EXAM_ROUND_LABELS[getExamRoundType(exam)]} · {exam.year}</option>)}</select>{!targetOptions.length ? <small className="results-import-step-help">ยังไม่มีรายการสอบในระบบ กรุณาเพิ่มรายการสอบก่อน</small> : null}</div>
        <div className={`results-import-setup-step${!selectedTarget ? ' results-import-setup-step-locked' : ''}`}><div className="results-import-step-heading"><span className="results-import-step-number">2</span><div><strong>อัปโหลดไฟล์ผลสอบ</strong><small>{selectedTarget ? resultTargetLabel(selectedTarget) : 'เลือกข้อ 1 ก่อนเพื่อเปิดการอัปโหลด'}</small></div></div><label className={`file-drop file-drop-inline results-import-file-drop${!selectedTarget || isPublished ? ' file-disabled' : ''}`}><input type="file" accept=".xlsx,.csv" disabled={!selectedTarget || isPublished || busyImport} onChange={(event) => { const file = event.target.files?.[0]; importFile(file); event.target.value = ''; }} /><span className="file-drop-icon"><Icon name={selectedTarget ? 'upload' : 'file'} /></span><span className="file-drop-copy"><strong>{busyImport ? 'กำลังอ่านและจับคู่…' : workflow.fileName || (selectedTarget ? 'เลือกไฟล์ Excel ผลสอบ' : 'รอเลือกรายการสอบ')}</strong><small>ไฟล์ .xlsx หรือ .csv · CANDIDATE NO, GRADE, SCHOOL NAME, CANDIDATE NAME, AWARD</small></span><span className="file-select-label">{isPublished ? 'ล็อกแล้ว' : !selectedTarget ? 'รอเลือก' : workflow.id ? 'แทนฉบับร่าง' : 'เลือกไฟล์'}</span></label></div>
      </div>
    </section>
    {selectedTarget ? <>
      {isPublished ? <div className="notice notice-green"><Icon name="check" /><div><strong>ประกาศผล {resultTargetLabel(selectedTarget)} แล้ว</strong><p>ผลสอบแสดงในหน้าประกาศผลและล็อกไม่ให้แก้ไข</p></div></div> : null}
      <div className="results-admin-grid"><section className="surface import-card">
        <div className="section-heading"><div><p className="eyebrow">ตรวจข้อมูลก่อนประกาศ</p><h2>ผลการนำเข้า · {resultTargetLabel(selectedTarget)}</h2></div><span className={isPublished ? 'schedule-open' : 'draft-badge'}>{isPublished ? 'ประกาศแล้ว' : workflow.id ? 'ฉบับร่าง' : 'รอไฟล์'}</span></div>
        {workflow.id ? <div className="import-summary"><span className="summary-icon summary-green"><Icon name="check" /></span><div><strong>{isPublished ? 'ประกาศผลแล้ว · ล็อกข้อมูล' : 'บันทึกฉบับร่างแล้ว'}</strong><small>บันทึก {rows.length} รายการ · {workflow.fileName}</small></div><span className="summary-pill">มีสิทธิ์ Final {finalEligibleRows.length} ราย</span></div> : null}
        <div className="results-count-strip"><span><strong>{rows.length}</strong> ผู้เข้าสอบ</span><span><strong>{finalEligibleRows.length}</strong> มีสิทธิ์ไป Final</span><span><strong>{matchedRows.length}</strong> จับคู่ได้</span><button type="button" className={`results-count-review ${hasConflict ? 'has-conflicts' : 'all-clear'}`} disabled={!workflow.id} aria-label={`${issueRows.length} รายการที่ต้องตรวจ · กดเพื่อเปิดรายการ`} title="กดเพื่อเปิดรายการที่ต้องตรวจ" aria-haspopup="dialog" aria-expanded={conflictsOpen} onClick={() => setConflictsOpen(true)}><strong>{issueRows.length}</strong><span className="results-review-action">รายการที่ต้องตรวจ</span><span className="results-review-indicator" aria-hidden="true"><Icon name="cursor" size={18} /></span></button></div>
        <div className="results-award-breakdown" aria-label="จำนวนผู้เข้าสอบตามรางวัล">{awardBreakdown.map(({ award, count }) => <div className={`results-award-count award-count-${award.toLowerCase().replaceAll(' ', '-')}`} key={award}><span>{award}</span><strong>{count}</strong></div>)}</div>
        <div className="result-preview-heading"><div><strong>รายชื่อผู้เข้าสอบทั้งหมด</strong><small>ตรวจเลขสอบ ระดับชั้น โรงเรียน ชื่อ และรางวัลก่อนประกาศ</small></div><span>{rows.length} ราย</span></div>
        {rows.length ? <div className="responsive-table admin-results-table-wrap"><table className="admin-results-table"><thead><tr><th>CANDIDATE NO</th><th>GRADE</th><th>SCHOOL NAME</th><th>CANDIDATE NAME</th><th>AWARD</th><th>จับคู่</th></tr></thead><tbody>{rows.map((row) => <tr className={row.matchStatus !== 'matched' ? 'admin-result-row-unmatched' : ''} key={row.id}><td data-label="CANDIDATE NO"><strong className="mono-number">{row.candidateNo}</strong></td><td data-label="GRADE">{row.grade}</td><td data-label="SCHOOL NAME">{row.schoolName}</td><td data-label="CANDIDATE NAME">{row.candidateName}</td><td data-label="AWARD"><span className={`award-badge award-${String(row.award || '').toLowerCase().replaceAll(' ', '-')}`}>{row.award}</span></td><td data-label="จับคู่">{row.matchStatus === 'matched' ? <span className="match-status match-ok"><Icon name="check" size={13} />จับคู่แล้ว</span> : <span className="match-status match-wait"><Icon name="info" size={13} />{row.matchNote || (row.matchStatus === 'data_mismatch' ? 'ข้อมูลไม่ตรง' : row.matchStatus === 'duplicate' ? 'เลขซ้ำ' : 'ไม่พบเลขสอบ')}</span>}</td></tr>)}</tbody></table></div> : <div className="empty-inline"><Icon name="info" /><span>นำเข้าไฟล์ผลสอบของรายการนี้เพื่อสร้างฉบับร่าง</span></div>}
        <div className="publish-box"><div><strong>{isPublished ? 'ประกาศผลแล้ว' : 'ยืนยันประกาศผล'}</strong><small>{isPublished ? 'ประกาศผลแล้วและล็อกข้อมูล' : hasConflict ? `ยังประกาศไม่ได้ · แก้รายการที่ต้องตรวจอีก ${issueRows.length} รายการ` : getExamRoundType(selectedTarget) === 'HEAT' ? 'เมื่อประกาศ Heat ผู้ได้เหรียญ หรือผู้ได้อันดับ 1st–3rd ของ BBB จะได้สิทธิ์ Final อัตโนมัติ' : 'เมื่อประกาศแล้วจะแสดงผลสาธารณะและล็อกข้อมูล'}</small></div><Button icon="check" disabled={!workflow.id || hasConflict || isPublished || !rows.length} onClick={() => onPublishResult(selectedTarget)}>{isPublished ? 'ผลสอบถูกล็อก' : 'ประกาศผล'}</Button></div>
      </section></div>
      {conflictsOpen ? <div className="results-conflict-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConflictsOpen(false); }}><section className="results-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="results-conflict-title">
        <div className="results-conflict-dialog-head"><div><p className="eyebrow">ตรวจสอบก่อนประกาศผล</p><h2 id="results-conflict-title">รายการที่ต้องตรวจ</h2><small>ยืนยันหรือจับคู่กับใบสมัครของรอบนี้ให้ครบก่อนประกาศ</small></div><span className={hasConflict ? 'conflict-count' : 'conflict-count conflict-count-clear'}>{issueRows.length} รายการ</span><button type="button" className="results-conflict-close" aria-label="ปิดหน้าต่าง" onClick={() => setConflictsOpen(false)}><Icon name="close" size={18} /></button></div>
        <div className="results-conflict-dialog-body">{!issueRows.length ? <div className="resolved-state"><span><Icon name="check" /></span><div><strong>ไม่พบรายการผิดปกติ</strong><p>ฉบับร่างพร้อมสำหรับตรวจสอบก่อนประกาศ</p></div></div> : <div className="conflict-list">{issueRows.map((row) => {
          const linked = applications.find((application) => (application.competitions || []).some((item) => item.applicationItemId === row.applicationItemId));
          const rowItem = applicationItems.find(({ item }) => item.applicationItemId === row.applicationItemId);
          return <article className="conflict-item" key={row.id}><div className="conflict-label"><span className="conflict-icon"><Icon name="info" /></span><div><strong>{row.matchNote || 'ตรวจการจับคู่ผลสอบ'}</strong><small>แถว {row.rowNumber} · เลขสอบ {row.candidateNo} · {row.candidateName}</small></div></div><p>{resultTargetLabel(selectedTarget)} · {row.grade}<br />โรงเรียนในไฟล์: {row.schoolName || '—'}{row.applicationItemId ? <><br />พบใบสมัคร: {rowItem?.application.candidate || linked?.candidate || row.applicationCandidateName} · {rowItem?.application.school || row.applicationSchoolName || '—'}</> : null}</p>
            {row.matchStatus === 'data_mismatch' ? <div className="conflict-actions"><Button variant="outline" icon="check" onClick={() => resolve(row, 'use_application')}>ใช้ข้อมูลจากใบสมัคร</Button><Button variant="text" icon="check" onClick={() => resolve(row, 'confirm')}>ยืนยันข้อมูลในไฟล์</Button></div> : <div className="conflict-actions"><select aria-label={`เลือกใบสมัครจับคู่แถว ${row.rowNumber}`} value={manualMatches[row.id] || ''} onChange={(event) => setManualMatches((current) => ({ ...current, [row.id]: event.target.value }))}><option value="">เลือกใบสมัครในรอบนี้</option>{applicationItems.map(({ application, item }) => <option key={item.applicationItemId} value={item.applicationItemId}>{application.candidate} · {application.school} · {item.examNumber || 'ยังไม่มีเลขสอบ'}</option>)}</select><Button variant="outline" disabled={!manualMatches[row.id]} onClick={() => resolve(row, 'manual_match', manualMatches[row.id])}>จับคู่กับใบสมัคร</Button></div>}
          </article>;
        })}</div>}</div>
      </section></div> : null}
    </> : null}
  </div>;
}

function AdminFinalIdsPage({ applications, examCatalog, publishedHeatResults, onImport, onResolveRow, onApply, notify, navigate }) {
  const finalRounds = examCatalog.filter((exam) => getExamRoundType(exam) === 'FINAL');
  const [roundId, setRoundId] = useState('');
  const target = finalRounds.find((exam) => exam.id === roundId) || null;
  const [workflowRecord, setWorkflowRecord] = useState({ targetId: '', workflow: null });
  const workflow = workflowRecord.targetId === target?.id ? workflowRecord.workflow : null;
  function setWorkflow(value) {
    setWorkflowRecord((current) => ({ targetId: target?.id || '', workflow: typeof value === 'function' ? value(current.targetId === target?.id ? current.workflow : null) : value }));
  }
  const [fileBusy, setFileBusy] = useState(false);
  const [manualMatches, setManualMatches] = useState({});
  const [loading, setLoading] = useState(false);
  const eligibleHeatItems = new Set((publishedHeatResults || []).filter((result) => result.eligibleForFinal)
    .map((result) => `${result.applicationId}::${result.competitionId}::${result.grade}`));
  const targetApplications = applications.filter((application) => application.year === target?.year && application.competitions?.some((item) => item.roundId === target?.id));
  const applicationItems = targetApplications.flatMap((application) => application.competitions
    .filter((item) => item.roundId === target?.id && item.applicationItemId && eligibleHeatItems.has(`${application.sourceHeatId}::${item.id}::${item.grade}`))
    .map((item) => ({ application, item })));
  const rows = workflow?.rows || [];
  const conflicts = rows.filter((row) => row.matchStatus !== 'matched');
  const matchedCount = rows.length - conflicts.length;

  useEffect(() => {
    if (!target || !BACKEND_ENABLED) { setWorkflow(null); return undefined; }
    let active = true;
    setLoading(true);
    fetch(`/api/admin/final-ids?roundId=${encodeURIComponent(target.id)}`, { credentials: 'same-origin' })
      .then(async (response) => { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'โหลดเลข Final ไม่สำเร็จ'); return result.workflow; })
      .then((result) => { if (active) setWorkflow(result || null); })
      .catch((error) => { if (active) notify(error?.message || 'โหลดเลข Final ไม่สำเร็จ'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [target?.id]);

  async function chooseFile(file) {
    if (!file || !target || fileBusy) return;
    setFileBusy(true);
    try {
      const parsed = await parseAdminWorkbook(file, false);
      const imported = await onImport(target, file.name, parsed);
      setWorkflow(imported);
    } catch (error) { notify(error?.message || 'นำเข้าเลข Final ไม่สำเร็จ'); }
    finally { setFileBusy(false); }
  }

  async function resolve(row, action, applicationItemId = '') {
    try {
      const updated = await onResolveRow(row.id, action, applicationItemId);
      setWorkflow(updated);
      setManualMatches((current) => ({ ...current, [row.id]: '' }));
    } catch (error) { notify(error?.message || 'แก้การจับคู่เลข Final ไม่สำเร็จ'); }
  }

  async function applyNumbers() {
    if (!target || conflicts.length || !rows.length || workflow?.applied) return;
    const applied = await onApply(target);
    if (!applied) return;
    setWorkflow((current) => current ? { ...current, applied: true } : current);
    try {
      const response = await fetch(`/api/admin/final-ids?roundId=${encodeURIComponent(target.id)}`, { credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'โหลดสถานะเลข Final ไม่สำเร็จ');
      setWorkflow(result.workflow || null);
    } catch { notify('บันทึกเลข Final แล้ว แต่โหลดสถานะใหม่ไม่สำเร็จ กรุณารีเฟรชหน้า'); }
  }

  return <div className="page-stack">
    <PageHeading eyebrow="ข้อมูลผู้เข้าสอบ Final · ฐานข้อมูลจริง" title="นำเข้าและจับคู่เลข Final" description="เลือกรายการสอบ Final ก่อนนำเข้าไฟล์จากผู้จัดเพื่อตรวจข้อมูลและบันทึกเลข" />
    <section className="surface results-import-setup" aria-label="เตรียมนำเข้าเลขประจำตัว Final">
      <div className="results-import-setup-heading"><div><p className="eyebrow">เลขประจำตัว Final</p><h2>เตรียมไฟล์เลขประจำตัว</h2><p>เลือกรอบ Final ที่สร้างไว้ แล้วอัปโหลดไฟล์จากผู้จัดเพื่อจับคู่ใบสมัคร</p></div><span className={workflow?.applied ? 'schedule-open' : workflow?.id ? 'draft-badge' : 'closed-badge'}>{workflow?.applied ? 'บันทึกเลขแล้ว' : workflow?.id ? `รอตรวจ ${conflicts.length} รายการ` : target ? 'พร้อมอัปโหลด' : 'รอเลือกรายการสอบ'}</span></div>
      <div className="results-import-setup-steps">
        <div className="results-import-setup-step"><div className="results-import-step-heading"><span className="results-import-step-number">1</span><div><strong>เลือกรายการสอบและรอบ Final</strong><small>แสดงรอบ Final ที่มีอยู่ในรายการสอบ</small></div></div><select aria-label="เลือกรายการสอบและรอบ Final" value={target?.id || ''} onChange={(event) => { setRoundId(event.target.value); setWorkflow(null); setManualMatches({}); }} required><option value="">เลือกรายการสอบและรอบ Final</option>{finalRounds.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} · {exam.round || EXAM_ROUND_LABELS.FINAL} · {exam.year}</option>)}</select>{!finalRounds.length ? <small className="results-import-step-help">ยังไม่มีรายการสอบรอบ Final ในระบบ</small> : null}</div>
        <div className={`results-import-setup-step${!target ? ' results-import-setup-step-locked' : ''}`}><div className="results-import-step-heading"><span className="results-import-step-number">2</span><div><strong>อัปโหลดเลขประจำตัว Final</strong><small>{target ? `${target.title} · ปี ${target.year}` : 'เลือกข้อ 1 ก่อนเพื่อเปิดการอัปโหลด'}</small></div></div><label className={`file-drop file-drop-inline results-import-file-drop${!target || workflow?.applied ? ' file-disabled' : ''}`}><input type="file" accept=".xlsx,.csv" disabled={!target || fileBusy || workflow?.applied} onChange={(event) => { const file = event.target.files?.[0]; chooseFile(file); event.target.value = ''; }} /><span className="file-drop-icon"><Icon name={target ? 'upload' : 'file'} /></span><span className="file-drop-copy"><strong>{fileBusy ? 'กำลังอ่านและจับคู่…' : workflow?.fileName || (target ? 'เลือกไฟล์ Excel เลขประจำตัว Final' : 'รอเลือกรายการสอบ Final')}</strong><small>ไฟล์ .xlsx หรือ .csv · CANDIDATE NO, CANDIDATE NAME, SCHOOL NAME และ GRADE (ถ้ามี)</small></span><span className="file-select-label">{workflow?.applied ? 'ล็อกแล้ว' : !target ? 'รอเลือก' : workflow?.id ? 'แทนฉบับร่าง' : 'เลือกไฟล์'}</span></label></div>
      </div>
      {workflow?.id ? <div className="results-import-setup-summary import-summary"><span className="summary-icon summary-green"><Icon name="check" /></span><div><strong>{workflow.applied ? 'บันทึกเลข Final แล้ว' : 'บันทึกฉบับร่างแล้ว'}</strong><small>จับคู่อัตโนมัติ {matchedCount} ราย · ต้องตรวจด้วยมือ {conflicts.length} ราย</small></div><span className="summary-pill">{rows.length} ราย</span></div> : null}
    </section>
    {target ? <>
      <section className="surface final-match-table">
        <div className="section-heading"><div><p className="eyebrow">{target.title} · ปี {target.year}</p><h2>ผลการนำเข้าเลข Final</h2></div><div className="match-legend"><span><i className="legend-green" />จับคู่แล้ว</span><span><i className="legend-amber" />รอตรวจ</span></div></div>
        {loading ? <div className="empty-inline"><Icon name="sync" /><span>กำลังโหลดสถานะการนำเข้า…</span></div> : <div className="responsive-table"><table><thead><tr><th>ชื่อภาษาอังกฤษ</th><th>โรงเรียน</th><th>ระดับชั้น</th><th>เลขประจำตัว Final</th><th>สถานะจับคู่</th><th>ดำเนินการ</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.candidateName}</td><td>{row.schoolName}</td><td>{row.grade || '—'}</td><td className="mono-number">{row.candidateNo}</td><td>{row.matchStatus === 'matched' ? <span className="match-status match-ok"><Icon name="check" size={13} />จับคู่แล้ว</span> : <span className="match-status match-wait"><Icon name="info" size={13} />{row.matchNote || 'รอตรวจ'}</span>}</td><td>{row.matchStatus === 'matched' ? <Button variant="text" icon="file" onClick={() => navigate('admin-review', row.applicationId)}>ดูใบสมัคร</Button> : <div className="final-id-row-actions"><select aria-label={`เลือกผู้สมัครจับคู่เลข ${row.candidateNo}`} value={manualMatches[row.id] || ''} onChange={(event) => setManualMatches((current) => ({ ...current, [row.id]: event.target.value }))}><option value="">เลือกใบสมัครในรอบนี้</option>{applicationItems.map(({ application, item }) => <option key={item.applicationItemId} value={item.applicationItemId}>{application.candidate} · {application.school} · {item.grade}</option>)}</select><Button variant="outline" disabled={!manualMatches[row.id]} onClick={() => resolve(row, 'manual_match', manualMatches[row.id])}>จับคู่</Button></div>}</td></tr>)}</tbody></table></div>}
        {!loading && !rows.length ? <div className="empty-inline"><Icon name="info" /><span>{workflow?.applied ? 'บันทึกเลข Final แล้ว แต่ไม่พบใบสมัครในรอบนี้' : 'เลือกไฟล์ Excel เพื่อเริ่มจับคู่เลข Final'}</span></div> : null}
        <div className="publish-box"><div><strong>{workflow?.applied ? 'บันทึกเลข Final แล้ว' : 'ยืนยันบันทึกเลข Final'}</strong><small>{workflow?.applied ? 'เลขถูกบันทึกลงใบสมัครแล้วและล็อกฉบับนำเข้า' : conflicts.length ? `แก้รายการที่ต้องตรวจก่อน (${conflicts.length} รายการ)` : 'เลขที่จับคู่แล้วจะถูกบันทึกลงใบสมัคร Final'}</small></div><Button icon="check" disabled={!workflow?.id || workflow?.applied || conflicts.length > 0 || !rows.length} onClick={applyNumbers}>{workflow?.applied ? 'บันทึกแล้ว' : 'บันทึกเลข Final'}</Button></div>
      </section>
      <div className="table-footnote"><Icon name="info" size={15} />ไฟล์ที่บันทึกแล้วจะแสดงเลขบนใบสมัคร Final และข้อมูลผู้เข้าสอบ</div>
    </> : null}
  </div>;
}

function GoogleDriveConnectionCard() {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refreshStatus() {
    if (!BACKEND_ENABLED) return;
    try {
      const response = await fetch('/api/admin/google-workspace/status', { credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "อ่านสถานะ Google Drive ไม่สำเร็จ");
      setStatus(result);
    } catch (error) { setMessage(error.message || "อ่านสถานะ Google Drive ไม่สำเร็จ"); }
  }
  useEffect(() => { refreshStatus(); }, []);
  async function connectGoogle() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch('/api/admin/google-workspace/connect', { method: 'POST', credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "เริ่มเชื่อม Google Drive ไม่สำเร็จ");
      window.location.assign(result.authorizationUrl);
    } catch (error) { setMessage(error.message || "เริ่มเชื่อม Google Drive ไม่สำเร็จ"); setBusy(false); }
  }
  async function prepareFolders() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch('/api/admin/google-workspace/initialize-drive', { method: 'POST', credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "เตรียมโฟลเดอร์ Google Drive ไม่สำเร็จ");
      await refreshStatus(); setMessage("สร้างโฟลเดอร์ OCEC Portal ใน Google Drive แล้ว");
    } catch (error) { setMessage(error.message || "เตรียมโฟลเดอร์ Google Drive ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  const missingWorkspaceScopes = (status?.missingScopes || []).filter((scope) => scope.includes("gmail.send") || scope.includes("spreadsheets"));
  const scopeLabels = missingWorkspaceScopes.map((scope) => scope.includes("gmail.send") ? "Gmail API" : "Google Sheets API").filter((label, index, labels) => labels.indexOf(label) === index);
  return <section className="surface sync-demo-control google-drive-connection">
    <div><span className="sync-demo-icon"><Icon name="upload" /></span><div><strong>บัญชี Google สำหรับ Drive, Gmail และ Sheets</strong><p>{status?.connected ? `เชื่อมต่อแล้ว · ${status.accountEmail}` : status?.configured ? "เชื่อมบัญชี Google ที่ใช้เก็บไฟล์และส่งอีเมล" : "ต้องตั้งค่า OAuth และ encryption key ใน environment ก่อนเชื่อมบัญชี"}</p>{status?.connected ? <small>{status.foldersInitialized ? "โฟลเดอร์ Drive พร้อมใช้งาน" : "ระบบจะเตรียมโฟลเดอร์ Drive เมื่อมีการอัปโหลดไฟล์"}{scopeLabels.length ? ` · ต้องเพิ่มสิทธิ์ ${scopeLabels.join(" และ ")} ใน Google Auth Platform แล้วเชื่อมบัญชีใหม่` : " · สิทธิ์ Gmail และ Sheets พร้อมใช้งาน"}</small> : null}{message ? <small role="status">{message}</small> : null}</div></div>
    {status?.connected ? <div className="final-id-row-actions">
      {!status.foldersInitialized ? <Button variant="outline" disabled={busy} onClick={prepareFolders}>{busy ? "กำลังเตรียม…" : "เตรียมโฟลเดอร์ Drive"}</Button> : <span className="schedule-open">Drive พร้อม</span>}
      {scopeLabels.length ? <Button variant="outline" disabled={busy} onClick={connectGoogle}>{busy ? "กำลังเชื่อม…" : "เชื่อมใหม่เพื่อเพิ่มสิทธิ์"}</Button> : null}
    </div> : <Button variant="outline" disabled={busy || !status?.configured} onClick={connectGoogle}>{busy ? "กำลังเชื่อม…" : "เชื่อมบัญชี Google"}</Button>}
  </section>;
}

function AdminSheetsPage() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function refresh() {
    try {
      const response = await fetch("/api/admin/integrations/status", { credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "อ่านสถานะ integration ไม่สำเร็จ");
      setData(result); setMessage("");
    } catch (error) { setMessage(error.message || "อ่านสถานะ integration ไม่สำเร็จ"); }
  }
  useEffect(() => {
    if (!BACKEND_ENABLED) return undefined;
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, []);
  const counts = (data?.queue?.counts || []).reduce((all, row) => ({ ...all, [`${row.kind}:${row.status}`]: row.count }), {});
  const jobs = data?.queue?.jobs || [];
  const syncFailedCount = counts["sheets.sync_item:failed"] || 0;
  const pendingCount = (counts["sheets.sync_item:pending"] || 0) + (counts["gmail.send:pending"] || 0);
  async function syncApprovedItems() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/sheets/sync", { method: "POST", credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "เพิ่มงานซิงก์ไม่สำเร็จ");
      setMessage(`เพิ่ม ${result.queued} รายการเข้าคิวซิงก์แล้ว`); await refresh();
    } catch (error) { setMessage(error.message || "เพิ่มงานซิงก์ไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  async function retryJob(id) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/integration-jobs/${id}/retry`, { method: "POST", credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "เริ่มงานซ้ำไม่สำเร็จ");
      await refresh();
    } catch (error) { setMessage(error.message || "เริ่มงานซ้ำไม่สำเร็จ"); }
    finally { setBusy(false); }
  }
  const formatTime = (value) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
  return (
    <div className="page-stack">
      <PageHeading eyebrow="การเชื่อมต่อข้อมูล" title="สถานะ Google Sheets" description="ซิงก์เฉพาะใบสมัครที่อนุมัติแล้ว · แยก workbook ตามปีและ tab ตามรายการสอบ/รอบ · การแก้ไขในชีตไม่เขียนกลับเข้าเว็บ" action={<Button variant="outline" icon="sync" disabled={busy || !BACKEND_ENABLED} onClick={refresh}>รีเฟรชสถานะ</Button>} />
      {BACKEND_ENABLED ? <GoogleDriveConnectionCard /> : <div className="notice notice-amber"><Icon name="info" /><div><strong>ยังไม่ได้เปิด backend จริง</strong><p>เปิด VITE_BACKEND_ENABLED และเชื่อมฐานข้อมูลก่อนดูสถานะ integration</p></div></div>}
      {message ? <div className="notice notice-blue" role="status"><Icon name="info" /><div><p>{message}</p></div></div> : null}
      <div className="sheets-grid">
        <section className="surface sheets-status-card"><span className={"sheets-status-icon " + (syncFailedCount ? "sheets-status-wait" : "")}><Icon name={syncFailedCount ? "sync" : "check"} /></span><p className="eyebrow">รายการที่อนุมัติ</p><h2>{data?.queue?.sheets?.synced_items ?? "—"} / {data?.queue?.sheets?.approved_items ?? "—"}</h2><p>รายการที่ซิงก์แล้ว / รายการที่อนุมัติและต้องซิงก์</p><div className="sheets-last-sync"><span>งานรอเริ่ม</span><strong>{pendingCount + (counts["sheets.sync_item:failed"] || 0) + (counts["gmail.send:failed"] || 0)} งาน</strong></div><Button variant="outline" icon="sync" disabled={busy || !data?.workspace?.connected} onClick={syncApprovedItems}>{busy ? "กำลังเพิ่มคิว…" : "ซิงก์ใบสมัครที่อนุมัติแล้ว"}</Button></section>
        <section className="surface sheets-activity"><div className="section-heading"><div><p className="eyebrow">Google Sheets</p><h2>Workbook ที่สร้างแล้ว</h2></div></div>
          {(data?.queue?.workbooks || []).length ? <div className="activity-list">{data.queue.workbooks.map((book) => <div className="activity-row" key={book.academic_year}><span className="activity-mark activity-ok"><Icon name="file" size={13} /></span><div><strong>{book.title}</strong><small>ปีการศึกษา {book.academic_year} · อัปเดต {formatTime(book.updated_at)}</small></div><a href={book.spreadsheet_url} target="_blank" rel="noreferrer">เปิดชีต</a></div>)}</div> : <div className="empty-inline"><Icon name="info" /><span>จะสร้าง workbook เมื่อมีใบสมัครที่อนุมัติแล้วเข้าคิว</span></div>}
          <p className="sheets-rule"><Icon name="info" size={15} />หนึ่งแถวต่อ Application Item ID · ถ้าสมัคร 3 รายการจะแยกอยู่ 3 tab ตามรอบ</p>
        </section>
      </div>
      <section className="surface sheets-activity"><div className="section-heading"><div><p className="eyebrow">คิวส่งข้อมูล</p><h2>งานล่าสุด</h2></div></div>
        {jobs.length ? <div className="activity-list">{jobs.map((job) => <div className={"activity-row " + (job.status === "failed" ? "activity-row-failed" : "")} key={job.id}><span className={"activity-mark " + (job.status === "completed" ? "activity-ok" : job.status === "failed" ? "activity-wait" : "")}><Icon name={job.status === "completed" ? "check" : job.status === "failed" ? "info" : "clock"} size={13} /></span><div><strong>{job.kind === "gmail.send" ? "ส่งอีเมล" : "ซิงก์ Google Sheets"} · {job.status === "completed" ? "เสร็จแล้ว" : job.status === "failed" ? "ส่งไม่สำเร็จ" : job.status === "running" ? "กำลังทำงาน" : "รอคิว"}</strong><small>{job.last_error || `สร้าง ${formatTime(job.created_at)} · ลองแล้ว ${job.attempts} ครั้ง`}</small></div>{job.status === "failed" ? <Button variant="text" disabled={busy} onClick={() => retryJob(job.id)}>ลองอีกครั้ง</Button> : null}</div>)}</div> : <div className="empty-inline"><Icon name="info" /><span>ยังไม่มีงานอีเมลหรือชีต</span></div>}
      </section>
    </div>
  );
}

function RegistrationLoginGate({ kind }) {
  return (
    <section className="surface registration-login-gate" aria-labelledby="registration-login-title">
      <span className="registration-login-icon"><Icon name="shield" size={22} /></span>
      <p className="eyebrow">{kind === "Final" ? "OCEC Final" : "OCEC Portal"}</p>
      <h1 id="registration-login-title">เข้าสู่ระบบเพื่อเริ่มสมัคร</h1>
      <p>เมื่อเข้าสู่ระบบแล้ว ฟอร์มสมัครสอบจะเปิดขึ้นที่หน้านี้ คุณสามารถกรอกข้อมูลผู้สมัครและติดตามใบสมัครผ่านบัญชีได้</p>
    </section>
  );
}

function FinalAccessGate({ navigate }) {
  return <section className="surface registration-login-gate" aria-labelledby="final-access-title"><span className="registration-login-icon"><Icon name="award" size={22} /></span><p className="eyebrow">OCEC Final</p><h1 id="final-access-title">ยืนยันสิทธิ์ก่อนสมัคร Final</h1><p>เริ่มจากตรวจสอบใบสมัคร Heat ที่ผ่านการคัดเลือก แล้วระบบจะนำข้อมูลเดิมมาเติมในฟอร์ม Final ให้</p><Button icon="arrow" onClick={() => navigate("final-confirm")}>ไปหน้ายืนยันสิทธิ์</Button></section>;
}

function schoolBatchesFromApplications(applications) {
  const batches = new Map();
  (applications || []).filter((application) => application.batchId).forEach((application) => {
    const batch = batches.get(application.batchId) || { id: application.batchId, source: "backend", applicationIds: [], invoiceTotal: application.invoiceTotal || 0, paymentSlipFileName: application.slipFileName || "", paymentId: application.paymentId || "" };
    batch.applicationIds.push(application.id);
    batches.set(batch.id, batch);
  });
  return [...batches.values()];
}

function App() {
  const [page, setPage] = useState(() => routeFromLocation().page);
  const [persona, setPersona] = useState(() => routeFromLocation().page.startsWith("admin-") ? "admin" : "coordinator");
  const [adminPortalPath, setAdminPortalPath] = useState(isAdminPortalPath);
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarDay, setCalendarDay] = useState(getBangkokTodayISO);
  const [centerCatalog, setCenterCatalog] = useState(BACKEND_ENABLED ? [] : DEFAULT_CENTER_CATALOG);
  const [applications, setApplications] = useState([]);
  const [publicEditApplication, setPublicEditApplication] = useState(null);
  const [publicEditCredentials, setPublicEditCredentials] = useState(null);
  const [schoolBatches, setSchoolBatches] = useState([]);
  const defaultPhysicalCenterIds = DEFAULT_CENTER_CATALOG.filter((center) => center.code !== ONLINE_CENTER_CODE).map((center) => center.id);
  const [examCatalog, setExamCatalog] = useState(() => BACKEND_ENABLED ? [] : demoExamCatalog.map((exam) => ({
    ...exam,
    centerIds: [...defaultPhysicalCenterIds],
    gradeOptions: [...(FORM_COMPETITIONS.find((competition) => competition.id === exam.competitionId)?.grades || DEFAULT_GRADE_CATALOG)],
  })));
  const [competitionCatalog, setCompetitionCatalog] = useState(() => BACKEND_ENABLED ? [] : DEFAULT_COMPETITION_CATALOG);
  const [gradeCatalog, setGradeCatalog] = useState(BACKEND_ENABLED ? [] : DEFAULT_GRADE_CATALOG);
  const [gradeCatalogEntries, setGradeCatalogEntries] = useState([]);
  const [competitionFees, setCompetitionFees] = useState({ heatOnline: 655, heatOnsite: 755, finalOnline: 1350, finalOnsite: 1550 });
  const [pastPaperCatalog, setPastPaperCatalog] = useState(BACKEND_ENABLED ? [] : DEMO_PAST_PAPERS);
  const [paymentAccounts, setPaymentAccounts] = useState(BACKEND_ENABLED ? [] : DEFAULT_PAYMENT_ACCOUNTS);
  const [savedCatalogSnapshot, setSavedCatalogSnapshot] = useState(null);
  const [catalogSaveState, setCatalogSaveState] = useState({ status: "idle", error: "" });
  const [autoSaveRequested, setAutoSaveRequested] = useState(false);
  const catalogSaveInFlightRef = useRef(false);
  const lastFailedCatalogSignatureRef = useRef("");
  const latestCatalogSignatureRef = useRef("");
  const [activeApplicationId, setActiveApplicationId] = useState(() => routeFromLocation().applicationId);
  const [toast, setToast] = useState("");
  const [authProfile, setAuthProfile] = useState(null);
  const [authChecked, setAuthChecked] = useState(!BACKEND_ENABLED);
  const [finalAccess, setFinalAccess] = useState(null);
  const [resultWorkflows, setResultWorkflows] = useState({});
  const [apiPublishedResults, setApiPublishedResults] = useState([]);
  useEffect(() => {
    if (!BACKEND_ENABLED) return undefined;
    const controller = new AbortController();
    async function loadBackendState() {
      try {
        const [catalogResponse, authResponse] = await Promise.all([
          fetch('/api/catalog', { signal: controller.signal }),
          fetch('/api/auth/me', { signal: controller.signal, credentials: 'same-origin' }),
        ]);
        if (!catalogResponse.ok || !authResponse.ok) throw new Error('Backend unavailable');
        const [catalog, auth] = await Promise.all([catalogResponse.json(), authResponse.json()]);
        if (controller.signal.aborted) return;
        setExamCatalog(catalog.exams);
        setCompetitionCatalog(catalog.competitions || DEFAULT_COMPETITION_CATALOG);
        setGradeCatalog(catalog.grades.map((grade) => grade.label));
        setGradeCatalogEntries(catalog.grades);
        setCenterCatalog(catalog.centers);
        setPastPaperCatalog(catalog.pastPapers);
        setPaymentAccounts(catalog.paymentAccounts);
        setSavedCatalogSnapshot({ exams: catalog.exams, competitions: catalog.competitions || DEFAULT_COMPETITION_CATALOG, grades: catalog.grades.map((grade) => grade.label), centers: catalog.centers, pastPapers: catalog.pastPapers, paymentAccounts: catalog.paymentAccounts });
        setAuthProfile(auth.user);
        setAuthChecked(true);
        if (auth.user) {
          const applicationsResponse = await fetch(auth.user.isAdmin ? '/api/admin/applications' : '/api/applications/mine', { signal: controller.signal, credentials: 'same-origin' });
          if (!applicationsResponse.ok) throw new Error('Could not load saved applications');
          const applicationData = await applicationsResponse.json();
          if (controller.signal.aborted) return;
          const savedApplications = applicationData.applications || [];
          setApplications(savedApplications);
          setSchoolBatches(schoolBatchesFromApplications(savedApplications));
        } else {
          setApplications([]);
          setSchoolBatches([]);
        }
        const publicResultsResponse = await fetch('/api/results', { signal: controller.signal });
        if (publicResultsResponse.ok) {
          const publicResults = await publicResultsResponse.json();
          if (!controller.signal.aborted) setApiPublishedResults(publicResults.results || []);
        }
        if (auth.user?.isAdmin) {
          const [resultsResponse] = await Promise.all([
            fetch('/api/admin/results', { signal: controller.signal, credentials: 'same-origin' }),
          ]);
          if (resultsResponse.ok) {
            const resultData = await resultsResponse.json();
            if (!controller.signal.aborted) setResultWorkflows(resultData.workflows || {});
          }
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setAuthChecked(true);
          setToast('ไม่สามารถเชื่อมต่อข้อมูลจริงได้ กรุณาตรวจสอบ Portal API');
        }
      }
    }
    loadBackendState();
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setCalendarDay(getBangkokTodayISO()), millisecondsUntilBangkokMidnight());
    return () => window.clearTimeout(timer);
  }, [calendarDay]);
  const demoPublishedResultRows = Object.entries(resultWorkflows).flatMap(([targetId, workflow]) => {
    if (!workflow.published) return [];
    const target = examCatalog.find((exam) => exam.id === targetId);
    if (!target) return [];
    return (workflow.rows || []).map((row) => ({
      ...row,
      targetId,
      competitionId: target.competitionId,
      competitionTitle: target.title,
      roundType: getExamRoundType(target),
      round: target.round || EXAM_ROUND_LABELS[getExamRoundType(target)],
      publishedAt: workflow.publishedAt || "",
      year: target.year,
    }));
  });
  const publishedResultRows = BACKEND_ENABLED ? apiPublishedResults : demoPublishedResultRows;
  const publishedHeatResults = publishedResultRows.filter((row) => row.roundType === "HEAT");
  const resultPublished = publishedHeatResults.length > 0;
  const effectiveExamCatalog = getFinalRegistrationCatalog(examCatalog, applications, publishedHeatResults, calendarDay);
  const registrationOpen = effectiveExamCatalog.some((exam) => exam.isOpen);
  const catalogSnapshot = { exams: examCatalog, competitions: competitionCatalog, grades: gradeCatalog, centers: centerCatalog, pastPapers: pastPaperCatalog, paymentAccounts };
  const catalogSignature = JSON.stringify(catalogSnapshot);
  latestCatalogSignatureRef.current = catalogSignature;
  const catalogDirty = BACKEND_ENABLED && Boolean(savedCatalogSnapshot) && catalogSignature !== JSON.stringify(savedCatalogSnapshot);
  const dirtyExamIds = savedCatalogSnapshot ? examCatalog.filter((exam) => JSON.stringify(exam) !== JSON.stringify(savedCatalogSnapshot.exams.find((saved) => saved.id === exam.id))).map((exam) => exam.id) : [];
  const catalogPage = page === "admin-round" || page === "admin-form-options";
  useEffect(() => {
    if (!BACKEND_ENABLED || !catalogDirty || !(page === "admin-form-options" || autoSaveRequested) || catalogSaveState.status === "saving" || catalogSignature === lastFailedCatalogSignatureRef.current) return undefined;
    const timer = window.setTimeout(() => { saveAdminCatalog({ silent: true }); }, 1100);
    return () => window.clearTimeout(timer);
  }, [page, catalogDirty, catalogSignature, autoSaveRequested, catalogSaveState.status]);
  useEffect(() => {
    if (!catalogDirty && autoSaveRequested && catalogSaveState.status !== "saving") setAutoSaveRequested(false);
  }, [catalogDirty, autoSaveRequested, catalogSaveState.status]);
  useEffect(() => {
    if (!catalogPage || !catalogDirty) return undefined;
    const warnBeforeUnload = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [catalogPage, catalogDirty]);
  const activeApplication = applications.find((item) => item.id === activeApplicationId) || applications[0];
  const adminEditApplication = applications.find((item) => item.id === activeApplicationId);
  const activeEditableApplication = publicEditApplication?.id === activeApplicationId
    ? publicEditApplication
    : applications.find((item) => item.id === activeApplicationId);
  const visibleApplications = persona === "coordinator" || persona === "admin"
    ? applications
    : persona === "guest"
      ? applications.filter((item) => item.owner === "guest")
      : applications.filter((item) => item.owner === "candidate");
  const pageTitle = pageLabels[page] || pageLabels.home;
  const requiresRegistrationLogin = !authProfile && page === "apply-heat";

  useEffect(() => {
    const syncRoute = () => {
      const route = routeFromLocation();
      const canonicalPath = routeUrlFor(route.page, route.applicationId);
      const currentPath = window.location.pathname;
      if (route.legacy || (route.page !== "not-found" && currentPath !== canonicalPath)) {
        window.history.replaceState(null, "", `${canonicalPath}${window.location.search}`);
      }
      setAdminPortalPath(isAdminPortalPath() || route.page.startsWith('admin-'));
      setPage(route.page);
      setActiveApplicationId(route.applicationId || "");
      if (route.page !== "edit-application") {
        setPublicEditApplication(null);
        setPublicEditCredentials(null);
      }
    };
    window.addEventListener("popstate", syncRoute);
    syncRoute();
    return () => {
      window.removeEventListener("popstate", syncRoute);
    };
  }, []);

  useEffect(() => {
    if (!adminPortalPath || !authChecked) return;
    if (authProfile?.isAdmin) {
      setPersona("admin");
      if (page === "admin-login") {
        setPage("admin-home");
        window.history.replaceState(null, "", routeUrlFor("admin-home"));
      }
      return;
    }
    if (page !== "admin-login" && page !== "not-found") {
      setPage("admin-login");
      window.history.replaceState(null, "", ADMIN_PORTAL_PATH);
    }
  }, [adminPortalPath, authChecked, authProfile?.isAdmin, page]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function navigate(nextPage, applicationId) {
    if (catalogPage && catalogDirty && nextPage !== page && !window.confirm("มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")) return;
    if (nextPage !== "edit-application") {
      setPublicEditApplication(null);
      setPublicEditCredentials(null);
    }
    if (applicationId !== undefined) setActiveApplicationId(applicationId || "");
    setPage(nextPage);
    setMenuOpen(false);
    const isAdminTarget = nextPage.startsWith("admin-");
    const targetUrl = routeUrlFor(nextPage, applicationId || (nextPage === "application-detail" || nextPage === "edit-application" || nextPage === "admin-review" || nextPage === "admin-application-edit" || nextPage === "slip-upload" || nextPage === "edit-verify" ? activeApplicationId : ""));
    setAdminPortalPath(isAdminTarget);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl !== targetUrl) window.history.pushState(null, "", targetUrl);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function startApplication() {
    setPersona("candidate");
    navigate("apply-heat");
  }

  function notify(message) {
    setToast(message);
  }

  function signInWithGoogleDemo() {
    if (BACKEND_ENABLED) {
      window.location.assign(`/api/auth/google/start?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    notify("โหมดตัวอย่างอ่านอย่างเดียว · เปิด Portal API เพื่อเข้าสู่ระบบและสมัครจริง");
  }

  function signInAdmin() {
    if (!BACKEND_ENABLED) {
      notify("ระบบหลังบ้านต้องเปิด VITE_BACKEND_ENABLED=true ก่อน");
      return;
    }
    const returnTo = routeUrlFor("admin-home");
    window.location.assign(`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function signOut() {
    if (BACKEND_ENABLED) {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
      catch { notify('ออกจากระบบไม่สำเร็จ กรุณาลองใหม่'); return; }
    }
    const wasAdminPortal = isAdminPortalPath();
    setAuthProfile(null);
    setPersona("coordinator");
    setApplications([]);
    setSchoolBatches([]);
    setPublicEditApplication(null);
    setPublicEditCredentials(null);
    setActiveApplicationId("");
    setMenuOpen(false);
    if (wasAdminPortal) {
      setPage("admin-login");
      window.history.replaceState(null, "", ADMIN_PORTAL_PATH);
      setAdminPortalPath(true);
    } else {
      setPage("home");
      window.history.replaceState(null, "", routeUrlFor("home"));
      setAdminPortalPath(false);
    }
    notify("ออกจากระบบแล้ว");
  }

  function updateApplication(id, updates) {
    setApplications((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item));
  }

  function saveAdminApplication(id, updates) {
    if (BACKEND_ENABLED) {
      return (async () => {
        const response = await fetch(`/api/admin/applications/${encodeURIComponent(id)}`, {
          method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(updates.adminEditPayload),
        });
        const responseText = await response.text().catch(() => '');
        let body = {};
        try { body = responseText ? JSON.parse(responseText) : {}; } catch { body = { message: responseText.slice(0, 240) }; }
        if (!response.ok) {
          const errorMessage = body.error || body.message || '';
          const missingRoute = response.status === 404 && (/^not found$/i.test(errorMessage) || /Route PATCH .* not found/i.test(errorMessage));
          if (missingRoute) throw new Error('Portal API ยังไม่ได้โหลดเส้นทางแก้ไขใบสมัคร · รีสตาร์ต Portal API แล้วเปิดหน้าแอดมินใหม่');
          if (response.status === 404) throw new Error(/application not found/i.test(errorMessage)
            ? 'ไม่พบใบสมัครนี้ในฐานข้อมูลที่กำลังเชื่อมต่อ · โหลดรายการใบสมัครใหม่แล้วลองอีกครั้ง'
            : `ไม่พบข้อมูลสำหรับบันทึก (HTTP 404)${errorMessage ? ` · ${errorMessage}` : ''}`);
          if (response.status === 401 || response.status === 403) throw new Error(`ไม่มีสิทธิ์บันทึกหรือหมดเวลาเข้าสู่ระบบ · ${errorMessage || `HTTP ${response.status}`}`);
          throw new Error(errorMessage || `บันทึกการแก้ไขไม่สำเร็จ (HTTP ${response.status})`);
        }
        try {
          await refreshApplicationData();
        } catch {
          // PATCH succeeded; a follow-up list refresh must not make the save look unsuccessful.
        }
        notify(body.result?.additionalDue ? `บันทึกแล้ว · ยอดชำระเพิ่ม ${fmtAdminMoney(body.result.additionalDue)}` : 'บันทึกการแก้ไขใบสมัครแล้ว');
        navigate('admin-review', id);
      })();
    }
    const current = applications.find((item) => item.id === id);
    if (!current) return;
    const next = { ...current, ...updates };
    const displayCompetitions = (application) => (application.competitions || []).map((item) => `${item.short || item.name} (${item.grade || "ไม่ระบุชั้น"} · ${getApplicationCompetitionFormat(application, item) === "Online" ? `Online Exam · ${getApplicationCompetitionExamEmail(application, item) || "ไม่มีอีเมล"}` : "Paper-Based"} · ${getApplicationCompetitionCenter(application, item) || "—"})`).join(", ") || "ไม่มีรายการ";
    const displayAddress = (information = {}) => [information.address1, information.address2, information.city, information.province, information.postalCode].filter(Boolean).join(" ") || "—";
    const fields = [
      ["ชื่อภาษาอังกฤษ", current.candidate, next.candidate],
      ["โรงเรียน", current.school, next.school],
      ["อีเมลติดต่อ", current.contactEmail, next.contactEmail],
      ["เบอร์โทรศัพท์", getApplicationPhone(current), getApplicationPhone(next)],
      ["ที่อยู่", displayAddress(current.studentInformation), displayAddress(next.studentInformation)],
      ["รายการสอบและรายละเอียด", displayCompetitions(current), displayCompetitions(next)],
      ["รูปแบบสอบ", getApplicationFormatSummary(current), getApplicationFormatSummary(next)],
      ["ศูนย์สอบ", getApplicationCenterSummary(current), getApplicationCenterSummary(next)],
      ["อีเมลเข้าสอบ Online", current.examEmail, next.examEmail],
      ["ค่าสมัครสอบ", fmtAdminMoney(current.registrationFee), fmtAdminMoney(next.registrationFee)],
      ["ส่วนต่างที่ไม่คืน/ไม่นำไปหัก", fmtAdminMoney(current.nonRefundableAdjustment), fmtAdminMoney(next.nonRefundableAdjustment)],
      ["ยอดชำระรวม", fmtAdminMoney(current.totalPayment), fmtAdminMoney(next.totalPayment)],
    ];
    const changes = fields.filter(([, oldValue, newValue]) => oldValue !== newValue).map(([label, oldValue, newValue]) => ({ label, oldValue: oldValue || "—", newValue: newValue || "—" }));
    if (updates.additionalSlipFileName && updates.additionalSlipFileName !== current.additionalSlipFileName) changes.push({ label: "สลิปค่าใช้จ่ายเพิ่มเติม", oldValue: current.additionalSlipFileName || "ไม่มีไฟล์", newValue: updates.additionalSlipFileName });
    if (!changes.length) { notify("ไม่มีข้อมูลเปลี่ยนแปลง"); return; }
    const at = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
    const entry = { id: `audit-${Date.now()}`, editor: "ผู้ดูแลระบบ · Aommy", at, changes };
    updateApplication(id, { ...updates, phoneLast4: (updates.phone || "").replace(/\D/g, "").slice(-4), changeHistory: [entry, ...(current.changeHistory || [])] });
    notify("บันทึกการแก้ไขตัวอย่างแล้ว · เพิ่มประวัติผู้แก้ เวลา และค่าก่อน–หลัง");
    navigate("admin-review", id);
  }

  function updateExam(id, updates) {
    setExamCatalog((current) => current.map((exam) => exam.id === id ? { ...exam, ...updates } : exam));
  }

  async function setExamManualClosed(id, manualClosed) {
    if (!BACKEND_ENABLED) {
      const today = getBangkokTodayISO();
      setExamCatalog((current) => current.map((exam) => exam.id === id ? {
        ...exam,
        finalManuallyClosed: manualClosed,
        isOpen: !manualClosed && Boolean(exam.openDate && exam.closeDate && exam.openDate <= today && today <= exam.closeDate),
      } : exam));
      return true;
    }
    const response = await fetch(`/api/admin/exams/${encodeURIComponent(id)}`, {
      method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ manualClosed }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'บันทึกสถานะรายการสอบไม่สำเร็จ');
    const today = getBangkokTodayISO();
    setExamCatalog((current) => current.map((exam) => exam.id === id ? {
      ...exam,
      ...result.exam,
      finalManuallyClosed: manualClosed,
      isOpen: !manualClosed && Boolean(exam.openDate && exam.closeDate && exam.openDate <= today && today <= exam.closeDate),
    } : exam));
    return result.exam;
  }

  async function saveAdminCatalog(options = {}) {
    if (!BACKEND_ENABLED) { notify("โหมดตัวอย่างยังไม่ได้เชื่อมฐานข้อมูล"); return false; }
    if (catalogSaveInFlightRef.current) return false;
    const silent = options?.silent === true;
    const attemptedSignature = catalogSignature;
    catalogSaveInFlightRef.current = true;
    lastFailedCatalogSignatureRef.current = "";
    setCatalogSaveState({ status: "saving", error: "" });
    const selectedPaymentAccountId = paymentAccounts.find((account) => account.active !== false && account.showInForm !== false)?.id || "";
    const normalizedPaymentAccounts = paymentAccounts.map((account) => ({
      ...account,
      showInForm: Boolean(selectedPaymentAccountId && account.id === selectedPaymentAccountId),
    }));
    const grades = gradeCatalog.map((label, index) => ({
      id: gradeCatalogEntries.find((entry) => entry.label === label)?.id || `grade-${label.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "")}`,
      label,
      sortOrder: index + 1,
    }));
    try {
      const response = await fetch('/api/admin/catalog', {
        method: 'PUT', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ exams: examCatalog, competitions: competitionCatalog, grades, centers: centerCatalog, pastPapers: pastPaperCatalog, paymentAccounts: normalizedPaymentAccounts }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "บันทึกข้อมูลตั้งต้นไม่สำเร็จ");
      const catalog = result.catalog;
      setGradeCatalogEntries(catalog.grades);
      if (latestCatalogSignatureRef.current === attemptedSignature) {
        setExamCatalog(catalog.exams);
        setCompetitionCatalog(catalog.competitions || []);
        setGradeCatalog(catalog.grades.map((grade) => grade.label));
        setCenterCatalog(catalog.centers);
        setPastPaperCatalog(catalog.pastPapers);
        setPaymentAccounts(catalog.paymentAccounts);
        setAutoSaveRequested(false);
      }
      setSavedCatalogSnapshot({ exams: catalog.exams, competitions: catalog.competitions || [], grades: catalog.grades.map((grade) => grade.label), centers: catalog.centers, pastPapers: catalog.pastPapers, paymentAccounts: catalog.paymentAccounts });
      setCatalogSaveState({ status: "saved", error: "" });
      if (!silent) notify("บันทึกข้อมูลแล้ว");
      return true;
    } catch (error) {
      const message = error?.message || "บันทึกข้อมูลตั้งต้นไม่สำเร็จ";
      lastFailedCatalogSignatureRef.current = attemptedSignature;
      setCatalogSaveState({ status: "error", error: message });
      if (!silent) notify(message);
      return false;
    } finally { catalogSaveInFlightRef.current = false; }
  }

  async function saveAdminExam(id) {
    if (!BACKEND_ENABLED || catalogSaveInFlightRef.current) return false;
    const exam = examCatalog.find((item) => item.id === id);
    if (!exam) return false;
    const attemptedExamSignature = JSON.stringify(exam);
    catalogSaveInFlightRef.current = true;
    setCatalogSaveState({ status: "saving", error: "", examId: id });
    const patch = {
      title: exam.title,
      openDate: exam.openDate || null,
      closeDate: exam.closeDate || null,
      editCloseDate: exam.editCloseDate || null,
      examDate: exam.examDate || null,
      examStartTime: exam.examStartTime || null,
      examEndTime: exam.examEndTime || null,
      finalConfirmCloseDate: exam.finalConfirmCloseDate || null,
      accent: exam.accent || null,
      logoDataUrl: exam.logoDataUrl || "",
      description: exam.description || "",
      prices: exam.prices || { paperBased: 0, onlineExam: 0 },
      gradeOptions: exam.gradeOptions || [],
      centerIds: exam.centerIds || [],
    };
    try {
      const response = await fetch(`/api/admin/exams/${encodeURIComponent(id)}`, {
        method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify(patch),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "บันทึกรายการสอบไม่สำเร็จ");
      if (!result.exam) throw new Error("ไม่พบข้อมูลรายการสอบหลังบันทึก");
      setExamCatalog((current) => current.map((item) => item.id === id && JSON.stringify(item) === attemptedExamSignature ? result.exam : item));
      setSavedCatalogSnapshot((current) => current ? { ...current, exams: current.exams.map((item) => item.id === id ? result.exam : item) } : current);
      setCatalogSaveState({ status: "saved", error: "" });
      notify(`บันทึก ${exam.title} ${exam.round || ""} แล้ว`);
      return true;
    } catch (error) {
      const message = error?.message || "บันทึกรายการสอบไม่สำเร็จ";
      setCatalogSaveState({ status: "error", error: message, examId: id });
      return false;
    } finally { catalogSaveInFlightRef.current = false; }
  }

  function addExam(exam) {
    setExamCatalog((current) => [...current, exam]);
  }

  function removeExam(id) {
    setExamCatalog((current) => current.filter((exam) => exam.id !== id));
  }

  async function refreshApplicationData() {
    if (!BACKEND_ENABLED || !authProfile) return [];
    const endpoint = authProfile.isAdmin ? '/api/admin/applications' : '/api/applications/mine';
    const response = await fetch(endpoint, { credentials: 'same-origin' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'โหลดใบสมัครจากฐานข้อมูลไม่สำเร็จ');
    const savedApplications = body.applications || [];
    setApplications(savedApplications);
    setSchoolBatches(schoolBatchesFromApplications(savedApplications));
    return savedApplications;
  }

  async function refreshApplicationsAfterAdminMutation() {
    try {
      await refreshApplicationData();
      return "";
    } catch {
      return " · บันทึกแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณารีเฟรชหน้า";
    }
  }

  async function submitApplication(values) {
    const applicants = values.batchApplications?.length ? values.batchApplications : [values];
    if (BACKEND_ENABLED) {
      try {
        const toCandidatePayload = (applicant) => {
          const examYear = applicant.examYear || values.examYear || getActiveExamYear(examCatalog, applicant.kind === "Final" ? "FINAL" : "HEAT");
          const roundType = applicant.kind === "Final" ? "FINAL" : "HEAT";
          const items = (applicant.examListings || []).map((listing) => {
            const round = examCatalog.find((exam) => exam.competitionId === listing.id && exam.year === examYear && getExamRoundType(exam) === roundType);
            const grade = gradeCatalogEntries.find((item) => item.label === listing.grade);
            if (!round || !grade) throw new Error(`ไม่พบข้อมูลรอบสอบหรือระดับชั้นของ ${listing.short || listing.name}`);
            return {
              roundId: round.id,
              gradeId: grade.id,
              format: normalizeExamFormat(listing.format) === "Online" ? "online" : "paper",
              centerId: listing.centerId,
              ...(normalizeExamFormat(listing.format) === "Online" ? { examEmail: listing.examEmail || applicant.examEmail || "" } : {}),
            };
          });
          const information = applicant.studentInformation || applicant;
          const school = applicant.school || (information.schoolName === "Other" ? information.certificateSchoolName : information.schoolName) || "";
          return {
            applicant: {
              firstNameEn: information.firstName || applicant.firstName || "",
              middleNameEn: information.middleName || applicant.middleName || "",
              lastNameEn: information.lastName || applicant.lastName || "",
              firstNameTh: information.thaiFirstName || applicant.thaiFirstName || "",
              lastNameTh: information.thaiLastName || applicant.thaiLastName || "",
              gender: information.gender || applicant.gender || "",
              certificateSchoolName: information.certificateSchoolName || applicant.certificateSchoolName || "",
              dateOfBirth: information.dateOfBirth || applicant.dateOfBirth || "",
              schoolName: school,
              contactEmail: applicant.contactEmail || information.email || applicant.email || "",
              contactPhone: information.phone || applicant.phone || "",
              address: {
                address1: information.address1 || applicant.address1 || "",
                address2: information.address2 || applicant.address2 || "",
                city: information.city || applicant.city || "",
                province: information.province || applicant.province || "",
                postalCode: information.postalCode || applicant.postalCode || "",
              },
            },
            items,
            pastPaperIds: (applicant.pastPaperSelections || []).map((paper) => paper.id),
            marketingConsent: Boolean(applicant.marketingConsent ?? values.schoolBatch?.marketingConsent),
            ...(applicant.sourceHeatId ? { sourceHeatApplicationId: applicant.sourceHeatId } : {}),
          };
        };
        const slipFile = values.schoolBatch?.paymentSlipFile || applicants[0]?.slipFile;
        if (!slipFile?.dataUrl) throw new Error("กรุณาแนบสลิปการชำระเงินก่อนส่งใบสมัคร");
        const slip = { fileName: slipFile.name || values.schoolBatch?.paymentSlipFileName || "payment-slip", mimeType: slipFile.type, dataBase64: slipFile.dataUrl.split(",")[1] || "" };
        const body = values.schoolBatch
          ? { schoolName: applicants[0]?.school || applicants[0]?.studentInformation?.schoolName || "", source: values.schoolBatch.source || "manual", applicants: applicants.map(toCandidatePayload), slip }
          : { ...toCandidatePayload(applicants[0]), source: applicants[0].kind === "Final" ? "final" : applicants[0].source || "self", slip };
        const response = await fetch(values.schoolBatch ? '/api/school-batches/submit' : '/api/applications/submit', {
          method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 409 && result.existingApplicationId) {
            await refreshApplicationData();
            setActiveApplicationId(result.existingApplicationId);
            setPersona(values.schoolBatch ? "coordinator" : "candidate");
            notify("พบใบสมัครรายการนี้อยู่แล้ว กำลังเปิดใบสมัครเดิม");
            navigate("application-detail", result.existingApplicationId);
            return { ok: true };
          }
          throw new Error(result.error || "ส่งใบสมัครไม่สำเร็จ");
        }
        const savedApplications = await refreshApplicationData();
        const firstId = values.schoolBatch ? result.batch?.applicationIds?.[0] : result.application?.id;
        if (!firstId) throw new Error("ส่งใบสมัครแล้ว แต่ระบบไม่ส่งเลขอ้างอิงกลับมา");
        setActiveApplicationId(firstId);
        setPersona(values.schoolBatch ? "coordinator" : "candidate");
        notify(values.schoolBatch ? `ส่งใบสมัคร ${result.batch.applicationIds.length} คนและบันทึกลงฐานข้อมูลแล้ว · ยอดรวม ฿${Number(result.batch.total || 0).toLocaleString()}` : "ส่งใบสมัครและบันทึกลงฐานข้อมูลแล้ว");
        navigate("application-detail", firstId);
        return { ok: true, applications: savedApplications };
      } catch (error) {
        const message = error?.message === "School name must be the same for all applicants in a batch"
          ? "ชื่อโรงเรียนในชุดใบสมัครต้องตรงกันทุกคน กรุณาตรวจชื่อโรงเรียนของผู้สมัครแต่ละคน"
          : error?.message || "ส่งใบสมัครไม่สำเร็จ กรุณาลองอีกครั้ง";
        notify(message);
        return { ok: false, error: message };
      }
    }
    notify("โหมดตัวอย่างอ่านอย่างเดียว · ไม่ได้บันทึกใบสมัคร");
    return { ok: false, error: "โหมดตัวอย่างอ่านอย่างเดียว · ไม่ได้บันทึกใบสมัคร" };

  }

  async function saveApplication(id, form, publicCredentials = null) {
    const publicAccess = Boolean(publicCredentials);
    if (BACKEND_ENABLED) {
      try {
        const information = form.studentInformation || {};
        const profile = {
          firstNameEn: form.nameParts?.firstName || form.firstName || information.firstName || "",
          middleNameEn: information.middleName || "",
          lastNameEn: form.nameParts?.lastName || form.lastName || information.lastName || "",
          firstNameTh: information.thaiFirstName || "",
          lastNameTh: information.thaiLastName || "",
          schoolName: form.school || information.school || "",
          contactEmail: form.contactEmail || information.email || "",
          contactPhone: form.phone || information.phone || "",
          address: { address1: information.address1 || "", address2: information.address2 || "", city: information.city || "", province: information.province || "", postalCode: information.postalCode || "" },
        };
        const response = await fetch(publicAccess ? `/api/public/applications/${encodeURIComponent(id)}/profile` : `/api/applications/${encodeURIComponent(id)}/profile`, {
          method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify(publicAccess ? { identity: publicCredentials, profile } : profile),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "บันทึกการแก้ไขไม่สำเร็จ");
        if (publicAccess) {
          setPublicEditApplication(result.application);
          setPublicEditCredentials({ candidateName: result.application.candidate, phoneLast4: result.application.phoneLast4 });
          notify("บันทึกการแก้ไขแล้ว · สถานะใบสมัครคงเดิม");
          navigate("check-status");
          return;
        }
        await refreshApplicationData();
        notify("บันทึกการแก้ไขลงฐานข้อมูลแล้ว · สถานะการอนุมัติคงเดิม");
        navigate("application-detail", id);
        return;
      } catch (error) { notify(error?.message || "บันทึกการแก้ไขไม่สำเร็จ"); return; }
    }
    const updatedApplication = { ...form, phoneLast4: form.phone.replace(/\D/g, "").slice(-4) };
    updateApplication(id, updatedApplication);
    if (publicAccess) {
      setPublicEditApplication((current) => current?.id === id ? { ...current, ...updatedApplication } : current);
      setPublicEditCredentials({ candidateName: updatedApplication.candidate, phoneLast4: updatedApplication.phoneLast4 });
      notify("บันทึกการแก้ไขแล้ว · สถานะใบสมัครคงเดิม");
      navigate("check-status");
      return;
    }
    notify("บันทึกการแก้ไขแล้ว สถานะใบสมัครยังคงยืนยันใบสมัคร");
    navigate("application-detail", id);
  }

  async function saveCertificatePhoto(id, certificatePhoto) {
    if (!BACKEND_ENABLED) throw new Error("กรุณาเปิด backend ก่อนอัปโหลดรูปเกียรติบัตร");
    try {
      const response = await fetch(`/api/applications/${encodeURIComponent(id)}/certificate-photo`, {
        method: certificatePhoto ? "POST" : "DELETE",
        credentials: "same-origin",
        ...(certificatePhoto ? { headers: { "content-type": "application/json" }, body: JSON.stringify(certificatePhoto) } : {}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "บันทึกรูปเกียรติบัตรไม่สำเร็จ");
      await refreshApplicationData();
      notify(certificatePhoto ? "อัปโหลดรูปเกียรติบัตรไปยัง Google Drive แล้ว" : "ลบรูปเกียรติบัตรแล้ว");
      return result;
    } catch (error) {
      notify(error?.message || "บันทึกรูปเกียรติบัตรไม่สำเร็จ");
      throw error;
    }
  }

  async function approveApplication(id, paymentId = null) {
    const item = applications.find((entry) => entry.id === id);
    if (BACKEND_ENABLED) {
      try {
        const response = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/review`, {
          method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision: 'approve', ...(paymentId ? { paymentId } : {}) }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'อนุมัติใบสมัครไม่สำเร็จ');
        const refreshWarning = await refreshApplicationsAfterAdminMutation();
        notify((result.paymentOnly ? 'ยืนยันยอดชำระเพิ่มแล้ว' : result.waitingPayments ? 'Portal API ยังใช้เงื่อนไขอนุมัติเวอร์ชันเก่า · กรุณารีสตาร์ต API แล้วลองอีกครั้ง' : 'อนุมัติใบสมัครแล้ว') + refreshWarning);
        return;
      } catch (error) {
        notify(error?.message || 'อนุมัติใบสมัครไม่สำเร็จ กรุณาลองอีกครั้ง');
        return;
      }
    }
    updateApplication(id, { status: "confirmed", canEdit: true });
    notify("อนุมัติใบสมัครแล้ว อีเมลแจ้งผลส่งไปยัง " + (item?.contactEmail || "อีเมลผู้เข้าสอบ"));
  }

  async function rejectApplication(id, reason) {
    if (reason?.trim().length > 240) { notify("เหตุผลต้องไม่เกิน 240 ตัวอักษร"); return false; }
    if (!BACKEND_ENABLED) { notify("โหมดตัวอย่างยังไม่ได้เชื่อมฐานข้อมูล"); return false; }
    try {
      const response = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/review`, {
        method: "PATCH", credentials: "same-origin", headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision: "reject", reason: reason?.trim() || "" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "ไม่อนุมัติใบสมัครไม่สำเร็จ");
      const refreshWarning = await refreshApplicationsAfterAdminMutation();
      notify("บันทึกการไม่อนุมัติและเข้าคิวส่งอีเมลแจ้งผู้สมัครแล้ว" + refreshWarning);
      return true;
    } catch (error) { notify(error?.message || "ไม่อนุมัติใบสมัครไม่สำเร็จ"); return false; }
  }

  async function notifySlipIssue(id, issue, paymentId = null) {
    const item = applications.find((entry) => entry.id === id);
    if (BACKEND_ENABLED) {
      try {
        const response = await fetch(`/api/admin/applications/${encodeURIComponent(id)}/review`, {
          method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ decision: 'slip_issue', reason: issue, ...(paymentId ? { paymentId } : {}) }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'บันทึกปัญหาสลิปไม่สำเร็จ');
        const refreshWarning = await refreshApplicationsAfterAdminMutation();
        notify((result.emailRecipient === 'coordinator'
          ? 'บันทึกปัญหาสลิปแล้ว · สร้างลิงก์ใช้ครั้งเดียวและเข้าคิวแจ้งผู้ประสานงาน'
          : 'บันทึกปัญหาสลิปแล้ว · สร้างลิงก์ใช้ครั้งเดียวและเข้าคิวส่งอีเมล') + refreshWarning);
        return;
      } catch (error) {
        notify(error?.message || 'บันทึกปัญหาสลิปไม่สำเร็จ กรุณาลองอีกครั้ง');
        return;
      }
    }
    updateApplication(id, { slipIssue: issue });
    notify("ส่งเทมเพลต “" + issue + "” พร้อมลิงก์อัปโหลดไปยัง " + (item?.contactEmail || "อีเมลผู้เข้าสอบ"));
  }

  async function generateHeatIds(examId) {
    const targetExam = examCatalog.find((exam) => exam.id === examId);
    if (!targetExam || getExamRoundType(targetExam) !== 'HEAT') return false;
    if (!BACKEND_ENABLED) { notify('กรุณาเปิด backend เพื่อสร้างเลขสอบลงฐานข้อมูล'); return false; }
    try {
      const response = await fetch(`/api/admin/exams/${encodeURIComponent(examId)}/exam-numbers`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'สร้างเลขประจำตัวสอบไม่สำเร็จ');
      const refreshWarning = await refreshApplicationsAfterAdminMutation();
      notify(`สร้างเลขประจำตัวสอบ ${targetExam.title} ${targetExam.round || EXAM_ROUND_LABELS.HEAT} แล้ว · ใหม่ ${result.assigned} ราย · มีเลขเดิม ${result.alreadyAssigned} ราย${refreshWarning}`);
      return true;
    } catch (error) { notify(error?.message || 'สร้างเลขประจำตัวสอบไม่สำเร็จ'); return false; }
  }

  async function importFinalIds(target, fileName, rows) {
    if (!BACKEND_ENABLED) throw new Error('กรุณาเปิด backend เพื่อนำเข้าเลข Final');
    const response = await fetch(`/api/admin/exams/${encodeURIComponent(target.id)}/final-ids/draft`, {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName, rows }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'นำเข้าเลข Final ไม่สำเร็จ');
    notify(`บันทึกเลข Final ${result.workflow.rows.length} รายการเป็นฉบับร่างแล้ว`);
    return result.workflow;
  }

  async function resolveFinalIdRow(rowId, action, applicationItemId = '') {
    const response = await fetch(`/api/admin/final-id-import-rows/${encodeURIComponent(rowId)}/resolve`, {
      method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...(applicationItemId ? { applicationItemId } : {}) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'แก้รายการจับคู่เลข Final ไม่สำเร็จ');
    return result.workflow;
  }

  async function saveFinalIds(target) {
    if (!target || !window.confirm(`ยืนยันบันทึกเลขประจำตัว Final ${target.title} ${target.year} ลงใบสมัครที่จับคู่แล้วหรือไม่?`)) return;
    try {
      const response = await fetch(`/api/admin/exams/${encodeURIComponent(target.id)}/final-ids/apply`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'บันทึกเลข Final ไม่สำเร็จ');
      const refreshWarning = await refreshApplicationsAfterAdminMutation();
      notify(`บันทึกเลขประจำตัว Final ลงใบสมัคร ${result.rows} รายแล้ว${refreshWarning}`);
      return true;
    } catch (error) { notify(error?.message || 'บันทึกเลข Final ไม่สำเร็จ'); return false; }
  }

  async function importResultDraft(target, fileName, rows) {
    if (!BACKEND_ENABLED) throw new Error('กรุณาเปิด backend เพื่อนำเข้าผลสอบ');
    const response = await fetch(`/api/admin/exams/${encodeURIComponent(target.id)}/results/draft`, {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName, rows }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'นำเข้าผลสอบไม่สำเร็จ');
    setResultWorkflows((current) => ({ ...current, [target.id]: result.workflow }));
    notify(`นำเข้าผลสอบ ${result.workflow.rows.length} รายการและบันทึกเป็นฉบับร่างแล้ว`);
    return result.workflow;
  }

  async function resolveResultConflict(targetId, rowId, action, applicationItemId = '') {
    const response = await fetch(`/api/admin/result-import-rows/${encodeURIComponent(rowId)}/resolve`, {
      method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...(applicationItemId ? { applicationItemId } : {}) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'แก้รายการจับคู่ผลสอบไม่สำเร็จ');
    setResultWorkflows((current) => ({ ...current, [targetId]: result.workflow }));
    notify('บันทึกการตรวจจับคู่ผลสอบแล้ว');
    return result.workflow;
  }

  async function publishResults(target) {
    const currentWorkflow = resultWorkflows[target.id] || {};
    if (!currentWorkflow.id || !currentWorkflow.rows?.length) { notify('ยังไม่มีผลสอบฉบับร่าง'); return; }
    const unresolvedCount = currentWorkflow.rows.filter((row) => row.matchStatus !== 'matched').length;
    if (unresolvedCount) { notify(`ยังประกาศผลไม่ได้ · กรุณาแก้รายการที่ต้องตรวจอีก ${unresolvedCount} รายการ`); return; }
    if (!window.confirm(`ยืนยันประกาศผล ${resultTargetLabel(target)} หรือไม่? เมื่อประกาศแล้วระบบจะแสดงผลสาธารณะและล็อกข้อมูล`)) return;
    try {
      const response = await fetch(`/api/admin/exams/${encodeURIComponent(target.id)}/results/publish`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'ประกาศผลสอบไม่สำเร็จ');
      let refreshWarning = '';
      try {
        const [publicResponse, workflowResponse, catalogResponse] = await Promise.all([
          fetch('/api/results'), fetch('/api/admin/results', { credentials: 'same-origin' }), fetch('/api/catalog'),
        ]);
        if (!publicResponse.ok || !workflowResponse.ok || !catalogResponse.ok) throw new Error('Refresh failed');
        setApiPublishedResults((await publicResponse.json()).results || []);
        setResultWorkflows((await workflowResponse.json()).workflows || {});
        setExamCatalog((await catalogResponse.json()).exams || []);
      } catch {
        refreshWarning = ' · ประกาศแล้ว แต่โหลดข้อมูลใหม่ไม่สำเร็จ กรุณารีเฟรชหน้า';
      }
      notify(`ประกาศผล ${resultTargetLabel(target)} แล้ว · ผู้มีสิทธิ์ Final ${result.eligibleForFinal} ราย · เปิดรอบ Final อัตโนมัติ ${result.openedFinalRounds} รอบ${refreshWarning}`);
    } catch (error) { notify(error?.message || 'ประกาศผลสอบไม่สำเร็จ'); }
  }

  function confirmFinalFromApplicationCard(application) {
    if (BACKEND_ENABLED) { navigate("final-confirm"); return; }
    if (!authProfile?.email || authProfile.isAdmin || application?.source !== "self"
      || application.contactEmail?.toLowerCase() !== authProfile.email.toLowerCase()) return;
    const availableRounds = getEligibleFinalRounds(application, effectiveExamCatalog, publishedHeatResults, calendarDay);
    if (!availableRounds.length) {
      notify("ขณะนี้ไม่มีรอบ Final ที่เปิดให้ยืนยันสิทธิ์สำหรับใบสมัครนี้");
      return;
    }
    setFinalAccess({ heatId: application.id, mode: "account", allowedRoundIds: availableRounds.map((round) => round.id) });
    setPersona("candidate");
    navigate("apply-final", application.id);
  }

  function continueVerifiedFinal(choice) {
    const { applicant, item } = choice;
    const exam = examCatalog.find((round) => round.id === item.roundId);
    const grade = gradeCatalogEntries.find((entry) => entry.id === item.gradeId);
    const center = centerCatalog.find((entry) => entry.id === item.centerId);
    if (!exam || !grade || !center) { notify("ข้อมูลรอบสอบไม่ครบ กรุณาลองใหม่"); return; }
    const prefill = {
      id: choice.sourceHeatApplicationId, year: item.year,
      candidate: [applicant.firstNameEn, applicant.middleNameEn, applicant.lastNameEn].filter(Boolean).join(" "),
      school: applicant.schoolName, contactEmail: applicant.contactEmail, center: center.name,
      competitions: [{ id: exam.competitionId, grade: grade.label, format: item.format === "online" ? "Online" : "Paper-Based", center: center.name, centerId: center.id, examEmail: item.examEmail }],
      studentInformation: {
        firstName: applicant.firstNameEn, middleName: applicant.middleNameEn || "", lastName: applicant.lastNameEn,
        thaiFirstName: applicant.firstNameTh || "", thaiLastName: applicant.lastNameTh || "",
        dateOfBirth: applicant.dateOfBirth, phone: applicant.contactPhone, email: applicant.contactEmail,
        address1: applicant.address?.address1 || "", address2: applicant.address?.address2 || "",
        city: applicant.address?.city || "", province: applicant.address?.province || "", postalCode: applicant.address?.postalCode || "",
      },
    };
    setFinalAccess({ heatId: choice.sourceHeatApplicationId, mode: "account", allowedRoundIds: [item.roundId], prefill });
    setPersona("candidate");
    navigate("apply-final", choice.sourceHeatApplicationId);
  }

  const content = (() => {
    switch (page) {
      case "not-found":
        return <NotFoundPage navigate={navigate} />;
      case "admin-login":
        return <AdminLoginPage authProfile={authProfile} authChecked={authChecked} backendEnabled={BACKEND_ENABLED} onSignIn={signInAdmin} onSignOut={signOut} />;
      case "apply-heat":
        return <ApplicationFormPage key={page} kind="Heat" onSubmit={submitApplication} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} centerCatalog={centerCatalog} pastPaperCatalog={pastPaperCatalog} paymentAccounts={paymentAccounts} />;
      case "apply-final":
        return authProfile && finalAccess && finalAccess.heatId === activeApplicationId
          ? <ApplicationFormPage key={`${page}-${activeApplicationId}`} kind="Final" prefill={finalAccess.prefill || activeApplication} applicationMode={finalAccess.mode} allowedRoundIds={finalAccess.allowedRoundIds} onSubmit={submitApplication} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} centerCatalog={centerCatalog} pastPaperCatalog={pastPaperCatalog} paymentAccounts={paymentAccounts} />
          : <FinalAccessGate navigate={navigate} />;
      case "applications":
        return <ApplicationsPage applications={visibleApplications} navigate={navigate} resultRows={publishedResultRows} examCatalog={effectiveExamCatalog} today={calendarDay} authProfile={authProfile} onConfirmFinal={confirmFinalFromApplicationCard} />;
      case "school-application-group":
        return <SchoolApplicationGroupPage applications={visibleApplications} groupKey={activeApplicationId} navigate={navigate} />;
      case "application-detail":
        return <ApplicationDetailPage application={applications.find((item) => item.id === activeApplicationId)} navigate={navigate} resultRows={publishedResultRows} examCatalog={effectiveExamCatalog} today={calendarDay} authProfile={authProfile} hasFinalApplication={applications.some((item) => item.kind === "Final" && item.sourceHeatId === activeApplicationId)} onConfirmFinal={confirmFinalFromApplicationCard} onSaveCertificatePhoto={saveCertificatePhoto} />;
      case "check-status":
        return <StatusLookupPage applications={applications} navigate={navigate} />;
      case "lookup-choice":
        return <LookupChoicePage navigate={navigate} />;
      case "edit-verify":
        return <EditVerifyPage applications={applications} onVerified={(application, credentials) => {
          setPublicEditApplication(application);
          setPublicEditCredentials(credentials);
          navigate("edit-application", application.id);
        }} navigate={navigate} />;
      case "edit-application":
        return activeEditableApplication
          ? <EditApplicationPage key={activeApplicationId} application={activeEditableApplication} onSave={saveApplication} navigate={navigate} examCatalog={examCatalog} publicAccess={publicEditApplication?.id === activeApplicationId} publicCredentials={publicEditCredentials} />
          : <section className="surface empty-state"><strong>กรุณายืนยันชื่อและเบอร์โทรศัพท์ก่อนแก้ไขใบสมัคร</strong><Button icon="shield" onClick={() => navigate("edit-verify")}>ไปหน้ายืนยันตัวตน</Button></section>;
      case "slip-upload":
        return <section className="surface empty-state"><strong>ลิงก์อัปโหลดสลิปนี้ใช้ไม่ได้</strong><p>กรุณาเปิดลิงก์เฉพาะจากอีเมลแจ้งแก้ไขสลิป</p><Button onClick={() => navigate("check-status")}>ค้นหาสถานะใบสมัคร</Button></section>;
      case "slip-replacement":
        return <SlipReplacementPage />;
      case "final-confirm":
        return BACKEND_ENABLED
          ? <ApiFinalConfirmationPage authProfile={authProfile} onContinue={continueVerifiedFinal} onSignIn={signInWithGoogleDemo} navigate={navigate} resultPublished={resultPublished} examCatalog={effectiveExamCatalog} />
          : <FinalConfirmationPage key={activeApplicationId} applications={applications} applicationHint={activeApplication} onContinue={() => notify("โหมดตัวอย่างอ่านอย่างเดียว · ไม่ได้ยืนยันสิทธิ์ Final")} navigate={navigate} publishedHeatResults={publishedHeatResults} examCatalog={effectiveExamCatalog} authProfile={authProfile} onSignIn={signInWithGoogleDemo} />;
      case "results":
        return <PublicResultsPage resultRows={publishedResultRows} />;
      case "admin-home":
        return <AdminHomePage applications={applications} examCatalog={effectiveExamCatalog} resultWorkflows={resultWorkflows} navigate={navigate} resultPublished={resultPublished} />;
      case "admin-review":
        return <AdminReviewPage applications={applications} schoolBatches={schoolBatches} onApprove={approveApplication} onReject={rejectApplication} onSlipIssue={notifySlipIssue} notify={notify} navigate={navigate} activeApplicationId={activeApplicationId} />;
      case "admin-application-edit":
        return adminEditApplication
          ? <AdminApplicationEditPage key={activeApplicationId} application={adminEditApplication} onSave={saveAdminApplication} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} centerCatalog={centerCatalog} gradeCatalogEntries={gradeCatalogEntries} />
          : <section className="surface empty-state"><strong>ไม่พบใบสมัครนี้</strong><Button variant="outline" onClick={() => navigate("admin-review")}>กลับไปหน้าใบสมัคร</Button></section>;
      case "admin-mock-papers":
        return <AdminMockPapersPage applications={applications} notify={notify} />;
      case "admin-round":
        return <AdminRoundPage examCatalog={effectiveExamCatalog} onUpdateExam={updateExam} onSetManualClosed={setExamManualClosed} onAddExam={addExam} onRemoveExam={removeExam} onSaveCatalog={saveAdminCatalog} onSaveExam={saveAdminExam} onRequestAutoSave={() => setAutoSaveRequested(true)} dirtyExamIds={dirtyExamIds} catalogSaveState={catalogSaveState} catalogDirty={catalogDirty} registrationOpen={registrationOpen} onGenerateHeatIds={generateHeatIds} centerCatalog={centerCatalog} setCenterCatalog={setCenterCatalog} gradeCatalog={gradeCatalog} setGradeCatalog={setGradeCatalog} competitionCatalog={competitionCatalog} setCompetitionCatalog={setCompetitionCatalog} applications={applications} pastPaperCatalog={pastPaperCatalog} setPastPaperCatalog={setPastPaperCatalog} notify={notify} />;
      case "admin-form-options":
        return <AdminRoundPage pageMode="form-options" examCatalog={examCatalog} onUpdateExam={updateExam} onSetManualClosed={setExamManualClosed} onAddExam={addExam} onRemoveExam={removeExam} onSaveCatalog={saveAdminCatalog} onSaveExam={saveAdminExam} catalogSaveState={catalogSaveState} catalogDirty={catalogDirty} registrationOpen={registrationOpen} onGenerateHeatIds={generateHeatIds} centerCatalog={centerCatalog} setCenterCatalog={setCenterCatalog} gradeCatalog={gradeCatalog} setGradeCatalog={setGradeCatalog} competitionCatalog={competitionCatalog} setCompetitionCatalog={setCompetitionCatalog} applications={applications} pastPaperCatalog={pastPaperCatalog} setPastPaperCatalog={setPastPaperCatalog} paymentAccounts={paymentAccounts} setPaymentAccounts={setPaymentAccounts} notify={notify} />;
      case "admin-results":
        return <AdminResultsPage applications={applications} examCatalog={examCatalog} resultWorkflows={resultWorkflows} onImportDraft={importResultDraft} onResolveConflict={resolveResultConflict} onPublishResult={publishResults} notify={notify} navigate={navigate} />;
      case "admin-final-ids":
        return <AdminFinalIdsPage applications={applications} examCatalog={examCatalog} publishedHeatResults={publishedHeatResults} onImport={importFinalIds} onResolveRow={resolveFinalIdRow} onApply={saveFinalIds} notify={notify} navigate={navigate} />;
      case "admin-sheets":
        return <AdminSheetsPage />;
      default:
        return <HomePage navigate={navigate} persona={persona} applications={visibleApplications} />;
    }
  })();

  const protectedAdminPage = page.startsWith("admin-") && page !== "admin-login";
  if (page === "admin-login" || (protectedAdminPage && (!BACKEND_ENABLED || !authChecked || !authProfile?.isAdmin))) {
    return <AdminLoginPage authProfile={authProfile} authChecked={authChecked} backendEnabled={BACKEND_ENABLED} onSignIn={signInAdmin} onSignOut={signOut} />;
  }

  if (page === "home" && persona !== "admin") {
    return <LandingPage navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={signInWithGoogleDemo} onSignOut={signOut} onStartApplication={startApplication} resultPublished={resultPublished} examCatalog={effectiveExamCatalog} />;
  }

  if (persona !== "admin" && !page.startsWith("admin-")) {
    return <PublicPortalLayout page={page} navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={signInWithGoogleDemo} onSignOut={signOut} toast={toast} setToast={setToast} examCatalog={effectiveExamCatalog}>{requiresRegistrationLogin ? <RegistrationLoginGate kind="Heat" /> : content}</PublicPortalLayout>;
  }

  const shellPersona = page.startsWith("admin-") ? "admin" : persona;
  return (
    <div className={"app-shell " + (shellPersona === "admin" ? "admin-shell" : "")}>
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
      <Sidebar page={page} persona={shellPersona} applications={applications} navigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} notify={notify} activeYear={getActiveExamYear(examCatalog, "HEAT")} />
      <main className="main-column" id="main-content" tabIndex="-1">
        <Topbar title={pageTitle} persona={shellPersona} setPersona={(next) => { setPersona(next); if (next === "admin") navigate("admin-home"); else if (page.startsWith("admin-")) navigate("home"); }} menuOpen={menuOpen} setMenuOpen={setMenuOpen} navigate={navigate} authProfile={authProfile} onSignOut={signOut} activeYear={getActiveExamYear(examCatalog, "HEAT")} />
        <div className="content-wrap">
          {!BACKEND_ENABLED ? <div className="prototype-banner"><Icon name="info" size={15} /><span>โหมดตัวอย่างสำหรับพัฒนา UI · ข้อมูลไม่เชื่อมต่อฐานข้อมูลจริง</span><button onClick={(event) => event.currentTarget.parentElement.remove()} aria-label="ปิดข้อความ"><Icon name="close" size={14} /></button></div> : null}
          {content}
          <footer className="page-footer"><span>© 2569 OCEC Portal</span><span>สำหรับการสอบถาม ติดต่อฝ่ายประสานงานโครงการ</span><a href="https://lin.ee/3hzFg1z" target="_blank" rel="noopener noreferrer">ศูนย์ช่วยเหลือ</a><a className="flaticon-attribution" href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">UIcons by Flaticon</a></footer>
        </div>
      </main>
      {toast ? <div className="toast" role="status" aria-live="polite"><span><Icon name="check" size={16} /></span><p>{toast}</p><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div> : null}
    </div>
  );
}

export default App;
