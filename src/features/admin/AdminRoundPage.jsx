import { useEffect, useState } from "react";
import { useConfirm } from "../../ConfirmDialog.jsx";
import { Button, ExamLogo, Icon, PageHeading } from "../../components/ui/index.jsx";
import { buildCenterSummaryRows, isOnlineCenter, ONLINE_CENTER_CODE, parseCenterRows } from "../../centers.js";
import { downloadWorkbook, readWorkbook, worksheetRows } from "../../excel.js";
import { formatThaiDate, getExamRoundType } from "../../examUtils.js";
import { FORM_PAST_PAPER_GROUPS } from "../applications/formCatalog.js";
import { EXAM_ROUND_LABELS, getBangkokTodayISO, isWithinRegistrationWindow } from "../applications/applicationUtils.js";
import { DEFAULT_COMPETITION_CATALOG } from "./adminCatalogDefaults.js";
import { getApplicationsForResultTarget } from "./adminUtils.js";
import { CatalogOptions, CompetitionCatalogManager } from "./CatalogOptions.jsx";
import { CenterSelectionList, GradeSelectionList } from "./CatalogResources.jsx";

function ClearableDateField({ id, label, value, onChange, labelClassName, inputClassName }) {
  return <div className="grid min-w-0 gap-1.5">
    <div className="flex min-w-0 items-center justify-between gap-2">
      <label className={labelClassName} htmlFor={id}>{label}</label>
      <button className="inline-flex min-h-8 shrink-0 items-center rounded-md px-2 text-[10px] font-semibold text-[#8a694e] transition-colors hover:bg-[#f8e8d7] hover:text-[#704b30] disabled:cursor-default disabled:text-[#c5b7aa] disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#8d89d1]" type="button" aria-label={`ล้าง${label}`} disabled={!value} onClick={() => onChange("")}>ล้าง</button>
    </div>
    <input className={inputClassName} id={id} type="date" value={value || ""} onChange={(event) => onChange(event.target.value)} />
  </div>;
}

