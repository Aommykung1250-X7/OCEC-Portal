import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_CENTER_CATALOG, ONLINE_CENTER_CODE, getCommonCenters, isOnlineCenter } from "./centers.js";
import { downloadWorkbook, readWorkbook, worksheetRows } from "./excel.js";
import { getApplicationHeatResultState } from "./application-results.js";
import { getApplicationExamRound, getFormCompetitions } from "./applicationCatalog.js";
import { useConfirm } from "./ConfirmDialog.jsx";
import { NotFoundPage } from "./SystemPages.jsx";
import { ADMIN_PORTAL_PATH, isAdminPortalPath, pageLabels, routeFromLocation, routeUrlFor } from "./routes.js";
import { BrandMark, Button, Field, Icon, PageHeading, StatusBadge } from "./components/ui/index.jsx";
import { formatThaiDate, getExamRoundType } from "./examUtils.js";
import { PublicPortalLayout } from "./components/public/PublicPortalLayout.jsx";
import { LandingPage } from "./features/home/LandingPage.jsx";
import { ApplicationDetailPage, ApplicationsPage, EditApplicationPage, SchoolApplicationGroupPage } from "./features/applications/ApplicationPages.jsx";
import { AdminLoginPage, AdminShell, HomePage } from "./features/admin/AdminShell.jsx";
import { AdminHomePage } from "./features/admin/AdminHomePage.jsx";
import { AdminReviewPage } from "./features/admin/AdminReviewPage.jsx";
import { AdminRoundPage } from "./features/admin/AdminRoundPage.jsx";
import { DEFAULT_COMPETITION_CATALOG } from "./features/admin/adminCatalogDefaults.js";
import { getApplicationsForResultTarget } from "./features/admin/adminUtils.js";
import { ApplicationFormPage } from "./features/applications/ApplicationFormPage.jsx";
import { ApplicantProfileFields } from "./features/applications/FormFields.jsx";
import { CompetitionFormatPicker, PaymentAccountCards } from "./features/applications/FormOptions.jsx";
import { DEMO_PAST_PAPERS, DEFAULT_GRADE_CATALOG, FORM_COMPETITIONS } from "./features/applications/formCatalog.js";
import { getCompetitionExamEmailValue, getCompetitionExamPrice, getSlipMimeType, readFileAsDataUrl } from "./features/applications/formUtils.js";
import { EditVerifyPage, LookupChoicePage, StatusLookupPage } from "./features/applications/StatusPages.jsx";
import { ApiFinalConfirmationPage, FinalConfirmationPage, PublicResultsPage } from "./features/results/ResultsPages.jsx";
import {
  EXAM_ROUND_LABELS,
  getActiveExamYear,
  getApplicationCenterSummary,
  getApplicationCompetitionCenter,
  getApplicationCompetitionExamEmail,
  getApplicationCompetitionFormat,
  getApplicationEditDeadline,
  getApplicationFormatSummary,
  getApplicationPhone,
  getApplicantEditValues,
  getBangkokTodayISO,
  getEligibleFinalRounds,
  resultTargetLabel,
  isApplicationEditable,
  isFinalConfirmationWindowOpen,
  isFinalEligibleAward,
  isWithinRegistrationWindow,
  normalizeExamFormat,
  normalizeAwardLabel,
} from "./features/applications/applicationUtils.js";

const BACKEND_ENABLED = import.meta.env.VITE_BACKEND_ENABLED === "true";

const DEFAULT_PAYMENT_ACCOUNTS = [
  { id: "ocec-main-account", bankName: "Kasikorn Bank", accountName: "บจก. โอซีอีซี (ไทยแลนด์)", accountNumber: "219-3-78805-2", category: "president", showInForm: true, active: true },
];


const RESULT_AWARDS = ["GOLD AWARD", "SILVER AWARD", "BRONZE AWARD", "MERIT AWARD", "PARTICIPATION"];
const DEMO_COMPETITION_ROUNDS = [
  { competitionId: "bbb", title: "Big Bay Bei (BBB)", roundType: "HEAT", accent: "coral", examStartTime: "11:15", examEndTime: "12:30" },
  { competitionId: "hkiso", title: "HKISO", roundType: "HEAT", accent: "violet", examStartTime: "09:45", examEndTime: "10:45" },
  { competitionId: "hkico", title: "HKICO", roundType: "HEAT", accent: "pink", examStartTime: "08:30", examEndTime: "09:30" },
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

function ExamScheduleNotice({ examCatalog = [], navigate }) {
  const exam = examCatalog.find((item) => getExamRoundType(item) === "HEAT" && item.isOpen && item.examDate)
    || examCatalog.find((item) => getExamRoundType(item) === "HEAT" && item.examDate);
  return <div className="landing-note"><Icon name="calendar" size={15} />{exam
    ? <span>รอบรับสมัครปีการศึกษา {exam.year} · สอบวันที่ {formatThaiDate(exam.examDate)}</span>
    : <a href="/#open-exams" onClick={(event) => { event.preventDefault(); navigate("home"); window.setTimeout(() => document.getElementById("open-exams")?.scrollIntoView(), 80); }}>ดูรายการสอบที่เปิดรับสมัคร</a>}</div>;
}

function millisecondsUntilBangkokMidnight() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  const nextMidnightUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day) + 1) - 7 * 60 * 60 * 1000;
  return Math.max(1000, nextMidnightUtc - Date.now() + 100);
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

