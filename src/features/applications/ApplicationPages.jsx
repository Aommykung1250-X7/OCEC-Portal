import { useState } from "react";
import { Button, Field, Icon, PageHeading, StatusBadge } from "../../components/ui/index.jsx";
import { ApplicantProfileFields } from "./FormFields.jsx";
import { formatThaiDate } from "../../examUtils.js";
import { getApplicationHeatResultState } from "../../application-results.js";
import {
  EXAM_ROUND_LABELS,
  getApplicantEditValues,
  getApplicationCenterSummary,
  getApplicationCompetitionCenter,
  getApplicationCompetitionExamEmail,
  getApplicationCompetitionFormat,
  getApplicationEditDeadline,
  getApplicationFormatSummary,
  getApplicationPhone,
  getEligibleFinalRounds,
  isApplicationEditable,
  isFinalEligibleAward,
} from "./applicationUtils.js";

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
      <div className="flex flex-wrap items-start gap-2.5">
        <div className="candidate-avatar">{application.candidate.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
        <div className="application-card-title min-w-0 flex-1">
          <p className="application-kind">{application.kind} · {application.year}</p>
          <h3>{application.candidate}</h3>
          <p>{application.school}</p>
        </div>
        <div className="application-card-status-group ml-auto flex max-w-full min-w-0 flex-wrap items-center justify-end gap-1.5 max-[600px]:flex-[1_0_100%]">
          {resultStageLabel ? <span className={`application-result-stage ${resultState.status === "published" ? "is-published" : "is-waiting"}`}><span className="status-dot" aria-hidden="true" />{resultStageLabel}</span> : <StatusBadge status={application.status} />}
          {hasFinalOpportunity ? <div className="application-final-chip"><Icon name="award" size={15} /><span><strong>ได้รับสิทธิ์สมัครรอบ Final แล้ว</strong></span><Button variant="success" className="application-final-chip-button" onClick={() => onConfirmFinal(application, finalRounds)}>ยืนยัน</Button></div> : null}
        </div>
      </div>
      <div className="application-meta-grid grid grid-cols-[1.1fr_.9fr_.8fr] gap-2 my-4 border-y border-[#eef1f5] py-3 max-[600px]:grid-cols-2">
        <div className="min-w-0 flex flex-col gap-1">
          <span>รายการสอบ</span>
          <strong>{application.exam}</strong>
        </div>
        <div className="min-w-0 flex flex-col gap-1">
          <span>เลขประจำตัวสอบ</span>
          <strong>{application.kind === "Final" ? (application.finalId || "รอเลขประจำตัว") : (application.heatId || "รอเลขประจำตัว")}</strong>
        </div>
        <div className="min-w-0 flex flex-col gap-1 max-[600px]:col-span-full">
          <span>วันที่ส่งใบสมัคร</span>
          <strong>{application.submitted}</strong>
        </div>
      </div>
      {resultStageLabel ? <div className="grid gap-[7px] -mt-0.5 mb-[13px]" aria-label="ผลสอบรายรายการ">
        {resultState.items.map(({ competition, result, status }) => {
          const outcome = result ? (typeof result.eligibleForFinal === "boolean" ? result.eligibleForFinal : result.result ? result.result === "pass" : isFinalEligibleAward(result.award, competition.id)) : null;
          const competitionName = competition.short || competition.name || competition.id;
          return <div className="application-card-result-row flex min-w-0 items-center justify-between gap-x-3 gap-y-2 rounded-[9px] border border-[#e9edf3] bg-[#fbfcfe] px-2.5 py-[9px] max-[600px]:flex-col max-[600px]:items-start" key={competition.applicationItemId || competition.id}>
            <strong>{competitionName}{competition.grade ? ` · ${competition.grade}` : ""}</strong>
            {result ? <span className="flex min-w-0 flex-wrap items-center justify-end gap-[5px] max-[600px]:justify-start"><span className="application-result-published">ประกาศผลสอบ</span><span className={`application-result-outcome ${outcome ? "is-passed" : "is-not-passed"}`}>{outcome ? "ผ่านรอบ HEAT ROUND" : "ไม่ผ่านรอบ HEAT ROUND"}</span></span>
              : status === "waiting" ? <span className="application-result-outcome is-waiting">รอประกาศผลสอบ</span>
                : <span className="application-result-upcoming">ยังไม่ถึงวันสอบ</span>}
          </div>;
        })}
      </div> : null}
      <div className="flex items-center justify-between gap-2">
        <div className="grid min-w-0 flex-1 gap-1">
          <span className="muted-inline"><Icon name="building" size={15} />{getApplicationCenterSummary(application)}</span>
          <span className="muted-inline"><Icon name="phone" size={15} />{getApplicationPhone(application)}</span>
        </div>
        <Button variant="text" className="min-h-[34px] text-xs" icon="arrow" onClick={onOpen}>ดูรายละเอียด</Button>
      </div>
    </article>
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

export function SchoolApplicationGroupPage({ applications, groupKey, navigate }) {
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

export function ApplicationsPage({ applications, navigate, resultRows = [], examCatalog = [], today, authProfile, onConfirmFinal }) {
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
      <div className="flex items-center justify-between gap-4 max-[600px]:flex-col max-[600px]:items-start max-[600px]:gap-2">
        <div className="inline-flex items-center gap-[3px] rounded-[10px] border border-[#e5eaf1] bg-white p-1" role="group" aria-label="กรองตามสถานะใบสมัคร">
          {filters.map((item) => <button key={item} className={filter === item ? "min-h-[34px] min-w-[68px] rounded-[7px] px-[11px] text-xs font-semibold text-ocec-brand bg-[#f0effa]" : "min-h-[34px] min-w-[68px] rounded-[7px] border-0 bg-transparent px-[11px] text-xs text-[#75849a] hover:bg-[#f6f8fb] hover:text-[#304766]"} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <span className="text-xs text-[#8290a2]">พบ {visibleCount} รายการ</span>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[601px]:grid-cols-2">
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

export function EditApplicationPage({ application, onSave, navigate, examCatalog, publicAccess = false, publicCredentials = null }) {
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

export function ApplicationDetailPage({ application, navigate, resultRows = [], examCatalog, today, authProfile, hasFinalApplication = false, onConfirmFinal, onSaveCertificatePhoto }) {
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
      <div className="grid grid-cols-[minmax(0,1fr)_292px] items-start gap-[15px] max-[960px]:grid-cols-1">
        <div className="grid gap-3.5">
          <section className="surface detail-summary grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-[17px] max-[600px]:grid-cols-[auto_minmax(0,1fr)]">
            <div className="detail-avatar">{application.candidate.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
            <div className="detail-ident min-w-0"><span className="application-kind">{application.exam}</span><h2>{application.candidate}</h2><p>{application.school}</p></div>
            <div className="max-[600px]:col-span-full max-[600px]:justify-self-start"><StatusBadge status={application.status} /></div>
            <div className="exam-number-box"><span>เลขประจำตัวสอบ</span><strong>{application.kind === "Final" ? (application.finalId || "รอเลขประจำตัว") : (application.heatId || "รอเลขประจำตัว")}</strong></div>
          </section>
          {application.status === "pending" ? <div className="notice notice-amber"><Icon name="clock" /><div><strong>ใบสมัครอยู่ระหว่างตรวจสอบ</strong><p>ตรวจสอบสถานะได้ตามปกติ แต่ยังแก้ไขข้อมูลไม่ได้</p></div></div> : null}
          <section className="surface detail-section p-[18px]">
            <div className="section-heading"><div><p className="eyebrow">ข้อมูลใบสมัคร</p><h2>ข้อมูลผู้เข้าสอบ</h2></div>{canEdit ? <Button variant="outline" icon="edit" onClick={() => navigate("edit-application", application.id)}>แก้ไขข้อมูล</Button> : null}</div>
            <div className="detail-info-grid grid grid-cols-2 gap-x-[18px] gap-y-4 mt-[18px] max-[600px]:gap-x-[10px] max-[600px]:gap-y-[13px]">
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
        <aside className="surface timeline-card p-[18px] max-[960px]:order-[-1]">
          <p className="eyebrow">ความคืบหน้า</p><h2>ขั้นตอนใบสมัคร</h2>
          <div className="timeline grid gap-0 my-5 mb-[15px] max-[960px]:grid-cols-3 max-[960px]:gap-2 max-[960px]:mb-2.5 max-[600px]:grid-cols-1">
            <div className="timeline-item timeline-done relative flex min-h-[54px] items-start gap-[9px] max-[960px]:min-h-[45px]"><span><Icon name="check" size={13} /></span><div className="flex flex-col gap-[3px] pt-px"><strong>ส่งใบสมัครแล้ว</strong><small>{application.submitted}</small></div></div>
            <div className={"timeline-item relative flex min-h-[54px] items-start gap-[9px] max-[960px]:min-h-[45px] " + (application.status === "confirmed" ? "timeline-done" : "timeline-current")}><span>{application.status === "confirmed" ? <Icon name="check" size={13} /> : "2"}</span><div className="flex flex-col gap-[3px] pt-px"><strong>{application.status === "confirmed" ? "ตรวจสอบและยืนยันแล้ว" : "รอตรวจใบสมัครและสลิป"}</strong><small>{application.status === "confirmed" ? "ตรวจสอบเรียบร้อย" : "เจ้าหน้าที่กำลังตรวจสอบ"}</small></div></div>
            <div className={"timeline-item relative flex min-h-[54px] items-start gap-[9px] max-[960px]:min-h-[45px] " + (applicationResults.length ? "timeline-done" : "")}><span>{applicationResults.length ? <Icon name="check" size={13} /> : "3"}</span><div className="flex flex-col gap-[3px] pt-px"><strong>ประกาศผลสอบ</strong><small>{applicationResults.length ? resultSummary : "รอประกาศผล"}</small></div></div>
          </div>
          {canConfirmFinal ? <div className="detail-final-confirm grid gap-[11px] mb-[14px] rounded-[10px] border border-[#a9dcbb] bg-[#edfaf1] p-3">
            <div className="flex items-center gap-[9px]"><span className="detail-final-confirm-icon"><Icon name="award" size={18} /></span><span className="grid min-w-0 gap-[3px]"><strong>ได้รับสิทธิ์สมัครรอบ Final</strong><small>ยืนยันสิทธิ์เพื่อไปสมัครสอบ Final</small></span></div>
            <Button className="w-full min-h-[42px]" icon="arrow" onClick={() => onConfirmFinal(application, finalRounds)}>ยืนยันสิทธิ์ Final</Button>
          </div> : null}
          <div className="timeline-contact flex items-start gap-[7px] rounded-lg bg-[#f3f7fd] p-2.5 text-xs leading-[1.55] text-[#496489]"><Icon name="mail" size={16} /><span>แจ้งเตือนส่งไปที่<br /><strong>{application.contactEmail}</strong></span></div>
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