export function AdminRoundPage({ pageMode = "rounds", selectedCompetitionId = "", examCatalog, onUpdateExam, onSetManualClosed = async () => {}, onAddExam, onRemoveExam, onSaveCatalog, onSaveExam, onRequestAutoSave = () => {}, dirtyExamIds = [], catalogSaveState = { status: "idle", error: "" }, catalogDirty = false, registrationOpen, onGenerateHeatIds, centerCatalog, setCenterCatalog, centerPosterVersion = null, onCenterPosterVersionChange = () => {}, gradeCatalog, setGradeCatalog, competitionCatalog = DEFAULT_COMPETITION_CATALOG, setCompetitionCatalog = () => {}, applications, pastPaperCatalog, setPastPaperCatalog, paymentAccounts = [], setPaymentAccounts = () => {}, notify }) {
  const confirmAction = useConfirm();
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
  async function removePaymentAccount(account) {
    if (!await confirmAction({ title: "ลบบัญชีรับโอน?", message: `${account.bankName} ${account.accountNumber}`, confirmLabel: "ลบบัญชี", tone: "danger" })) return;
    setPaymentAccounts((current) => current.filter((item) => item.id !== account.id));
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
  const [newExam, setNewExam] = useState({ competitionId: selectedCompetitionId || competitionCatalog.find((competition) => competition.active !== false)?.id || "", roundTypes: [], year: catalogYears[0] || "", openDate: "", closeDate: "", examDate: "", examStartTime: "", examEndTime: "", editCloseDate: "", gradeOptions: [], accent: "violet", description: "ตรวจสอบกำหนดการและรายละเอียดการสมัคร", centerIds: activePhysicalCenterIds, prices: { HEAT: { paperBased: 755, onlineExam: 655 }, FINAL: { paperBased: 1550, onlineExam: 1350 }, FINAL_X: { paperBased: 1550, onlineExam: 1350 } } });
  const pageCompetition = competitionCatalog.find((competition) => competition.id === selectedCompetitionId);
  const pageCompetitionTitle = pageCompetition?.short || pageCompetition?.name || examCatalog.find((exam) => exam.competitionId === selectedCompetitionId)?.title || "รายการสอบ";
  useEffect(() => {
    if (!selectedCompetitionId) return;
    setYearFilter("all");
    setNewExam((current) => ({ ...current, competitionId: selectedCompetitionId }));
  }, [selectedCompetitionId]);
  const selectedCompetition = competitionCatalog.find((competition) => competition.id === newExam.competitionId);
  const visibleExams = examCatalog.filter((exam) => (!selectedCompetitionId || exam.competitionId === selectedCompetitionId)
    && (selectedCompetitionId || yearFilter === "all" || exam.year === yearFilter));
  const examGroups = Object.values(visibleExams.reduce((groups, exam) => {
    const groupId = selectedCompetitionId ? String(exam.year) : `${exam.competitionId || exam.title}-${exam.year}`;
    groups[groupId] ||= { id: groupId, title: selectedCompetitionId ? pageCompetitionTitle : exam.title, year: exam.year, rounds: [] };
    groups[groupId].rounds.push(exam);
    return groups;
  }, Object.create(null))).sort((left, right) => selectedCompetitionId
    ? (Number(right.year) - Number(left.year)) || String(right.year).localeCompare(String(left.year), "th")
    : Number(left.rounds.some((exam) => exam.competitionId === "bbb")) - Number(right.rounds.some((exam) => exam.competitionId === "bbb")));
  const roundOrder = { HEAT: 0, FINAL: 1, FINAL_X: 2 };
  const roundGridColumns = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3" };
  examGroups.forEach((group) => group.rounds.sort((left, right) => (roundOrder[getExamRoundType(left)] ?? 3) - (roundOrder[getExamRoundType(right)] ?? 3)));
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
  async function saveCenterEdit(center, draft) {
    if (isOnlineCenter(center)) { notify("ศูนย์ Online : Home Base เป็นค่าเริ่มต้นและแก้ไขไม่ได้"); return false; }
    const code = String(draft.code || "").trim();
    const name = String(draft.name || "").trim();
    if (!/^\d{3}$/.test(code)) { notify("รหัสศูนย์สอบต้องเป็นตัวเลข 3 หลัก"); return false; }
    if (!name) { notify("กรุณาระบุชื่อศูนย์สอบ"); return false; }
    if (centerCatalog.some((item) => item.id !== center.id && item.code === code)) { notify("รหัสศูนย์สอบนี้มีอยู่แล้ว"); return false; }
    if (code === center.code && name === center.name) return true;
    if (!await confirmAction({
      title: "ยืนยันบันทึกการแก้ไขศูนย์สอบ?",
      message: `รหัส ${center.code} → ${code} · ชื่อ ${center.name} → ${name}`,
      confirmLabel: "บันทึกการแก้ไข",
    })) return false;
    setCenterCatalog((current) => current.map((item) => item.id === center.id ? { ...item, code, name } : item));
    onRequestAutoSave();
    notify("แก้ไขศูนย์สอบแล้ว · กำลังบันทึกอัตโนมัติ");
    return true;
  }
  function addCenter(event) {
    event?.preventDefault();
    const code = newCenterCode.trim();
    const name = newCenterName.trim();
    if (!/^\d{3}$/.test(code)) { notify("รหัสศูนย์สอบต้องเป็นตัวเลข 3 หลัก"); return; }
    if (!name) { notify("กรุณาระบุชื่อศูนย์สอบ"); return; }
    if (centerCatalog.some((center) => center.code === code)) { notify("รหัสศูนย์สอบนี้มีอยู่แล้ว"); return; }
    setCenterCatalog((current) => [...current, { id: `center-${code}`, code, name, active: true }]);
    setNewCenterCode(""); setNewCenterName(""); notify("เพิ่มศูนย์สอบแล้ว · กำลังบันทึกอัตโนมัติ");
    onRequestAutoSave();
  }
  async function deactivateCenter(center) {
    if (isOnlineCenter(center)) { notify("ศูนย์ Online : Home Base เป็นค่าเริ่มต้นและลบไม่ได้"); return; }
    if (!await confirmAction({ title: 'ปิดใช้งานศูนย์สอบ?', message: `ศูนย์สอบ ${center.name} จะถูกนำออกจากรายการสอบที่ใช้อยู่`, confirmLabel: 'ปิดใช้งาน', tone: 'danger' })) return;
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
    const competitionId = FORM_PAST_PAPER_GROUPS.find((group) => group.title === newPaperGroup)?.id || null;
    setPastPaperCatalog((current) => [...current, { id: `paper-${Date.now()}`, competitionId, group: newPaperGroup, name: newPaperName.trim(), price: Number(newPaperPrice) || 0, active: true }]);
    setNewPaperName(""); notify("เพิ่มรายการแล้ว · กำลังบันทึกอัตโนมัติ");
  }
  async function removePastPaper(paper) {
    if (!await confirmAction({ title: 'ลบข้อสอบเก่า?', message: paper.title || paper.name, confirmLabel: 'ลบข้อสอบเก่า', tone: 'danger' })) return;
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
  async function removeGradeOption(grade) {
    const wouldEmptyOpenExam = examCatalog.some((exam) => exam.isOpen && (exam.gradeOptions || []).length === 1 && exam.gradeOptions.includes(grade));
    if (wouldEmptyOpenExam) {
      notify("ปิดรับสมัครรายการสอบที่ใช้ระดับชั้นนี้ก่อนลบระดับชั้นสุดท้าย");
      return;
    }
    if (!await confirmAction({ title: 'ลบระดับชั้น?', message: `ระดับชั้น ${grade} จะถูกนำออกจากตัวเลือกและรายการสอบที่ใช้อยู่`, confirmLabel: 'ลบระดับชั้น', tone: 'danger' })) return;
    setGradeCatalog((current) => current.filter((item) => item !== grade));
    examCatalog.filter((exam) => (exam.gradeOptions || []).includes(grade)).forEach((exam) => {
      onUpdateExam(exam.id, { gradeOptions: (exam.gradeOptions || []).filter((item) => item !== grade) });
    });
    setNewExam((current) => ({ ...current, gradeOptions: current.gradeOptions.filter((item) => item !== grade) }));
    notify(`นำระดับชั้น ${grade} ออกจากตัวเลือกและรายการสอบแล้ว`);
  }
  return (
    <div className="page-stack">
      <PageHeading eyebrow={pageMode === "form-options" ? "รอบสอบและข้อมูลตั้งต้น" : selectedCompetitionId ? "จัดการรายการสอบ" : "รอบสอบและข้อมูลตั้งต้น"} title={pageMode === "form-options" ? "ข้อมูลตัวเลือกในฟอร์ม" : selectedCompetitionId ? pageCompetitionTitle : "รายการสอบและกำหนดการ"} description={pageMode === "form-options" ? "จัดการระดับชั้น ศูนย์สอบ และข้อสอบเก่าที่ใช้เป็นตัวเลือกในฟอร์มสมัคร" : selectedCompetitionId ? `จัดการรอบสอบทั้งหมดของ ${pageCompetitionTitle} แยกตามปีการศึกษา` : "แก้ไขรายการสอบและบันทึกการเปลี่ยนแปลงลงฐานข้อมูล"} action={pageMode === "form-options" ? <span className="admin-data-note"><Icon name="building" size={14} />ระดับชั้น {gradeCatalog.length} ระดับ · ศูนย์สอบ {centerCatalog.filter((center) => center.active !== false).length} แห่ง</span> : <span className={registrationOpen ? "schedule-open" : "closed-badge"}>{registrationOpen ? `เปิดรับ ${visibleExams.filter((exam) => exam.isOpen).length} รายการ` : "ปิดรับสมัครทั้งหมด"}</span>} />
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
      <section className="surface admin-round-catalog min-w-0 rounded-2xl border border-[#e4e6ef] bg-white p-3.5 shadow-sm sm:p-6">
        <div className="section-heading mb-4 flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between"><div><p className="eyebrow">{selectedCompetitionId ? "รอบสอบทั้งหมด" : "แสดงบนหน้าสมัคร"}</p><h2>{selectedCompetitionId ? `รายการรอบสอบ · ${pageCompetitionTitle}` : "จัดการรายการสอบทั้งหมด"}</h2></div><div className="admin-exam-heading-actions flex w-full flex-wrap items-center justify-between gap-2 md:w-auto md:justify-end"><span className="admin-data-note"><Icon name="info" size={14} />สถานะเปิดรับเชื่อมกับหน้าแรก</span><Button className="min-h-11 sm:min-h-9" icon="plus" onClick={() => { if (!showNewExamForm && selectedCompetitionId) updateNewExam("competitionId", selectedCompetitionId); setShowNewExamForm((current) => !current); setNewExamError(""); }}>{showNewExamForm ? "ปิดฟอร์ม" : selectedCompetitionId ? "เพิ่มรอบสอบ" : "เพิ่มรายการสอบ"}</Button></div></div>
        {showNewExamForm ? <form className="admin-exam-create-form mb-[18px] grid gap-4 rounded-2xl border border-[#e7e5f2] bg-gradient-to-br from-[#fbfaff] to-white p-3.5 sm:gap-[17px] sm:p-5" onSubmit={(event) => { event.preventDefault(); addExam(); }}>
          <div className="admin-exam-create-heading flex items-center gap-3"><span className="admin-exam-create-icon grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#eeedfb] text-[#4d499e]"><Icon name="plus" size={17} /></span><div className="grid gap-[3px]"><strong className="text-sm text-[#303a60]">{selectedCompetitionId ? `เพิ่มรอบสอบ · ${pageCompetitionTitle}` : "เพิ่มรายการสอบใหม่"}</strong><small className="text-[11px] text-[#7e899f]">รายการจะยังปิดรับสมัคร จนกว่าแอดมินจะกดเปิดรับจากการ์ด</small></div></div>
          <div className="admin-exam-create-fields grid min-w-0 grid-cols-1 gap-2.5 min-[701px]:grid-cols-2 min-[701px]:gap-3">
            <div className="admin-exam-title-round-row grid min-w-0 grid-cols-1 items-start gap-2.5 min-[701px]:col-span-full min-[701px]:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] min-[701px]:gap-3">
              <fieldset className="admin-competition-choice m-0 grid min-w-0 gap-2 rounded-xl border border-[#e6e6f0] p-3"><legend className="px-1 text-xs font-semibold text-[#5f6e88]">ชื่อรายการสอบ <b className="text-[#d65c67">*</b></legend><div className="flex min-w-0 flex-col items-stretch gap-2 min-[701px]:flex-row min-[701px]:items-center"><select className="min-h-11 w-full min-w-0 flex-1 rounded-lg border border-[#e1e4ed] bg-white px-3 text-sm text-[#394763] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[42px] sm:text-xs" aria-label="ชื่อรายการสอบ" value={newExam.competitionId} onChange={(event) => updateNewExam("competitionId", event.target.value)} required><option value="">เลือกรายการสอบ</option>{competitionCatalog.filter((competition) => competition.active !== false || competition.id === selectedCompetitionId).map((competition) => <option key={competition.id} value={competition.id}>{competition.short || competition.name}</option>)}</select><Button className="min-h-11 whitespace-nowrap px-2.5 text-xs min-[701px]:min-h-9" type="button" variant="outline" icon="settings" onClick={() => setShowCompetitionManager((current) => !current)}>{showCompetitionManager ? "ปิดจัดการชื่อ" : "เพิ่ม/แก้ชื่อ"}</Button></div>
                {showCompetitionManager ? <CompetitionCatalogManager selectedCompetition={selectedCompetition} newCompetitionName={newCompetitionName} onNewCompetitionNameChange={setNewCompetitionName} onAddCompetition={addCompetitionChoice} onUpdateCompetition={updateCompetitionChoice} /> : null}
              </fieldset>
              <fieldset className="admin-round-choice m-0 grid min-w-0 gap-2 rounded-xl border border-[#e6e6f0] p-3"><legend className="px-1 text-xs font-semibold text-[#5f6e88]">รอบสอบ <b className="text-[#d65c67]">*</b></legend><div className="flex flex-wrap gap-1.5">{Object.entries(EXAM_ROUND_LABELS).map(([roundType, label]) => <label key={roundType} className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-2 text-xs font-semibold transition-colors ${newExam.roundTypes.includes(roundType) ? "admin-round-choice-selected border-[#cac7e9] bg-[#f4f3fc] text-[#514d9c]" : "border-[#e7e8f0] bg-white text-[#728097] hover:bg-[#f8f8fc]"}`}><input className="h-4 w-4 accent-[#5954a4]" type="checkbox" checked={newExam.roundTypes.includes(roundType)} onChange={() => toggleNewExamRound(roundType)} /><span>{label}</span></label>)}</div><small className="text-[10px] text-[#8a95a7]">เลือกได้หลายรอบ ระบบจะแยกสร้างเป็นการ์ดคนละใบ</small></fieldset>
            </div>
            {newExam.roundTypes.map((roundType) => <fieldset className="admin-round-price-set m-0 grid min-w-0 grid-cols-2 content-start gap-2 rounded-xl border border-[#cbd0ed] bg-[#eef0fb] px-3 py-3 min-[701px]:col-span-full sm:px-3.5" key={roundType}><legend className="col-span-full px-1 text-xs font-semibold text-[#454c87]">ราคาสมัคร · {EXAM_ROUND_LABELS[roundType]}</legend><label className="grid min-w-0 gap-1.5 text-[10px] font-semibold text-[#59628d]"><span>Paper-Based</span><div className="flex min-w-0 items-center gap-1"><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#cbd0e4] bg-white px-2 text-sm text-[#394763] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[38px] sm:text-[11px]" aria-label={`${EXAM_ROUND_LABELS[roundType]} ราคา Paper-Based`} type="number" min="0" value={newExam.prices[roundType].paperBased} onChange={(event) => updateNewExam("prices", { ...newExam.prices, [roundType]: { ...newExam.prices[roundType], paperBased: Math.max(0, Number(event.target.value) || 0) } })} /><b className="text-[9px] font-semibold text-[#8290a3]">บาท</b></div></label><label className="grid min-w-0 gap-1.5 text-[10px] font-semibold text-[#59628d]"><span>Online Exam</span><div className="flex min-w-0 items-center gap-1"><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#cbd0e4] bg-white px-2 text-sm text-[#394763] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[38px] sm:text-[11px]" aria-label={`${EXAM_ROUND_LABELS[roundType]} ราคา Online Exam`} type="number" min="0" value={newExam.prices[roundType].onlineExam} onChange={(event) => updateNewExam("prices", { ...newExam.prices, [roundType]: { ...newExam.prices[roundType], onlineExam: Math.max(0, Number(event.target.value) || 0) } })} /><b className="text-[9px] font-semibold text-[#8290a3]">บาท</b></div></label></fieldset>)}
            <label className="grid min-w-0 content-start gap-1.5"><span className="text-xs font-semibold text-[#5f6e88]">ปีการศึกษา <b className="text-[#d65c67]">*</b></span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e1e4ed] bg-white px-3 text-sm text-[#394763] outline-none transition focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[42px] sm:text-xs" inputMode="numeric" value={newExam.year} onChange={(event) => updateNewExam("year", event.target.value)} placeholder="2569" required /></label>
            <fieldset className="admin-exam-schedule-fields m-0 grid min-w-0 gap-2 rounded-xl border border-[#ead2b9] bg-[#fff3e6] p-3.5 min-[701px]:col-span-full"><legend className="px-1.5 text-[11px] font-bold text-[#875b37]">กำหนดวันสำคัญ</legend><div className="admin-exam-schedule-grid grid min-w-0 grid-cols-1 gap-2.5 min-[701px]:grid-cols-2">
              <ClearableDateField id="new-exam-open-date" label="เริ่มรับสมัคร" labelClassName="text-[10px] font-semibold text-[#765a44]" inputClassName="min-h-11 w-full min-w-0 rounded-lg border border-[#e2cdb7] bg-white px-3 text-sm text-[#394763] outline-none shadow-sm focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:text-xs" value={newExam.openDate} onChange={(value) => updateNewExam("openDate", value)} />
              <ClearableDateField id="new-exam-close-date" label="ปิดรับสมัคร" labelClassName="text-[10px] font-semibold text-[#765a44]" inputClassName="min-h-11 w-full min-w-0 rounded-lg border border-[#e2cdb7] bg-white px-3 text-sm text-[#394763] outline-none shadow-sm focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:text-xs" value={newExam.closeDate} onChange={(value) => updateNewExam("closeDate", value)} />
              <ClearableDateField id="new-exam-exam-date" label="วันสอบ" labelClassName="text-[10px] font-semibold text-[#765a44]" inputClassName="min-h-11 w-full min-w-0 rounded-lg border border-[#e2cdb7] bg-white px-3 text-sm text-[#394763] outline-none shadow-sm focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:text-xs" value={newExam.examDate} onChange={(value) => updateNewExam("examDate", value)} />
              <label className="grid min-w-0 gap-1.5"><span className="text-[10px] font-semibold text-[#765a44]">เวลาเริ่มสอบ</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e2cdb7] bg-white px-3 text-sm text-[#394763] outline-none shadow-sm focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:text-xs" type="time" value={newExam.examStartTime} onChange={(event) => updateNewExam("examStartTime", event.target.value)} /></label>
              <label className="grid min-w-0 gap-1.5"><span className="text-[10px] font-semibold text-[#765a44]">เวลาสิ้นสุด</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e2cdb7] bg-white px-3 text-sm text-[#394763] outline-none shadow-sm focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:text-xs" type="time" value={newExam.examEndTime} onChange={(event) => updateNewExam("examEndTime", event.target.value)} /></label>
              <ClearableDateField id="new-exam-edit-close-date" label="ปิดแก้ไขข้อมูล" labelClassName="text-[10px] font-semibold text-[#765a44]" inputClassName="min-h-11 w-full min-w-0 rounded-lg border border-[#e2cdb7] bg-white px-3 text-sm text-[#394763] outline-none shadow-sm focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:text-xs" value={newExam.editCloseDate} onChange={(value) => updateNewExam("editCloseDate", value)} />
            </div></fieldset>
            <label className="admin-exam-description grid min-w-0 content-start gap-1.5 min-[701px]:col-span-full"><span className="text-xs font-semibold text-[#5f6e88]">คำอธิบายบนการ์ด</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e1e4ed] bg-white px-3 text-sm text-[#394763] outline-none transition focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[42px] sm:text-xs" value={newExam.description} onChange={(event) => updateNewExam("description", event.target.value)} placeholder="รายละเอียดสั้นๆ ของรายการสอบ" /></label>
            <GradeSelectionList grades={gradeCatalog} selectedGrades={newExam.gradeOptions} onChange={(gradeOptions) => updateNewExam("gradeOptions", gradeOptions)} label="ระดับชั้นที่เปิดรับในรายการนี้" />
            <CenterSelectionList centers={centerCatalog} selectedIds={newExam.centerIds} onChange={(centerIds) => updateNewExam("centerIds", centerIds)} label="ศูนย์สอบที่เปิดในรอบนี้" />
            <div className="admin-exam-form-logo grid content-start gap-1.5"><span className="admin-exam-field-label text-xs font-semibold text-[#5f6e88]">โลโก้ประจำรายการ</span><div className="admin-exam-logo-control flex min-h-[58px] min-w-0 flex-wrap items-center gap-2 rounded-[10px] border border-[#e6e6f0] bg-white p-2"><ExamLogo exam={{ ...newExam, logoDataUrl: newExamLogo }} className="grid !h-[42px] !w-[42px] !shrink-0 !place-items-center !rounded-[10px]" iconSize={19} /><label className="admin-exam-logo-button relative inline-flex min-h-11 items-center gap-1.5 overflow-hidden rounded-lg border border-[#dcd9ef] bg-[#f8f7ff] px-2.5 text-[11px] font-bold text-[#494691] transition-colors hover:border-[#aaa6d9] hover:bg-[#f0effb]"><Icon name="upload" size={15} />{newExamLogo ? "เปลี่ยนรูปโลโก้" : "เลือกรูปโลโก้"}<input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept="image/png,image/jpeg,image/webp" aria-label="เลือกรูปโลโก้รายการสอบใหม่" onChange={(event) => { readLogoFile(event.target.files?.[0], setNewExamLogo); event.target.value = ""; }} /></label><small className="text-[10px] text-[#8a94a6]">PNG, JPG หรือ WEBP · ไม่เกิน 5 MB</small>{newExamLogo ? <button type="button" className="admin-exam-remove-logo rounded px-1.5 py-1 text-[10px] text-[#a35968] hover:bg-[#fff3f5]" onClick={() => setNewExamLogo("")}>เอารูปออก</button> : null}</div></div>
          </div>
          {newExamError ? <p className="admin-exam-error -mt-1 flex items-start gap-1.5 text-[11px] text-[#a34654]" role="alert"><Icon name="info" size={14} />{newExamError}</p> : null}
          <div className="admin-exam-form-footer flex flex-col gap-2.5 border-t border-[#ecebf3] pt-3 sm:flex-row sm:items-center sm:justify-between"><span className="inline-flex items-start gap-1.5 text-[10px] text-[#818ca0]"><Icon className="mt-px shrink-0" name="info" size={14} />เลือก {newExam.roundTypes.length || 0} รอบ · {newExam.gradeOptions.length} ระดับชั้น · รายการใหม่เริ่มต้นเป็นยังไม่เปิดรับ</span><div className="grid grid-cols-2 gap-2 sm:flex"><Button className="min-h-11 w-full sm:min-h-[38px]" type="button" variant="outline" onClick={() => { setShowNewExamForm(false); setNewExamError(""); }}>ยกเลิก</Button><Button className="min-h-11 w-full sm:min-h-[38px]" type="submit" icon="check">เพิ่ม {newExam.roundTypes.length || "รายการ"} การ์ด</Button></div></div>
        </form> : null}
        <div className="admin-round-catalog-toolbar mb-3 flex flex-col gap-2 rounded-[11px] border border-[#ececf4] bg-[#fafaff] p-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap items-baseline gap-1.5 text-[11px] text-[#808ca1]"><strong className="text-xs text-[#43516e]">{visibleExams.length} การ์ดรายการสอบ</strong><span>· {visibleExams.filter((exam) => exam.isOpen).length} รอบกำลังเปิดรับ</span></div>{!selectedCompetitionId ? <label className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#687690] sm:justify-start">ปีการศึกษา<select className="min-h-11 min-w-24 rounded-lg border border-[#e0e2ee] bg-white px-2 text-sm text-[#394763] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[34px] sm:text-[11px]" value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">ทุกปี</option>{catalogYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label> : null}</div>
        <div className="admin-round-groups grid min-w-0 grid-cols-1 items-start gap-3">{examGroups.map((group) => <section className="admin-round-group min-w-0 rounded-[14px] border border-[#e3e4ef] bg-gradient-to-br from-[#f9f9fd] to-white p-3 shadow-sm" key={group.id}>
          <div className="admin-round-group-heading mb-2.5 flex min-h-10 items-center gap-2 border-b border-[#e9eaf2] px-0.5 pb-2"><span className="admin-round-group-mark grid h-[31px] w-[31px] shrink-0 place-items-center rounded-[9px] bg-[#efeffb] text-[#5b56a5]"><Icon name="award" size={17} /></span><div className="grid min-w-0 flex-1 gap-px"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#374461]">{selectedCompetitionId ? `${group.title} ${group.year}` : group.title}</strong><small className="text-[9px] text-[#8792a5]">{selectedCompetitionId ? "รอบสอบ" : `ปีการศึกษา ${group.year}`}</small></div><span className="admin-round-group-count shrink-0 rounded-md bg-[#efeffb] px-2 py-1 text-[9px] font-bold text-[#65619f]">{group.rounds.length} รอบ</span></div>
          <div className={`admin-round-accordion-list grid gap-[7px] ${selectedCompetitionId ? roundGridColumns[Math.min(group.rounds.length, 3)] : ""}`}>{group.rounds.map((exam) => {
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
            return <details id={`admin-exam-${encodeURIComponent(String(exam.id))}`} className={`admin-round-accordion group min-w-0 overflow-hidden rounded-[11px] border border-[#e2e5ef] bg-white transition-colors duration-150 hover:border-[#cfd2e7] open:border-[#c8c6e7] open:bg-[#fdfdff] motion-reduce:transition-none${exam.isOpen ? " admin-round-accordion-open" : ""}`} key={exam.id}>
              <summary className="admin-round-accordion-summary grid min-h-[70px] min-w-0 cursor-pointer list-none grid-cols-[32px_minmax(0,1fr)_17px] items-center gap-2 p-2.5 min-[701px]:min-h-16 min-[701px]:grid-cols-[34px_minmax(0,1fr)_auto_17px] min-[701px]:gap-2.5 min-[701px]:px-[13px]">
                <ExamLogo exam={exam} className={`exam-type-mark exam-card-${exam.accent} !h-8 !w-8 !rounded-[9px] min-[701px]:!h-[34px] min-[701px]:!w-[34px]`} iconSize={18} />
                <span className="admin-round-accordion-copy grid min-w-0 gap-[3px]">
                  <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#344260] min-[701px]:text-[13px]">{exam.title} {roundLabel} {exam.year}</strong>
                  <small className="overflow-hidden text-ellipsis whitespace-nowrap text-[9px] text-[#7f8ba1] min-[701px]:text-[10px]">{scheduleLabel} · Paper-Based ฿{Number(prices.paperBased || 0).toLocaleString()} · Online Exam ฿{Number(prices.onlineExam || 0).toLocaleString()}</small>
                </span>
                <span className={`admin-round-accordion-status col-start-2 row-start-2 justify-self-start whitespace-nowrap min-[701px]:col-auto min-[701px]:row-auto min-[701px]:justify-self-auto ${exam.isOpen ? "schedule-open" : isFinalRound && finalStatus === "waiting-results" ? "draft-badge" : "closed-badge"}`}>{statusLabel}</span>
                <Icon name="chevron" size={17} className="admin-round-accordion-chevron col-start-3 row-span-2 row-start-1 text-[#858eaa] transition-transform duration-[180ms] min-[701px]:col-auto min-[701px]:row-span-1 min-[701px]:row-start-auto" />
              </summary>
              <div className="admin-round-accordion-panel grid gap-3 border-t border-[#ececf3] bg-[#fcfcff] p-3 min-[701px]:px-3.5 min-[701px]:py-[15px]">
                <div className="admin-round-pricing-row flex min-w-0 flex-col gap-3 min-[701px]:flex-row min-[701px]:items-center min-[701px]:justify-between">
                  <div className="admin-round-price-summary grid w-full grid-cols-2 gap-1.5 min-[701px]:max-w-[390px] min-[701px]:flex-[0_1_390px]">
                    <span className="grid gap-0.5 rounded-lg border border-[#eef0f5] bg-[#fbfcff] px-2 py-1.5"><small className="text-[9px] text-[#8994a7]">Paper-Based</small><strong className="text-xs text-[#43516e]">฿{Number(prices.paperBased || 0).toLocaleString()}</strong></span>
                    <span className="grid gap-0.5 rounded-lg border border-[#eef0f5] bg-[#fbfcff] px-2 py-1.5"><small className="text-[9px] text-[#8994a7]">Online Exam</small><strong className="text-xs text-[#43516e]">฿{Number(prices.onlineExam || 0).toLocaleString()}</strong></span>
                  </div>
                  <div className="admin-round-actions ml-auto flex flex-wrap items-center justify-end gap-2 min-[701px]:ml-0">
                    {isFinalRound
                      ? exam.isOpen
                        ? <Button className="min-h-11 min-[701px]:min-h-[35px]" variant="outline" icon="close" onClick={() => requestExamStatusChange(exam)}>ปิดรับ Final</Button>
                        : finalStatus === "closed-manual"
                          ? <Button className="min-h-11 min-[701px]:min-h-[35px]" variant="outline" icon="check" disabled={!scheduleInWindow} title={scheduleInWindow ? "คืนสถานะเปิดรับอัตโนมัติ" : "เปิดคืนได้เฉพาะในช่วงวันที่กำหนด"} onClick={() => restoreFinalAutoStatus(exam)}>คืนสถานะอัตโนมัติ</Button>
                          : null
                      : <>
                        <Button className="min-h-11 min-[701px]:min-h-[35px]" variant={exam.isOpen ? "outline" : "primary"} icon={exam.isOpen ? "close" : "check"} disabled={!exam.isOpen && !scheduleInWindow} title={!exam.isOpen && !scheduleInWindow ? "เปิดรับได้เฉพาะในช่วงวันที่กำหนด" : ""} onClick={() => requestExamStatusChange(exam)}>{exam.isOpen ? "ปิดรับ" : "เปิดรับ"}</Button>
                        {isHeatRound ? <Button className="min-h-11 min-[701px]:min-h-[35px]" type="button" variant={heatIdsToGenerate ? "outline" : "success"} icon={heatIdsToGenerate ? "hash" : "check"} disabled={!registrationEnded || !heatIdsToGenerate} ariaLabel={`สร้างเลขประจำตัวสอบ ${exam.title} ${roundLabel} ปี ${exam.year}${!registrationEnded ? " · รอปิดรับสมัคร" : ""}`} title={!registrationEnded ? "ปิดรับสมัครก่อน หรือรอให้พ้นวันปิดรับสมัคร" : heatIdsToGenerate ? `สร้างเลขให้ ${heatIdsToGenerate} รายการสอบ` : "ไม่มีเลขประจำตัวที่ต้องสร้าง"} onClick={() => requestHeatIdGeneration(exam)}>{!registrationEnded ? "รอปิดรับก่อนสร้างเลข" : heatIdsToGenerate ? `สร้างเลขสอบ · ${heatIdsToGenerate} รายการ${heatHasExistingNumbers ? "ใหม่" : ""}` : heatItems.length ? "สร้างเลขแล้ว" : "ยังไม่มีผู้สมัคร"}</Button> : null}
                      </>}
                    {!exam.isOpen ? <Button type="button" variant="outline" icon="download" className="center-summary-download min-h-11 px-2 min-[701px]:min-h-[34px] min-[701px]:px-[9px] min-[701px]:text-[11px]" onClick={() => downloadCenterSummary(exam)}>สรุปศูนย์สอบ</Button> : null}
                    <Button variant="outline" className="admin-round-delete min-h-11 border-[#efd4db] bg-[#fffafb] text-[#a44e61] hover:border-[#d8a9b5] hover:bg-[#fff2f4] hover:text-[#873c4e] min-[701px]:min-h-[35px]" icon="trash" ariaLabel={`ลบ ${exam.title} ${exam.round || ""} ปี ${exam.year}`} title="ลบการ์ดรายการสอบนี้" onClick={async () => { if (!await confirmAction({ title: 'ลบรายการสอบ?', message: `${exam.title} ${roundLabel} ปี ${exam.year}`, confirmLabel: 'ลบรายการสอบ', tone: 'danger' })) return; onRemoveExam(exam.id); onRequestAutoSave(); notify(`ลบ ${exam.title} ${roundLabel} ปี ${exam.year} แล้ว · กำลังบันทึก`); }}>ลบ</Button>
                  </div>
                </div>
                {isFinalRound ? <div className="admin-final-auto-note flex items-start gap-2 rounded-lg border border-[#e8e5f8] bg-[#f8f7ff] px-2.5 py-2 text-[10px] leading-[1.5] text-[#706e9e]"><Icon className="mt-px shrink-0" name="info" size={14} /><span>เมื่อประกาศผล HEAT ระบบเปิดสิทธิ์ให้ผู้ผ่านยืนยันได้ภายในช่วงวันรับสมัคร Final โดยใช้วันปิดรับสมัครเดียวกัน</span></div> : null}
                <div className="admin-round-accordion-config grid gap-3 border-t border-[#ececf3] pt-3">
                  <strong className="text-xs text-[#4c5980]">กำหนดการและรายละเอียดรอบสอบ</strong>
                  <div className="admin-round-fields grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                    <label className="grid min-w-0 gap-1"><span className="text-xs font-semibold text-[#8491a3]">เริ่มรับสมัคร</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e8ef] bg-white px-2.5 text-sm text-[#596a81] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[43px] sm:text-[13px]" type="date" value={exam.openDate || ""} onChange={(event) => onUpdateExam(exam.id, { openDate: event.target.value })} /></label>
                    <label className="grid min-w-0 gap-1"><span className="text-xs font-semibold text-[#8491a3]">ปิดรับสมัคร{isFinalRound ? " / ยืนยันสิทธิ์ Final" : ""}</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e8ef] bg-white px-2.5 text-sm text-[#596a81] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[43px] sm:text-[13px]" type="date" value={exam.closeDate || ""} onChange={(event) => onUpdateExam(exam.id, { closeDate: event.target.value, ...(isFinalRound ? { finalConfirmCloseDate: event.target.value } : {}), closes: formatThaiDate(event.target.value) })} /></label>
                    <label className="grid min-w-0 gap-1"><span className="text-xs font-semibold text-[#8491a3]">วันสอบ</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e8ef] bg-white px-2.5 text-sm text-[#596a81] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[43px] sm:text-[13px]" type="date" value={exam.examDate || ""} onChange={(event) => onUpdateExam(exam.id, { examDate: event.target.value })} /></label>
                    <label className="grid min-w-0 gap-1"><span className="text-xs font-semibold text-[#8491a3]">เวลาเริ่มสอบ</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e8ef] bg-white px-2.5 text-sm text-[#596a81] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[43px] sm:text-[13px]" type="time" value={exam.examStartTime || ""} onChange={(event) => onUpdateExam(exam.id, { examStartTime: event.target.value })} /></label>
                    <label className="grid min-w-0 gap-1"><span className="text-xs font-semibold text-[#8491a3]">เวลาสิ้นสุด</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e8ef] bg-white px-2.5 text-sm text-[#596a81] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[43px] sm:text-[13px]" type="time" value={exam.examEndTime || ""} onChange={(event) => onUpdateExam(exam.id, { examEndTime: event.target.value })} /></label>
                    <label className="grid min-w-0 gap-1"><span className="text-xs font-semibold text-[#8491a3]">ปิดแก้ไขข้อมูล</span><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e8ef] bg-white px-2.5 text-sm text-[#596a81] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[43px] sm:text-[13px]" type="date" value={exam.editCloseDate || ""} onChange={(event) => onUpdateExam(exam.id, { editCloseDate: event.target.value })} /></label>
                  </div>
                  <div className="admin-round-price-edit mt-2 grid grid-cols-2 gap-2">
                    <label className="grid min-w-0 gap-1"><span className="text-xs font-semibold text-[#8491a3]">Paper-Based</span><div className="flex min-w-0 items-center gap-1"><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e8ef] bg-white px-2.5 text-sm text-[#596a81] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[38px] sm:text-xs" type="number" min="0" value={prices.paperBased ?? 0} onChange={(event) => onUpdateExam(exam.id, { prices: { ...prices, paperBased: Math.max(0, Number(event.target.value) || 0) } })} /><b className="shrink-0 text-[9px] font-semibold text-[#8290a3]">บาท</b></div></label>
                    <label className="grid min-w-0 gap-1"><span className="text-xs font-semibold text-[#8491a3]">Online Exam</span><div className="flex min-w-0 items-center gap-1"><input className="min-h-11 w-full min-w-0 rounded-lg border border-[#e3e8ef] bg-white px-2.5 text-sm text-[#596a81] outline-none focus:border-[#8d89d1] focus:ring-2 focus:ring-[#8d89d1]/15 sm:min-h-[38px] sm:text-xs" type="number" min="0" value={prices.onlineExam ?? 0} onChange={(event) => onUpdateExam(exam.id, { prices: { ...prices, onlineExam: Math.max(0, Number(event.target.value) || 0) } })} /><b className="shrink-0 text-[9px] font-semibold text-[#8290a3]">บาท</b></div></label>
                  </div>
                  <div className="admin-round-selection-grid grid min-w-0 grid-cols-1 items-start gap-2.5 min-[701px]:grid-cols-2">
                    <GradeSelectionList grades={gradeCatalog} selectedGrades={exam.gradeOptions || []} onChange={(gradeOptions) => { if (exam.isOpen && !gradeOptions.length) { notify("รายการสอบที่เปิดรับต้องมีระดับชั้นอย่างน้อยหนึ่งระดับ"); return; } onUpdateExam(exam.id, { gradeOptions }); }} label="ระดับชั้นที่เปิดรับในรายการนี้" />
                    <CenterSelectionList centers={centerCatalog} selectedIds={exam.centerIds || []} onChange={(centerIds) => onUpdateExam(exam.id, { centerIds })} label="ศูนย์สอบ Paper-Based ที่เปิดในรอบนี้" />
                  </div>
                  <div className="admin-round-logo-row flex min-w-0 flex-wrap items-center gap-2 border-t border-[#ececf3] pt-2.5"><span className="mr-auto text-[11px] text-[#8491a3]">โลโก้รายการ</span><label className="admin-exam-logo-button relative inline-flex min-h-11 items-center gap-1.5 overflow-hidden rounded-lg border border-[#dcd9ef] bg-[#f8f7ff] px-2 text-[10px] font-bold text-[#494691] transition-colors hover:border-[#aaa6d9] hover:bg-[#f0effb] min-[701px]:min-h-[32px]"><Icon name="upload" size={14} />{exam.logoDataUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}<input className="absolute inset-0 h-full w-full cursor-pointer opacity-0" type="file" accept="image/png,image/jpeg,image/webp" aria-label={`อัปโหลดโลโก้ ${exam.title} ${exam.round}`} onChange={(event) => { readLogoFile(event.target.files?.[0], (logoDataUrl) => onUpdateExam(exam.id, { logoDataUrl })); event.target.value = ""; }} /></label><small className="text-[10px] text-[#929cad]">PNG · JPG · WEBP ไม่เกิน 5 MB</small></div>
                  <div className="admin-round-card-save mt-1 flex flex-col gap-2.5 border-t border-[#eceaf4] pt-3.5 text-xs text-[#758099] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"><span>{dirtyExamIds.includes(exam.id) ? "มีการเปลี่ยนแปลงในรอบนี้" : "ข้อมูลรอบนี้บันทึกแล้ว"}</span><Button className="min-h-11 w-full sm:min-h-9 sm:w-auto" type="button" variant="outline" icon="check" disabled={!dirtyExamIds.includes(exam.id) || catalogSaveState.status === "saving"} onClick={() => onSaveExam(exam.id)}>{catalogSaveState.status === "saving" ? "กำลังบันทึก…" : "บันทึกรอบนี้"}</Button></div>
                </div>
              </div>
            </details>;
          })}</div>
        </section>)}{!visibleExams.length ? <div className="empty-inline"><Icon name="calendar" /><span>{selectedCompetitionId ? `ยังไม่มีรอบสอบใน ${pageCompetitionTitle}` : "ยังไม่มีรายการสอบในปีการศึกษานี้"}</span></div> : null}</div>
      </section>
      </> : null}
      {pageMode === "form-options" ? <CatalogOptions
        examCatalog={examCatalog}
        gradeCatalog={gradeCatalog}
        newGradeName={newGradeName}
        setNewGradeName={setNewGradeName}
        onAddGradeOption={addGradeOption}
        onRemoveGradeOption={removeGradeOption}
        centerCatalog={centerCatalog}
        centerFile={centerFile}
        centerPreview={centerPreview}
        excludeCenterIssues={excludeCenterIssues}
        setExcludeCenterIssues={setExcludeCenterIssues}
        onStageCenterFile={stageCenterFile}
        onApplyCenterImport={applyCenterImport}
        onSaveCenterEdit={saveCenterEdit}
        onUpdateCenter={updateCenter}
        onDeactivateCenter={deactivateCenter}
        newCenterCode={newCenterCode}
        setNewCenterCode={setNewCenterCode}
        newCenterName={newCenterName}
        setNewCenterName={setNewCenterName}
        onAddCenter={addCenter}
        centerPosterVersion={centerPosterVersion}
        onCenterPosterVersionChange={onCenterPosterVersionChange}
        paymentAccounts={paymentAccounts}
        selectedPaymentAccountId={selectedPaymentAccountId}
        onUpdatePaymentAccount={updatePaymentAccount}
        onRemovePaymentAccount={removePaymentAccount}
        newPaymentAccount={newPaymentAccount}
        setNewPaymentAccount={setNewPaymentAccount}
        onAddPaymentAccount={addPaymentAccount}
        pastPaperCatalog={pastPaperCatalog}
        setPastPaperCatalog={setPastPaperCatalog}
        paperGroupOptions={paperGroupOptions}
        newPaperGroup={newPaperGroup}
        setNewPaperGroup={setNewPaperGroup}
        newPaperName={newPaperName}
        setNewPaperName={setNewPaperName}
        newPaperPrice={newPaperPrice}
        setNewPaperPrice={setNewPaperPrice}
        onAddPastPaper={addPastPaper}
        onRemovePastPaper={removePastPaper}
      /> : null}
    </div>
  );
}