const demoGoogleProfile = {
  name: "Nicha Srisawat",
  email: "nicha.student@example.com",
  picture: "/demo-google-avatar.svg",
};

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
      if (!response.ok) throw new Error(result.error || "ไม่สามารถใช้ลิงก์นี้ได้หรือหมดอายุแล้ว");
      if (active) { setDetails(result); setLinkStatus("valid"); }
    }).catch((reason) => { if (active) { setError(reason.message || "ไม่สามารถใช้ลิงก์นี้ได้หรือหมดอายุแล้ว"); setLinkStatus("invalid"); } });
    return () => { active = false; };
  }, [token]);

  async function selectSlip(file) {
    if (!file) return;
    const mimeType = getSlipMimeType(file);
    if (!mimeType) { setSlipFile(null); setFileError("รองรับไฟล์ JPG, PNG หรือ PDF เท่านั้น"); return; }
    if (file.size > 10 * 1024 * 1024) { setSlipFile(null); setFileError("ไฟล์มีขนาดเกิน 10 MB"); return; }
    setFileError(""); setError("");
    try { setSlipFile({ fileName: file.name, mimeType, dataBase64: await readFileAsDataUrl(file) }); }
    catch (reason) { setSlipFile(null); setFileError(reason.message || "อ่านไฟล์หลักฐานการชำระเงินไม่สำเร็จ"); }
  }

  async function uploadSlip() {
    if (!slipFile || !token || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/slip-replacements/submit", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, slip: slipFile }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "อัปโหลดหลักฐานการชำระเงินไม่สำเร็จ");
      setUploaded(true);
    } catch (reason) { setError(reason.message || "อัปโหลดหลักฐานการชำระเงินไม่สำเร็จ โปรดดำเนินการอีกครั้ง"); }
    finally { setBusy(false); }
  }

  return <div className="page-stack narrow-page">
    <PageHeading eyebrow="ลิงก์ปลอดภัย" title="ส่งหลักฐานการชำระเงินฉบับใหม่" description="โปรดอัปโหลดหลักฐานฉบับใหม่เพื่อแทนที่ไฟล์เดิม ใบสมัครที่อยู่ระหว่างตรวจสอบจะกลับเข้าสู่คิวตรวจสอบ" />
    <section className="surface upload-card">
      {linkStatus === "loading" ? <div className="empty-inline"><Icon name="sync" /><span>กำลังตรวจสอบลิงก์…</span></div> : null}
      {linkStatus === "invalid" ? <div className="notice notice-amber"><Icon name="info" /><div><strong>ไม่สามารถใช้ลิงก์นี้ได้</strong><p>{error || "ลิงก์อาจหมดอายุ ถูกใช้งานแล้ว หรือระบบหลังบ้านยังไม่ได้เปิดใช้งาน"}</p></div></div> : null}
      {linkStatus === "valid" && !uploaded ? <>
        <div className="upload-token"><span className="upload-token-icon"><Icon name="upload" /></span><div><strong>{details?.schoolName ? `ชุดใบสมัครของโรงเรียน ${details.schoolName}` : "หลักฐานการชำระเงินของใบสมัคร"}</strong><small>{details?.applicationCount || 1} ใบสมัครที่อยู่ระหว่างตรวจสอบหลักฐานการชำระเงิน · ลิงก์นี้ใช้ได้ครั้งเดียว</small></div></div>
        <label className="file-drop"><input type="file" accept="image/jpeg,image/png,application/pdf,.pdf" onChange={(event) => { selectSlip(event.target.files?.[0]); event.target.value = ""; }} /><span className="file-drop-icon"><Icon name="upload" size={22} /></span><strong>{slipFile?.fileName || "เลือกไฟล์หลักฐานการชำระเงินฉบับใหม่"}</strong><small>รองรับ JPG, PNG หรือ PDF · ขนาดไม่เกิน 10 MB</small></label>
        {fileError || error ? <p className="inline-error" role="alert"><Icon name="info" size={15} />{fileError || error}</p> : null}
        <div className="notice notice-blue"><Icon name="lock" /><div><strong>ลิงก์นี้ใช้สำหรับเปลี่ยนหลักฐานการชำระเงินเท่านั้น</strong><p>กรณีสมัครเป็นชุดผ่านโรงเรียน การอัปโหลดครั้งนี้จะแทนหลักฐานการชำระเงินของทั้งชุด โดยใบสมัครที่อนุมัติแล้วจะคงสถานะเดิม</p></div></div>
        <Button className="button-full" icon="upload" disabled={!slipFile || busy} onClick={uploadSlip}>{busy ? "กำลังส่งหลักฐานการชำระเงิน…" : "ส่งหลักฐานฉบับใหม่"}</Button>
      </> : null}
      {uploaded ? <div className="upload-success"><p>ระบบได้รับหลักฐานการชำระเงินฉบับใหม่แล้ว ใบสมัครที่อยู่ระหว่างตรวจสอบกลับเข้าสู่คิวตรวจสอบ และลิงก์นี้ถูกปิดใช้งานแล้ว</p></div> : null}
    </section>
    <div className="privacy-note"><Icon name="lock" size={14} />ลิงก์หมดอายุภายใน 3 วันและใช้งานได้ครั้งเดียว</div>
  </div>;
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
  const isMockEligible = (application) => application.status === "confirmed" || application.status === "pending";
  const applicantRows = applications.filter(isMockEligible).flatMap((application) => (application.competitions || []).map((competition) => ({ application, competition }))).filter(({ application, competition }) => {
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
    if (!mockFiltersReady) { setMockMessage("โปรดระบุรายการสอบ ปีการศึกษา ระดับชั้น และช่วงวันที่ให้ครบถ้วน ก่อนเพิ่มข้อมูลลงใน Google Sheets"); return; }
    setMockBusy(true); setMockMessage(""); setMockSheetUrl("");
    try {
      const response = await fetch("/api/admin/mock-sheets/add", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ year: yearFilter, competition: examFilter, grade: gradeFilter, startDate, endDate }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "ไม่สามารถเพิ่มรายชื่อใน Google Sheets ได้");
      setMockMessage(result.selected ? `เพิ่มข้อมูลใหม่ ${result.inserted} รายการ · ปรับปรุงข้อมูล ${result.updated} รายการในแผ่นงาน ${result.tab}` : "ไม่พบใบสมัครที่ส่งแล้วและไม่ถูกปฏิเสธตามตัวกรองที่กำหนด");
      setMockSheetUrl(result.spreadsheetUrl || "");
    } catch (error) { setMockMessage(error.message || "ไม่สามารถเพิ่มรายชื่อใน Google Sheets ได้"); }
    finally { setMockBusy(false); }
  }
  async function exportReport() {
    if (!BACKEND_ENABLED) {
      notify("โปรดเปิดใช้งาน VITE_BACKEND_ENABLED และเชื่อมต่อฐานข้อมูลก่อนส่งออกรายงาน");
      return;
    }
    const rows = [["APPLICATION ID", "CANDIDATE NAME", "EMAIL", "SCHOOL", "COMPETITION", "PAST PAPER", "DETAIL", "QUANTITY", "UNIT PRICE (THB)", "ACADEMIC YEAR"], ...paperRows.map(({ application, paper, quantity }) => [application.id, application.candidate, application.contactEmail, application.school, application.exam, paper.name, paper.detail || "", quantity, Number(paper.fee || 0), application.year])];
    const yearPart = yearFilter === "all" ? "all-years" : yearFilter;
    const fileName = `ocec-past-papers-${yearPart}.xlsx`;
    try {
      await downloadWorkbook([{ name: "Past Papers", rows }], fileName);
      notify(`ส่งออกไฟล์เรียบร้อยแล้ว จำนวน ${rows.length - 1} รายการ`);
    } catch (error) {
      notify(error.message || "ไม่สามารถส่งออกรายงานได้");
    }
  }

  return (
    <div className="page-stack admin-mock-page">
      <PageHeading eyebrow={BACKEND_ENABLED ? "รายงานจากฐานข้อมูล" : "รายงานใบสมัคร"} title="รายชื่อผู้เข้าสอบ Mock และรายการข้อสอบเก่า" description="เลือกใบสมัครที่ส่งแล้วและยังไม่ได้รับการปฏิเสธ เพื่อเพิ่มรายชื่อผู้เข้าสอบลงใน Google Sheets หรือส่งออกรายการข้อสอบเก่า" action={tab === "mock" ? <Button icon="sync" disabled={!BACKEND_ENABLED || !mockFiltersReady || mockBusy || !applicantRows.length} onClick={addToMockSheet}>{mockBusy ? "กำลังเพิ่มข้อมูล…" : "เพิ่มรายชื่อใน Google Sheets"}</Button> : <Button icon="download" disabled={!BACKEND_ENABLED || !paperRows.length} onClick={exportReport}>ส่งออก Excel</Button>} />
      <div className="admin-mock-stat-grid">
        <article className="admin-mock-stat"><span className="admin-mock-stat-icon mock-icon-violet"><Icon name="users" /></span><div><small>ผู้สมัครทั้งหมด</small><strong>{applications.length}</strong><span>รวมรอบ HEAT และ Final</span></div></article>
        <article className="admin-mock-stat"><span className="admin-mock-stat-icon mock-icon-pink"><Icon name="building" /></span><div><small>สมัครผ่านโรงเรียน</small><strong>{applications.filter((item) => item.source === "school").length}</strong><span>ใบสมัครรายบุคคล</span></div></article>
        <article className="admin-mock-stat"><span className="admin-mock-stat-icon mock-icon-accent"><Icon name="book" /></span><div><small>ชุดข้อสอบเก่าที่เลือก</small><strong>{applications.reduce((sum, item) => sum + (item.pastPapers || []).length, 0)}</strong><span>นับเป็น 1 ชุดต่อรายการที่เลือก</span></div></article>
      </div>
      <section className="surface admin-mock-workspace">
        <div className="admin-mock-tabs" role="tablist" aria-label="ประเภทข้อมูล">
          <button type="button" role="tab" aria-selected={tab === "mock"} className={tab === "mock" ? "admin-mock-tab active" : "admin-mock-tab"} onClick={() => { setTab("mock"); filterReset(); }}><Icon name="users" size={17} />รายชื่อผู้เข้าสอบ Mock <span>{applications.filter(isMockEligible).reduce((sum, item) => sum + (item.competitions || []).length, 0)}</span></button>
          <button type="button" role="tab" aria-selected={tab === "papers"} className={tab === "papers" ? "admin-mock-tab active" : "admin-mock-tab"} onClick={() => { setTab("papers"); filterReset(); }}><Icon name="book" size={17} />รายการซื้อข้อสอบเก่า <span>{applications.reduce((sum, item) => sum + (item.pastPapers || []).length, 0)}</span></button>
        </div>
        <div className="admin-mock-toolbar"><div><p className="eyebrow">{tab === "mock" ? "รายชื่อผู้สมัคร" : "รายการจัดส่งข้อสอบเก่า"}</p><h2>{tab === "mock" ? `พบ ${applicantRows.length} รายการสอบ` : `พบ ${totalPaperSets} ชุด`}</h2><small>{tab === "mock" ? "แสดงหนึ่งแถวต่อรายการสอบ · วันที่ส่งใบสมัครอ้างอิงเวลาประเทศไทย · เพิ่มข้อมูลลงใน Google Sheets เมื่อเลือกคำสั่งเท่านั้น · กำหนดสถานะใน Google Sheets" : "แต่ละแถวคือข้อสอบเก่าหนึ่งชุดที่ผู้สมัครเลือกไว้"}</small></div>{tab === "papers" ? <label className="admin-mock-search"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อผู้สมัคร โรงเรียน หรือรายการข้อสอบเก่า" /></label> : null}</div>
        <div className="admin-mock-filters">
          <label><span>รายการสอบ</span><select value={examFilter} onChange={(event) => { setExamFilter(event.target.value); setGradeFilter("all"); }}><option value="all">ทุกรายการสอบ</option>{examOptions.map((exam) => <option key={exam}>{exam}</option>)}</select></label>
          <label><span>ปีการศึกษา</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">ทุกปี</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
          {tab === "mock" ? <label><span>ระดับชั้น</span><select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option value="all">ทุกระดับชั้น</option>{grades.map((grade) => <option key={grade}>{grade}</option>)}</select></label> : <label><span>ชื่อข้อสอบเก่า</span><select value={paperFilter} onChange={(event) => setPaperFilter(event.target.value)}><option value="all">ทุกรายการ</option>{paperNames.map((paper) => <option key={paper}>{paper}</option>)}</select></label>}
          {tab === "mock" ? <><label><span>วันที่เริ่มต้น</span><input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label><label><span>วันที่สิ้นสุด</span><input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label></> : null}
          <button type="button" className="admin-mock-reset" onClick={filterReset}>ล้างตัวกรอง</button>
        </div>
        {tab === "mock" && mockMessage ? <div className="admin-mock-sheet-result" role="status"><span>{mockMessage}</span>{mockSheetUrl ? <a href={mockSheetUrl} target="_blank" rel="noreferrer">เปิด Google Sheets</a> : null}</div> : null}
        {breakdown.length ? <div className="admin-mock-breakdown"><span>{tab === "mock" ? "จำนวนผู้สมัครตามรายการสอบ" : "จำนวนชุดตามชื่อข้อสอบ"}</span><div>{breakdown.map(([name, count]) => <span className="admin-mock-breakdown-chip" key={name}><strong>{count}</strong>{name}</span>)}</div></div> : null}
        {tab === "papers" ? <div className="admin-mock-breakdown admin-mock-exam-year-breakdown"><span>สรุปข้อสอบเก่าตามรายการสอบและปี</span><div>{paperGroupsByExamYear.length ? paperGroupsByExamYear.map((group) => <span className="admin-mock-breakdown-chip" key={`${group.exam}-${group.year}`}><strong>{group.sets} ชุด</strong>{group.exam} · {group.year} · ฿{group.total.toLocaleString()}</span>) : <small>ไม่มีรายการซื้อข้อสอบเก่าตามตัวกรอง</small>}</div></div> : null}
        {tab === "mock" ? (
          <div className="admin-mock-table-wrap"><table className="admin-mock-table"><thead><tr><th>วันที่ส่งใบสมัคร</th><th>ชื่อ</th><th>อีเมล</th><th>หมายเลขโทรศัพท์</th><th>รายการสอบ</th><th>ระดับชั้น</th></tr></thead><tbody>{applicantRows.map(({ application, competition }) => <tr key={competition.applicationItemId || `${application.id}-${competition.id}`}><td>{submissionDay(application.submitted) || "—"}</td><td><strong>{application.candidate}</strong></td><td>{application.contactEmail || "—"}</td><td>{application.studentInformation?.phone || "—"}</td><td>{competition.short || competition.name}{competition.roundType ? ` ${competition.roundType}` : ""}</td><td>{competition.grade || "—"}</td></tr>)}{applicantRows.length === 0 ? <tr><td colSpan="6"><div className="admin-mock-empty"><Icon name="search" /><strong>ไม่พบรายชื่อที่ตรงกับตัวกรอง</strong><span>โปรดปรับคำค้นหา หรือเลือก “ล้างตัวกรอง”</span></div></td></tr> : null}</tbody></table></div>
        ) : (
          <div className="admin-mock-table-wrap"><table className="admin-mock-table"><thead><tr><th>ผู้สมัคร</th><th>โรงเรียน</th><th>รายการสอบ</th><th>ข้อสอบเก่าที่เลือก</th><th>จำนวน</th><th>ราคา</th><th>ปี</th></tr></thead><tbody>{paperRows.map(({ application, paper }, index) => <tr key={`${application.id}-${paper.id}-${index}`}><td><strong>{application.candidate}</strong><small>{application.contactEmail}</small></td><td>{application.school}</td><td>{application.exam}</td><td><strong>{paper.name}</strong><small>{paper.detail || "ข้อสอบเก่าสำหรับผู้สมัคร"}</small></td><td><span className="admin-mock-quantity">1 ชุด</span></td><td>{fmtMoney(paper.fee)}</td><td>{application.year}</td></tr>)}{paperRows.length === 0 ? <tr><td colSpan="7"><div className="admin-mock-empty"><Icon name="book" /><strong>ไม่มีรายการข้อสอบเก่าที่ตรงกับตัวกรอง</strong><span>โปรดปรับคำค้นหา หรือเลือก “ล้างตัวกรอง”</span></div></td></tr> : null}</tbody></table></div>
        )}
        <div className="admin-mock-footer"><span><Icon name="info" size={15} />{tab === "mock" ? `${applicantRows.length} รายการสอบตามตัวกรอง · ใบสมัครที่ส่งแล้วและไม่ถูกปฏิเสธ` : `${totalPaperSets} ชุดข้อสอบเก่าตามตัวกรอง`}{BACKEND_ENABLED ? " · ข้อมูลปัจจุบันจากฐานข้อมูล" : " · โปรดเปิดใช้งานระบบหลังบ้านก่อนใช้งานจริง"}</span>{tab === "mock" ? <Button variant="outline" icon="sync" disabled={!BACKEND_ENABLED || !mockFiltersReady || mockBusy || !applicantRows.length} onClick={addToMockSheet}>{mockBusy ? "กำลังเพิ่มข้อมูล…" : "เพิ่มรายชื่อใน Google Sheets"}</Button> : <Button variant="outline" icon="download" disabled={!BACKEND_ENABLED || !paperRows.length} onClick={exportReport}>ส่งออก Excel</Button>}</div>
      </section>
    </div>
  );
}

