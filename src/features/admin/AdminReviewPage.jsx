import { useEffect, useState } from "react";
import { Button, Icon, PageHeading, StatusBadge } from "../../components/ui/index.jsx";
import {
  getApplicationCompetitionCenter,
  getApplicationCompetitionExamEmail,
  getApplicationCompetitionFormat,
  getApplicationFormatSummary,
  getApplicationPhone,
} from "../applications/applicationUtils.js";
import { DemoTransferSlip, ReviewRejectDialog, ReviewSlipDialog } from "./ReviewDialogs.jsx";

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

export function AdminReviewPage({ applications, schoolBatches = [], sourceFilter = "all", onApprove, onReject, onSlipIssue, notify, navigate, activeApplicationId, backendEnabled }) {
  const hasUnreviewedPayment = (item) => (item.paymentRecords || []).some((payment) => payment.status === "pending");
  const pendingApps = applications.filter((item) => item.status === "pending" || hasUnreviewedPayment(item));
  const [selectedId, setSelectedId] = useState(activeApplicationId || pendingApps[0]?.id || applications[0]?.id || "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(activeApplicationId ? "all" : "pending");
  const [kindFilter, setKindFilter] = useState("all");
  const [competitionFilters, setCompetitionFilters] = useState([]);
  const [reviewView, setReviewView] = useState("all");
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const [slipPreviewOpen, setSlipPreviewOpen] = useState(false);
  const [loadedSlip, setLoadedSlip] = useState(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [rejectApplicationId, setRejectApplicationId] = useState("");
  const schoolApplications = applications.filter((item) => item.source === "school");
  const sourceApplications = sourceFilter === "all"
    ? applications
    : applications.filter((item) => sourceFilter === "school" ? item.source === "school" : item.source !== "school");
  const schoolGroups = Object.values(schoolApplications.reduce((groups, item) => {
    const key = `${item.year}|${item.exam}`;
    groups[key] ||= { key, year: item.year, exam: item.exam, applications: [] };
    groups[key].applications.push(item);
    return groups;
  }, {})).map((group) => ({ ...group, pending: group.applications.filter((item) => item.status === "pending" || hasUnreviewedPayment(item)).length }));
  const selectedGroup = schoolGroups.find((group) => group.key === selectedGroupKey);
  const competitionOptions = [...new Map(sourceApplications.flatMap((item) => item.competitions || [])
    .map((competition) => [getReviewCompetitionKey(competition), competition.short || competition.name || competition.id])
    .filter(([key]) => key)).entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "en"));
  const reviewPool = reviewView === "school-groups"
    ? selectedGroup?.applications || []
    : sourceApplications;
  const filteredApplications = reviewPool.filter((item) => {
    const query = search.trim().toLowerCase();
    const applicationNumber = `OC-${item.year}-${String(item.id || "").toUpperCase()}`;
    const competitionTerms = (item.competitions || []).flatMap((competition) => [competition.short, competition.name, competition.subject]).filter(Boolean);
    const matchesSearch = !query || [item.candidate, item.id, applicationNumber, item.school, item.contactEmail, item.heatId, item.finalId, item.exam, item.year, ...competitionTerms].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    const matchesStatus = statusFilter === "all"
      || (statusFilter === "pending" ? item.status === "pending" || hasUnreviewedPayment(item) : item.status === statusFilter && !hasUnreviewedPayment(item));
    const matchesCompetition = reviewView !== "all" || competitionFilters.length === 0
      || (item.competitions || []).some((competition) => competitionFilters.includes(getReviewCompetitionKey(competition)));
    return matchesSearch && matchesStatus && matchesCompetition && (kindFilter === "all" || item.kind === kindFilter);
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
  const selectedSlipFileName = selectedSlipFile?.name || selectedSchoolBatch?.paymentSlipFileName || selected?.slipFileName || (backendEnabled ? "ไม่พบไฟล์หลักฐานการชำระเงิน" : `payment-slip-${selected?.id || "application"}.pdf`);
  const [slipLoadError, setSlipLoadError] = useState("");
  const hasReviewableSlip = !backendEnabled || Boolean(selectedSlipDataUrl);
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
      .then((response) => { if (!response.ok) throw new Error("เปิดไฟล์หลักฐานการชำระเงินจากฐานข้อมูลไม่สำเร็จ"); return response.blob(); })
      .then((blob) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.onerror = () => reject(new Error("อ่านไฟล์หลักฐานการชำระเงินไม่สำเร็จ"));
        reader.readAsDataURL(blob);
      }))
      .then((dataUrl) => { if (!cancelled) setLoadedSlip({ key: selectedSlipKey, applicationId: selected.id, paymentId: selectedPayment?.id, name: slipMetadata.name, type: slipMetadata.type, dataUrl }); })
      .catch((error) => { if (!cancelled) setSlipLoadError(error.message || "เปิดไฟล์หลักฐานการชำระเงินไม่สำเร็จ"); });
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
      <PageHeading eyebrow="จัดการใบสมัคร · คิวตรวจ" title="ตรวจใบสมัครและหลักฐานการชำระเงิน" description="ตรวจสอบข้อมูลผู้สมัคร รายการสอบ และยอดชำระ ก่อนอนุมัติใบสมัครหรือแจ้งปัญหาเกี่ยวกับหลักฐานการชำระเงิน" action={<span className="queue-indicator"><span />รอตรวจสอบ {pendingCount} ใบ</span>} />
      <div className="review-layout grid min-w-0 grid-cols-[300px_minmax(0,1fr)] items-start gap-[17px] max-[1020px]:grid-cols-[255px_minmax(0,1fr)] max-[800px]:grid-cols-1">
        <section className="surface review-queue min-w-0 overflow-hidden">
          <div className={`admin-review-mode ${sourceFilter === "self" ? "grid-cols-1" : ""}`} role="tablist" aria-label="มุมมองคิวใบสมัคร">
            <button type="button" role="tab" aria-selected={reviewView === "all"} className={reviewView === "all" ? "active" : ""} onClick={() => { setReviewView("all"); setSelectedGroupKey(""); setSearch(""); }}>ใบสมัคร <span>{sourceApplications.length}</span></button>
            {sourceFilter !== "self" ? <button type="button" role="tab" aria-label={`กลุ่มโรงเรียน · ${schoolApplications.length} ใบสมัครทั้งหมด`} aria-selected={reviewView === "school-groups"} className={reviewView === "school-groups" ? "active" : ""} onClick={() => { setReviewView("school-groups"); setSelectedGroupKey(""); setSearch(""); setKindFilter("all"); }}>กลุ่มโรงเรียน <span title={`${schoolApplications.length} ใบสมัครจากโรงเรียนทั้งหมด`}>{schoolApplications.length}</span></button> : null}
          </div>
          {reviewView === "school-groups" && !selectedGroup ? (
            <>
              <div className="review-queue-head flex items-center justify-between px-[15px] pb-[10px] pt-[15px]"><div><h2 className="m-0 text-[16px] text-[#2e3c5d]">กลุ่มรายการสอบ</h2><p className="mb-0 mt-[3px] text-xs text-[#8996a7]">เลือกกลุ่มเพื่อดูรายชื่อผู้สมัคร</p></div><span className="queue-pill grid h-[25px] w-[25px] place-items-center rounded-[7px] bg-[#fff2d4] text-xs font-bold text-[#83540f]" title={`${schoolPendingCount} ใบสมัครจากโรงเรียนอยู่ระหว่างตรวจสอบ`} aria-label={`${schoolPendingCount} ใบสมัครจากโรงเรียนอยู่ระหว่างตรวจสอบ`}>{schoolPendingCount}</span></div>
              <div className="review-group-list">{schoolGroups.map((group) => <button type="button" key={group.key} className="review-group-card" onClick={() => { setSelectedGroupKey(group.key); setSelectedId(""); setStatusFilter("pending"); setKindFilter("all"); }}><span className="review-group-mark"><Icon name={group.applications[0]?.kind === "Final" ? "award" : "file"} /></span><span className="review-group-copy"><small>ปีการศึกษา {group.year} · {group.applications[0]?.kind}</small><strong>{group.exam}</strong><em className={group.pending ? "review-group-pending" : "review-group-clear"}>{group.pending ? `${group.pending} ใบอยู่ระหว่างตรวจสอบ` : "ไม่มีงานค้าง"}</em></span><span className="review-group-count">{group.applications.length}<small>ใบสมัคร</small></span><Icon name="chevron" size={18} /></button>)}{schoolGroups.length === 0 ? <div className="review-empty-filter"><Icon name="building" /><strong>ยังไม่มีใบสมัครจากโรงเรียน</strong></div> : null}</div>
            </>
          ) : (
            <>
              <div className="review-queue-head flex items-center justify-between px-[15px] pb-[10px] pt-[15px]"><div>{reviewView === "school-groups" ? <button type="button" className="review-back-groups" onClick={() => { setSelectedGroupKey(""); setSearch(""); }}><Icon name="arrow" size={15} />กลับไปกลุ่ม</button> : null}<h2 className="m-0 text-[16px] text-[#2e3c5d]">{selectedGroup?.exam || (sourceFilter === "school" ? "ผ่านโรงเรียน" : sourceFilter === "self" ? "สมัครด้วยตนเอง" : "ใบสมัคร")}</h2><p className="mb-0 mt-[3px] text-xs text-[#8996a7]">{selectedGroup ? `ปีการศึกษา ${selectedGroup.year} · ${filteredApplications.length} จาก ${reviewPool.length} ใบ` : `${filteredApplications.length} จาก ${reviewPool.length} รายการ`}</p></div><span className="queue-pill grid h-[25px] w-[25px] place-items-center rounded-[7px] bg-[#fff2d4] text-xs font-bold text-[#83540f]">{reviewPool.filter((item) => item.status === "pending" || hasUnreviewedPayment(item)).length}</span></div>
              <label className="input-with-icon review-search mx-[11px] mb-[9px]"><Icon name="search" /><input className="min-h-9 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ โรงเรียน หรือเลขประจำตัวสอบ" /></label>
              <div className="review-filter-row" role="group" aria-label="กรองสถานะใบสมัคร">{[{ id: "pending", label: "อยู่ระหว่างตรวจสอบ" }, { id: "confirmed", label: "ยืนยันแล้ว" }, { id: "all", label: "ทั้งหมด" }].map((filter) => <button type="button" key={filter.id} className={statusFilter === filter.id ? "review-filter-active" : ""} aria-pressed={statusFilter === filter.id} onClick={() => setStatusFilter(filter.id)}>{filter.label}<span>{scopedStatusCount(filter.id)}</span></button>)}</div>
              <div className="review-filter-selects grid-cols-1"><label><span>ประเภท</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">รอบ HEAT และ Final</option><option value="Heat">HEAT</option><option value="Final">Final</option></select></label></div>
              {reviewView === "all" && competitionOptions.length > 0 ? <fieldset className="review-competition-filter">
                <legend>รายการสอบ</legend>
                <div className="review-competition-filter-heading"><span>เลือกได้หลายรายการ · แสดงใบสมัครที่ตรงกับรายการใดรายการหนึ่ง · หากไม่เลือกจะแสดงทั้งหมด</span>{competitionFilters.length > 0 ? <button type="button" onClick={() => setCompetitionFilters([])}>ล้างที่เลือก</button> : null}</div>
                <div className="review-competition-options">{competitionOptions.map((option) => <label key={option.key} className={competitionFilters.includes(option.key) ? "selected" : ""}><input type="checkbox" checked={competitionFilters.includes(option.key)} onChange={(event) => { const checked = event.target.checked; setCompetitionFilters((current) => checked ? [...current, option.key] : current.filter((key) => key !== option.key)); }} /><span>{option.label}</span></label>)}</div>
              </fieldset> : null}
              <div className="review-list grid max-h-[calc(11*82px)] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
                {filteredApplications.map((item) => (
                  <button className={`review-list-item flex min-h-[82px] w-full items-center gap-2 border-0 border-t border-[#edf0f4] bg-white px-[11px] py-[9px] text-left transition-colors hover:bg-[#fafcff] ${selected?.id === item.id ? "review-list-selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)}>
                    <span className={`review-status-avatar ${item.status === "confirmed" && !hasUnreviewedPayment(item) ? "review-status-avatar-confirmed" : item.slipIssue ? "review-status-avatar-issue" : "review-status-avatar-pending"}`} title={hasUnreviewedPayment(item) ? "มีรายการชำระเงินรอตรวจสอบ" : item.status === "confirmed" ? "ยืนยันใบสมัคร" : item.slipIssue ? `ต้องตรวจสอบ: ${item.slipIssue}` : "อยู่ระหว่างตรวจสอบ"} aria-label={hasUnreviewedPayment(item) ? "มีรายการชำระเงินรอตรวจสอบ" : item.status === "confirmed" ? "ยืนยันใบสมัคร" : item.slipIssue ? `ต้องตรวจสอบ: ${item.slipIssue}` : "อยู่ระหว่างตรวจสอบ"}>
                      <Icon name={item.status === "confirmed" && !hasUnreviewedPayment(item) ? "check" : item.slipIssue ? "info" : "clock"} size={16} />
                    </span>
                    <span className="review-list-copy flex min-w-0 flex-1 flex-col gap-[3px]"><strong className="truncate text-[13px] text-[#2d3e5e]">{item.candidate}</strong><small className="truncate text-xs text-[#66758e]">{getAdminReviewExamLabel(item)}</small><small className="truncate text-xs text-[#66758e]">{item.source === "school" ? "ส่งผ่านโรงเรียน" : "สมัครด้วยตนเอง"} · {(item.competitions || []).length} รายการ · {fmtMoney(item.totalPayment)}</small>{hasUnreviewedPayment(item) && item.status === "confirmed" ? <small className="review-list-payment-pending truncate text-xs font-bold text-[#93640f]">ยอดชำระเพิ่มเติมอยู่ระหว่างตรวจสอบ</small> : null}</span>
                  </button>
                ))}
                {!filteredApplications.length ? <div className="review-empty-filter"><Icon name="search" /><strong>ไม่พบใบสมัคร</strong><span>โปรดปรับคำค้นหาหรือตัวกรอง</span></div> : null}
              </div>
            </>
          )}
        </section>
        {selected ? (
          <section className="surface review-detail min-w-0 max-h-none gap-0 overflow-visible p-[14px] min-[801px]:px-[18px] min-[801px]:py-4">
            <div className="review-detail-head flex items-center justify-between gap-3 border-b border-[#edf0f4] pb-[10px] max-[800px]:items-start max-[800px]:flex-col">
              <div>
                <p className="eyebrow">{selected.kind} · {selected.source === "school" ? "ส่งผ่านโรงเรียน" : "สมัครด้วยตนเอง"}</p>
                <h2>{selected.candidate}</h2>
                <span>{selected.school}{selected.batchId ? ` · ชุด ${selected.batchId}` : ""}</span>
              </div>
              <div className="review-detail-actions flex items-center justify-between gap-2 max-[800px]:w-full"><StatusBadge status={selected.status} /><Button variant="outline" icon="edit" onClick={() => navigate("admin-application-edit", selected.id)}>แก้ไขใบสมัคร</Button></div>
            </div>
            {selected.slipIssue ? <div className="review-record-issue"><Icon name="info" size={16} /><span><strong>หลักฐานการชำระเงินมีปัญหา</strong> · {selected.slipIssue} · ผู้รับลิงก์จะอัปโหลดผ่านอีเมล</span></div> : null}
            <div className="review-detail-body grid max-h-none grid-cols-1 gap-[10px] overflow-visible pt-3">
              <section className="review-profile-strip col-start-1 min-w-0 rounded-[11px] border border-[#e0e4ed] bg-white px-[15px] py-[13px]" aria-label="ข้อมูลผู้สมัคร">
                <div className="review-section-heading border-b border-[#edf0f4] pb-[9px]">
                  <span className="review-section-icon"><Icon name="users" size={16} /></span>
                  <div><strong>ข้อมูลผู้สมัคร</strong><small>ใบสมัคร OC-{selected.year}-{selected.id.toUpperCase()}</small></div>
                  <time className="review-submitted-at" dateTime={submittedAtISO || undefined}><Icon name="clock" size={14} /><span><small>สมัครเมื่อ</small><strong>{submittedAtLabel}</strong></span></time>
                </div>
                <div className="review-copy-grid mt-[9px] grid grid-cols-4 gap-2 max-[800px]:grid-cols-2 max-[540px]:grid-cols-1">
                  {[["ชื่อ", firstName], ["นามสกุล", lastName], ["หมายเลขโทรศัพท์", getApplicationPhone(selected)], ["รหัสประจำตัว", candidateExamNumber || "ยังไม่กำหนด"], ["อีเมล", selected.contactEmail]].map(([label, value]) => (
                    <div className={`review-copy-field grid min-h-[42px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-1.5 rounded-lg border border-[#edf0f4] bg-[#fcfcfe] px-[7px] py-[5px]${label === "อีเมล" ? " review-copy-email col-span-full" : ""}`} key={label}>
                      <span className="col-span-full text-[10px] leading-[1.2] text-[#7e8ba0]">{label}</span><strong className={`min-w-0 text-[13px] font-[650] text-[#344861] ${label === "อีเมล" ? "overflow-visible whitespace-normal [overflow-wrap:anywhere] leading-[1.4]" : "truncate"}`} title={value}>{value || "—"}</strong>
                      {(label !== "รหัสประจำตัว" || candidateExamNumber) ? <button type="button" className="review-copy-button grid h-[29px] w-[29px] place-items-center rounded-[7px] border border-[#e4e2f1] bg-white text-[#5652a2] max-[800px]:h-11 max-[800px]:w-11 enabled:hover:border-[#b9b5dc] enabled:hover:bg-[#f4f2fc] disabled:cursor-not-allowed disabled:bg-[#f4f5f7] disabled:text-[#a5a9b3]" aria-label={`คัดลอก${label}`} title={`คัดลอก${label}`} disabled={!value} onClick={() => copyApplicantField(label, value)}><Icon name="copy" size={14} /></button> : null}
                    </div>
                  ))}
                </div>
              </section>
              <section className="review-exam-panel col-start-1 min-w-0 rounded-[11px] border border-[#e0e4ed] bg-white px-[15px] py-[13px]" aria-label="รายละเอียดการสมัคร">
                <div className="review-section-heading border-b border-[#edf0f4] pb-[9px]"><span className="review-section-icon review-section-icon-violet"><Icon name="book" size={16} /></span><div><strong>รายการสอบและรูปแบบ</strong><small>ปีการศึกษา {selected.year} · {selected.kind} ROUND</small></div></div>
                <div className="review-exam-list mt-[9px] grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-[7px] max-[540px]:grid-cols-1">
                  {selected.competitions?.length ? selected.competitions.map((competition) => {
                    const online = getApplicationCompetitionFormat(selected, competition) === "Online";
                    const examEmail = getApplicationCompetitionExamEmail(selected, competition);
                    return <div className="review-exam-row grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-2 rounded-lg border border-[#edf0f4] bg-[#fcfcfe] px-[10px] py-2" key={competition.id}>
                      <span className="grid min-w-0 gap-0.5"><strong className="font-portal text-[13px] text-[#555b9e]">{competition.short || competition.name}</strong><small className="truncate text-xs text-[#687990]">{competition.name}</small><small className="text-xs leading-[1.45] text-[#687990]">{competition.grade || "ไม่ระบุชั้น"} · {online ? "Online Exam" : "Paper-Based"} · {getApplicationCompetitionCenter(selected, competition) || "—"}</small>{online ? <small className="review-exam-email text-xs leading-[1.45] text-[#4f6480] [overflow-wrap:anywhere]">อีเมลเข้าสอบ: {examEmail || "ยังไม่ได้ระบุ"}</small> : null}</span><b className="col-start-2 row-start-1 whitespace-nowrap text-xs text-[#465872]">{fmtMoney(competition.fee)}</b>
                    </div>;
                  }) : <p className="review-no-data">ไม่มีรายละเอียดรายการสอบในใบสมัครนี้</p>}
                </div>
                <div className="review-papers-row mt-2 grid gap-2 rounded-[9px] border border-[#dfddef] bg-[#f7f6fc] px-3 py-[10px]">
                  <div className="review-papers-heading flex items-center justify-between gap-2.5"><strong className="text-[13px] text-[#445873]">ข้อสอบเก่าที่เลือก</strong><span className="review-paper-count whitespace-nowrap rounded-md bg-[#f1effb] px-1.5 py-1 text-[11px] text-[#5652a2]">{selected.pastPapers?.length || 0} ชุด</span></div>
                  {selected.pastPapers?.length ? (
                    <table className="review-papers-table w-full table-fixed border-collapse">
                      <thead><tr><th className="border-b border-[#e9e8f0] bg-[#f1eff8] px-2.5 py-2 text-left text-[11px] font-bold text-[#6f7d91]" scope="col">รายการข้อสอบเก่า</th><th className="w-[112px] border-b border-[#e9e8f0] bg-[#f1eff8] px-2.5 py-2 text-right text-[11px] font-bold text-[#6f7d91] max-[480px]:w-[86px]" scope="col">ราคา</th></tr></thead>
                      <tbody>{selected.pastPapers.map((paper) => <tr key={paper.id}><td className="break-words border-b border-[#e9e8f0] px-2.5 py-2 text-[12px] leading-[1.5] text-[#445873]">{paper.name}</td><td className="whitespace-nowrap border-b border-[#e9e8f0] px-2.5 py-2 text-right text-[13px] font-bold tabular-nums text-[#3d4c69] max-[480px]:w-[86px]">{fmtMoney(paper.fee)}</td></tr>)}</tbody>
                    </table>
                  ) : <p className="review-no-papers m-0 rounded-[7px] bg-white px-2.5 py-[9px] text-[12px] text-[#7c899c]">ไม่ได้ซื้อข้อสอบเก่า</p>}
                </div>
                <div className="review-fee-summary mt-[9px] grid grid-cols-3 gap-2 max-[480px]:grid-cols-2"><span className="flex min-h-[49px] min-w-0 flex-col items-start justify-center gap-1 rounded-lg border border-[#e6e9f0] bg-[#fbfcfe] px-[9px] py-[7px] text-[11px] font-medium text-[#77869b]">ค่าสมัคร <b className="whitespace-nowrap text-[12px] font-bold text-[#475a75]">{fmtMoney(selected.registrationFee)}</b></span><span className="flex min-h-[49px] min-w-0 flex-col items-start justify-center gap-1 rounded-lg border border-[#e6e9f0] bg-[#fbfcfe] px-[9px] py-[7px] text-[11px] font-medium text-[#77869b]">ข้อสอบเก่า <b className="whitespace-nowrap text-[12px] font-bold text-[#475a75]">{fmtMoney(selected.pastPapersTotal)}</b></span>{Number(selected.nonRefundableAdjustment || 0) > 0 ? <span className="flex min-h-[49px] min-w-0 flex-col items-start justify-center gap-1 rounded-lg border border-[#e6e9f0] bg-[#fbfcfe] px-[9px] py-[7px] text-[11px] font-medium text-[#77869b]">ส่วนต่างไม่คืน/ไม่นำไปหัก <b className="whitespace-nowrap text-[12px] font-bold text-[#475a75]">{fmtMoney(selected.nonRefundableAdjustment)}</b></span> : null}<strong className="flex min-h-[49px] min-w-0 flex-col items-start justify-center gap-1 rounded-lg border border-[#dcd9f0] bg-[#f4f2fc] px-[9px] py-[7px] text-[11px] font-medium text-[#3d4c69] max-[480px]:col-span-full">ยอดที่ต้องชำระ <b className="font-portal text-[15px] font-bold text-[#514e9a]">{fmtMoney(expectedTransferAmount)}</b></strong></div>
              </section>
              <section className="review-payment-panel col-start-1 min-w-0 rounded-[11px] border border-[#e0e4ed] bg-white px-[15px] py-[13px]" aria-label="หลักฐานการชำระเงิน">
                <div className="review-section-heading border-b border-[#edf0f4] pb-[9px]"><span className="review-section-icon review-section-icon-amber"><Icon name="image" size={16} /></span><div><strong>หลักฐานการชำระเงิน</strong><small>ตรวจสอบหลักฐานและยอดชำระเงิน</small></div></div>
                {paymentRecords.length > 1 ? <div className="review-payment-switcher flex gap-[7px] overflow-x-auto py-[9px] pb-0.5" aria-label="เลือกหลักฐานการชำระเงินที่ต้องการตรวจสอบ">{paymentRecords.map((payment, index) => <button type="button" key={payment.id} className={`grid min-w-[150px] flex-none gap-1 rounded-[9px] border border-[#e5e7ef] bg-[#fbfbfe] px-2.5 py-2 text-left text-[#596783] transition-colors ${selectedPayment?.id === payment.id ? "active border-[#a7a2d5] bg-[#f3f2fc] text-[#45418d] shadow-[inset_0_0_0_1px_rgba(93,88,173,0.08)]" : ""}`} aria-pressed={selectedPayment?.id === payment.id} onClick={() => { setSelectedPaymentId(payment.id); setLoadedSlip(null); setSlipLoadError(""); }}><span className="text-[9px]">{payment.status === "confirmed" ? "ยืนยันแล้ว" : "อยู่ระหว่างตรวจสอบ"} · {index === 0 && selected.status === "confirmed" ? "ยอดล่าสุด" : `รายการชำระ ${paymentRecords.length - index}`}</span><strong className="font-portal text-[13px] font-bold">{fmtMoney(payment.expectedAmount)}</strong></button>)}</div> : null}
                {selectedPayment ? <div className="review-payment-amount my-2 flex items-center gap-2 rounded-[9px] border border-[#f1e5c7] bg-[#fffaf0] px-2.5 py-2"><span className="text-[10px] text-[#788398]">ยอดของหลักฐานการชำระเงินนี้</span><strong className="font-portal text-[14px] font-bold text-[#465271]">{fmtMoney(expectedTransferAmount)}</strong><small className="ml-auto text-[9px] text-[#97723a]">{selectedPayment.status === "confirmed" ? "ยืนยันยอดแล้ว" : "อยู่ระหว่างตรวจสอบยอดนี้"}</small></div> : null}
                <div className="review-slip-only flex items-start">
                  <div className="review-slip-column w-full max-w-[200px] min-w-0">
                    <button type="button" className="review-slip-preview box-border flex h-[min(400px,70dvh)] min-h-0 max-h-[400px] w-full max-w-[200px] items-center justify-center overflow-hidden rounded-[10px] border border-[#e5e8f0] bg-[#f4f6fb] p-[5px] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#7773c2] disabled:cursor-not-allowed disabled:opacity-75" aria-label={"ขยายดูหลักฐานการชำระเงินของ " + selected.candidate} title="เลือกเพื่อขยายดูหลักฐานการชำระเงิน" disabled={!selectedSlipDataUrl && backendEnabled} onClick={() => setSlipPreviewOpen(true)}>
                      {selectedSlipDataUrl && selectedSlipType.startsWith("image/") ? <img className="review-slip-image block h-auto max-h-full max-w-full w-auto flex-[0_1_auto] object-contain" src={selectedSlipDataUrl} alt={"หลักฐานการชำระเงินโอนเงินของ " + selected.candidate} />
                        : selectedSlipDataUrl && selectedSlipType === "application/pdf" ? <span className="review-slip-pdf-card grid min-h-full place-content-center justify-items-center gap-[5px] text-[#55519b]"><Icon name="file" size={25} /><strong className="text-[15px]">PDF</strong><small className="text-[11px] text-[#737f94]">เลือกเพื่อเปิดดูหลักฐานการชำระเงินฉบับเต็ม</small></span>
                          : backendEnabled ? <span className="review-slip-empty"><Icon name="info" /><strong>ไม่พบไฟล์หลักฐานการชำระเงินใน Portal</strong><small>ตรวจสอบไฟล์บน Google Drive</small></span> : <DemoTransferSlip application={selected} amount={expectedTransferAmount} />}
                    </button>
                    {slipLoadError ? <small className="review-slip-load-error">{slipLoadError}</small> : null}
                  </div>
                </div>
              </section>
            </div>
            <details className="review-history-collapsible"><summary>ประวัติการแก้ไข · {(selected.changeHistory || []).length} ครั้ง</summary>{selected.changeHistory?.length ? <div className="review-history-list">{selected.changeHistory.map((entry) => <article className="review-history-entry" key={entry.id}><div className="review-history-meta"><strong>{entry.editor}</strong><time>{entry.at}</time></div><div className="review-history-changes">{entry.changes.map((change, index) => <div key={`${entry.id}-${index}`}><span>{change.label}</span><div><del>{change.oldValue || "—"}</del><Icon name="arrow" size={13} /><strong>{change.newValue || "—"}</strong></div></div>)}</div></article>)}</div> : <p className="review-history-empty">ยังไม่มีประวัติการแก้ไข</p>}</details>
            <div className="review-actions mt-[9px] flex items-center justify-between gap-3 border-t border-[#edf0f4] pt-[9px] max-[800px]:items-stretch max-[800px]:flex-col">
              <div className="review-action-label"><strong>ผลการตรวจสอบ</strong><small>{pendingAdditionalPayment ? "ใบสมัครอนุมัติแล้ว · ตรวจหลักฐานการชำระเงินยอดชำระเพิ่ม" : selected.status === "confirmed" ? "ใบสมัครนี้อนุมัติแล้ว" : selected.slipIssue ? "รอหลักฐานการชำระเงินใหม่ก่อนอนุมัติ" : !hasReviewableSlip ? "ยังเปิดหลักฐานการชำระเงินไม่ได้ จึงยังอนุมัติไม่ได้" : "ตรวจสอบหลักฐานการชำระเงินแล้วอนุมัติใบสมัคร"}</small></div>
              <div className="review-action-buttons flex flex-col items-end gap-2 max-[800px]:items-stretch">
                {selected.status !== "confirmed" && !selected.slipIssue && selectedPayment?.status !== "confirmed" ? <div className="template-menu"><span>ส่งเทมเพลตแจ้งปัญหาหลักฐานการชำระเงิน</span><div><Button className="min-h-9 px-[9px] text-xs max-[800px]:min-h-11" variant="outline" icon="mail" onClick={() => onSlipIssue(selected.id, "หลักฐานการชำระเงินไม่ถูกต้อง", selectedPayment?.id)}>หลักฐานการชำระเงินไม่ถูกต้อง</Button><Button className="min-h-9 px-[9px] text-xs max-[800px]:min-h-11" variant="outline" icon="mail" onClick={() => onSlipIssue(selected.id, "เปิดหลักฐานการชำระเงินไม่ได้", selectedPayment?.id)}>เปิดหลักฐานการชำระเงินไม่ได้</Button></div></div> : null}
                <div className="review-decision-buttons grid w-full max-w-[360px] grid-cols-2 gap-2 max-[800px]:max-w-full">
                  <Button className={`min-h-11 min-w-0 whitespace-normal px-[10px] py-2 leading-[1.35] ${selected.status === "confirmed" || selected.status === "rejected" ? "col-start-2" : ""}`} icon="check" disabled={(selected.status === "confirmed" && !pendingAdditionalPayment) || Boolean(selected.slipIssue) || !hasReviewableSlip} onClick={() => onApprove(selected.id, selectedPayment?.id)} title={!hasReviewableSlip ? "โปรดเปิดหลักฐานการชำระเงินก่อนอนุมัติ หรือแจ้งปัญหาที่พบ" : undefined}>{pendingAdditionalPayment ? "ยืนยันยอดชำระเพิ่ม" : selected.status === "confirmed" ? "อนุมัติแล้ว" : "อนุมัติใบสมัคร"}</Button>
                  {selected.status !== "confirmed" && selected.status !== "rejected" ? <Button variant="outline" className="review-reject-trigger min-h-11 min-w-0 whitespace-normal border-[#ffd6df] bg-[#fff7f9] px-[10px] py-2 leading-[1.35] text-[#a13450] hover:border-[#f7a9bb] hover:bg-[#fff0f4]" onClick={() => setRejectApplicationId(selected.id)}>ไม่อนุมัติใบสมัคร</Button> : null}
                </div>
              </div>
            </div>
          </section>
        ) : reviewView === "school-groups" && !selectedGroup ? <section className="surface review-group-guide"><span><Icon name="grid" size={22} /></span><p className="eyebrow">ตรวจใบสมัครจากโรงเรียน</p><h2>เลือกกลุ่มรายการสอบ</h2><p>แต่ละกลุ่มรวมใบสมัครตามรายการสอบและปีการศึกษา เมื่อเลือกกลุ่มแล้วจะแสดงรายชื่อผู้สมัคร พร้อมตัวกรองสถานะและค้นหาชื่อ</p></section> : <div className="surface empty-state">เลือกใบสมัครเพื่อดูรายละเอียด</div>}
      </div>
      {slipPreviewOpen && selected ? <ReviewSlipDialog key={selected.id} backendEnabled={backendEnabled} application={selected} amount={expectedTransferAmount} fileName={selectedSlipFileName} dataUrl={selectedSlipDataUrl} fileType={selectedSlipType} onClose={() => setSlipPreviewOpen(false)} /> : null}
      {rejectTarget ? <ReviewRejectDialog key={rejectTarget.id} application={rejectTarget} onReject={onReject} onClose={() => setRejectApplicationId("")} /> : null}
    </div>
  );
}
