import { useState } from "react";
import { DEFAULT_CENTER_CATALOG, ONLINE_CENTER_CODE, getCommonCenters, isOnlineCenter } from "../../centers.js";
import { readWorkbook } from "../../excel.js";
import { downloadSchoolTemplate, parseSchoolWorkbook } from "../../schoolBatchWorkbook.js";
import { formatThaiDate, getExamRoundType } from "../../examUtils.js";
import { Button, Icon, PageHeading } from "../../components/ui/index.jsx";
import { ApplicationField } from "./FormFields.jsx";
import { getActiveExamYear, normalizeExamFormat } from "./applicationUtils.js";
import { createSchoolApplicant, formatExamSession, formatExamTime, getCompetitionExamEmailValue, getCompetitionExamPrice, getSlipMimeType, groupPastPaperCatalog, readFileAsDataUrl, selectedExamDateText } from "./formUtils.js";
import { CompetitionFormatPicker, PaymentAccountCards } from "./FormOptions.jsx";
import { CenterPosterPreview } from "./CenterPosterPreview.jsx";

export function SchoolBatchForm({ kind, prefill, batch, setBatch, onSubmit, navigate, onBack, competitionFees, examCatalog, examYear, centerCatalog, pastPaperCatalog, paymentAccounts, competitions, schools, centerPosterVersion = null, backendEnabled = false }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [errorSection, setErrorSection] = useState("");
  const [excelPreview, setExcelPreview] = useState(null);
  const [excelImportMessage, setExcelImportMessage] = useState("");
  const activeExamYear = examYear || getActiveExamYear(examCatalog, "HEAT");
  const pastPaperGroups = groupPastPaperCatalog(pastPaperCatalog);
  const formPaymentAccounts = (paymentAccounts || []).filter((account) => account.active !== false && account.showInForm !== false);
  const allPastPapers = pastPaperGroups.flatMap((group) => group.items);
  const activeCenterCatalog = centerCatalog?.length ? centerCatalog : backendEnabled ? [] : DEFAULT_CENTER_CATALOG;
  const activeApplicant = batch.applicants.find((applicant) => applicant.id === batch.activeId) || batch.applicants[0];
  const activeIndex = Math.max(0, batch.applicants.findIndex((applicant) => applicant.id === activeApplicant.id));
  const centersForCompetition = (competitionId) => getCommonCenters([competitionId], examCatalog, activeCenterCatalog, {
    year: activeExamYear,
    roundType: "HEAT",
    roundId: competitions.find((competition) => competition.id === competitionId)?.roundId,
  });
  const formatForApplicantCompetition = (applicant, competitionId) => normalizeExamFormat(applicant.formats?.[competitionId], normalizeExamFormat(applicant.format));
  const activeApplicantHasPaperBased = competitions.some((competition) => activeApplicant.competitionIds.includes(competition.id) && formatForApplicantCompetition(activeApplicant, competition.id) === "Paper-Based");
  const examEmailForApplicantCompetition = (applicant, competitionId) => getCompetitionExamEmailValue(applicant.examEmailsByCompetition, competitionId, applicant.examEmail);
  const centerForApplicantCompetition = (applicant, competitionId) => applicant.centersByCompetition?.[competitionId] || (applicant.competitionIds?.length === 1 ? applicant.center || "" : "");
  const examScheduleSummary = competitions.map((competition) => {
    const exam = examCatalog.find((item) => item.id === competition.roundId)
      || examCatalog.find((item) => item.competitionId === competition.id && item.year === activeExamYear && getExamRoundType(item) === "HEAT");
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
      setExcelImportMessage(parsed.issues.length ? `พบข้อผิดพลาด ${parsed.issues.length} รายการในไฟล์ โปรดแก้ไขก่อนนำเข้า` : `อ่านข้อมูลผู้สมัคร ${parsed.applicants.length} คนแล้ว · โปรดตรวจสอบข้อมูลตัวอย่างก่อนแทนที่รายชื่อปัจจุบัน`);
    } catch (error) {
      setExcelImportMessage(error?.message || "ไม่สามารถเปิดไฟล์ Excel ได้ โปรดตรวจสอบไฟล์แล้วดำเนินการอีกครั้ง");
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
    setExcelImportMessage(`นำเข้าข้อมูลผู้สมัคร ${applicants.length} คนจาก ${excelPreview.fileName} แล้ว · โปรดแนบหลักฐานการชำระเงินรวม 1 ไฟล์ก่อนส่ง`);
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
    if (applicant.phone.replace(/\D/g, "").length < 7) return "กรุณากรอกหมายเลขโทรศัพท์ให้ถูกต้อง";
    if (!applicant.address1.trim()) return "กรุณากรอกที่อยู่";
    if (!applicant.city.trim()) return "กรุณากรอกเขตหรืออำเภอ";
    if (!applicant.province.trim()) return "กรุณากรอกจังหวัด";
    if (!applicant.postalCode.trim()) return "กรุณากรอกรหัสไปรษณีย์";
    if (applicant.competitionIds.length === 0) return "กรุณาเลือกรายการสอบอย่างน้อย 1 รายการ";
    const selectedCompetitions = competitions.filter((competition) => applicant.competitionIds.includes(competition.id));
    if (selectedCompetitions.some((competition) => !competition.grades.includes(applicant.grades[competition.id]))) return "กรุณาเลือกระดับชั้นที่เปิดรับในแต่ละรายการสอบ";
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
    const registrationFee = selectedCompetitions.reduce((sum, competition) => sum + getCompetitionExamPrice(examCatalog, competition.id, "HEAT", formatForApplicantCompetition(applicant, competition.id), competitionFees, activeExamYear, competition.roundId), 0);
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
      setFormError(`ผู้สมัครในชุดเดียวกันต้องระบุชื่อโรงเรียนให้ตรงกัน: ${applicant.firstName} ${applicant.lastName} ระบุ “${schoolFor(applicant)}” ขณะที่ผู้สมัครคนแรกระบุ “${firstSchool}” โปรดแก้ไขชื่อโรงเรียนของผู้สมัครรายนี้`);
      setErrorSection("applicant");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (!formPaymentAccounts.length) {
      setFormError("ขณะนี้ไม่มีบัญชีรับโอนเงินแสดงในแบบฟอร์ม โปรดติดต่อผู้ดูแลระบบ");
      setErrorSection("payment");
      return;
    }
    if (!batch.paymentSlipFileName || !batch.paymentSlipFile?.dataUrl) {
      setFormError("กรุณาแนบหลักฐานการชำระเงินสำหรับยอดรวมของชุดใบสมัคร");
      setErrorSection("payment");
      document.getElementById("school-payment-zone")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!batch.confirmDetails) {
      setFormError("กรุณายืนยันว่าได้ตรวจสอบข้อมูลและยอดชำระเงินของผู้สมัครทุกคนเรียบร้อยแล้ว");
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
          ? activeCenterCatalog.find((center) => center.code === ONLINE_CENTER_CODE) || (!backendEnabled ? DEFAULT_CENTER_CATALOG.find((center) => center.code === ONLINE_CENTER_CODE) : null)
          : centersForCompetition(competition.id).find((center) => center.name === centerForApplicantCompetition(applicant, competition.id));
        const fee = getCompetitionExamPrice(examCatalog, competition.id, "HEAT", format, competitionFees, activeExamYear, competition.roundId);
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
        description="สามารถเพิ่มผู้เข้าสอบหลายคน โดยกรอกข้อมูลและเลือกรายการสอบแยกสำหรับแต่ละคน"
        action={<div className="school-form-actions flex flex-wrap items-center justify-end gap-2 max-[600px]:gap-1.5" role="group" aria-label="การดำเนินการสมัคร">
          <Button icon="arrow" className="school-mode-return-button shadow-[0_3px_9px_rgba(89,85,168,0.2)] hover:shadow-[0_5px_13px_rgba(89,85,168,0.26)] [&_.ocec-icon]:rotate-180 max-[600px]:min-h-[42px] max-[600px]:px-[9px] max-[600px]:text-[11px]" onClick={onBack}>กลับไปสมัครด้วยตนเอง</Button>
          <Button variant="outline" icon="close" className="max-[600px]:min-h-[42px] max-[600px]:px-[9px] max-[600px]:text-[11px]" onClick={() => navigate(kind === "Final" ? "final-confirm" : "home")}>ยกเลิก</Button>
        </div>}
      />
      <div className="form-layout school-batch-layout grid min-w-0 grid-cols-1 items-start gap-4 min-[801px]:grid-cols-[minmax(0,1fr)_255px] min-[1021px]:grid-cols-[minmax(0,1fr)_300px]">
        <form className="surface form-surface registration-form school-batch-form grid min-w-0 gap-0 rounded-2xl p-4 sm:p-5 xl:p-[clamp(20px,2.5vw,34px)]" onSubmit={handleSubmit} noValidate>
          <section className="form-zone mb-6 min-w-0 border-b border-ocec-border pb-7 last:mb-0 last:border-b-0 last:pb-0" aria-labelledby="school-zone-student">
            <div className="form-progress mb-5 flex items-start gap-3 border-b border-ocec-border pb-4"><span className="form-progress-number grid size-10 shrink-0 place-items-center rounded-xl bg-ocec-brand text-base font-bold text-white">01</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-base font-bold leading-snug text-ocec-brand md:text-lg" id="school-zone-student">Student Information <span className="text-sm font-medium text-ocec-muted">/ ข้อมูลผู้สมัคร</span></strong><small className="text-sm leading-relaxed text-ocec-muted">สร้างใบสมัครแยก 1 ใบต่อผู้เข้าสอบ</small></div><span className="applicant-count-chip inline-flex shrink-0 items-center gap-1 rounded-full border border-ocec-border bg-ocec-brand-soft px-2.5 py-1.5 text-xs font-semibold text-ocec-brand"><Icon name="users" size={14} />{batch.applicants.length} คน</span></div>
            <div className="school-mode-note mb-3 flex items-start gap-2 rounded-xl border border-ocec-border bg-ocec-brand-soft p-3 text-sm leading-relaxed text-ocec-brand"><Icon className="mt-0.5 shrink-0" name="info" size={17} /><span>ผู้สมัครแต่ละรายมีข้อมูล รายการสอบ และระดับชั้นแยกจากกัน · เลือกชื่อผู้สมัครเพื่อแก้ไขข้อมูล</span></div>
            <section className="school-import-panel grid min-w-0 gap-3 rounded-xl border border-ocec-border bg-ocec-background p-3 sm:p-4" aria-labelledby="school-excel-heading">
              <div className="school-import-copy flex min-w-0 items-start gap-3"><span className="school-import-icon grid size-9 shrink-0 place-items-center rounded-lg bg-ocec-brand-soft text-ocec-brand"><Icon name="file" /></span><div className="flex min-w-0 flex-col gap-1"><strong className="text-sm font-semibold text-ocec-brand" id="school-excel-heading">นำเข้ารายชื่อจาก Excel</strong><small className="text-xs leading-relaxed text-ocec-muted">ใช้ชีตเดียว · 1 แถวต่อผู้เข้าสอบ · เลือกรายการสอบ ระดับชั้น รูปแบบสอบ ศูนย์สอบ และอีเมลเข้าสอบออนไลน์แยกตามรายการในแถวเดียวกัน</small></div></div>
              <div className="school-import-actions grid grid-cols-1 items-stretch gap-2 sm:grid-cols-2">
                <Button variant="outline" icon="download" onClick={() => downloadSchoolTemplate({ centerCatalog: activeCenterCatalog, competitions, pastPaperCatalog, schools }, `ocec-school-registration-${activeExamYear}.xlsx`)}>ดาวน์โหลด Template Excel</Button>
                <label htmlFor="school-batch-excel-upload" className="button button-outline school-excel-upload-button"><Icon name="upload" size={17} /><span>{excelPreview ? "เปลี่ยนไฟล์ Excel" : "เลือกไฟล์ Excel"}</span><input id="school-batch-excel-upload" type="file" accept=".xlsx" onChange={(event) => { stageSchoolWorkbook(event.target.files?.[0]); event.target.value = ""; }} /></label>
              </div>
              {excelImportMessage ? <p className={`school-excel-message${excelPreview?.issues.length ? " school-excel-message-error" : ""}`} role="status">{excelImportMessage}</p> : null}
              {excelPreview ? <div className="school-excel-preview"><div className="school-excel-preview-head"><strong>ตัวอย่างข้อมูลจาก {excelPreview.fileName}</strong><span>{excelPreview.applicants.length} คน · {excelPreview.issues.length} จุดที่ต้องแก้</span></div>
                {excelPreview.applicants.length ? <div className="school-excel-preview-names">{excelPreview.applicants.slice(0, 4).map((applicant, index) => <span key={`${applicant.rowId}-${index}`}>{applicant.rowId} · {applicant.candidate || `${applicant.firstName} ${applicant.lastName}`}</span>)}{excelPreview.applicants.length > 4 ? <small>และอีก {excelPreview.applicants.length - 4} คน</small> : null}</div> : null}
                {excelPreview.issues.length ? <ul className="school-excel-issues">{excelPreview.issues.slice(0, 12).map((issue, index) => <li key={`${issue.sheet}-${issue.row}-${issue.field}-${index}`}>{issue.sheet} · แถว {issue.row}{issue.field ? ` · ${issue.field}` : ""}: {issue.message}</li>)}{excelPreview.issues.length > 12 ? <li>และอีก {excelPreview.issues.length - 12} รายการ</li> : null}</ul> : excelPreview.applicants.length ? <Button icon="check" onClick={importSchoolWorkbookPreview}>ใช้ข้อมูลจาก Excel แทนรายชื่อในแบบฟอร์ม</Button> : <p className="school-excel-message-error">ไม่พบรายชื่อผู้สมัครในไฟล์นี้</p>}
              </div> : null}
            </section>
              <div className="school-applicant-switcher grid grid-cols-1 gap-2 xl:grid-cols-2" role="group" aria-label="เลือกผู้เข้าสอบ">
              {batch.applicants.map((applicant, index) => {
                const applicantName = `${applicant.firstName} ${applicant.lastName}`.trim();
                const complete = !applicantIssue(applicant);
                return <div className={`school-applicant-tab-wrap grid min-w-0 grid-cols-[minmax(0,1fr)_44px] items-stretch gap-1.5 rounded-xl border border-ocec-border bg-white p-1.5 transition-colors motion-reduce:transition-none${applicant.id === activeApplicant.id ? " school-applicant-tab-active border-ocec-accent bg-ocec-brand-soft shadow-[inset_0_0_0_1px_var(--color-ocec-accent)]" : ""}`} key={applicant.id}>
                  <button type="button" aria-pressed={applicant.id === activeApplicant.id} className="school-applicant-tab flex min-w-0 min-h-14 cursor-pointer items-center gap-2 rounded-lg bg-transparent p-2 text-left transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-ocec-accent focus-visible:outline-offset-2" onClick={() => { setBatch((current) => ({ ...current, activeId: applicant.id })); setFormError(""); setErrorSection(""); }}>
                    <span className="applicant-number grid size-8 shrink-0 place-items-center rounded-lg bg-ocec-brand-soft text-xs font-bold tabular-nums text-ocec-brand">{String(index + 1).padStart(2, "0")}</span>
                    <span className="school-applicant-copy flex min-w-0 flex-1 flex-col gap-0.5"><strong className="truncate text-xs font-semibold text-ocec-ink">{applicantName || `ผู้เข้าสอบคนที่ ${index + 1}`}</strong><small className="truncate text-xs leading-snug text-ocec-muted">{applicant.schoolName === "Other" ? applicant.certificateSchoolName || "รอระบุโรงเรียน" : applicant.schoolName || "ยังไม่ได้ระบุโรงเรียน"} · {applicant.competitionIds.length} รายการสอบ</small></span>
                    <span className={`applicant-status shrink-0 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800${complete ? " applicant-status-ready bg-emerald-50 text-emerald-800" : ""}`}>{complete ? "ข้อมูลครบ" : "อยู่ระหว่างกรอกข้อมูล"}</span>
                  </button>
                  {batch.applicants.length > 1 ? <button type="button" className="remove-applicant-button grid size-11 place-items-center self-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-500" aria-label={`ลบใบสมัครของผู้เข้าสอบคนที่ ${index + 1}`} onClick={() => removeApplicant(applicant.id)}><Icon name="close" size={16} /></button> : null}
                </div>;
              })}
            </div>
            <Button variant="outline" icon="plus" className="add-applicant-button mt-2 min-h-11" onClick={addApplicant}>เพิ่มผู้เข้าสอบ</Button>
            {formError && errorSection === "applicant" ? <p className="inline-error school-form-error mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-700" role="alert"><Icon className="mt-0.5 shrink-0" name="info" size={16} />{formError}</p> : null}
            <div className="student-entry-card mt-3 min-w-0 rounded-xl border border-ocec-border bg-white p-3 sm:p-4">
              <div className="student-entry-heading mb-3 flex min-w-0 items-center gap-2 border-b border-ocec-border pb-3"><span className="student-entry-index grid size-8 shrink-0 place-items-center rounded-lg bg-ocec-brand-soft text-xs font-bold tabular-nums text-ocec-brand">{String(activeIndex + 1).padStart(2, "0")}</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="break-words text-sm font-semibold text-ocec-ink">{fullName || `ผู้เข้าสอบคนที่ ${activeIndex + 1}`}</strong><small className="text-xs text-ocec-muted">ใบสมัครที่ {activeIndex + 1} จาก {batch.applicants.length}</small></div><span className="student-entry-total shrink-0 rounded-full bg-ocec-brand-soft px-2.5 py-1.5 text-xs font-semibold text-ocec-brand">รวม {totalLabel(activeTotals.totalPayment)}</span></div>
              <div className="form-grid grid grid-cols-1 gap-x-3 gap-y-4 md:grid-cols-2">
                <ApplicationField label="English First Name" required><input autoComplete="given-name" value={activeApplicant.firstName} onChange={(event) => updateApplicant(activeApplicant.id, "firstName", event.target.value)} placeholder="First name" /></ApplicationField>
                <ApplicationField label="English Last Name" required><input autoComplete="family-name" value={activeApplicant.lastName} onChange={(event) => updateApplicant(activeApplicant.id, "lastName", event.target.value)} placeholder="Last name" /></ApplicationField>
                <ApplicationField label="ชื่อ (ภาษาไทย)" required><input value={activeApplicant.thaiFirstName} onChange={(event) => updateApplicant(activeApplicant.id, "thaiFirstName", event.target.value)} placeholder="ชื่อจริงภาษาไทย" /></ApplicationField>
                <ApplicationField label="นามสกุล (ภาษาไทย)" required><input value={activeApplicant.thaiLastName} onChange={(event) => updateApplicant(activeApplicant.id, "thaiLastName", event.target.value)} placeholder="นามสกุลภาษาไทย" /></ApplicationField>
                <fieldset className="gender-fieldset m-0 grid min-w-0 gap-2 border-0 p-0"><legend className="field-title text-xs font-semibold text-ocec-brand">Gender / เพศ <span className="required-mark">*</span></legend><div className="gender-options flex flex-wrap gap-x-4 gap-y-2">{[["Male", "ชาย"], ["Female", "หญิง"], ["Prefer not to say", "ไม่ประสงค์ระบุ"]].map(([value, label]) => <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ocec-muted-strong" key={value}><input className="size-4 accent-ocec-brand" type="radio" name={`gender-${activeApplicant.id}`} value={value} checked={activeApplicant.gender === value} onChange={() => updateApplicant(activeApplicant.id, "gender", value)} required /><span>{label}</span></label>)}</div></fieldset>
                <ApplicationField label="Date of Birth / วันเกิด" required><input type="date" autoComplete="bday" value={activeApplicant.dateOfBirth} onChange={(event) => updateApplicant(activeApplicant.id, "dateOfBirth", event.target.value)} /></ApplicationField>
                <ApplicationField label="School Name / โรงเรียน" required hint="โปรดเลือกชื่อโรงเรียนจากรายการ หากไม่พบ ให้เลือก Other แล้วกรอกชื่อโรงเรียนในช่องถัดไป"><select value={activeApplicant.schoolName} onChange={(event) => { const schoolName = event.target.value; setBatch((current) => ({ ...current, applicants: current.applicants.map((applicant) => applicant.id === activeApplicant.id ? { ...applicant, schoolName, certificateSchoolName: schoolName === "Other" ? "" : applicant.certificateSchoolName } : applicant) })); setFormError(""); setErrorSection(""); }}><option value="">เลือกโรงเรียน</option>{schools.map((school) => <option key={school} value={school}>{school === "Other" ? "Other / ไม่มีชื่อโรงเรียนในรายการ" : school}</option>)}</select></ApplicationField>
                <ApplicationField label={activeApplicant.schoolName === "Other" ? "School Name in English / ชื่อโรงเรียน" : "School Name in English for Certificate"} required={activeApplicant.schoolName === "Other"} hint={activeApplicant.schoolName === "Other" ? "ระบุชื่อโรงเรียนเป็นภาษาอังกฤษ หากไม่พบในรายการ" : "กรอกข้อมูลนี้หากต้องการใช้ชื่อโรงเรียนภาษาอังกฤษอื่นบนใบประกาศนียบัตร"}><input value={activeApplicant.certificateSchoolName} onChange={(event) => updateApplicant(activeApplicant.id, "certificateSchoolName", event.target.value)} placeholder={activeApplicant.schoolName === "Other" ? "พิมพ์ชื่อโรงเรียนที่นี่" : "ชื่อโรงเรียนภาษาอังกฤษบนใบประกาศ"} /></ApplicationField>
                <ApplicationField label="Email / อีเมล" required hint="ระบบจะส่งข้อมูลสำหรับเข้าใช้งานข้อสอบเก่าไปยังอีเมลของผู้เข้าสอบ"><input type="email" autoComplete="email" value={activeApplicant.email} onChange={(event) => updateApplicant(activeApplicant.id, "email", event.target.value)} placeholder="student@example.com" /></ApplicationField>
                <ApplicationField label="Phone Number / หมายเลขโทรศัพท์" required hint="รูปแบบตัวอย่าง (000) 000-0000"><input type="tel" inputMode="tel" autoComplete="tel" value={activeApplicant.phone} onChange={(event) => updateApplicant(activeApplicant.id, "phone", event.target.value)} placeholder="(000) 000-0000" /></ApplicationField>
                <section className="address-subzone col-span-full min-w-0 rounded-xl border border-ocec-border bg-ocec-background p-3 sm:p-4" aria-labelledby={`address-${activeApplicant.id}`}>
                  <div className="address-subzone-heading mb-3 flex items-center gap-2"><span className="address-subzone-icon grid size-8 shrink-0 place-items-center rounded-lg bg-ocec-brand-soft text-ocec-brand"><Icon name="building" size={15} /></span><div className="flex min-w-0 flex-col gap-0.5"><h3 className="m-0 text-sm font-semibold leading-snug text-ocec-brand" id={`address-${activeApplicant.id}`}>Address <span className="text-ocec-muted">/ ที่อยู่</span></h3><p className="m-0 text-xs text-ocec-muted">กรอกที่อยู่สำหรับติดต่อ</p></div></div>
                  <div className="address-subzone-grid grid grid-cols-1 gap-3 md:grid-cols-2">
                    <ApplicationField label="Address Line 1 / ที่อยู่" required><input autoComplete="address-line1" value={activeApplicant.address1} onChange={(event) => updateApplicant(activeApplicant.id, "address1", event.target.value)} placeholder="บ้านเลขที่ ถนน" /></ApplicationField>
                    <ApplicationField label="Address Line 2 / ที่อยู่เพิ่มเติม"><input autoComplete="address-line2" value={activeApplicant.address2} onChange={(event) => updateApplicant(activeApplicant.id, "address2", event.target.value)} placeholder="อาคาร หมู่บ้าน (ถ้ามี)" /></ApplicationField>
                    <ApplicationField label="District / City / เขตหรืออำเภอ" required><input autoComplete="address-level2" value={activeApplicant.city} onChange={(event) => updateApplicant(activeApplicant.id, "city", event.target.value)} /></ApplicationField>
                    <ApplicationField label="Postal Code / รหัสไปรษณีย์" required><input autoComplete="postal-code" inputMode="numeric" maxLength={10} value={activeApplicant.postalCode} onChange={(event) => updateApplicant(activeApplicant.id, "postalCode", event.target.value.replace(/[^\d-]/g, ""))} /></ApplicationField>
                  </div>
                </section>
              </div>
            </div>
          </section>

          <section className="form-zone mb-6 min-w-0 border-b border-ocec-border pb-7 last:mb-0 last:border-b-0 last:pb-0" aria-labelledby={`school-zone-competition-${activeApplicant.id}`}>
            <div className="form-progress mb-5 flex items-start gap-3 border-b border-ocec-border pb-4"><span className="form-progress-number grid size-10 shrink-0 place-items-center rounded-xl bg-ocec-brand text-base font-bold text-white">02</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-base font-bold leading-snug text-ocec-brand md:text-lg" id={`school-zone-competition-${activeApplicant.id}`}>Competition Selection <span className="text-sm font-medium text-ocec-muted">/ รายการสอบและระดับชั้น</span></strong><small className="text-sm leading-relaxed text-ocec-muted">เลือกได้หลายรายการ และเลือกระดับชั้นแยกในแต่ละรายการ</small></div></div>
            {activeApplicantHasPaperBased ? <CenterPosterPreview version={centerPosterVersion} backendEnabled={backendEnabled} /> : null}
            <div className="competition-list grid min-w-0 grid-cols-1 gap-3">{competitions.map((competition) => {
              const selected = activeApplicant.competitionIds.includes(competition.id);
              const competitionExam = examCatalog.find((exam) => exam.competitionId === competition.id && exam.year === activeExamYear && getExamRoundType(exam) === "HEAT");
              const format = formatForApplicantCompetition(activeApplicant, competition.id);
              const availableCenters = selected && format === "Paper-Based" ? centersForCompetition(competition.id) : [];
              return <article className={`competition-card min-w-0 rounded-xl border border-ocec-border bg-white p-3 transition-colors motion-reduce:transition-none sm:p-4${selected ? " competition-card-selected border-ocec-accent bg-ocec-brand-soft shadow-[inset_0_0_0_1px_var(--color-ocec-accent)]" : ""}`} key={competition.id}>
                <label className="competition-select"><input type="checkbox" checked={selected} onChange={() => toggleCompetition(competition.id)} /><span className="competition-check-mark" aria-hidden="true" /><span><strong>{competition.name}</strong><small>{competition.subject}</small><small className="competition-session"><Icon name="clock" size={12} />สอบ {formatExamSession(competitionExam)}</small></span><span className="competition-fee">฿{getCompetitionExamPrice(examCatalog, competition.id, "HEAT", format, competitionFees, activeExamYear).toLocaleString()}<small> / รายการ</small></span></label>
                {selected ? <div className="competition-card-options mt-3 grid min-w-0 grid-cols-1 gap-3 border-t border-ocec-border pt-3 min-[701px]:ml-[27px] min-[701px]:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)]">
                  <CompetitionFormatPicker variant="application" competitionId={competition.id} prefix={activeApplicant.id} format={format} paperPrice={getCompetitionExamPrice(examCatalog, competition.id, "HEAT", "Paper-Based", competitionFees, activeExamYear)} onlinePrice={getCompetitionExamPrice(examCatalog, competition.id, "HEAT", "Online", competitionFees, activeExamYear)} onChange={(nextFormat) => updateApplicantFormat(competition.id, nextFormat)} />
                  {format === "Paper-Based" ? <ApplicationField label={`ศูนย์สอบ ${competition.short}`} required className="competition-center-field col-span-full"><select value={centerForApplicantCompetition(activeApplicant, competition.id)} onChange={(event) => updateApplicant(activeApplicant.id, "centersByCompetition", { ...activeApplicant.centersByCompetition, [competition.id]: event.target.value })}><option value="">เลือกศูนย์สอบ</option>{centerForApplicantCompetition(activeApplicant, competition.id) && !isOnlineCenter(centerForApplicantCompetition(activeApplicant, competition.id)) && !availableCenters.some((center) => center.name === centerForApplicantCompetition(activeApplicant, competition.id)) ? <option value={centerForApplicantCompetition(activeApplicant, competition.id)}>{centerForApplicantCompetition(activeApplicant, competition.id)} · กรุณาเลือกศูนย์ที่เปิด</option> : null}{availableCenters.map((center) => <option key={center.id} value={center.name}>{center.name}</option>)}</select>{!availableCenters.length ? <small className="field-hint-error">รายการนี้ยังไม่มีศูนย์สอบที่เปิดใช้งาน</small> : null}</ApplicationField> : <div className="competition-online-fields col-span-full grid min-w-0 grid-cols-1 gap-3"><ApplicationField label={`อีเมลเข้าสอบ ${competition.short}`} required className="competition-exam-email min-w-0" hint="สามารถใช้ที่อยู่อีเมลเดียวกับรายการสอบอื่นได้ หากใช้บัญชีเดียวกัน"><input type="email" autoComplete="email" value={examEmailForApplicantCompetition(activeApplicant, competition.id)} onChange={(event) => updateApplicant(activeApplicant.id, "examEmailsByCompetition", { ...activeApplicant.examEmailsByCompetition, [competition.id]: event.target.value })} placeholder="student@gmail.com" required /></ApplicationField></div>}
                  <ApplicationField label={`ระดับชั้น ${competition.short}`} required className="competition-grade col-span-full grid gap-2 border-t border-ocec-border pt-3"><select value={activeApplicant.grades[competition.id] || ""} onChange={(event) => updateApplicant(activeApplicant.id, "grades", { ...activeApplicant.grades, [competition.id]: event.target.value })}><option value="">เลือกระดับชั้น</option>{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}</select></ApplicationField>
                </div> : null}
              </article>;
            })}{!competitions.length ? <div className="empty-inline flex min-w-0 items-center gap-2 rounded-xl border border-dashed border-ocec-border bg-ocec-background p-4 text-sm leading-relaxed text-ocec-muted"><Icon className="shrink-0" name="calendar" /><span>ขณะนี้ยังไม่มีรายการสอบรอบ HEAT ที่เปิดรับสมัคร</span></div> : null}</div>
            <div className="schedule-note mt-3 flex min-w-0 items-start gap-2.5 rounded-xl border border-ocec-border bg-ocec-brand-soft p-3 text-ocec-brand"><Icon className="mt-0.5 shrink-0" name="calendar" size={16} /><div className="flex min-w-0 flex-col gap-1"><strong className="text-sm font-semibold">กำหนดการรอบสอบ</strong><span className="text-sm leading-relaxed">ปิดรับสมัคร {formatThaiDate(examCatalog.find((exam) => exam.year === activeExamYear && getExamRoundType(exam) === "HEAT")?.closeDate)} · วันสอบ {formatThaiDate(examCatalog.find((exam) => exam.year === activeExamYear && getExamRoundType(exam) === "HEAT")?.examDate)}</span><small className="text-xs leading-relaxed text-ocec-muted">{examScheduleSummary}</small></div></div>
          </section>

          <section className="form-zone mb-6 min-w-0 border-b border-ocec-border pb-7 last:mb-0 last:border-b-0 last:pb-0" aria-labelledby={`school-zone-papers-${activeApplicant.id}`}>
            <div className="form-progress mb-5 flex items-start gap-3 border-b border-ocec-border pb-4"><span className="form-progress-number grid size-10 shrink-0 place-items-center rounded-xl bg-ocec-brand text-base font-bold text-white">03</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-base font-bold leading-snug text-ocec-brand md:text-lg" id={`school-zone-papers-${activeApplicant.id}`}>Past Papers <span className="text-sm font-medium text-ocec-muted">/ ข้อสอบเก่า</span></strong><small className="text-sm leading-relaxed text-ocec-muted">เลือกรายการให้ผู้เข้าสอบคนนี้</small></div><span className="paper-total-chip shrink-0 rounded-full bg-ocec-brand-soft px-2 py-1 text-xs font-semibold text-ocec-brand">รวม {totalLabel(activeTotals.papersTotal)}</span></div>
            <div className="past-paper-grid grid min-w-0 grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3">{pastPaperGroups.map((group) => <fieldset className="past-paper-group m-0 min-w-0 rounded-xl border border-ocec-border bg-white p-3" key={group.id}><legend className="max-w-full px-1 text-xs font-semibold text-ocec-brand">{group.title}</legend><div className="grid gap-1">{group.items.map((paper) => <label key={paper.id} className="past-paper-option flex min-w-0 min-h-11 cursor-pointer items-start gap-2 border-b border-slate-200 py-3 last:border-b-0"><input className="mt-1 size-4 shrink-0 accent-ocec-brand" type="checkbox" checked={activeApplicant.pastPaperIds.includes(paper.id)} onChange={() => togglePastPaper(paper.id)} /><span className="past-paper-copy grid min-w-0 flex-1 gap-1"><strong className="break-words text-xs font-semibold leading-snug text-ocec-ink">{paper.title}</strong><small className="break-words text-xs leading-snug text-ocec-muted">{paper.detail}</small></span><b className="shrink-0 whitespace-nowrap text-xs font-bold text-ocec-brand">฿{paper.price}</b></label>)}</div></fieldset>)}</div>
            <div className="past-paper-info mt-3 rounded-xl border border-ocec-border bg-ocec-background p-3 text-sm leading-relaxed text-ocec-muted"><strong className="text-sm font-semibold text-ocec-brand">ข้อมูลข้อสอบเก่า</strong><p className="my-1 text-xs leading-relaxed"><b>HKISO / HKICO:</b> English Version · <b>Big Bay Bei:</b> English + Thai Version พร้อม VDO ภาษาไทย</p><p className="my-1 text-xs leading-relaxed">เจ้าหน้าที่ส่งข้อมูลเข้าใช้งานทางอีเมลภายใน 3–5 วันหลังสมัคร หากไม่พบอีเมล โปรดตรวจสอบโฟลเดอร์ Junk หรือ Spam</p></div>
          </section>

          <section className="form-zone form-zone-payment min-w-0" id="school-payment-zone" aria-labelledby="school-zone-payment">
            <div className="form-progress mb-5 flex items-start gap-3 border-b border-ocec-border pb-4"><span className="form-progress-number grid size-10 shrink-0 place-items-center rounded-xl bg-ocec-brand text-base font-bold text-white">04</span><div className="flex min-w-0 flex-1 flex-col gap-0.5"><strong className="text-base font-bold leading-snug text-ocec-brand md:text-lg" id="school-zone-payment">Payment and Confirmation <span className="text-sm font-medium text-ocec-muted">/ ชำระเงินและยืนยัน</span></strong><small className="text-sm leading-relaxed text-ocec-muted">ชำระรวม 1 บิลสำหรับผู้เข้าสอบ {batch.applicants.length} คน</small></div></div>
            <div className="payment-total-grid grid grid-cols-1 gap-2 min-[701px]:grid-cols-3"><div className="flex min-w-0 min-h-[82px] flex-col justify-center gap-1 rounded-xl border border-ocec-border bg-ocec-background p-3"><span className="text-xs font-semibold text-ocec-muted-strong">ข้อสอบเก่า</span><small className="min-h-0 text-xs leading-snug text-ocec-muted">Past Papers Total · รวมทุกคน</small><strong className="text-lg font-bold text-ocec-ink">{totalLabel(batchTotals.papersTotal)}</strong></div><div className="flex min-w-0 min-h-[82px] flex-col justify-center gap-1 rounded-xl border border-ocec-border bg-ocec-background p-3"><span className="text-xs font-semibold text-ocec-muted-strong">ค่าสมัครสอบ</span><small className="min-h-0 text-xs leading-snug text-ocec-muted">Competition Registration Fee · รวมทุกคน</small><strong className="text-lg font-bold text-ocec-ink">{totalLabel(batchTotals.registrationFee)}</strong></div><div className="payment-total-grand flex min-w-0 min-h-[82px] flex-col justify-center gap-1 rounded-xl border border-ocec-accent bg-ocec-brand-soft p-3"><span className="text-xs font-semibold text-ocec-brand">ยอดที่ต้องชำระ</span><small className="min-h-0 text-xs leading-snug text-ocec-muted">Total Payment · รวมทุกคน</small><strong className="text-lg font-bold text-ocec-brand">{totalLabel(batchTotals.totalPayment)}</strong></div></div>
            <div className="school-payment-breakdown mt-3 overflow-hidden rounded-xl border border-ocec-border bg-white"><div className="school-breakdown-heading flex flex-col gap-1 border-b border-ocec-border bg-ocec-background p-3"><strong className="text-sm font-semibold text-ocec-ink">สรุปยอดแยกตามผู้เข้าสอบ</strong><small className="text-xs leading-relaxed text-ocec-muted">ชำระยอดรวมด้วยใบแจ้งชำระและหลักฐานการชำระเงินเพียงชุดเดียว</small></div>{batch.applicants.map((applicant, index) => {
              const totals = totalsFor(applicant);
              const applicantName = `${applicant.firstName} ${applicant.lastName}`.trim() || `ผู้เข้าสอบคนที่ ${index + 1}`;
              return <div key={applicant.id} className="school-breakdown-row flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 p-3 last:border-b-0"><div className="flex min-w-0 flex-col gap-1"><strong className="break-words text-sm font-semibold text-ocec-muted-strong">{String(index + 1).padStart(2, "0")} · {applicantName}</strong><small className="text-xs leading-relaxed text-ocec-muted">{totals.selectedCompetitions.length} รายการสอบ · ข้อสอบเก่า {totalLabel(totals.papersTotal)}</small></div><b className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-ocec-brand">{totalLabel(totals.totalPayment)}</b></div>;
            })}</div>
            <PaymentAccountCards accounts={formPaymentAccounts} />
            <div className="refund-warning my-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800"><Icon className="mt-0.5 shrink-0" name="info" /><div className="flex min-w-0 flex-col gap-1"><strong className="text-xs font-bold tracking-wide">REGISTRATION FEES: NON-REFUNDABLE</strong><span className="text-sm leading-relaxed text-amber-900">ค่าธรรมเนียมการสมัครขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนชำระเงิน</span></div></div>
            <label className={`file-drop file-drop-inline school-batch-slip registration-slip mt-3 flex min-h-[72px] min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ocec-border bg-ocec-background p-3 text-left text-ocec-muted transition-colors hover:border-ocec-accent hover:bg-ocec-brand-soft focus-within:ring-4 focus-within:ring-ocec-accent/20${batch.paymentSlipFile?.dataUrl ? " slip-file-ready border-emerald-400 bg-emerald-50" : ""}`}><input type="file" accept="image/jpeg,image/png,application/pdf,.pdf" aria-label="แนบหลักฐานการชำระเงินยอดรวมของชุดใบสมัคร" onChange={async (event) => {
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
                setBatch((current) => ({ ...current, paymentSlipFileName: "", paymentSlipFile: null, paymentSlipError: "ขนาดไฟล์ต้องไม่เกิน 10 MB" }));
                return;
              }
              setBatch((current) => ({ ...current, paymentSlipFileName: "กำลังอ่านหลักฐานการชำระเงิน…", paymentSlipFile: null, paymentSlipError: "" }));
              try {
                const paymentSlipFile = { name: file.name, type: fileType, dataUrl: await readFileAsDataUrl(file) };
                setBatch((current) => ({ ...current, paymentSlipFileName: file.name, paymentSlipFile, paymentSlipError: "" }));
                setFormError("");
              } catch (error) {
                setBatch((current) => ({ ...current, paymentSlipFileName: "", paymentSlipFile: null, paymentSlipError: error.message || "ไม่สามารถอ่านหลักฐานการชำระเงินได้" }));
              }
            }} /><span className="file-drop-icon grid size-9 shrink-0 place-items-center rounded-lg bg-ocec-brand-soft text-ocec-brand"><Icon name={batch.paymentSlipFile?.dataUrl ? "check" : "upload"} /></span><span className="file-drop-copy flex min-w-0 flex-1 flex-col gap-1" aria-live="polite"><strong className="truncate text-sm font-semibold text-ocec-ink">{batch.paymentSlipFile?.dataUrl ? "แนบหลักฐานการชำระเงินแล้ว" : batch.paymentSlipFileName || "แนบหลักฐานการชำระเงินยอดรวม 1 ไฟล์"}</strong>{batch.paymentSlipFile?.dataUrl ? <small className="slip-file-name break-words text-xs leading-snug text-ocec-muted" title={batch.paymentSlipFileName}>{batch.paymentSlipFileName} · พร้อมส่งพร้อมใบสมัคร</small> : null}<small className="text-xs leading-snug text-ocec-muted">ยอด {totalLabel(batchTotals.totalPayment)} · JPG, PNG หรือ PDF · ไม่เกิน 10 MB{batch.paymentSlipError ? ` · ${batch.paymentSlipError}` : ""}</small></span><span className="file-select-label shrink-0 rounded-full border border-ocec-border bg-white px-3 py-2 text-xs font-semibold text-ocec-brand">{batch.paymentSlipFile?.dataUrl ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}</span></label>
            <label className="confirm-check mt-2 flex cursor-pointer items-start gap-2.5 rounded-xl border border-ocec-border bg-white p-3 text-sm leading-relaxed text-ocec-muted-strong"><input className="mt-1 size-4 shrink-0 accent-ocec-brand" type="checkbox" checked={batch.confirmDetails} onChange={(event) => { setBatch((current) => ({ ...current, confirmDetails: event.target.checked })); setFormError(""); setErrorSection(""); }} /><span>ข้าพเจ้าได้ตรวจสอบข้อมูลของผู้สมัครทุกคนและยอดชำระเงินรวมเรียบร้อยแล้ว <b className="text-red-600">*</b></span></label>
            <label className="confirm-check confirm-check-optional mt-2 flex cursor-pointer items-start gap-2.5 rounded-xl border border-ocec-border bg-ocec-background p-3 text-sm leading-relaxed text-ocec-muted"><input className="mt-1 size-4 shrink-0 accent-ocec-brand" type="checkbox" checked={batch.marketingConsent} onChange={(event) => setBatch((current) => ({ ...current, marketingConsent: event.target.checked }))} /><span>ข้าพเจ้ายินยอมให้ OCEC Thailand เผยแพร่ชื่อผู้สมัคร ผลการแข่งขัน และรางวัล ผ่านช่องทางประชาสัมพันธ์อย่างเป็นทางการ</span></label>
            {formError && errorSection === "payment" ? <p className="inline-error school-form-error mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-relaxed text-red-700" role="alert"><Icon className="mt-0.5 shrink-0" name="info" size={16} />{formError}</p> : null}
            <div className="form-footer form-footer-submit mt-4 flex flex-col items-stretch justify-between gap-3 border-t border-ocec-border pt-4 sm:flex-row sm:items-center"><span className="inline-flex items-center gap-1.5 text-xs text-ocec-muted"><Icon name="lock" size={14} />แยกใบสมัครตามผู้เข้าสอบ · ชำระเงินรวมหนึ่งรายการ</span><Button type="submit" icon={isSubmitting ? undefined : "arrow"} disabled={isSubmitting}>{isSubmitting ? "กำลังส่งใบสมัคร…" : `ส่งใบสมัคร ${batch.applicants.length} คน`}</Button></div>
          </section>
        </form>
        <aside className="surface side-note form-side-note school-batch-summary rounded-2xl border border-ocec-border bg-white p-4 shadow-portal-card sm:p-5 min-[801px]:sticky min-[801px]:top-4">
          <span className="side-note-icon"><Icon name="users" /></span><h3>สรุปชุดใบสมัคร</h3>
          <div className="live-total"><span>ผู้เข้าสอบ</span><strong>{batch.applicants.length} คน</strong>{batch.applicants.map((applicant, index) => {
            const name = `${applicant.firstName} ${applicant.lastName}`.trim();
            const totals = totalsFor(applicant);
            return <small key={applicant.id}>{index + 1}. {name || "ยังไม่ระบุชื่อ"} · {totals.selectedCompetitions.length} รายการ</small>;
          })}</div>
          <div className="live-total live-total-highlight"><span>ยอดชำระรวม</span><strong>{totalLabel(batchTotals.totalPayment)}</strong><small>ค่าสอบ {totalLabel(batchTotals.registrationFee)} + ข้อสอบเก่า {totalLabel(batchTotals.papersTotal)}</small></div>
          <div className="side-deadline"><Icon name="calendar" /><span><small>วันสอบ</small><strong>{selectedExamDateText(examCatalog, kind === "Final" ? "FINAL" : "HEAT", examYear, [...new Set(batch.applicants.flatMap((applicant) => applicant.competitionIds || []))])}</strong></span></div>
          <p className="side-note-small">ใบสมัครแยกตามผู้เข้าสอบ แต่ใช้ยอดชำระรวมและแนบหลักฐานการชำระเงินเพียงไฟล์เดียวต่อชุด</p>
        </aside>
      </div>
    </div>
  );
}