function AdminApplicationEditPage({ application, onSave, navigate, competitionFees, examCatalog, competitionCatalog, centerCatalog, gradeCatalogEntries = [] }) {
  const savedCompetitions = application.competitions || [];
  const roundType = application.kind === "Final" ? "FINAL" : "HEAT";
  const catalogCompetitions = getFormCompetitions(examCatalog, competitionCatalog, roundType, { year: application.year }).filter((item) => {
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
        if (comma < 0) return reject(new Error("อ่านไฟล์หลักฐานการชำระเงินไม่สำเร็จ"));
        const extensionType = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" }[file.name.split(".").pop()?.toLowerCase()];
        resolve({ fileName: file.name, mimeType: file.type || extensionType || "", dataBase64: result.slice(comma + 1) });
      };
      reader.onerror = () => reject(new Error("อ่านไฟล์หลักฐานการชำระเงินไม่สำเร็จ"));
      reader.readAsDataURL(file);
    });
  }
  async function submit(event) {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) { setError("โปรดกรอกชื่อและนามสกุลภาษาอังกฤษ"); return; }
    if (!school.trim()) { setError("โปรดกรอกชื่อโรงเรียน"); return; }
    if (!email.trim()) { setError("โปรดกรอกอีเมลติดต่อของผู้สมัคร"); return; }
    if (!phone.trim()) { setError("โปรดกรอกหมายเลขโทรศัพท์ของผู้สมัคร"); return; }
    if (!competitions.length) { setError("โปรดเลือกรายการสอบอย่างน้อย 1 รายการ"); return; }
    if (competitions.some((item) => !grades[item.id])) { setError("โปรดเลือกระดับชั้นให้ครบในทุกรายการที่สมัคร"); return; }
    const invalidRound = competitions.find((item) => !item.roundId && !roundFor(item));
    if (invalidRound) { setError(`ไม่พบข้อมูลรอบสอบของรายการ ${invalidRound.short || invalidRound.name}`); return; }
    const missingCenter = competitions.find((item) => formatFor(item.id) === "Paper-Based"
      && !centersFor(item.id).some((option) => option.id === centers[item.id])
      && !savedCompetitions.some((previous) => previous.id === item.id && previous.centerId === centers[item.id]
        && !isOnlineCenter(previous.centerSnapshot || { id: previous.centerId, code: previous.centerCode, name: previous.center })));
    if (missingCenter) { setError(`โปรดเลือกศูนย์สอบที่เปิดให้บริการสำหรับรายการ ${missingCenter.short || missingCenter.name}`); return; }
    const invalidOnlineEmail = competitions.find((item) => formatFor(item.id) === "Online" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(examEmailForCompetition(item.id).trim()));
    if (invalidOnlineEmail) { setError(`โปรดกรอกอีเมลเข้าสอบที่ถูกต้องสำหรับรายการ ${invalidOnlineEmail.short || invalidOnlineEmail.name}`); return; }
    if (additionalDue > 0 && !additionalSlip) { setError("โปรดแนบหลักฐานการชำระเงินเพิ่มเติมเพื่อบันทึกยอดชำระส่วนที่เพิ่มขึ้น"); return; }
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
    if (updatedCompetitions.some((item) => !item.gradeId)) { setError("ไม่พบข้อมูลระดับชั้นในรายการตัวเลือก"); return; }
    const missingRound = updatedCompetitions.find((item) => !item.roundId);
    if (missingRound) { setError(`ไม่พบข้อมูลรอบสอบของ ${missingRound.short || missingRound.name} โปรดโหลดหน้าเครื่องมือผู้ดูแลระบบใหม่แล้วดำเนินการอีกครั้ง`); return; }
    const missingCenterId = updatedCompetitions.find((item) => !item.centerId);
    if (missingCenterId) { setError(`ไม่พบข้อมูลศูนย์สอบของ ${missingCenterId.short || missingCenterId.name} โปรดโหลดหน้าเครื่องมือผู้ดูแลระบบใหม่แล้วดำเนินการอีกครั้ง`); return; }
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
      <PageHeading eyebrow="งานผู้ดูแลระบบ · แก้ไขได้ทุกสถานะ" title="แก้ไขใบสมัคร" description={`${application.candidate} · ${application.exam} · ${application.school}`} action={<Button variant="outline" icon="arrow" onClick={() => navigate("admin-review", application.id)}>กลับไปตรวจใบสมัคร</Button>} />
      <form className="admin-edit-layout" onSubmit={submit}>
        <div className="admin-edit-main">
          <section className="surface admin-edit-section"><div className="admin-edit-section-heading"><span>01</span><div><h2>ข้อมูลผู้เข้าสอบ</h2><p>ผู้ดูแลระบบแก้ไขข้อมูลส่วนตัวได้ทุกสถานะ</p></div></div><ApplicantProfileFields values={profile} onChange={updateProfileField} showThaiNames /></section>
          <section className="surface admin-edit-section"><div className="admin-edit-section-heading"><span>02</span><div><h2>รายการสอบ รูปแบบ และศูนย์สอบ</h2><p>ระบบปิดการแก้ไขรายการและระดับชั้นในวันสอบ · สามารถเปลี่ยนรูปแบบสอบได้ตลอดวันสอบ</p></div></div>
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
                <label><input type="checkbox" checked={active} disabled={lockedSelection || saving} onChange={() => toggleCompetition(competition.id)} /><span className="admin-edit-checkbox"><Icon name="check" size={13} /></span><span><strong>{competition.name}</strong><small>{competition.subject}{lockedSelection ? ` · ปิดการแก้ไขรายการ ${examDateFor(competition)}` : ""}</small></span><span className="admin-edit-fee">฿{feeForCompetition(competition).toLocaleString()}<small> / รายการ</small></span></label>
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
          {changedFormats.length || delta !== 0 || additionalDue > 0 ? <section className={hasOnsiteToOnline ? "notice notice-amber admin-edit-change-notice" : "notice notice-blue admin-edit-change-notice"}><Icon name={hasOnsiteToOnline ? "info" : "check"} /><div><strong>{changedFormats.length ? `เปลี่ยนรูปแบบสอบ ${changedFormats.length} รายการ` : additionalDue > 0 ? `ยอดชำระเพิ่ม ${fmtAdminMoney(additionalDue)}` : `ยอดสมัครเปลี่ยน ${delta > 0 ? "เพิ่ม" : "ลด"} ${fmtAdminMoney(Math.abs(delta))}`}</strong><p>{additionalDue > 0 ? `แนบหลักฐานการชำระเงินส่วนที่เพิ่ม ${fmtAdminMoney(additionalDue)} · ส่วนต่างจากการลดราคาไม่หักรายการอื่น` : delta < 0 ? `ยอดลดลง ${fmtAdminMoney(Math.abs(delta))} · ไม่คืนเงินและไม่นำส่วนต่างไปหักรายการที่เพิ่ม` : hasOnsiteToOnline ? "ส่วนต่างจากการเปลี่ยนเป็น Online ไม่คืนและไม่นำไปหักรายการอื่น" : "ยอดรวมไม่เปลี่ยน"}</p></div></section> : null}
          {additionalDue > 0 ? <label className="file-drop file-drop-inline admin-edit-slip"><input type="file" accept="image/jpeg,image/png,application/pdf" disabled={saving} onChange={(event) => { setAdditionalSlip(event.target.files?.[0] || null); setError(""); }} /><span className="file-drop-icon"><Icon name="upload" /></span><span className="file-drop-copy"><strong>{additionalSlip?.name || "แนบหลักฐานการชำระเงินเพิ่มเติม"}</strong><small>หลักฐานยอดที่ชำระเพิ่ม · JPG, PNG หรือ PDF</small></span><span className="file-select-label">เลือกไฟล์</span></label> : null}
          {error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}
          <div className="admin-edit-footer"><span><Icon name="info" size={15} />การบันทึกจะจัดเก็บข้อมูลในระบบและบันทึกประวัติการแก้ไข</span><Button variant="outline" disabled={saving} onClick={() => navigate("admin-review", application.id)}>ยกเลิก</Button><Button type="submit" icon="check" disabled={saving}>{saving ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</Button></div>
        </div>
        <aside className="surface admin-edit-summary"><span className="side-note-icon"><Icon name="settings" /></span><p className="eyebrow">ตรวจยอดก่อนบันทึก</p><h2>สรุปยอดเปลี่ยนแปลง</h2><div className="admin-edit-total-row"><span>ยอดเดิมในใบสมัคร</span><strong>{fmtAdminMoney(paidTotal)}</strong></div><div className="admin-edit-total-row"><span>ข้อสอบเก่า</span><strong>{fmtAdminMoney(pastPapersTotal)}</strong></div><div className="admin-edit-total-row"><span>ค่าสมัครตามรายการใหม่ · {competitions.length} รายการ</span><strong>{fmtAdminMoney(nextRegistrationFee)}</strong></div>{nonRefundableAdjustment > 0 ? <div className="admin-edit-total-row"><span>ส่วนต่างที่ไม่คืน/ไม่นำไปหัก</span><strong>{fmtAdminMoney(nonRefundableAdjustment)}</strong></div> : null}<div className="admin-edit-total-row admin-edit-new-total"><span>ยอดชำระรวมหลังแก้ไข</span><strong>{fmtAdminMoney(amountAfterEdit)}</strong></div><div className={additionalDue > 0 ? "admin-edit-pay-now due" : "admin-edit-pay-now"}><small>ยอดที่ต้องชำระเพิ่ม</small><strong>{fmtAdminMoney(additionalDue)}</strong></div><p>ส่วนต่างจากการเปลี่ยนรูปแบบหรือการลดรายการไม่คืนและไม่นำไปหักค่าสมัครรายการใหม่</p></aside>
      </form>
    </div>
  );
}

