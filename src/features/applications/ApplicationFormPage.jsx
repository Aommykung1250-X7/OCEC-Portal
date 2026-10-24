import { useState } from "react";
import { DEFAULT_CENTER_CATALOG, ONLINE_CENTER_CODE, getCommonCenters, isOnlineCenter } from "../../centers.js";
import { formatThaiDate, getExamRoundType } from "../../examUtils.js";
import { getFormCompetitions } from "../../applicationCatalog.js";
import { Button, Icon, PageHeading } from "../../components/ui/index.jsx";
import { ApplicationField } from "./FormFields.jsx";
import { getActiveExamYear, getApplicationCompetitionFormat, getApplicationCompetitionExamEmail, isFinalConfirmationWindowOpen, normalizeExamFormat } from "./applicationUtils.js";
import { createSchoolApplicant, formatExamSession, getCompetitionExamEmailValue, getCompetitionExamPrice, groupPastPaperCatalog, getSlipMimeType, readFileAsDataUrl, selectedExamDateText } from "./formUtils.js";
import { FORM_SCHOOLS } from "./formCatalog.js";
import { CompetitionFormatPicker, CompetitionPriceSummary, PaymentAccountCards } from "./FormOptions.jsx";
import { SchoolBatchForm } from "./SchoolBatchForm.jsx";
import { CenterPosterPreview } from "./CenterPosterPreview.jsx";