function fmtAdminMoney(value) { return `฿${Number(value || 0).toLocaleString()}`; }

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
    } catch (error) { notify(error?.message || 'ไม่สามารถอ่านไฟล์ผลสอบได้'); }
    finally { setBusyImport(false); }
  }

  async function resolve(row, action, applicationItemId = '') {
    try {
      await onResolveConflict(selectedTarget.id, row.id, action, applicationItemId);
      setManualMatches((current) => ({ ...current, [row.id]: '' }));
    } catch (error) { notify(error?.message || 'ไม่สามารถแก้ไขรายการจับคู่ได้'); }
  }

  return <div className="page-stack">
    <PageHeading eyebrow="ผลการสอบ · ฐานข้อมูลจริง" title="นำเข้าและประกาศผลสอบ" description="เลือกรายการสอบและรอบก่อนนำเข้า Excel เพื่อตรวจข้อมูลแล้วจึงประกาศผล" />
    <section className="surface results-import-setup" aria-label="เตรียมนำเข้าผลสอบ">
      <div className="results-import-setup-heading"><div><p className="eyebrow">นำเข้าผลสอบ</p><h2>เตรียมไฟล์สำหรับรอบสอบ</h2><p>เลือกรายการสอบที่สร้างไว้ แล้วอัปโหลดผลสอบของรอบดังกล่าว</p></div><span className={isPublished ? 'schedule-open' : workflow.id ? 'draft-badge' : 'closed-badge'}>{isPublished ? 'ประกาศผลแล้ว' : workflow.id ? 'มีฉบับร่าง' : selectedTarget ? 'พร้อมอัปโหลด' : 'รอเลือกรายการสอบ'}</span></div>
      <div className="results-import-setup-steps">
        <div className="results-import-setup-step"><div className="results-import-step-heading"><span className="results-import-step-number">1</span><div><strong>เลือกรายการสอบและรอบ</strong><small>รายชื่อดึงจากรายการสอบที่มีอยู่ในระบบ</small></div></div><select aria-label="เลือกรายการสอบและรอบเพื่อนำเข้าผลสอบ" value={selectedTarget?.id || ''} onChange={(event) => { setTargetId(event.target.value); setConflictsOpen(false); setManualMatches({}); }} required><option value="">เลือกรายการสอบและรอบ</option>{targetOptions.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} · {exam.round || EXAM_ROUND_LABELS[getExamRoundType(exam)]} · {exam.year}</option>)}</select>{!targetOptions.length ? <small className="results-import-step-help">ยังไม่มีรายการสอบในระบบ กรุณาเพิ่มรายการสอบก่อน</small> : null}</div>
        <div className={`results-import-setup-step${!selectedTarget ? ' results-import-setup-step-locked' : ''}`}><div className="results-import-step-heading"><span className="results-import-step-number">2</span><div><strong>อัปโหลดไฟล์ผลสอบ</strong><small>{selectedTarget ? resultTargetLabel(selectedTarget) : 'โปรดเลือกรายการในขั้นตอนที่ 1 เพื่อเปิดใช้งานการอัปโหลด'}</small></div></div><label className={`file-drop file-drop-inline results-import-file-drop${!selectedTarget || isPublished ? ' file-disabled' : ''}`}><input type="file" accept=".xlsx,.csv" disabled={!selectedTarget || isPublished || busyImport} onChange={(event) => { const file = event.target.files?.[0]; importFile(file); event.target.value = ''; }} /><span className="file-drop-icon"><Icon name={selectedTarget ? 'upload' : 'file'} /></span><span className="file-drop-copy"><strong>{busyImport ? 'กำลังอ่านและจับคู่…' : workflow.fileName || (selectedTarget ? 'เลือกไฟล์ Excel ผลสอบ' : 'รอเลือกรายการสอบ')}</strong><small>ไฟล์ .xlsx หรือ .csv · CANDIDATE NO, GRADE, SCHOOL NAME, CANDIDATE NAME, AWARD</small></span><span className="file-select-label">{isPublished ? 'บันทึกแล้ว' : !selectedTarget ? 'รอเลือก' : workflow.id ? 'แทนที่ฉบับร่าง' : 'เลือกไฟล์'}</span></label></div>
      </div>
    </section>
    {selectedTarget ? <>
      {isPublished ? <div className="notice notice-green"><Icon name="check" /><div><strong>ประกาศผล {resultTargetLabel(selectedTarget)} แล้ว</strong><p>ผลสอบเผยแพร่บนหน้าประกาศผลแล้ว และไม่สามารถแก้ไขข้อมูลได้</p></div></div> : null}
      <div className="results-admin-grid"><section className="surface import-card">
        <div className="section-heading"><div><p className="eyebrow">ตรวจข้อมูลก่อนประกาศ</p><h2>ผลการนำเข้า · {resultTargetLabel(selectedTarget)}</h2></div><span className={isPublished ? 'schedule-open' : 'draft-badge'}>{isPublished ? 'ประกาศแล้ว' : workflow.id ? 'ฉบับร่าง' : 'รออัปโหลดไฟล์'}</span></div>
        {workflow.id ? <div className="import-summary"><span className="summary-icon summary-green"><Icon name="check" /></span><div><strong>{isPublished ? 'ประกาศผลแล้ว · ปิดการแก้ไขข้อมูล' : 'บันทึกฉบับร่างเรียบร้อยแล้ว'}</strong><small>บันทึก {rows.length} รายการ · {workflow.fileName}</small></div><span className="summary-pill">มีสิทธิ์ Final {finalEligibleRows.length} ราย</span></div> : null}
        <div className="results-count-strip"><span><strong>{rows.length}</strong> ผู้เข้าสอบ</span><span><strong>{finalEligibleRows.length}</strong> มีสิทธิ์ไป Final</span><span><strong>{matchedRows.length}</strong> จับคู่ได้</span><button type="button" className={`results-count-review ${hasConflict ? 'has-conflicts' : 'all-clear'}`} disabled={!workflow.id} aria-label={`${issueRows.length} รายการที่ต้องตรวจ · เลือกเพื่อเปิดรายการ`} title="เลือกเพื่อเปิดรายการที่ต้องตรวจ" aria-haspopup="dialog" aria-expanded={conflictsOpen} onClick={() => setConflictsOpen(true)}><strong>{issueRows.length}</strong><span className="results-review-action">รายการที่ต้องตรวจ</span><span className="results-review-indicator" aria-hidden="true"><Icon name="cursor" size={18} /></span></button></div>
        <div className="results-award-breakdown" aria-label="จำนวนผู้เข้าสอบตามรางวัล">{awardBreakdown.map(({ award, count }) => <div className={`results-award-count award-count-${award.toLowerCase().replaceAll(' ', '-')}`} key={award}><span>{award}</span><strong>{count}</strong></div>)}</div>
      <div className="result-preview-heading"><div><strong>รายชื่อผู้เข้าสอบทั้งหมด</strong><small>โปรดตรวจสอบเลขประจำตัวสอบ ระดับชั้น โรงเรียน ชื่อ และรางวัลก่อนประกาศผล</small></div><span>{rows.length} ราย</span></div>
        {rows.length ? <div className="responsive-table admin-results-table-wrap"><table className="admin-results-table"><thead><tr><th>CANDIDATE NO</th><th>GRADE</th><th>SCHOOL NAME</th><th>CANDIDATE NAME</th><th>AWARD</th><th>จับคู่</th></tr></thead><tbody>{rows.map((row) => <tr className={row.matchStatus !== 'matched' ? 'admin-result-row-unmatched' : ''} key={row.id}><td data-label="CANDIDATE NO"><strong className="mono-number">{row.candidateNo}</strong></td><td data-label="GRADE">{row.grade}</td><td data-label="SCHOOL NAME">{row.schoolName}</td><td data-label="CANDIDATE NAME">{row.candidateName}</td><td data-label="AWARD"><span className={`award-badge award-${String(row.award || '').toLowerCase().replaceAll(' ', '-')}`}>{row.award}</span></td><td data-label="จับคู่">{row.matchStatus === 'matched' ? <span className="match-status match-ok"><Icon name="check" size={13} />จับคู่แล้ว</span> : <span className="match-status match-wait"><Icon name="info" size={13} />{row.matchNote || (row.matchStatus === 'data_mismatch' ? 'ข้อมูลไม่ตรง' : row.matchStatus === 'duplicate' ? 'เลขซ้ำ' : 'ไม่พบเลขสอบ')}</span>}</td></tr>)}</tbody></table></div> : <div className="empty-inline"><Icon name="info" /><span>นำเข้าไฟล์ผลสอบของรายการนี้เพื่อสร้างฉบับร่าง</span></div>}
        <div className="publish-box"><div><strong>{isPublished ? 'ประกาศผลแล้ว' : 'ยืนยันประกาศผล'}</strong><small>{isPublished ? 'ประกาศผลแล้วและปิดการแก้ไขข้อมูล' : hasConflict ? `ยังไม่สามารถประกาศผลได้ · โปรดแก้ไขรายการที่ต้องตรวจสอบอีก ${issueRows.length} รายการ` : getExamRoundType(selectedTarget) === 'HEAT' ? 'เมื่อประกาศผลรอบ HEAT ผู้ได้รับเหรียญหรือผู้ที่ได้อันดับ 1st–3rd ของ BBB จะได้รับสิทธิ์สมัครรอบ Final โดยอัตโนมัติ' : 'เมื่อประกาศผลแล้ว ระบบจะแสดงผลต่อสาธารณะและปิดการแก้ไขข้อมูล'}</small></div><Button icon="check" disabled={!workflow.id || hasConflict || isPublished || !rows.length} onClick={() => onPublishResult(selectedTarget)}>{isPublished ? 'ประกาศผลแล้ว' : 'ประกาศผล'}</Button></div>
      </section></div>
      {conflictsOpen ? <div className="results-conflict-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConflictsOpen(false); }}><section className="results-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="results-conflict-title">
        <div className="results-conflict-dialog-head"><div><p className="eyebrow">ตรวจสอบก่อนประกาศผล</p><h2 id="results-conflict-title">รายการที่ต้องตรวจ</h2><small>ยืนยันหรือจับคู่กับใบสมัครของรอบนี้ให้ครบก่อนประกาศ</small></div><span className={hasConflict ? 'conflict-count' : 'conflict-count conflict-count-clear'}>{issueRows.length} รายการ</span><button type="button" className="results-conflict-close" aria-label="ปิดหน้าต่าง" onClick={() => setConflictsOpen(false)}><Icon name="close" size={18} /></button></div>
        <div className="results-conflict-dialog-body">{!issueRows.length ? <div className="resolved-state"><span><Icon name="check" /></span><div><strong>ไม่พบรายการผิดปกติ</strong><p>ฉบับร่างพร้อมสำหรับตรวจสอบก่อนประกาศ</p></div></div> : <div className="conflict-list">{issueRows.map((row) => {
          const linked = applications.find((application) => (application.competitions || []).some((item) => item.applicationItemId === row.applicationItemId));
          const rowItem = applicationItems.find(({ item }) => item.applicationItemId === row.applicationItemId);
          return <article className="conflict-item" key={row.id}><div className="conflict-label"><span className="conflict-icon"><Icon name="info" /></span><div><strong>{row.matchNote || 'ตรวจการจับคู่ผลสอบ'}</strong><small>แถว {row.rowNumber} · เลขสอบ {row.candidateNo} · {row.candidateName}</small></div></div><p>{resultTargetLabel(selectedTarget)} · {row.grade}<br />โรงเรียนในไฟล์: {row.schoolName || '—'}{row.applicationItemId ? <><br />พบใบสมัคร: {rowItem?.application.candidate || linked?.candidate || row.applicationCandidateName} · {rowItem?.application.school || row.applicationSchoolName || '—'}</> : null}</p>
            {row.matchStatus === 'data_mismatch' ? <div className="conflict-actions"><Button variant="outline" icon="check" onClick={() => resolve(row, 'use_application')}>ใช้ข้อมูลจากใบสมัคร</Button><Button variant="text" icon="check" onClick={() => resolve(row, 'confirm')}>ยืนยันข้อมูลในไฟล์</Button></div> : <div className="conflict-actions"><select aria-label={`เลือกใบสมัครจับคู่แถว ${row.rowNumber}`} value={manualMatches[row.id] || ''} onChange={(event) => setManualMatches((current) => ({ ...current, [row.id]: event.target.value }))}><option value="">เลือกใบสมัครในรอบนี้</option>{applicationItems.map(({ application, item }) => <option key={item.applicationItemId} value={item.applicationItemId}>{application.candidate} · {application.school} · {item.examNumber || 'ยังไม่มีเลขประจำตัวสอบ'}</option>)}</select><Button variant="outline" disabled={!manualMatches[row.id]} onClick={() => resolve(row, 'manual_match', manualMatches[row.id])}>จับคู่กับใบสมัคร</Button></div>}
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
      .then(async (response) => { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'ไม่สามารถโหลดเลขประจำตัวสอบ Final ได้'); return result.workflow; })
      .then((result) => { if (active) setWorkflow(result || null); })
      .catch((error) => { if (active) notify(error?.message || 'ไม่สามารถโหลดเลขประจำตัวสอบ Final ได้'); })
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
    } catch (error) { notify(error?.message || 'ไม่สามารถนำเข้าเลขประจำตัวสอบ Final ได้'); }
    finally { setFileBusy(false); }
  }

  async function resolve(row, action, applicationItemId = '') {
    try {
      const updated = await onResolveRow(row.id, action, applicationItemId);
      setWorkflow(updated);
      setManualMatches((current) => ({ ...current, [row.id]: '' }));
    } catch (error) { notify(error?.message || 'ไม่สามารถแก้ไขการจับคู่เลขประจำตัวสอบ Final ได้'); }
  }

  async function applyNumbers() {
    if (!target || conflicts.length || !rows.length || workflow?.applied) return;
    const applied = await onApply(target);
    if (!applied) return;
    setWorkflow((current) => current ? { ...current, applied: true } : current);
    try {
      const response = await fetch(`/api/admin/final-ids?roundId=${encodeURIComponent(target.id)}`, { credentials: 'same-origin' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'ไม่สามารถโหลดสถานะเลขประจำตัวสอบ Final ได้');
      setWorkflow(result.workflow || null);
    } catch { notify('บันทึกเลขประจำตัวสอบ Final แล้ว แต่ไม่สามารถโหลดสถานะล่าสุดได้ โปรดรีเฟรชหน้า'); }
  }

  return <div className="page-stack">
    <PageHeading eyebrow="ข้อมูลผู้เข้าสอบ Final · ฐานข้อมูลจริง" title="นำเข้าและจับคู่เลขประจำตัวสอบ" description="เลือกรายการสอบ Final ก่อนนำเข้าไฟล์จากผู้จัดเพื่อตรวจข้อมูลและบันทึกเลข" />
    <section className="surface results-import-setup" aria-label="เตรียมนำเข้าเลขประจำตัวสอบรอบ Final">
      <div className="results-import-setup-heading"><div><p className="eyebrow">เลขประจำตัวสอบรอบ Final</p><h2>เตรียมไฟล์เลขประจำตัวสอบ</h2><p>เลือกรอบ Final ที่สร้างไว้ แล้วอัปโหลดไฟล์จากผู้จัดเพื่อจับคู่ข้อมูลกับใบสมัคร</p></div><span className={workflow?.applied ? 'schedule-open' : workflow?.id ? 'draft-badge' : 'closed-badge'}>{workflow?.applied ? 'บันทึกเลขประจำตัวสอบแล้ว' : workflow?.id ? `อยู่ระหว่างตรวจสอบ ${conflicts.length} รายการ` : target ? 'พร้อมอัปโหลด' : 'โปรดเลือกรายการสอบ'}</span></div>
      <div className="results-import-setup-steps">
        <div className="results-import-setup-step"><div className="results-import-step-heading"><span className="results-import-step-number">1</span><div><strong>เลือกรายการสอบและรอบ Final</strong><small>แสดงรอบ Final ที่มีอยู่ในรายการสอบ</small></div></div><select aria-label="เลือกรายการสอบและรอบ Final" value={target?.id || ''} onChange={(event) => { setRoundId(event.target.value); setWorkflow(null); setManualMatches({}); }} required><option value="">เลือกรายการสอบและรอบ Final</option>{finalRounds.map((exam) => <option key={exam.id} value={exam.id}>{exam.title} · {exam.round || EXAM_ROUND_LABELS.FINAL} · {exam.year}</option>)}</select>{!finalRounds.length ? <small className="results-import-step-help">ยังไม่มีรายการสอบรอบ Final ในระบบ</small> : null}</div>
        <div className={`results-import-setup-step${!target ? ' results-import-setup-step-locked' : ''}`}><div className="results-import-step-heading"><span className="results-import-step-number">2</span><div><strong>อัปโหลดเลขประจำตัวสอบรอบ Final</strong><small>{target ? `${target.title} · ปี ${target.year}` : 'โปรดเลือกรายการในขั้นตอนที่ 1 เพื่อเปิดใช้งานการอัปโหลด'}</small></div></div><label className={`file-drop file-drop-inline results-import-file-drop${!target || workflow?.applied ? ' file-disabled' : ''}`}><input type="file" accept=".xlsx,.csv" disabled={!target || fileBusy || workflow?.applied} onChange={(event) => { const file = event.target.files?.[0]; chooseFile(file); event.target.value = ''; }} /><span className="file-drop-icon"><Icon name={target ? 'upload' : 'file'} /></span><span className="file-drop-copy"><strong>{fileBusy ? 'กำลังอ่านและจับคู่…' : workflow?.fileName || (target ? 'เลือกไฟล์ Excel เลขประจำตัวสอบรอบ Final' : 'โปรดเลือกรายการสอบรอบ Final')}</strong><small>ไฟล์ .xlsx หรือ .csv · CANDIDATE NO, CANDIDATE NAME, SCHOOL NAME และ GRADE (ถ้ามี)</small></span><span className="file-select-label">{workflow?.applied ? 'บันทึกแล้ว' : !target ? 'โปรดเลือก' : workflow?.id ? 'แทนที่ฉบับร่าง' : 'เลือกไฟล์'}</span></label></div>
      </div>
      {workflow?.id ? <div className="results-import-setup-summary import-summary"><span className="summary-icon summary-green"><Icon name="check" /></span><div><strong>{workflow.applied ? 'บันทึกเลขประจำตัวสอบแล้ว' : 'บันทึกฉบับร่างเรียบร้อยแล้ว'}</strong><small>จับคู่อัตโนมัติ {matchedCount} ราย · ต้องตรวจสอบด้วยตนเอง {conflicts.length} ราย</small></div><span className="summary-pill">{rows.length} ราย</span></div> : null}
    </section>
    {target ? <>
      <section className="surface final-match-table">
        <div className="section-heading"><div><p className="eyebrow">{target.title} · ปี {target.year}</p><h2>ผลการนำเข้าเลขประจำตัวสอบ Final</h2></div><div className="match-legend"><span><i className="legend-green" />จับคู่แล้ว</span><span><i className="legend-amber" />อยู่ระหว่างตรวจสอบ</span></div></div>
        {loading ? <div className="empty-inline"><Icon name="sync" /><span>กำลังโหลดสถานะการนำเข้า…</span></div> : <div className="responsive-table"><table><thead><tr><th>ชื่อภาษาอังกฤษ</th><th>โรงเรียน</th><th>ระดับชั้น</th><th>เลขประจำตัวสอบรอบ Final</th><th>สถานะจับคู่</th><th>ดำเนินการ</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td>{row.candidateName}</td><td>{row.schoolName}</td><td>{row.grade || '—'}</td><td className="mono-number">{row.candidateNo}</td><td>{row.matchStatus === 'matched' ? <span className="match-status match-ok"><Icon name="check" size={13} />จับคู่แล้ว</span> : <span className="match-status match-wait"><Icon name="info" size={13} />{row.matchNote || 'อยู่ระหว่างตรวจสอบ'}</span>}</td><td>{row.matchStatus === 'matched' ? <Button variant="text" icon="file" onClick={() => navigate('admin-review', row.applicationId)}>ดูใบสมัคร</Button> : <div className="final-id-row-actions"><select aria-label={`เลือกผู้สมัครจับคู่เลข ${row.candidateNo}`} value={manualMatches[row.id] || ''} onChange={(event) => setManualMatches((current) => ({ ...current, [row.id]: event.target.value }))}><option value="">เลือกใบสมัครในรอบนี้</option>{applicationItems.map(({ application, item }) => <option key={item.applicationItemId} value={item.applicationItemId}>{application.candidate} · {application.school} · {item.grade}</option>)}</select><Button variant="outline" disabled={!manualMatches[row.id]} onClick={() => resolve(row, 'manual_match', manualMatches[row.id])}>จับคู่</Button></div>}</td></tr>)}</tbody></table></div>}
        {!loading && !rows.length ? <div className="empty-inline"><Icon name="info" /><span>{workflow?.applied ? 'บันทึกเลขประจำตัวสอบแล้ว แต่ไม่พบใบสมัครในรอบนี้' : 'เลือกไฟล์ Excel เพื่อเริ่มจับคู่เลขประจำตัวสอบรอบ Final'}</span></div> : null}
        <div className="publish-box"><div><strong>{workflow?.applied ? 'บันทึกเลขประจำตัวสอบแล้ว' : 'ยืนยันการบันทึกเลขประจำตัวสอบ'}</strong><small>{workflow?.applied ? 'บันทึกเลขลงในใบสมัครแล้ว และปิดการแก้ไขข้อมูลนำเข้า' : conflicts.length ? `โปรดแก้ไขรายการที่ต้องตรวจสอบก่อน (${conflicts.length} รายการ)` : 'เลขที่จับคู่แล้วจะถูกบันทึกลงในใบสมัครรอบ Final'}</small></div><Button icon="check" disabled={!workflow?.id || workflow?.applied || conflicts.length > 0 || !rows.length} onClick={applyNumbers}>{workflow?.applied ? 'บันทึกแล้ว' : 'บันทึกเลขประจำตัวสอบ'}</Button></div>
      </section>
      <div className="table-footnote"><Icon name="info" size={15} />เลขที่บันทึกแล้วจะแสดงในใบสมัคร Final และข้อมูลผู้เข้าสอบ</div>
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
    <div><span className="sync-demo-icon"><Icon name="upload" /></span><div><strong>บัญชี Google สำหรับ Drive, Gmail และ Sheets</strong><p>{status?.connected ? `เชื่อมต่อแล้ว · ${status.accountEmail}` : status?.configured ? "โปรดเชื่อมต่อบัญชี Google ที่ใช้จัดเก็บไฟล์และส่งอีเมล" : "โปรดตั้งค่า OAuth และ encryption key ใน environment ก่อนเชื่อมต่อบัญชี"}</p>{status?.connected ? <small>{status.foldersInitialized ? "โฟลเดอร์ Drive พร้อมใช้งานใช้งาน" : "ระบบจะสร้างโฟลเดอร์ใน Drive เมื่อมีการอัปโหลดไฟล์"}{scopeLabels.length ? ` · โปรดเพิ่มสิทธิ์ ${scopeLabels.join(" และ ")} ใน Google Auth Platform แล้วเชื่อมต่อบัญชีอีกครั้ง` : " · สิทธิ์ Gmail และ Sheets พร้อมใช้งาน"}</small> : null}{message ? <small role="status">{message}</small> : null}</div></div>
    {status?.connected ? <div className="final-id-row-actions">
      {!status.foldersInitialized ? <Button variant="outline" disabled={busy} onClick={prepareFolders}>{busy ? "กำลังเตรียม…" : "เตรียมโฟลเดอร์ Drive"}</Button> : <span className="schedule-open">Drive พร้อมใช้งาน</span>}
      {scopeLabels.length ? <Button variant="outline" disabled={busy} onClick={connectGoogle}>{busy ? "กำลังเชื่อม…" : "เชื่อมต่ออีกครั้งเพื่อเพิ่มสิทธิ์"}</Button> : null}
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
      if (!response.ok) throw new Error(result.error || "ไม่สามารถอ่านสถานะการเชื่อมต่อได้");
      setData(result); setMessage("");
    } catch (error) { setMessage(error.message || "ไม่สามารถอ่านสถานะการเชื่อมต่อได้"); }
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
      if (!response.ok) throw new Error(result.error || "ไม่สามารถเพิ่มงานซิงก์ได้");
      setMessage(`เพิ่ม ${result.queued} รายการเข้าคิวซิงก์แล้ว`); await refresh();
    } catch (error) { setMessage(error.message || "ไม่สามารถเพิ่มงานซิงก์ได้"); }
    finally { setBusy(false); }
  }
  async function retryJob(id) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/integration-jobs/${id}/retry`, { method: "POST", credentials: "same-origin" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "ไม่สามารถเริ่มงานอีกครั้งได้");
      await refresh();
    } catch (error) { setMessage(error.message || "ไม่สามารถเริ่มงานอีกครั้งได้"); }
    finally { setBusy(false); }
  }
  const formatTime = (value) => value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
  return (
    <div className="page-stack">
      <PageHeading eyebrow="การเชื่อมต่อข้อมูล" title="สถานะการเชื่อมต่อ Google Sheets" description="ระบบจะส่งข้อมูลเฉพาะใบสมัครที่ได้รับอนุมัติแล้ว · จัดเก็บไฟล์แยกตามปีและแผ่นงานตามรายการสอบและรอบ · การแก้ไขข้อมูลใน Google Sheets จะไม่เปลี่ยนแปลงข้อมูลบนเว็บไซต์" action={<Button variant="outline" icon="sync" disabled={busy || !BACKEND_ENABLED} onClick={refresh}>ปรับปรุงสถานะ</Button>} />
      {BACKEND_ENABLED ? <GoogleDriveConnectionCard /> : <div className="notice notice-amber"><Icon name="info" /><div><strong>ยังไม่ได้เปิดใช้งานระบบหลังบ้าน</strong><p>โปรดเปิดใช้งาน VITE_BACKEND_ENABLED และเชื่อมต่อฐานข้อมูลก่อนตรวจสอบสถานะการเชื่อมต่อ</p></div></div>}
      {message ? <div className="notice notice-blue" role="status"><Icon name="info" /><div><p>{message}</p></div></div> : null}
      <div className="sheets-grid">
        <section className="surface sheets-status-card"><span className={"sheets-status-icon " + (syncFailedCount ? "sheets-status-wait" : "")}><Icon name={syncFailedCount ? "sync" : "check"} /></span><p className="eyebrow">รายการที่อนุมัติ</p><h2>{data?.queue?.sheets?.synced_items ?? "—"} / {data?.queue?.sheets?.approved_items ?? "—"}</h2><p>รายการที่ซิงก์แล้ว / รายการที่อนุมัติและต้องซิงก์</p><div className="sheets-last-sync"><span>งานที่รอดำเนินการ</span><strong>{pendingCount + (counts["sheets.sync_item:failed"] || 0) + (counts["gmail.send:failed"] || 0)} งาน</strong></div><Button variant="outline" icon="sync" disabled={busy || !data?.workspace?.connected} onClick={syncApprovedItems}>{busy ? "กำลังเพิ่มคิว…" : "ซิงก์ใบสมัครที่อนุมัติแล้ว"}</Button></section>
        <section className="surface sheets-activity"><div className="section-heading"><div><p className="eyebrow">Google Sheets</p><h2>ไฟล์ Google Sheets ที่สร้างแล้ว</h2></div></div>
          {(data?.queue?.workbooks || []).length ? <div className="activity-list">{data.queue.workbooks.map((book) => <div className="activity-row" key={book.academic_year}><span className="activity-mark activity-ok"><Icon name="file" size={13} /></span><div><strong>{book.title}</strong><small>ปีการศึกษา {book.academic_year} · ปรับปรุงล่าสุด {formatTime(book.updated_at)}</small></div><a href={book.spreadsheet_url} target="_blank" rel="noreferrer">เปิด Google Sheets</a></div>)}</div> : <div className="empty-inline"><Icon name="info" /><span>ระบบจะสร้างไฟล์ Google Sheets เมื่อมีใบสมัครที่ได้รับอนุมัติเข้าคิว</span></div>}
          <p className="sheets-rule"><Icon name="info" size={15} />หนึ่งแถวต่อ Application Item ID · หากสมัคร 3 รายการ ระบบจะแยกข้อมูลเป็น 3 แท็บตามรอบสอบ</p>
        </section>
      </div>
      <section className="surface sheets-activity"><div className="section-heading"><div><p className="eyebrow">คิวส่งข้อมูล</p><h2>รายการดำเนินการล่าสุด</h2></div></div>
        {jobs.length ? <div className="activity-list">{jobs.map((job) => <div className={"activity-row " + (job.status === "failed" ? "activity-row-failed" : "")} key={job.id}><span className={"activity-mark " + (job.status === "completed" ? "activity-ok" : job.status === "failed" ? "activity-wait" : "")}><Icon name={job.status === "completed" ? "check" : job.status === "failed" ? "info" : "clock"} size={13} /></span><div><strong>{job.kind === "gmail.send" ? "ส่งอีเมล" : "ซิงก์ Google Sheets"} · {job.status === "completed" ? "ดำเนินการสำเร็จ" : job.status === "failed" ? "ดำเนินการไม่สำเร็จ" : job.status === "running" ? "กำลังดำเนินการ" : "รอดำเนินการ"}</strong><small>{job.last_error || `สร้าง ${formatTime(job.created_at)} · ดำเนินการแล้ว ${job.attempts} ครั้ง`}</small></div>{job.status === "failed" ? <Button variant="text" disabled={busy} onClick={() => retryJob(job.id)}>ดำเนินการอีกครั้ง</Button> : null}</div>)}</div> : <div className="empty-inline"><Icon name="info" /><span>ยังไม่มีรายการดำเนินการด้านอีเมลหรือ Google Sheets</span></div>}
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
      <p>เมื่อเข้าสู่ระบบแล้ว แบบฟอร์มสมัครสอบจะแสดงในหน้านี้ ท่านสามารถกรอกข้อมูลผู้สมัครและติดตามสถานะใบสมัครผ่านบัญชีได้</p>
    </section>
  );
}

function FinalAccessGate({ navigate }) {
  return <section className="surface registration-login-gate" aria-labelledby="final-access-title"><span className="registration-login-icon"><Icon name="award" size={22} /></span><p className="eyebrow">OCEC Final</p><h1 id="final-access-title">ยืนยันสิทธิ์สมัครรอบ Final</h1><p>เริ่มจากตรวจสอบใบสมัครรอบ HEAT ที่ผ่านการคัดเลือก จากนั้นระบบจะนำข้อมูลเดิมมาเติมในแบบฟอร์มรอบ Final</p><Button icon="arrow" onClick={() => navigate("final-confirm")}>ไปยังหน้ายืนยันสิทธิ์</Button></section>;
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
  const confirmAction = useConfirm();
  const [page, setPage] = useState(() => routeFromLocation().page);
  const [persona, setPersona] = useState(() => routeFromLocation().page.startsWith("admin-") ? "admin" : "coordinator");
  const [adminPortalPath, setAdminPortalPath] = useState(isAdminPortalPath);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedAdminCompetitionId, setSelectedAdminCompetitionId] = useState("");
  const [calendarDay, setCalendarDay] = useState(getBangkokTodayISO);
  const [centerCatalog, setCenterCatalog] = useState(BACKEND_ENABLED ? [] : DEFAULT_CENTER_CATALOG);
  const [centerPosterVersion, setCenterPosterVersion] = useState(null);
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
        setCenterPosterVersion(catalog.centerPosterVersion || null);
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

  async function navigate(nextPage, applicationId, competitionId = "") {
    const switchingCompetition = nextPage === "admin-round" && competitionId !== selectedAdminCompetitionId;
    if (catalogPage && catalogDirty && (nextPage !== page || switchingCompetition) && !await confirmAction({ title: 'ออกจากหน้านี้?', message: 'มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก', confirmLabel: 'ออกจากหน้า', tone: 'danger' })) return;
    if (nextPage !== "edit-application") {
      setPublicEditApplication(null);
      setPublicEditCredentials(null);
    }
    setSelectedAdminCompetitionId(nextPage === "admin-round" ? competitionId : "");
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
    notify("โหมดตัวอย่างเป็นแบบอ่านอย่างเดียว โปรดเปิดใช้งาน Portal API เพื่อเข้าสู่ระบบและสมัครสอบจริง");
  }

  function signInAdmin() {
    if (!BACKEND_ENABLED) {
      notify("โปรดตั้งค่า VITE_BACKEND_ENABLED=true เพื่อเปิดใช้งานระบบหลังบ้าน");
      return;
    }
    const returnTo = routeUrlFor("admin-home");
    window.location.assign(`/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`);
  }

  async function signOut() {
    if (BACKEND_ENABLED) {
      try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); }
      catch { notify('ไม่สามารถออกจากระบบได้ โปรดลองอีกครั้ง'); return; }
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
          if (missingRoute) throw new Error('Portal API ยังไม่รองรับการแก้ไขใบสมัคร โปรดเริ่ม Portal API ใหม่แล้วเปิดหน้าเครื่องมือผู้ดูแลระบบอีกครั้ง');
          if (response.status === 404) throw new Error(/application not found/i.test(errorMessage)
            ? 'ไม่พบใบสมัครนี้ในฐานข้อมูลที่กำลังเชื่อมต่อ · โหลดรายการใบสมัครใหม่แล้วดำเนินการอีกครั้ง'
            : `ไม่พบข้อมูลสำหรับบันทึก (HTTP 404)${errorMessage ? ` · ${errorMessage}` : ''}`);
          if (response.status === 401 || response.status === 403) throw new Error(`ไม่มีสิทธิ์บันทึกหรือหมดเวลาเข้าสู่ระบบ · ${errorMessage || `HTTP ${response.status}`}`);
          throw new Error(errorMessage || `บันทึกการแก้ไขไม่สำเร็จ (HTTP ${response.status})`);
        }
        try {
          await refreshApplicationData();
        } catch {
          // PATCH succeeded; a follow-up list refresh must not make the save look unsuccessful.
        }
        notify(body.result?.additionalDue ? `บันทึกข้อมูลแล้ว · ยอดชำระเพิ่มเติม ${fmtAdminMoney(body.result.additionalDue)}` : 'บันทึกการแก้ไขใบสมัครแล้ว');
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
      ["หมายเลขโทรศัพท์", getApplicationPhone(current), getApplicationPhone(next)],
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
    if (updates.additionalSlipFileName && updates.additionalSlipFileName !== current.additionalSlipFileName) changes.push({ label: "หลักฐานการชำระเงินเพิ่มเติม", oldValue: current.additionalSlipFileName || "ไม่มีไฟล์", newValue: updates.additionalSlipFileName });
    if (!changes.length) { notify("ไม่มีข้อมูลที่เปลี่ยนแปลง"); return; }
    const at = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
    const entry = { id: `audit-${Date.now()}`, editor: "ผู้ดูแลระบบ · Aommy", at, changes };
    updateApplication(id, { ...updates, phoneLast4: (updates.phone || "").replace(/\D/g, "").slice(-4), changeHistory: [entry, ...(current.changeHistory || [])] });
    notify("บันทึกตัวอย่างการแก้ไขแล้ว · ระบบบันทึกผู้แก้ไข เวลา และค่าก่อนและหลังแก้ไข");
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
    if (!BACKEND_ENABLED) { notify("โหมดตัวอย่างยังไม่ได้เชื่อมต่อฐานข้อมูล"); return false; }
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
    if (!response.ok) throw new Error(body.error || 'ไม่สามารถโหลดใบสมัครจากฐานข้อมูลได้');
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
      return " · บันทึกข้อมูลแล้ว แต่ไม่สามารถโหลดรายการล่าสุดได้ โปรดรีเฟรชหน้า";
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
            const round = getApplicationExamRound(examCatalog, listing, examYear, roundType);
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
        if (!slipFile?.dataUrl) throw new Error("โปรดแนบหลักฐานการชำระเงินก่อนส่งใบสมัคร");
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
            notify("พบใบสมัครสำหรับรายการนี้แล้ว ระบบกำลังเปิดใบสมัครเดิม");
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
        notify(values.schoolBatch ? `ส่งใบสมัคร ${result.batch.applicationIds.length} คนและบันทึกลงฐานข้อมูลแล้ว · ยอดรวม ฿${Number(result.batch.total || 0).toLocaleString()}` : "ส่งใบสมัครและบันทึกข้อมูลลงฐานข้อมูลเรียบร้อยแล้ว");
        navigate("application-detail", firstId);
        return { ok: true, applications: savedApplications };
      } catch (error) {
        const message = error?.message === "School name must be the same for all applicants in a batch"
          ? "ชื่อโรงเรียนในชุดใบสมัครต้องตรงกันทุกคน กรุณาตรวจชื่อโรงเรียนของผู้สมัครแต่ละคน"
          : error?.message || "ส่งใบสมัครไม่สำเร็จ กรุณาดำเนินการอีกครั้ง";
        notify(message);
        return { ok: false, error: message };
      }
    }
    notify("โหมดตัวอย่างเป็นแบบอ่านอย่างเดียว ระบบไม่ได้บันทึกใบสมัคร");
    return { ok: false, error: "โหมดตัวอย่างเป็นแบบอ่านอย่างเดียว ระบบไม่ได้บันทึกใบสมัคร" };

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
          notify("บันทึกการแก้ไขแล้ว โดยสถานะใบสมัครยังคงเดิม");
          navigate("check-status");
          return;
        }
        await refreshApplicationData();
        notify("บันทึกการแก้ไขลงฐานข้อมูลแล้ว โดยสถานะการอนุมัติยังคงเดิม");
        navigate("application-detail", id);
        return;
      } catch (error) { notify(error?.message || "บันทึกการแก้ไขไม่สำเร็จ"); return; }
    }
    const updatedApplication = { ...form, phoneLast4: form.phone.replace(/\D/g, "").slice(-4) };
    updateApplication(id, updatedApplication);
    if (publicAccess) {
      setPublicEditApplication((current) => current?.id === id ? { ...current, ...updatedApplication } : current);
      setPublicEditCredentials({ candidateName: updatedApplication.candidate, phoneLast4: updatedApplication.phoneLast4 });
      notify("บันทึกการแก้ไขแล้ว โดยสถานะใบสมัครยังคงเดิม");
      navigate("check-status");
      return;
    }
    notify("บันทึกการแก้ไขแล้ว โดยสถานะใบสมัครยังคงเป็น “ยืนยันแล้ว”");
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
      notify(certificatePhoto ? "อัปโหลดภาพเกียรติบัตรไปยัง Google Drive เรียบร้อยแล้ว" : "ลบรูปเกียรติบัตรแล้ว");
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
        notify((result.paymentOnly ? 'ยืนยันยอดชำระเพิ่มแล้ว' : result.waitingPayments ? 'Portal API ยังใช้เงื่อนไขอนุมัติเวอร์ชันเก่า · กรุณารีสตาร์ต API แล้วดำเนินการอีกครั้ง' : 'อนุมัติใบสมัครแล้ว') + refreshWarning);
        return;
      } catch (error) {
        notify(error?.message || 'อนุมัติใบสมัครไม่สำเร็จ กรุณาดำเนินการอีกครั้ง');
        return;
      }
    }
    updateApplication(id, { status: "confirmed", canEdit: true });
    notify("อนุมัติใบสมัครแล้ว อีเมลแจ้งผลส่งไปยัง " + (item?.contactEmail || "อีเมลผู้เข้าสอบ"));
  }

  async function rejectApplication(id, reason) {
    if (reason?.trim().length > 240) { notify("โปรดระบุเหตุผลไม่เกิน 240 ตัวอักษร"); return false; }
    if (!BACKEND_ENABLED) { notify("โหมดตัวอย่างยังไม่ได้เชื่อมต่อฐานข้อมูล"); return false; }
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
        if (!response.ok) throw new Error(result.error || 'ไม่สามารถบันทึกปัญหาเกี่ยวกับหลักฐานการชำระเงินได้');
        const refreshWarning = await refreshApplicationsAfterAdminMutation();
        notify((result.emailRecipient === 'coordinator'
          ? 'บันทึกปัญหาเกี่ยวกับหลักฐานการชำระเงินแล้ว · สร้างลิงก์ใช้ครั้งเดียวและเข้าคิวแจ้งผู้ประสานงาน'
          : 'บันทึกปัญหาเกี่ยวกับหลักฐานการชำระเงินแล้ว · สร้างลิงก์ใช้ครั้งเดียวและเข้าคิวส่งอีเมล') + refreshWarning);
        return;
      } catch (error) {
        notify(error?.message || 'ไม่สามารถบันทึกปัญหาเกี่ยวกับหลักฐานการชำระเงินได้ กรุณาดำเนินการอีกครั้ง');
        return;
      }
    }
    updateApplication(id, { slipIssue: issue });
    notify("ส่งเทมเพลต “" + issue + "” พร้อมลิงก์อัปโหลดไปยัง " + (item?.contactEmail || "อีเมลผู้เข้าสอบ"));
  }

  async function generateHeatIds(examId) {
    const targetExam = examCatalog.find((exam) => exam.id === examId);
    if (!targetExam || getExamRoundType(targetExam) !== 'HEAT') return false;
    if (!BACKEND_ENABLED) { notify('โปรดเปิดใช้งานระบบหลังบ้านเพื่อสร้างเลขประจำตัวสอบและบันทึกลงฐานข้อมูล'); return false; }
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
    if (!BACKEND_ENABLED) throw new Error('กรุณาเปิด backend เพื่อนำเข้าเลขประจำตัวสอบ');
    const response = await fetch(`/api/admin/exams/${encodeURIComponent(target.id)}/final-ids/draft`, {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName, rows }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถนำเข้าเลขประจำตัวสอบ Final ได้');
    notify(`บันทึกเลขประจำตัวสอบ Final ${result.workflow.rows.length} รายการเป็นฉบับร่างเรียบร้อยแล้ว`);
    return result.workflow;
  }

  async function resolveFinalIdRow(rowId, action, applicationItemId = '') {
    const response = await fetch(`/api/admin/final-id-import-rows/${encodeURIComponent(rowId)}/resolve`, {
      method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...(applicationItemId ? { applicationItemId } : {}) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถแก้ไขรายการจับคู่เลขประจำตัวสอบ Final ได้');
    return result.workflow;
  }

  async function saveFinalIds(target) {
    if (!target || !await confirmAction({ title: 'บันทึกเลขประจำตัวสอบรอบ Final?', message: `เลขประจำตัวสอบของ ${target.title} ปี ${target.year} จะถูกบันทึกลงในใบสมัครที่จับคู่แล้ว`, confirmLabel: 'บันทึกเลขประจำตัวสอบ' })) return;
    try {
      const response = await fetch(`/api/admin/exams/${encodeURIComponent(target.id)}/final-ids/apply`, {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: true }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'ไม่สามารถบันทึกเลขประจำตัวสอบ Final ได้');
      const refreshWarning = await refreshApplicationsAfterAdminMutation();
      notify(`บันทึกเลขประจำตัวสอบลงในใบสมัคร ${result.rows} รายการแล้ว${refreshWarning}`);
      return true;
    } catch (error) { notify(error?.message || 'ไม่สามารถบันทึกเลขประจำตัวสอบ Final ได้'); return false; }
  }

  async function importResultDraft(target, fileName, rows) {
    if (!BACKEND_ENABLED) throw new Error('กรุณาเปิด backend เพื่อนำเข้าผลสอบ');
    const response = await fetch(`/api/admin/exams/${encodeURIComponent(target.id)}/results/draft`, {
      method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ fileName, rows }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถนำเข้าผลสอบได้');
    setResultWorkflows((current) => ({ ...current, [target.id]: result.workflow }));
    notify(`นำเข้าผลสอบ ${result.workflow.rows.length} รายการและบันทึกเป็นฉบับร่างแล้ว`);
    return result.workflow;
  }

  async function resolveResultConflict(targetId, rowId, action, applicationItemId = '') {
    const response = await fetch(`/api/admin/result-import-rows/${encodeURIComponent(rowId)}/resolve`, {
      method: 'PATCH', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, ...(applicationItemId ? { applicationItemId } : {}) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'ไม่สามารถแก้ไขรายการจับคู่ผลสอบได้');
    setResultWorkflows((current) => ({ ...current, [targetId]: result.workflow }));
    notify('บันทึกการตรวจจับคู่ผลสอบแล้ว');
    return result.workflow;
  }

  async function publishResults(target) {
    const currentWorkflow = resultWorkflows[target.id] || {};
    if (!currentWorkflow.id || !currentWorkflow.rows?.length) { notify('ยังไม่มีผลสอบฉบับร่าง'); return; }
    const unresolvedCount = currentWorkflow.rows.filter((row) => row.matchStatus !== 'matched').length;
    if (unresolvedCount) { notify(`ยังไม่สามารถประกาศผลได้ · โปรดแก้ไขรายการที่ต้องตรวจสอบอีก ${unresolvedCount} รายการ`); return; }
    if (!await confirmAction({ title: 'ยืนยันการประกาศผลสอบ', message: `${resultTargetLabel(target)} จะเผยแพร่ต่อสาธารณะและปิดการแก้ไขข้อมูลหลังประกาศ`, confirmLabel: 'ประกาศผลสอบ', tone: 'danger' })) return;
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
        const refreshedCatalog = await catalogResponse.json();
        setExamCatalog(refreshedCatalog.exams || []);
        setCenterPosterVersion(refreshedCatalog.centerPosterVersion || null);
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
    if (!exam || !grade || !center) { notify("ข้อมูลรอบสอบไม่ครบถ้วน โปรดตรวจสอบข้อมูลแล้วดำเนินการอีกครั้ง"); return; }
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
        return <ApplicationFormPage key={page} kind="Heat" onSubmit={submitApplication} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} competitionCatalog={competitionCatalog} centerCatalog={centerCatalog} pastPaperCatalog={pastPaperCatalog} paymentAccounts={paymentAccounts} centerPosterVersion={centerPosterVersion} backendEnabled={BACKEND_ENABLED} />;
      case "apply-final":
        return authProfile && finalAccess && finalAccess.heatId === activeApplicationId
          ? <ApplicationFormPage key={`${page}-${activeApplicationId}`} kind="Final" prefill={finalAccess.prefill || activeApplication} applicationMode={finalAccess.mode} allowedRoundIds={finalAccess.allowedRoundIds} onSubmit={submitApplication} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} competitionCatalog={competitionCatalog} centerCatalog={centerCatalog} pastPaperCatalog={pastPaperCatalog} paymentAccounts={paymentAccounts} centerPosterVersion={centerPosterVersion} backendEnabled={BACKEND_ENABLED} />
          : <FinalAccessGate navigate={navigate} />;
      case "applications":
        return <ApplicationsPage applications={visibleApplications} navigate={navigate} resultRows={publishedResultRows} examCatalog={effectiveExamCatalog} today={calendarDay} authProfile={authProfile} onConfirmFinal={confirmFinalFromApplicationCard} />;
      case "school-application-group":
        return <SchoolApplicationGroupPage applications={visibleApplications} groupKey={activeApplicationId} navigate={navigate} />;
      case "application-detail":
        return <ApplicationDetailPage application={applications.find((item) => item.id === activeApplicationId)} navigate={navigate} resultRows={publishedResultRows} examCatalog={effectiveExamCatalog} today={calendarDay} authProfile={authProfile} hasFinalApplication={applications.some((item) => item.kind === "Final" && item.sourceHeatId === activeApplicationId)} onConfirmFinal={confirmFinalFromApplicationCard} onSaveCertificatePhoto={saveCertificatePhoto} />;
      case "check-status":
        return <StatusLookupPage applications={applications} navigate={navigate} backendEnabled={BACKEND_ENABLED} />;
      case "lookup-choice":
        return <LookupChoicePage navigate={navigate} />;
      case "edit-verify":
        return <EditVerifyPage applications={applications} onVerified={(application, credentials) => {
          setPublicEditApplication(application);
          setPublicEditCredentials(credentials);
          navigate("edit-application", application.id);
        }} navigate={navigate} backendEnabled={BACKEND_ENABLED} />;
      case "edit-application":
        return activeEditableApplication
          ? <EditApplicationPage key={activeApplicationId} application={activeEditableApplication} onSave={saveApplication} navigate={navigate} examCatalog={examCatalog} publicAccess={publicEditApplication?.id === activeApplicationId} publicCredentials={publicEditCredentials} />
          : <section className="surface empty-state"><strong>กรุณายืนยันชื่อและหมายเลขโทรศัพท์ก่อนแก้ไขใบสมัคร</strong><Button icon="shield" onClick={() => navigate("edit-verify")}>ไปหน้ายืนยันตัวตน</Button></section>;
      case "slip-upload":
        return <section className="surface empty-state"><strong>ไม่สามารถใช้ลิงก์อัปโหลดหลักฐานการชำระเงินนี้ได้</strong><p>โปรดเปิดลิงก์จากอีเมลแจ้งให้แก้ไขหลักฐานการชำระเงินเท่านั้น</p><Button onClick={() => navigate("check-status")}>ตรวจสอบสถานะใบสมัคร</Button></section>;
      case "slip-replacement":
        return <SlipReplacementPage />;
      case "final-confirm":
        return BACKEND_ENABLED
          ? <ApiFinalConfirmationPage authProfile={authProfile} onContinue={continueVerifiedFinal} onSignIn={signInWithGoogleDemo} navigate={navigate} resultPublished={resultPublished} examCatalog={effectiveExamCatalog} demoProfile={demoGoogleProfile} />
          : <FinalConfirmationPage key={activeApplicationId} applications={applications} applicationHint={activeApplication} onContinue={() => notify("โหมดตัวอย่างอ่านอย่างเดียว · ไม่ได้ยืนยันสิทธิ์สมัครรอบ Final")} navigate={navigate} publishedHeatResults={publishedHeatResults} examCatalog={effectiveExamCatalog} authProfile={authProfile} onSignIn={signInWithGoogleDemo} demoProfile={demoGoogleProfile} />;
      case "results":
        return <PublicResultsPage resultRows={publishedResultRows} />;
      case "admin-home":
        return <AdminHomePage applications={applications} examCatalog={effectiveExamCatalog} resultWorkflows={resultWorkflows} navigate={navigate} resultPublished={resultPublished} backendEnabled={BACKEND_ENABLED} />;
      case "admin-review":
        return <AdminReviewPage backendEnabled={BACKEND_ENABLED} applications={applications} schoolBatches={schoolBatches} onApprove={approveApplication} onReject={rejectApplication} onSlipIssue={notifySlipIssue} notify={notify} navigate={navigate} activeApplicationId={activeApplicationId} />;
      case "admin-application-edit":
        return adminEditApplication
          ? <AdminApplicationEditPage key={activeApplicationId} application={adminEditApplication} onSave={saveAdminApplication} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} competitionCatalog={competitionCatalog} centerCatalog={centerCatalog} gradeCatalogEntries={gradeCatalogEntries} />
          : <section className="surface empty-state"><strong>ไม่พบใบสมัครนี้</strong><Button variant="outline" onClick={() => navigate("admin-review")}>กลับไปยังหน้าใบสมัคร</Button></section>;
      case "admin-mock-papers":
        return <AdminMockPapersPage applications={applications} notify={notify} />;
      case "admin-round":
        return <AdminRoundPage selectedCompetitionId={selectedAdminCompetitionId} examCatalog={effectiveExamCatalog} onUpdateExam={updateExam} onSetManualClosed={setExamManualClosed} onAddExam={addExam} onRemoveExam={removeExam} onSaveCatalog={saveAdminCatalog} onSaveExam={saveAdminExam} onRequestAutoSave={() => setAutoSaveRequested(true)} dirtyExamIds={dirtyExamIds} catalogSaveState={catalogSaveState} catalogDirty={catalogDirty} registrationOpen={registrationOpen} onGenerateHeatIds={generateHeatIds} centerCatalog={centerCatalog} setCenterCatalog={setCenterCatalog} centerPosterVersion={centerPosterVersion} onCenterPosterVersionChange={setCenterPosterVersion} gradeCatalog={gradeCatalog} setGradeCatalog={setGradeCatalog} competitionCatalog={competitionCatalog} setCompetitionCatalog={setCompetitionCatalog} applications={applications} pastPaperCatalog={pastPaperCatalog} setPastPaperCatalog={setPastPaperCatalog} notify={notify} />;
      case "admin-form-options":
        return <AdminRoundPage pageMode="form-options" examCatalog={examCatalog} onUpdateExam={updateExam} onSetManualClosed={setExamManualClosed} onAddExam={addExam} onRemoveExam={removeExam} onSaveCatalog={saveAdminCatalog} onSaveExam={saveAdminExam} catalogSaveState={catalogSaveState} catalogDirty={catalogDirty} registrationOpen={registrationOpen} onGenerateHeatIds={generateHeatIds} centerCatalog={centerCatalog} setCenterCatalog={setCenterCatalog} centerPosterVersion={centerPosterVersion} onCenterPosterVersionChange={setCenterPosterVersion} gradeCatalog={gradeCatalog} setGradeCatalog={setGradeCatalog} competitionCatalog={competitionCatalog} setCompetitionCatalog={setCompetitionCatalog} applications={applications} pastPaperCatalog={pastPaperCatalog} setPastPaperCatalog={setPastPaperCatalog} paymentAccounts={paymentAccounts} setPaymentAccounts={setPaymentAccounts} notify={notify} />;
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
    return <LandingPage navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={signInWithGoogleDemo} onSignOut={signOut} onStartApplication={startApplication} resultPublished={resultPublished} examCatalog={effectiveExamCatalog} demoProfile={demoGoogleProfile} backendEnabled={BACKEND_ENABLED} />;
  }

  if (persona !== "admin" && !page.startsWith("admin-")) {
    return <PublicPortalLayout page={page} navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={signInWithGoogleDemo} onSignOut={signOut} demoProfile={demoGoogleProfile} backendEnabled={BACKEND_ENABLED} toast={toast} setToast={setToast} scheduleNotice={<ExamScheduleNotice examCatalog={effectiveExamCatalog} navigate={navigate} />}>{requiresRegistrationLogin ? <RegistrationLoginGate kind="Heat" /> : content}</PublicPortalLayout>;
  }

  const shellPersona = page.startsWith("admin-") ? "admin" : persona;
  return <AdminShell
    page={page}
    title={pageTitle}
    persona={shellPersona}
    applications={applications}
    competitionCatalog={competitionCatalog}
    selectedAdminCompetitionId={selectedAdminCompetitionId}
    navigate={navigate}
    menuOpen={menuOpen}
    setMenuOpen={setMenuOpen}
    onSetPersona={(next) => { setPersona(next); if (next === "admin") navigate("admin-home"); else if (page.startsWith("admin-")) navigate("home"); }}
    authProfile={authProfile}
    onSignOut={signOut}
    activeYear={getActiveExamYear(examCatalog, "HEAT")}
    backendEnabled={BACKEND_ENABLED}
    toast={toast}
    setToast={setToast}
    notify={notify}
  >{content}</AdminShell>;
}

export default App;