export function ApplicationFormPage({ kind, prefill, applicationMode, allowedRoundIds, onSubmit, navigate, competitionFees, examCatalog, competitionCatalog, centerCatalog, pastPaperCatalog, paymentAccounts, centerPosterVersion = null, backendEnabled = false }) {
  const isFinal = kind === "Final";
  const examRoundType = isFinal ? "FINAL" : "HEAT";
  const examYear = isFinal && prefill?.year ? prefill.year : getActiveExamYear(examCatalog, examRoundType);
  // Final applications are reached only through a verified HEAT result; show the matching Final rounds
  // after that gate even when the public registration card is still marked closed.
  const catalogCompetitions = getFormCompetitions(examCatalog, competitionCatalog, examRoundType, {
    openOnly: !isFinal,
    year: examYear,
    ...(isFinal && Array.isArray(allowedRoundIds) ? { roundIds: allowedRoundIds } : {}),
  });
  const allowedFinalRounds = Array.isArray(allowedRoundIds) ? new Set(allowedRoundIds) : null;
  const openCompetitions = isFinal
    ? catalogCompetitions.filter((competition) => {
      const exam = examCatalog.find((entry) => entry.id === competition.roundId);
      return Boolean(exam && exam.competitionId === competition.id && exam.year === examYear
        && getExamRoundType(exam) === "FINAL" && !exam.finalManuallyClosed
        && isFinalConfirmationWindowOpen(exam) && (!allowedFinalRounds || allowedFinalRounds.has(exam.id)));
    })
    : catalogCompetitions;
  const competitions = isFinal && prefill?.competitions?.length
    ? openCompetitions.filter((competition) => prefill.competitions.some((selected) => selected.id === competition.id))
    : openCompetitions;
  const pastPaperGroups = groupPastPaperCatalog(pastPaperCatalog);
  const formPaymentAccounts = (paymentAccounts || []).filter((account) => account.active !== false && account.showInForm !== false);
  const activeCenterCatalog = centerCatalog?.length ? centerCatalog : backendEnabled ? [] : DEFAULT_CENTER_CATALOG;
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
  const roundIdForCompetition = (competitionId) => competitions.find((competition) => competition.id === competitionId)?.roundId;
  const centersForCompetition = (competitionId) => getCommonCenters([competitionId], examCatalog, activeCenterCatalog, { year: examYear, roundType: examRoundType, roundId: roundIdForCompetition(competitionId) });
  const priceForCompetition = (competition, format = formatForCompetition(competition.id)) => getCompetitionExamPrice(examCatalog, competition.id, examRoundType, format, competitionFees, examYear, competition.roundId);
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
      setFileError("รองรับไฟล์ JPG, PNG และ PDF เท่านั้น");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileName("");
      setSlipFile(null);
      setFileError("ขนาดไฟล์ต้องไม่เกิน 10 MB");
      return;
    }
    setFileName("กำลังอ่านหลักฐานการชำระเงิน…");
    setSlipFile(null);
    setFileError("");
    try {
      setSlipFile({ name: file.name, type: fileType, dataUrl: await readFileAsDataUrl(file) });
      setFileName(file.name);
      setFileError("");
    } catch (error) {
      setFileName("");
      setSlipFile(null);
      setFileError(error.message || "ไม่สามารถอ่านหลักฐานการชำระเงินได้");
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
    if (selectedCompetitions.some((competition) => !competition.grades.includes(form.grades[competition.id]))) {
      setSelectionError("กรุณาเลือกระดับชั้นที่เปิดรับในแต่ละรายการสอบ");
      return;
    }
    const missingCenter = selectedCompetitions.find((competition) => formatForCompetition(competition.id) === "Paper-Based"
      && !centersForCompetition(competition.id).some((center) => center.name === centerForCompetition(competition.id)));
    if (missingCenter) {
      setPaymentError(`กรุณาเลือกศูนย์สอบที่เปิดรับสำหรับ ${missingCenter.short || missingCenter.name}`);
      return;
    }
    const invalidOnlineEmail = selectedCompetitions.find((competition) => formatForCompetition(competition.id) === "Online"
      && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(examEmailForCompetition(competition.id).trim()));
    if (invalidOnlineEmail) {
      setPaymentError(`กรุณากรอกอีเมลเข้าสอบที่ถูกต้องสำหรับ ${invalidOnlineEmail.short || invalidOnlineEmail.name}`);
      return;
    }
    if (!formPaymentAccounts.length) {
      setPaymentError("ขณะนี้ไม่มีบัญชีรับโอนเงินแสดงในแบบฟอร์ม โปรดติดต่อผู้ดูแลระบบ");
      return;
    }
    if (!form.confirmDetails) {
      setPaymentError("กรุณายืนยันว่าได้ตรวจสอบข้อมูลและยอดชำระเงินเรียบร้อยแล้ว");
      return;
    }
    if (!fileName || !slipFile?.dataUrl) {
      setFileError("กรุณาแนบหลักฐานการชำระเงินก่อนส่งใบสมัคร");
      return;
    }
    setFileError("");
    const candidate = `${form.firstName} ${form.lastName}`.trim();
    const school = form.schoolName === "Other" ? form.certificateSchoolName : form.schoolName;
    const examListings = selectedCompetitions.map((competition) => {
      const format = formatForCompetition(competition.id);
      const selectedCenter = format === "Online"
        ? activeCenterCatalog.find((center) => center.code === ONLINE_CENTER_CODE) || (!backendEnabled ? DEFAULT_CENTER_CATALOG.find((center) => center.code === ONLINE_CENTER_CODE) : null)
        : centersForCompetition(competition.id).find((center) => center.name === centerForCompetition(competition.id));
      const fee = priceForCompetition(competition);
      return { ...competition, grade: form.grades[competition.id], format, examEmail: format === "Online" ? examEmailForCompetition(competition.id).trim() : "", fee, chargedFee: fee, center: selectedCenter?.name || "", centerId: selectedCenter?.id || "", centerCode: selectedCenter?.code || "", centerSnapshot: selectedCenter ? { id: selectedCenter.id, code: selectedCenter.code, name: selectedCenter.name } : null };
    });
    const formats = new Set(examListings.map((listing) => listing.format));
    const centersSummary = [...new Set(examListings.map((listing) => listing.center).filter(Boolean))].join(" · ");
    const legacyCenter = formats.size === 1 && formats.has("Online")
      ? activeCenterCatalog.find((center) => center.code === ONLINE_CENTER_CODE) || (!backendEnabled ? DEFAULT_CENTER_CATALOG[0] : null)
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
    return <SchoolBatchForm kind={kind} prefill={prefill} batch={schoolBatch} setBatch={setSchoolBatch} onSubmit={onSubmit} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} examYear={examYear} centerCatalog={centerCatalog} pastPaperCatalog={pastPaperCatalog} paymentAccounts={paymentAccounts} competitions={competitions} schools={schools} centerPosterVersion={centerPosterVersion} backendEnabled={backendEnabled} onBack={() => { setApplicationSource("self"); update("source", "self"); }} />;
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow={isFinal ? `OCEC Final ${examYear}` : `เปิดรับสมัคร · ปีการศึกษา ${examYear}`}
        title={isFinal ? "สมัครสอบ Final" : "สมัครสอบ OCEC"}
        description={isFinal ? "ตรวจสอบข้อมูลและกรอกข้อมูลผู้เข้าสอบ รายการสอบ และการชำระเงินให้ครบในแบบฟอร์มเดียว" : "เลือกรายการที่เปิดรับสมัครและเลือกระดับชั้นแยกกันได้ในแบบฟอร์มเดียว"}
        action={<Button variant="outline" icon="arrow" onClick={() => navigate(isFinal ? "final-confirm" : "home")}>ยกเลิก</Button>}
      />
      <div className="form-layout grid min-w-0 grid-cols-1 items-start gap-4 min-[801px]:grid-cols-[minmax(0,1fr)_255px] min-[1021px]:grid-cols-[minmax(0,1fr)_300px]">
        <form className="surface form-surface registration-form grid gap-0 rounded-2xl p-4 sm:p-5 xl:p-[clamp(20px,2.5vw,34px)]" onSubmit={submit}>
          <section className="form-zone mb-6 min-w-0 border-b border-ocec-border pb-7 last:mb-0 last:border-b-0 last:pb-0" aria-labelledby="zone-student">
          <div className="form-progress mb-5 flex items-start gap-3 border-b border-ocec-border pb-4"><span className="form-progress-number grid size-10 shrink-0 place-items-center rounded-xl bg-ocec-brand text-base font-bold text-white">01</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-base font-bold leading-snug text-ocec-brand md:text-lg" id="zone-student">Student Information <span className="text-sm font-medium text-ocec-muted">/ ข้อมูลผู้สมัคร</span></strong><small className="text-sm leading-relaxed text-ocec-muted">โปรดกรอกชื่อให้ตรงกับเอกสารที่ใช้ในการสอบและการออกใบประกาศนียบัตร</small></div><span className="shrink-0 text-xs text-ocec-muted"><span className="required-mark">*</span> จำเป็น</span></div>
          {!isFinal ? (
            <div className="source-choice mb-4 grid gap-2">
              <span className="field-title text-sm font-semibold text-ocec-brand">สมัครในนาม</span>
              <div className="source-choice-grid grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className={`flex min-h-[62px] cursor-pointer items-center gap-2.5 rounded-xl border border-ocec-border bg-white p-3 transition-colors motion-reduce:transition-none hover:border-ocec-accent focus-within:ring-4 focus-within:ring-ocec-accent/20 has-[:checked]:border-ocec-accent has-[:checked]:bg-ocec-brand-soft has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-ocec-accent)] ${applicationSource === "self" ? "source-selected" : ""}`}><input className="m-0 accent-ocec-brand" type="radio" name="source" checked={applicationSource === "self"} onChange={() => { setApplicationSource("self"); update("source", "self"); }} /><span className="source-option-icon grid size-9 shrink-0 place-items-center rounded-lg bg-ocec-brand-soft text-ocec-brand"><Icon name="users" /></span><span className="flex min-w-0 flex-col gap-0.5"><strong className="text-sm font-semibold text-ocec-brand">ผู้สมัครเอง</strong><small className="text-xs text-ocec-muted">ยื่นใบสมัครด้วยบัญชีส่วนตัว</small></span></label>
                <label className={`flex min-h-[62px] cursor-pointer items-center gap-2.5 rounded-xl border border-ocec-border bg-white p-3 transition-colors motion-reduce:transition-none hover:border-ocec-accent focus-within:ring-4 focus-within:ring-ocec-accent/20 has-[:checked]:border-ocec-accent has-[:checked]:bg-ocec-brand-soft has-[:checked]:shadow-[inset_0_0_0_1px_var(--color-ocec-accent)] ${applicationSource === "school" ? "source-selected" : ""}`}><input className="m-0 accent-ocec-brand" type="radio" name="source" checked={applicationSource === "school"} onChange={() => { setApplicationSource("school"); update("source", "school"); }} /><span className="source-option-icon grid size-9 shrink-0 place-items-center rounded-lg bg-ocec-brand-soft text-ocec-brand"><Icon name="building" /></span><span className="flex min-w-0 flex-col gap-0.5"><strong className="text-sm font-semibold text-ocec-brand">โรงเรียน</strong><small className="text-xs text-ocec-muted">ผู้ประสานงานโรงเรียนเป็นผู้ยื่นใบสมัคร</small></span></label>
              </div>
            </div>
          ) : (
            <div className="notice notice-blue"><Icon name="info" /><div><strong>ข้อมูลจากใบสมัครรอบ HEAT · เลขประจำตัวสอบ {prefill?.heatId}</strong><p>โปรดตรวจสอบข้อมูลที่ระบบกรอกไว้ และกรอกข้อมูลในช่องที่ยังว่างก่อนส่งใบสมัครรอบ Final</p></div></div>
          )}
          <div className="form-grid grid grid-cols-1 gap-x-3 gap-y-4 md:grid-cols-2">
            <ApplicationField label="English First Name" required><input autoComplete="given-name" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} placeholder="First name" required /></ApplicationField>
            <ApplicationField label="English Last Name" required><input autoComplete="family-name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} placeholder="Last name" required /></ApplicationField>
            <ApplicationField label="ชื่อ (ภาษาไทย)" required><input value={form.thaiFirstName} onChange={(event) => update("thaiFirstName", event.target.value)} placeholder="ชื่อจริงภาษาไทย" required /></ApplicationField>
            <ApplicationField label="นามสกุล (ภาษาไทย)" required><input value={form.thaiLastName} onChange={(event) => update("thaiLastName", event.target.value)} placeholder="นามสกุลภาษาไทย" required /></ApplicationField>
            <fieldset className="gender-fieldset m-0 grid min-w-0 gap-2 border-0 p-0"><legend className="field-title text-xs font-semibold text-ocec-brand">Gender / เพศ <span className="required-mark">*</span></legend><div className="gender-options flex flex-wrap gap-x-4 gap-y-2">{[["Male", "ชาย"], ["Female", "หญิง"], ["Prefer not to say", "ไม่ประสงค์ระบุ"]].map(([value, label]) => <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ocec-muted-strong" key={value}><input className="size-4 accent-ocec-brand" type="radio" name="gender" value={value} checked={form.gender === value} onChange={() => update("gender", value)} required /><span>{label}</span></label>)}</div></fieldset>
            <ApplicationField label="Date of Birth / วันเกิด" required><input type="date" autoComplete="bday" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} required /></ApplicationField>
            <ApplicationField label="School Name / โรงเรียน" required hint="โปรดเลือกชื่อโรงเรียนจากรายการ หากไม่พบ ให้เลือก Other แล้วกรอกชื่อโรงเรียนในช่องถัดไป"><select value={form.schoolName} onChange={(event) => { const schoolName = event.target.value; setForm((current) => ({ ...current, schoolName, certificateSchoolName: schoolName === "Other" ? "" : current.certificateSchoolName })); }} required><option value="">เลือกโรงเรียน</option>{schools.map((school) => <option key={school} value={school}>{school === "Other" ? "Other / ไม่มีชื่อโรงเรียนในรายการ" : school}</option>)}</select></ApplicationField>
            <ApplicationField label={form.schoolName === "Other" ? "School Name in English / ชื่อโรงเรียน" : "School Name in English for Certificate"} required={form.schoolName === "Other"} hint={form.schoolName === "Other" ? "ระบุชื่อโรงเรียนเป็นภาษาอังกฤษสำหรับแสดงบนเกียรติบัตร" : "เลือก Other หากต้องการระบุชื่อโรงเรียนบนเกียรติบัตรด้วยตนเอง"}><input value={form.certificateSchoolName} onChange={(event) => update("certificateSchoolName", event.target.value)} placeholder={form.schoolName === "Other" ? "ระบุชื่อโรงเรียนเป็นภาษาอังกฤษ" : "เลือก Other เพื่อพิมพ์ชื่อโรงเรียน"} required={form.schoolName === "Other"} disabled={form.schoolName !== "Other"} /></ApplicationField>
            <ApplicationField label="Email / อีเมล" required hint="ระบบจะส่งข้อมูลสำหรับเข้าใช้งานข้อสอบเก่าภายใน 3–5 วันหลังยื่นใบสมัคร"><input type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="student@example.com" required /></ApplicationField>
            <ApplicationField label="Phone Number / หมายเลขโทรศัพท์" required><input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="0812345678" required /></ApplicationField>
            <section className="address-subzone col-span-full min-w-0 rounded-xl border border-ocec-border bg-ocec-background p-3 sm:p-4" aria-labelledby="address-subzone-title">
              <div className="address-subzone-heading mb-3 flex items-center gap-2"><span className="address-subzone-icon grid size-8 shrink-0 place-items-center rounded-lg bg-ocec-brand-soft text-ocec-brand"><Icon name="building" size={15} /></span><div className="flex min-w-0 flex-col gap-0.5"><h3 className="m-0 text-sm font-semibold leading-snug text-ocec-brand" id="address-subzone-title">Address <span className="text-ocec-muted">/ ที่อยู่</span></h3><p className="m-0 text-xs text-ocec-muted">โปรดระบุที่อยู่สำหรับติดต่อ</p></div></div>
              <div className="address-subzone-grid grid grid-cols-1 gap-3 md:grid-cols-2">
                <ApplicationField label="Address Line 1 / ที่อยู่" required><input autoComplete="address-line1" value={form.address1} onChange={(event) => update("address1", event.target.value)} placeholder="บ้านเลขที่ ถนน" required /></ApplicationField>
                <ApplicationField label="Address Line 2 / ที่อยู่เพิ่มเติม"><input autoComplete="address-line2" value={form.address2} onChange={(event) => update("address2", event.target.value)} placeholder="อาคาร หมู่บ้าน (หากมี)" /></ApplicationField>
                <ApplicationField label="District / City / เขตหรืออำเภอ" required><input autoComplete="address-level2" value={form.city} onChange={(event) => update("city", event.target.value)} required /></ApplicationField>
                <ApplicationField label="Province / จังหวัด" required><input autoComplete="address-level1" value={form.province} onChange={(event) => update("province", event.target.value)} required /></ApplicationField>
                <ApplicationField label="Postal Code / รหัสไปรษณีย์" required><input autoComplete="postal-code" inputMode="numeric" maxLength={10} value={form.postalCode} onChange={(event) => update("postalCode", event.target.value.replace(/[^\d-]/g, ""))} required /></ApplicationField>
              </div>
            </section>
          </div>
          </section>
          <section className="form-zone mb-6 min-w-0 border-b border-ocec-border pb-7 last:mb-0 last:border-b-0 last:pb-0" aria-labelledby="zone-competition">
            <div className="form-progress mb-5 flex items-start gap-3 border-b border-ocec-border pb-4"><span className="form-progress-number grid size-10 shrink-0 place-items-center rounded-xl bg-ocec-brand text-base font-bold text-white">02</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-base font-bold leading-snug text-ocec-brand md:text-lg" id="zone-competition">Competition Selection <span className="text-sm font-medium text-ocec-muted">/ เลือกรายการสอบและระดับชั้น</span></strong><small className="text-sm leading-relaxed text-ocec-muted">เลือกรายการที่ต้องการสมัคร แล้วเลือกระดับชั้นแยกในแต่ละรายการ</small></div></div>
            {selectedCompetitions.some((competition) => formatForCompetition(competition.id) === "Paper-Based") ? <CenterPosterPreview version={centerPosterVersion} backendEnabled={backendEnabled} /> : null}
            <div className="competition-list grid min-w-0 grid-cols-1 gap-3">
              {competitions.map((competition) => {
                const selected = form.competitionIds.includes(competition.id);
                const competitionExam = (examCatalog || []).find((exam) => exam.id === competition.roundId)
                  || (examCatalog || []).find((exam) => exam.competitionId === competition.id && exam.year === examYear && getExamRoundType(exam) === examRoundType);
                const format = formatForCompetition(competition.id);
                const paperPrice = priceForCompetition(competition, "Paper-Based");
                const onlinePrice = priceForCompetition(competition, "Online");
                const competitionCenters = selected && format === "Paper-Based" ? centersForCompetition(competition.id) : [];
                return <article className={`competition-card min-w-0 rounded-xl border border-ocec-border bg-white p-3 transition-colors motion-reduce:transition-none sm:p-4${selected ? " competition-card-selected border-ocec-accent bg-ocec-brand-soft shadow-[inset_0_0_0_1px_var(--color-ocec-accent)]" : ""}`} key={competition.id}>
                  <label className="competition-select"><input type="checkbox" checked={selected} onChange={() => toggleCompetition(competition.id)} /><span className="competition-check-mark" aria-hidden="true" /><span><strong>{competition.name}</strong><small>{competition.subject}</small><small className="competition-session"><Icon name="clock" size={12} />สอบ {formatExamSession(competitionExam)}</small></span><CompetitionPriceSummary selected={selected} format={format} paperPrice={paperPrice} onlinePrice={onlinePrice} /></label>
                  {selected ? <div className="competition-card-options mt-3 grid min-w-0 grid-cols-1 gap-3 border-t border-ocec-border pt-3 min-[701px]:ml-[27px] min-[701px]:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)]">
                    <CompetitionFormatPicker variant="application" competitionId={competition.id} format={format} paperPrice={paperPrice} onlinePrice={onlinePrice} onChange={(nextFormat) => updateCompetitionFormat(competition.id, nextFormat)} />
                    {format === "Paper-Based" ? <ApplicationField label={`ศูนย์สอบ ${competition.short}`} required className="competition-center-field col-span-full"><select value={centerForCompetition(competition.id)} onChange={(event) => updateCompetitionCenter(competition.id, event.target.value)} required><option value="">เลือกศูนย์สอบ</option>{centerForCompetition(competition.id) && !isOnlineCenter(centerForCompetition(competition.id)) && !competitionCenters.some((center) => center.name === centerForCompetition(competition.id)) ? <option value={centerForCompetition(competition.id)}>{centerForCompetition(competition.id)} · กรุณาเลือกศูนย์ที่เปิด</option> : null}{competitionCenters.map((center) => <option key={center.id} value={center.name}>{center.name}</option>)}</select>{!competitionCenters.length ? <small className="field-hint-error">ยังไม่มีศูนย์สอบที่เปิดรับสำหรับรายการนี้</small> : null}</ApplicationField> : <div className="competition-online-fields col-span-full grid min-w-0 grid-cols-1 gap-3"><ApplicationField label={`อีเมลเข้าสอบ ${competition.short}`} required className="competition-exam-email min-w-0" hint="สามารถใช้ที่อยู่อีเมลเดียวกับรายการสอบอื่นได้ หากใช้บัญชีเดียวกัน"><input type="email" autoComplete="email" value={examEmailForCompetition(competition.id)} onChange={(event) => updateCompetitionExamEmail(competition.id, event.target.value)} placeholder="student@gmail.com" required /></ApplicationField></div>}
                    <ApplicationField label={`ระดับชั้น ${competition.short}`} required className="competition-grade col-span-full grid gap-2 border-t border-ocec-border pt-3"><select value={competition.grades.includes(form.grades[competition.id]) ? form.grades[competition.id] : ""} onChange={(event) => { setForm((current) => ({ ...current, grades: { ...current.grades, [competition.id]: event.target.value } })); setSelectionError(""); }} required><option value="">เลือกระดับชั้น</option>{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}</select></ApplicationField>
                  </div> : null}
                </article>;
              })}
              {!competitions.length ? <div className="empty-inline flex min-w-0 items-center gap-2 rounded-xl border border-dashed border-ocec-border bg-ocec-background p-4 text-sm leading-relaxed text-ocec-muted"><Icon className="shrink-0" name="calendar" /><span>ขณะนี้ยังไม่มีรายการสอบรอบนี้ที่เปิดรับสมัคร</span></div> : null}
            </div>
            <div className="schedule-note mt-3 flex min-w-0 items-start gap-2.5 rounded-xl border border-ocec-border bg-ocec-brand-soft p-3 text-ocec-brand"><Icon className="mt-0.5 shrink-0" name="calendar" size={16} /><div className="flex min-w-0 flex-col gap-1"><strong className="text-sm font-semibold">{isFinal ? "การสมัครรอบ Final" : "กำหนดการรอบสอบ"}</strong><span className="text-sm leading-relaxed">{isFinal ? "ใบสมัครรอบ Final แยกจากรอบ HEAT และต้องแนบหลักฐานการชำระเงินใหม่" : `ปิดรับสมัคร ${formatThaiDate(scheduleExam?.closeDate)} · วันสอบ ${formatThaiDate(scheduleExam?.examDate)}`}</span><small className="text-xs leading-relaxed text-ocec-muted">{isFinal ? "โปรดตรวจสอบรายการสอบและระดับชั้นจากรอบ HEAT ก่อนส่งใบสมัคร" : "โปรดตรวจสอบเวลาเข้าสอบในรายละเอียดของแต่ละรายการ"}</small></div></div>
            {selectionError ? <p className="inline-error selection-error mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-700" role="alert"><Icon className="mt-0.5 shrink-0" name="info" size={16} />{selectionError}</p> : null}
          </section>
          {selectedCompetitions.length ? <p className="form-helper-note mb-4 rounded-lg bg-ocec-background px-3 py-2 text-xs leading-relaxed text-ocec-muted">โปรดตรวจสอบระดับชั้น รูปแบบสอบ ศูนย์สอบ หรืออีเมลเข้าสอบในแต่ละรายการก่อนชำระเงิน</p> : null}
          <section className="form-zone mb-6 min-w-0 border-b border-ocec-border pb-7 last:mb-0 last:border-b-0 last:pb-0" aria-labelledby="zone-papers">
            <div className="form-progress mb-5 flex items-start gap-3 border-b border-ocec-border pb-4"><span className="form-progress-number grid size-10 shrink-0 place-items-center rounded-xl bg-ocec-brand text-base font-bold text-white">03</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-base font-bold leading-snug text-ocec-brand md:text-lg" id="zone-papers">Past Papers <span className="text-sm font-medium text-ocec-muted">/ ข้อสอบเก่า</span></strong><small className="text-sm leading-relaxed text-ocec-muted">สามารถเลือกซื้อข้อสอบเพิ่มเติมได้ ระบบจะส่งข้อมูลสำหรับเข้าใช้งานทางอีเมล</small></div><span className="paper-total-chip shrink-0 rounded-full bg-ocec-brand-soft px-2 py-1 text-xs font-semibold text-ocec-brand">รวม ฿{pastPapersTotal.toLocaleString()}</span></div>
            <div className="past-paper-grid grid min-w-0 grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3">{pastPaperGroups.map((group) => <fieldset className="past-paper-group m-0 min-w-0 rounded-xl border border-ocec-border bg-white p-3" key={group.id}><legend className="max-w-full px-1 text-xs font-semibold text-ocec-brand">{group.title}</legend><div className="grid gap-1">{group.items.map((paper) => <label key={paper.id} className="past-paper-option flex min-w-0 min-h-11 cursor-pointer items-start gap-2 border-b border-slate-200 py-3 last:border-b-0"><input className="mt-1 size-4 shrink-0 accent-ocec-brand" type="checkbox" checked={form.pastPaperIds.includes(paper.id)} onChange={() => togglePastPaper(paper.id)} /><span className="past-paper-copy grid min-w-0 flex-1 gap-1"><strong className="break-words text-xs font-semibold leading-snug text-ocec-ink">{paper.title}</strong><small className="break-words text-xs leading-snug text-ocec-muted">{paper.detail}</small></span><b className="shrink-0 whitespace-nowrap text-xs font-bold text-ocec-brand">฿{paper.price}</b></label>)}</div></fieldset>)}</div>
            <div className="past-paper-info mt-3 rounded-xl border border-ocec-border bg-ocec-background p-3 text-sm leading-relaxed text-ocec-muted"><strong className="text-sm font-semibold text-ocec-brand">📚 ข้อมูลข้อสอบเก่า</strong><p className="my-1 text-xs leading-relaxed"><b>HKISO / HKICO:</b> English Version · <b>Big Bay Bei:</b> English + Thai Version พร้อม VDO ภาษาไทย</p><p className="my-1 text-xs leading-relaxed">เข้าใช้งานผ่าน <a className="font-semibold text-ocec-brand underline underline-offset-2" href="https://www.learnocecth.com/" target="_blank" rel="noreferrer">Learn OCEC Thailand</a> เจ้าหน้าที่จะส่งข้อมูลทางอีเมลภายใน 3–5 วันหลังยื่นใบสมัคร</p><small className="mt-1 block text-xs leading-relaxed text-ocec-muted">ข้อสอบที่ซื้อจะตรงกับระดับชั้นที่สมัคร · หากต้องการข้อสอบระดับชั้นเพิ่มเติม ติดต่อ LINE Official: <b>@ocecth</b> · หากไม่พบอีเมล โปรดตรวจสอบโฟลเดอร์ Junk หรือ Spam</small></div>
          </section>
          <section className="form-zone form-zone-payment min-w-0" aria-labelledby="zone-payment">
            <div className="form-progress mb-5 flex items-start gap-3 border-b border-ocec-border pb-4"><span className="form-progress-number grid size-10 shrink-0 place-items-center rounded-xl bg-ocec-brand text-base font-bold text-white">04</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-base font-bold leading-snug text-ocec-brand md:text-lg" id="zone-payment">Payment and Confirmation <span className="text-sm font-medium text-ocec-muted">/ ชำระเงินและยืนยัน</span></strong><small className="text-sm leading-relaxed text-ocec-muted">โปรดตรวจสอบยอดชำระเงินก่อนแนบหลักฐาน</small></div></div>
            <div className="payment-total-grid grid grid-cols-1 gap-2 min-[701px]:grid-cols-3"><div className="flex min-w-0 min-h-[82px] flex-col justify-center gap-1 rounded-xl border border-ocec-border bg-ocec-background p-3"><span className="text-xs font-semibold text-ocec-muted-strong">ข้อสอบเก่า</span><small className="min-h-0 text-xs leading-snug text-ocec-muted">Past Papers Total</small><strong className="text-lg font-bold text-ocec-ink">฿{pastPapersTotal.toLocaleString()}</strong></div><div className="flex min-w-0 min-h-[82px] flex-col justify-center gap-1 rounded-xl border border-ocec-border bg-ocec-background p-3"><span className="text-xs font-semibold text-ocec-muted-strong">ค่าสมัครสอบ</span><small className="min-h-0 text-xs leading-snug text-ocec-muted">Competition Registration Fee</small><strong className="text-lg font-bold text-ocec-ink">฿{registrationFee.toLocaleString()}</strong></div><div className="payment-total-grand flex min-w-0 min-h-[82px] flex-col justify-center gap-1 rounded-xl border border-ocec-accent bg-ocec-brand-soft p-3"><span className="text-xs font-semibold text-ocec-brand">ยอดที่ต้องชำระ</span><small className="min-h-0 text-xs leading-snug text-ocec-muted">Total Payment</small><strong className="text-lg font-bold text-ocec-brand">฿{totalPayment.toLocaleString()}</strong></div></div>
            <PaymentAccountCards accounts={formPaymentAccounts} />
            <div className="refund-warning my-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800"><Icon className="mt-0.5 shrink-0" name="info" /><div className="flex min-w-0 flex-col gap-1"><strong className="text-xs font-bold tracking-wide">REGISTRATION FEES: NON-REFUNDABLE</strong><span className="text-sm leading-relaxed text-amber-900">ค่าธรรมเนียมการสมัครขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนชำระเงิน</span></div></div>
            <label className={`file-drop file-drop-inline registration-slip mt-3 flex min-h-[72px] min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ocec-border bg-ocec-background p-3 text-left text-ocec-muted transition-colors hover:border-ocec-accent hover:bg-ocec-brand-soft focus-within:ring-4 focus-within:ring-ocec-accent/20${slipFile?.dataUrl ? " slip-file-ready border-emerald-400 bg-emerald-50" : ""}`}>
              <input type="file" accept="image/jpeg,image/png,application/pdf,.pdf" onChange={(event) => { selectSlip(event.target.files?.[0]); event.target.value = ""; }} aria-label="แนบหลักฐานการชำระเงิน" />
              <span className="file-drop-icon grid size-9 shrink-0 place-items-center rounded-lg bg-ocec-brand-soft text-ocec-brand"><Icon name={slipFile?.dataUrl ? "check" : "upload"} /></span>
              <span className="file-drop-copy flex min-w-0 flex-1 flex-col gap-1" aria-live="polite"><strong className="truncate text-sm font-semibold text-ocec-ink">{slipFile?.dataUrl ? "แนบหลักฐานการชำระเงินแล้ว" : fileName || "แนบหลักฐานการชำระเงิน"}</strong>{slipFile?.dataUrl ? <small className="slip-file-name break-words text-xs leading-snug text-ocec-muted" title={fileName}>{fileName} · พร้อมส่งพร้อมใบสมัคร</small> : null}<small className="text-xs leading-snug text-ocec-muted">รองรับ JPG, PNG หรือ PDF · ไม่เกิน 10 MB · ผู้ดูแลระบบจะเห็นหลักฐานการชำระเงินในใบสมัคร</small></span>
              <span className="file-select-label shrink-0 rounded-full border border-ocec-border bg-white px-3 py-2 text-xs font-semibold text-ocec-brand">{slipFile?.dataUrl ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}</span>
            </label>
            {fileError ? <p className="inline-error mt-2 flex items-start gap-2 text-sm leading-relaxed text-red-700" role="alert"><Icon className="mt-0.5 shrink-0" name="info" size={16} />{fileError}</p> : null}
            <label className="confirm-check mt-2 flex cursor-pointer items-start gap-2.5 rounded-xl border border-ocec-border bg-white p-3 text-sm leading-relaxed text-ocec-muted-strong"><input className="mt-1 size-4 shrink-0 accent-ocec-brand" type="checkbox" checked={form.confirmDetails} onChange={(event) => { update("confirmDetails", event.target.checked); setSelectionError(""); setPaymentError(""); }} /><span>ข้าพเจ้ารับทราบและตรวจสอบข้อมูลเรียบร้อยแล้ว และต้องการยืนยันส่งแบบฟอร์มนี้ <b className="text-red-600">*</b></span></label>
            <label className="confirm-check confirm-check-optional mt-2 flex cursor-pointer items-start gap-2.5 rounded-xl border border-ocec-border bg-ocec-background p-3 text-sm leading-relaxed text-ocec-muted"><input className="mt-1 size-4 shrink-0 accent-ocec-brand" type="checkbox" checked={form.marketingConsent} onChange={(event) => update("marketingConsent", event.target.checked)} /><span>ข้าพเจ้ายินยอมให้ OCEC Thailand เผยแพร่ชื่อผู้สมัคร ผลการแข่งขัน และรางวัล ผ่านช่องทางประชาสัมพันธ์อย่างเป็นทางการของ OCEC Thailand และรายการแข่งขัน</span></label>
            {paymentError ? <p className="inline-error selection-error mt-2 flex items-start gap-2 text-sm leading-relaxed text-red-700" role="alert"><Icon className="mt-0.5 shrink-0" name="info" size={16} />{paymentError}</p> : null}
          <div className="form-footer form-footer-submit mt-4 flex flex-col items-stretch justify-between gap-3 border-t border-ocec-border pt-4 sm:flex-row sm:items-center"><span className="inline-flex items-center gap-1.5 text-xs text-ocec-muted"><Icon name="lock" size={14} />ข้อมูลนี้ใช้เพื่อดำเนินการสมัครสอบ</span><Button type="submit" icon={isSubmitting ? undefined : "arrow"} disabled={isSubmitting}>{isSubmitting ? "กำลังส่งใบสมัคร…" : "ส่งใบสมัคร"}</Button></div>
          </section>
        </form>
        <aside className="surface side-note form-side-note order-[-1] rounded-2xl border border-ocec-border bg-white p-4 shadow-portal-card sm:p-5 min-[801px]:sticky min-[801px]:top-4 min-[801px]:order-none max-[480px]:static max-[480px]:order-0">
          <span className="side-note-icon"><Icon name="shield" /></span><h3>สรุปการสมัคร</h3>
          <div className="live-total"><span>รายการสอบ</span><strong>{selectedCompetitions.length} รายการ</strong>{selectedCompetitions.map((competition) => <small key={competition.id}>{competition.short}{form.grades[competition.id] ? ` · ${form.grades[competition.id]}` : " · เลือกระดับชั้น"}</small>)}</div>
          <div className="live-total"><span>รูปแบบสอบ</span><strong>{formatSummary}</strong>{selectedCompetitions.map((competition) => <small key={competition.id}>{competition.short} · {formatForCompetition(competition.id) === "Online" ? `Online Exam · ${examEmailForCompetition(competition.id) || "กรอกอีเมลในรายการสอบ"}` : `Paper-Based · ${centerForCompetition(competition.id) || "เลือกศูนย์สอบ"}`}</small>)}</div>
          <div className="live-total live-total-highlight"><span>ยอดรวมปัจจุบัน</span><strong>฿{totalPayment.toLocaleString()}</strong><small>ค่าสอบ ฿{registrationFee.toLocaleString()} + ข้อสอบเก่า ฿{pastPapersTotal.toLocaleString()}</small></div>
          <hr /><div className="side-deadline"><Icon name="calendar" /><span><small>วันสอบ</small><strong>{selectedExamDateText(examCatalog, examRoundType, examYear, form.competitionIds, competitions.filter((competition) => form.competitionIds.includes(competition.id)).map((competition) => competition.roundId))}</strong></span></div>
          <p className="side-note-small">หลังสมัคร ระบบจะส่งข้อมูลสรุปและรายละเอียดข้อสอบเก่าไปยังอีเมลที่ระบุไว้</p>
        </aside>
      </div>
    </div>
  );
}
