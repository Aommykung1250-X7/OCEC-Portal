import { useEffect, useRef, useState } from "react";
import { Button, Field, GoogleMark, Icon, PageHeading, ProfileAvatar } from "../../components/ui/index.jsx";
import { formatThaiDate } from "../../examUtils.js";
import {
  EXAM_ROUND_LABELS,
  getActiveExamYear,
  getBangkokTodayISO,
  getEligibleFinalRounds,
  isFinalEligibleAward,
  resultTargetLabel,
} from "../applications/applicationUtils.js";

function getPublicResultStatus(row) {
  if (row.roundType === "HEAT") {
    return isFinalEligibleAward(row.award, row.competitionId)
      ? { label: "ผ่านการสอบรอบ HEAT", tone: "eligible" }
      : { label: "ไม่ผ่านการสอบรอบ HEAT", tone: "not-eligible" };
  }
  return { label: "ประกาศผลแล้ว", tone: "published" };
}

export function ApiFinalConfirmationPage({ authProfile, onContinue, onSignIn, navigate, resultPublished, examCatalog, demoProfile }) {
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
      .then(async (response) => { if (!response.ok) throw new Error("ไม่สามารถโหลดข้อมูลสิทธิ์สอบรอบ Final ได้"); return response.json(); })
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
      if (!response.ok) throw new Error(result.error || "ไม่สามารถค้นหาสิทธิ์สอบได้");
      setChoices(result.choices || []);
    } catch (requestError) { setError(requestError.message || "ไม่สามารถค้นหาสิทธิ์สอบได้"); }
    finally { setBusy(false); }
  }

  async function verify(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/public/final-eligibility/verify", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidateName: query.trim(), finalRoundId: selectedRoundId, phoneLast4: lastFour }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "ไม่สามารถยืนยันสิทธิ์สอบได้");
      setVerified(true);
    } catch (requestError) { setError(requestError.message || "ไม่สามารถยืนยันสิทธิ์สอบได้"); }
    finally { setBusy(false); }
  }

  const accountChoices = authorized.filter((choice) => !choice.schoolGrant);
  const schoolChoices = authorized.filter((choice) => choice.schoolGrant);
  const activeYear = getActiveExamYear(examCatalog, "FINAL", "2569");
  return <div className="page-stack final-rights-page mx-auto grid w-full max-w-[1160px] gap-[18px] max-[700px]:gap-[13px]">
    <section className="final-rights-hero relative grid min-h-[282px] grid-cols-[minmax(0,1.15fr)_minmax(260px,.85fr)] overflow-hidden max-[700px]:grid-cols-1" aria-labelledby="final-rights-title">
      <div className="final-rights-hero-copy relative z-[1] self-center px-[42px] py-9 max-[700px]:px-[26px] max-[700px]:py-[29px] max-[460px]:px-[21px] max-[460px]:py-[26px]">
        <span className="final-rights-kicker"><Icon name="award" size={16} /> OCEC FINAL {activeYear}</span>
        <h1 id="final-rights-title">การสมัครรอบ Final<br /><em>เริ่มต้นด้วยการยืนยันสิทธิ์</em></h1>
        <p>ผู้ที่ผ่านการสอบรอบ HEAT โปรดตรวจสอบข้อมูลให้ตรงกับใบสมัครเดิมก่อนสมัครรอบ Final</p>
        <div className="final-rights-hero-meta mt-[22px] flex flex-wrap gap-x-5 gap-y-2 text-xs"><span className="inline-flex items-center gap-[7px]"><Icon name="check" size={17} /> ใช้ข้อมูลจากใบสมัครรอบ HEAT เดิม</span><span className="inline-flex items-center gap-[7px]"><Icon name="shield" size={17} /> ยืนยันตัวตนก่อนสมัคร</span></div>
      </div>
      <div className="final-rights-hero-art relative min-h-[260px] max-[700px]:hidden" aria-hidden="true"><span className="final-rights-orbit" /><span className="final-rights-medal"><Icon name="award" size={48} /></span><span className="final-rights-star final-rights-star-one">✦</span><span className="final-rights-star final-rights-star-two">✦</span><span className="final-rights-final-word">FINAL</span></div>
    </section>
    <div className="final-rights-info-row flex items-center justify-between gap-4 rounded-2xl border border-[#e2e4f2] bg-white px-[19px] py-[15px] max-[700px]:items-start max-[700px]:flex-col"><div className="flex flex-wrap items-center gap-x-[23px] gap-y-[10px]"><span className={resultPublished ? "final-rights-live" : "final-rights-waiting"}><i />{resultPublished ? "ตรวจสอบสิทธิ์สมัครรอบ Final" : "รอประกาศผลการสอบรอบ HEAT"}</span><span className="final-rights-deadline"><Icon name="calendar" size={17} /> กำหนดปิดยืนยันสิทธิ์แตกต่างกันตามรายการสอบและรอบ</span></div><Button variant="text" onClick={() => navigate("results")}>ดูประกาศผล <Icon name="arrow" size={16} /></Button></div>
    <div className="final-rights-layout grid grid-cols-[minmax(0,1.65fr)_minmax(260px,.75fr)] items-start gap-[18px] max-[960px]:grid-cols-1">
      <div className="final-rights-main grid min-w-0 gap-4">
        <section className="surface final-rights-workspace p-[29px] max-[700px]:p-5 max-[460px]:p-4 final-rights-api-workspace" aria-labelledby="final-rights-workspace-title">
          <div className="final-rights-workspace-heading mb-[22px] flex items-start justify-between gap-[14px]"><div><p className="eyebrow">ยืนยันสิทธิ์เข้าสอบ Final</p><h2 id="final-rights-workspace-title">คุณสมัครสอบรอบ HEAT ผ่านช่องทางใด?</h2><p>โปรดเลือกช่องทางที่ตรงกับใบสมัครรอบ HEAT</p></div><span className="final-rights-step-number">01 / 03</span></div>
          <div className="final-rights-paths mb-[23px] grid grid-cols-2 gap-[11px] max-[700px]:gap-2 max-[460px]:grid-cols-1" role="tablist" aria-label="วิธียืนยันสิทธิ์">
            <button type="button" role="tab" aria-selected={path === "account"} className={"final-rights-path grid min-h-[145px] justify-items-start content-start gap-1.5 p-[18px] text-left cursor-pointer max-[700px]:min-h-[137px] max-[700px]:p-[14px] max-[460px]:min-h-[86px] max-[460px]:grid-cols-[36px_minmax(0,1fr)] max-[460px]:content-center max-[460px]:gap-x-[9px] " + (path === "account" ? "selected" : "")} onClick={() => { setPath("account"); setError(""); }}><span className="final-rights-path-icon grid size-[38px] place-items-center mb-[3px] max-[460px]:row-span-2 max-[460px]:mb-0"><Icon name="users" /></span><strong className="max-[460px]:col-start-2">สมัครด้วยบัญชีตนเอง</strong><small className="max-[460px]:col-start-2">เปิดใบสมัครของฉันเพื่อดำเนินการต่อ</small></button>
            <button type="button" role="tab" aria-selected={path === "school"} className={"final-rights-path grid min-h-[145px] justify-items-start content-start gap-1.5 p-[18px] text-left cursor-pointer max-[700px]:min-h-[137px] max-[700px]:p-[14px] max-[460px]:min-h-[86px] max-[460px]:grid-cols-[36px_minmax(0,1fr)] max-[460px]:content-center max-[460px]:gap-x-[9px] " + (path === "school" ? "selected" : "")} onClick={() => { setPath("school"); setError(""); }}><span className="final-rights-path-icon grid size-[38px] place-items-center mb-[3px] max-[460px]:row-span-2 max-[460px]:mb-0"><Icon name="building" /></span><strong className="max-[460px]:col-start-2">สมัครโดยโรงเรียน</strong><small className="max-[460px]:col-start-2">ค้นหาด้วยชื่อและยืนยันหมายเลขโทรศัพท์</small></button>
          </div>
          {error ? <p className="inline-error" role="alert">{error}</p> : null}
          {path === "account" ? <div role="tabpanel" className="final-rights-account-panel">
            {!authProfile ? <div className="final-rights-signin"><span className="final-rights-signin-icon"><GoogleMark /></span><div><strong>เข้าสู่ระบบเพื่อตรวจสอบสิทธิ์สอบ</strong><p>โปรดใช้บัญชี Google เดียวกับที่ใช้สมัครสอบรอบ HEAT</p></div><Button variant="outline" onClick={() => onSignIn(demoProfile)}>เข้าสู่ระบบ Google</Button></div> :
              accountChoices.length ? <div className="final-rights-match-list">{accountChoices.map((choice) => <div className="final-rights-match" key={`${choice.sourceHeatApplicationId}-${choice.item.roundId}`}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{choice.applicant.firstNameEn} {choice.applicant.lastNameEn}</strong><small>{choice.item.competition} · {choice.item.year}</small></div><Button icon="arrow" onClick={() => onContinue(choice)}>สมัครรอบ Final</Button></div>)}</div> : <div className="final-rights-empty"><Icon name="info" /><div><strong>ไม่พบสิทธิ์สมัครรอบ Final ที่เปิดให้ยืนยันในบัญชีนี้</strong><p>หากสมัครผ่านโรงเรียน โปรดเลือกแท็บ “สมัครโดยโรงเรียน” เพื่อค้นหาด้วยชื่อ</p></div></div>}
          </div> : <div role="tabpanel" className="final-rights-school-panel">
            {schoolChoices.length ? <div className="final-rights-match-list">{schoolChoices.map((choice) => <div className="final-rights-match" key={`${choice.sourceHeatApplicationId}-${choice.item.roundId}`}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{choice.applicant.firstNameEn} {choice.applicant.lastNameEn}</strong><small>{choice.item.competition} · {choice.item.year}</small></div><Button icon="arrow" onClick={() => onContinue(choice)}>สมัครรอบ Final</Button></div>)}</div> : verified ? <div className="notice notice-blue"><Icon name="check" /><div><strong>ยืนยันหมายเลขโทรศัพท์แล้ว</strong><p>โปรดเข้าสู่ระบบด้วยบัญชี Google ที่ต้องการใช้สำหรับใบสมัครรอบ Final</p><Button onClick={() => window.location.assign(`/api/auth/google/start?flow=final&returnTo=${encodeURIComponent("/final/confirm")}`)}>เข้าสู่ระบบ Google แล้วสมัคร</Button></div></div> : <>
              <div className="final-rights-section-label"><span>02</span><div><strong>ตรวจสอบใบสมัครรอบ HEAT</strong><small>ระบุชื่อภาษาอังกฤษให้ตรงกับข้อมูลในใบสมัคร</small></div></div>
              <form className="final-rights-eligibility-search" onSubmit={search}><Field label="ชื่อและนามสกุลภาษาอังกฤษ" required><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} minLength={3} maxLength={255} required autoComplete="off" placeholder="เช่น Thanakorn Wattanakul" /></div></Field><Button type="submit" icon="search" disabled={busy}>{busy ? "กำลังค้นหา…" : "ค้นหาสิทธิ์ Final"}</Button></form>
              {choices.length ? <form className="final-rights-verify-form" onSubmit={verify}><div className="final-rights-section-label"><span>03</span><div><strong>ยืนยันตัวตน</strong><small>ใช้หมายเลขโทรศัพท์ในใบสมัคร HEAT</small></div></div><Field label="เลือกรายการสอบ" required><select value={selectedRoundId} onChange={(event) => setSelectedRoundId(event.target.value)} required><option value="">เลือกรายการสอบ</option>{choices.map((choice) => <option value={choice.finalRoundId} key={choice.finalRoundId}>{choice.competition} · {choice.round} · {choice.year}</option>)}</select></Field><Field label="เลข 4 ตัวท้ายของหมายเลขโทรศัพท์" required><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} required placeholder="••••" /></Field><Button type="submit" icon="shield" disabled={busy || !selectedRoundId}>{busy ? "กำลังยืนยัน…" : "ยืนยันตัวตน"}</Button></form> : <div className="final-rights-search-hint"><Icon name="info" size={16} />ค้นหาชื่อเพื่อตรวจสอบสิทธิ์สมัครรอบ Final</div>}
            </>}
          </div>}
        </section>
      </div>
      <aside className="final-rights-aside grid min-w-0 gap-4 max-[960px]:grid-cols-2 max-[700px]:grid-cols-1"><section className="surface final-rights-guide"><p className="eyebrow">ขั้นตอนการสมัคร</p><h2>ขั้นตอนสมัครรอบ Final</h2><ol><li><span>01</span><div><strong>ตรวจสอบสิทธิ์</strong><small>ตรวจสอบใบสมัครในบัญชี หรือค้นหาด้วยชื่อ</small></div></li><li><span>02</span><div><strong>ยืนยันตัวตน</strong><small>ผู้สมัครผ่านโรงเรียนต้องยืนยันด้วยหมายเลขโทรศัพท์ 4 หลักท้าย</small></div></li><li><span>03</span><div><strong>สมัครรอบ Final</strong><small>ตรวจสอบข้อมูลเดิม ชำระเงิน และแนบหลักฐานการชำระเงินใหม่</small></div></li></ol></section><div className="final-rights-help"><Icon name="info" size={18} /><p>การสมัครรอบ Final ใช้ใบสมัครใหม่ แยกจากรอบ HEAT และเจ้าหน้าที่จะตรวจสอบหลักฐานการชำระเงินอีกครั้ง</p></div></aside>
    </div>
  </div>;
}

export function FinalConfirmationPage({ applications, applicationHint, onContinue, navigate, publishedHeatResults = [], examCatalog, authProfile, onSignIn, demoProfile }) {
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
  const pendingReason = !hasPublishedHeat ? "รอประกาศผลการสอบรอบ HEAT" : "พ้นกำหนดยืนยันสิทธิ์ทุกรายการแล้ว";
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
      setError("หมายเลขโทรศัพท์ 4 หลักท้ายไม่ตรงกับข้อมูลในใบสมัครรอบ HEAT โปรดตรวจสอบอีกครั้ง");
      return;
    }
    setError("");
    setVerified(true);
  }

  return (
    <div className="page-stack final-rights-page mx-auto grid w-full max-w-[1160px] gap-[18px] max-[700px]:gap-[13px]">
      <section className="final-rights-hero relative grid min-h-[282px] grid-cols-[minmax(0,1.15fr)_minmax(260px,.85fr)] overflow-hidden max-[700px]:grid-cols-1" aria-labelledby="final-rights-title">
        <div className="final-rights-hero-copy relative z-[1] self-center px-[42px] py-9 max-[700px]:px-[26px] max-[700px]:py-[29px] max-[460px]:px-[21px] max-[460px]:py-[26px]">
          <span className="final-rights-kicker"><Icon name="award" size={16} /> OCEC FINAL 2569</span>
          <h1 id="final-rights-title">การสมัครรอบ Final<br /><em>เริ่มต้นด้วยการยืนยันสิทธิ์</em></h1>
          <p>ผู้ที่ผ่านการสอบรอบ HEAT โปรดตรวจสอบข้อมูลให้ตรงกับใบสมัครเดิมก่อนสมัครรอบ Final</p>
          <div className="final-rights-hero-meta mt-[22px] flex flex-wrap gap-x-5 gap-y-2 text-xs"><span className="inline-flex items-center gap-[7px]"><Icon name="check" size={17} /> ใช้ข้อมูลจากใบสมัครรอบ HEAT เดิม</span><span className="inline-flex items-center gap-[7px]"><Icon name="shield" size={17} /> ยืนยันตัวตนก่อนสมัคร</span></div>
        </div>
        <div className="final-rights-hero-art relative min-h-[260px] max-[700px]:hidden" aria-hidden="true"><span className="final-rights-orbit" /><span className="final-rights-medal"><Icon name="award" size={48} /></span><span className="final-rights-star final-rights-star-one">✦</span><span className="final-rights-star final-rights-star-two">✦</span><span className="final-rights-final-word">FINAL</span></div>
      </section>

      <div className="final-rights-info-row flex items-center justify-between gap-4 rounded-2xl border border-[#e2e4f2] bg-white px-[19px] py-[15px] max-[700px]:items-start max-[700px]:flex-col"><div className="flex flex-wrap items-center gap-x-[23px] gap-y-[10px]"><span className={canConfirm ? "final-rights-live" : "final-rights-waiting"}><i />{canConfirm ? "เปิดยืนยันสิทธิ์" : pendingReason}</span><span className="final-rights-deadline"><Icon name="calendar" size={17} /> กำหนดปิดยืนยันสิทธิ์แตกต่างกันตามรายการสอบและรอบ</span></div><Button variant="text" onClick={() => navigate("results")}>ดูประกาศผล <Icon name="arrow" size={16} /></Button></div>

      <div className="final-rights-layout grid grid-cols-[minmax(0,1.65fr)_minmax(260px,.75fr)] items-start gap-[18px] max-[960px]:grid-cols-1">
        <div className="final-rights-main grid min-w-0 gap-4">
          {!canConfirm ? <div className="notice notice-amber final-rights-pending"><Icon name="clock" /><div><strong>{pendingReason}</strong><p>{!hasPublishedHeat ? "ระบบจะเปิดให้ยืนยันสิทธิ์โดยอัตโนมัติเมื่อผู้ดูแลระบบประกาศผลการสอบรอบ HEAT" : "พ้นกำหนดยืนยันสิทธิ์ของทุกรายการที่เกี่ยวข้องแล้ว"} ขณะนี้ระบบกำลังแสดงตัวอย่างขั้นตอนการใช้งาน</p></div><Button variant="outline" onClick={() => setShowPreview((value) => !value)}>{showPreview ? "ซ่อนตัวอย่าง" : "ดูตัวอย่างขั้นตอน"}</Button></div> : null}
          {canConfirm || showPreview ? (
            <section className="surface final-rights-workspace p-[29px] max-[700px]:p-5 max-[460px]:p-4" aria-labelledby="final-rights-workspace-title">
              <div className="final-rights-workspace-heading mb-[22px] flex items-start justify-between gap-[14px]"><div><p className="eyebrow">ยืนยันสิทธิ์เข้าสอบ Final</p><h2 id="final-rights-workspace-title">คุณสมัครสอบรอบ HEAT ผ่านช่องทางใด?</h2><p>โปรดเลือกช่องทางที่ตรงกับใบสมัครรอบ HEAT</p></div><span className="final-rights-step-number">01 / 03</span></div>
              <div className="final-rights-paths mb-[23px] grid grid-cols-2 gap-[11px] max-[700px]:gap-2 max-[460px]:grid-cols-1" role="tablist" aria-label="วิธีตรวจสอบใบสมัครรอบ HEAT">
                <button type="button" role="tab" aria-selected={path === "account"} className={"final-rights-path grid min-h-[145px] justify-items-start content-start gap-1.5 p-[18px] text-left cursor-pointer max-[700px]:min-h-[137px] max-[700px]:p-[14px] max-[460px]:min-h-[86px] max-[460px]:grid-cols-[36px_minmax(0,1fr)] max-[460px]:content-center max-[460px]:gap-x-[9px] " + (path === "account" ? "selected" : "")} onClick={() => { setPath("account"); setVerified(false); setError(""); }}><span className="final-rights-path-icon grid size-[38px] place-items-center mb-[3px] max-[460px]:row-span-2 max-[460px]:mb-0"><Icon name="users" /></span><strong className="max-[460px]:col-start-2">สมัครด้วยบัญชีตนเอง</strong><small className="max-[460px]:col-start-2">เปิดใบสมัครของฉันเพื่อดำเนินการต่อ</small></button>
                <button type="button" role="tab" aria-selected={path === "school"} className={"final-rights-path grid min-h-[145px] justify-items-start content-start gap-1.5 p-[18px] text-left cursor-pointer max-[700px]:min-h-[137px] max-[700px]:p-[14px] max-[460px]:min-h-[86px] max-[460px]:grid-cols-[36px_minmax(0,1fr)] max-[460px]:content-center max-[460px]:gap-x-[9px] " + (path === "school" ? "selected" : "")} onClick={() => { setPath("school"); setVerified(false); setError(""); }}><span className="final-rights-path-icon grid size-[38px] place-items-center mb-[3px] max-[460px]:row-span-2 max-[460px]:mb-0"><Icon name="building" /></span><strong className="max-[460px]:col-start-2">สมัครโดยโรงเรียน</strong><small className="max-[460px]:col-start-2">ค้นหาด้วยชื่อและยืนยันหมายเลขโทรศัพท์</small></button>
              </div>

              {path === "account" ? (
                <div className="final-rights-account-panel" role="tabpanel">
                  {authProfile ? <><div className="final-rights-account-identity"><ProfileAvatar src={authProfile.picture} alt="" /><div><small>บัญชีที่เข้าสู่ระบบ</small><strong>{authProfile.name}</strong><span>{authProfile.email}</span></div></div>{accountMatches.length ? <div className="final-rights-match-list">{accountMatches.map((item) => <div className="final-rights-match" key={item.id}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{item.candidate}</strong><small>เลขประจำตัวสอบ HEAT {item.heatId} · {item.school}</small><small>{finalRoundDeadlineText(item)}</small></div><Button disabled={!canConfirm} icon="arrow" onClick={() => onContinue(item, "account", null, getEligibleFinalRounds(item, examCatalog, publishedHeatResults, localToday))}>ยืนยันสิทธิ์</Button></div>)}</div> : <div className="final-rights-empty"><Icon name="info" /><div><strong>ยังไม่พบใบสมัครรอบ HEAT ที่ผ่านการคัดเลือกในบัญชีนี้</strong><p>หากสมัครผ่านโรงเรียน โปรดเลือกแท็บ “สมัครโดยโรงเรียน” เพื่อค้นหาด้วยชื่อ</p></div></div>}</> : <div className="final-rights-signin"><span className="final-rights-signin-icon"><GoogleMark /></span><div><strong>เข้าสู่ระบบเพื่อตรวจสอบใบสมัคร</strong><p>ผู้สมัครรอบ HEAT ด้วยบัญชีตนเองไม่ต้องยืนยันหมายเลขโทรศัพท์อีกครั้ง</p></div><Button variant="outline" onClick={() => onSignIn(demoProfile)}>เข้าสู่ระบบโหมดตัวอย่าง</Button></div>}
                </div>
              ) : verified ? (
                <div className="final-rights-verified" role="tabpanel"><span className="final-rights-verified-icon"><Icon name="check" size={28} /></span><p className="eyebrow">ตัวอย่างขั้นตอน</p><h3>พร้อมสมัคร OCEC Final</h3><p>ระบบจะนำข้อมูลจากใบสมัครรอบ HEAT ของ <strong>{selected?.candidate}</strong> มาเติมในแบบฟอร์มรอบ Final โปรดตรวจสอบข้อมูลก่อนส่งใบสมัคร</p><div className="final-rights-verified-summary"><span>เลขประจำตัวสอบ HEAT <strong>{selected?.heatId}</strong></span><span>โรงเรียน <strong>{selected?.school}</strong></span><span className="final-rights-deadline-list">รอบที่ยืนยันได้<strong>{selectedFinalRounds.map((exam) => `${exam.title} · ปิดยืนยันสิทธิ์ ${exam.finalConfirmCloseDate ? formatThaiDate(exam.finalConfirmCloseDate) : "ไม่กำหนด"}`).join(" / ")}</strong></span></div><div className="final-rights-verified-actions"><Button disabled={!canConfirm || !selectedFinalRounds.length} icon="arrow" onClick={() => onContinue(selected, "google", { name: selected?.candidate, email: selected?.contactEmail, picture: demoProfile.picture }, selectedFinalRounds)}>เข้าสู่ระบบ Google แล้วสมัคร</Button></div><button type="button" className="back-link" onClick={() => { setVerified(false); setSelectedId(""); setLastFour(""); }}><Icon name="arrow" size={15} />ค้นหารายชื่ออื่น</button></div>
              ) : (
                <div className="final-rights-school-panel" role="tabpanel"><div className="final-rights-section-label"><span>02</span><div><strong>ตรวจสอบใบสมัครรอบ HEAT</strong><small>ระบุชื่อภาษาอังกฤษให้ตรงกับข้อมูลในใบสมัคร</small></div></div><Field label="ชื่อและนามสกุลภาษาอังกฤษ" required><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); setLastFour(""); setError(""); }} placeholder="เช่น Thanakorn Wattanakul" autoComplete="off" /></div></Field>{query.trim() ? <div className="final-rights-results" aria-live="polite"><p>{eligible.length ? `พบ ${eligible.length} รายการ · โปรดตรวจสอบเลขประจำตัวสอบและโรงเรียนก่อนเลือก` : "ไม่พบรายชื่อที่ตรงกับคำค้น"}</p>{eligible.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? "final-rights-result selected" : "final-rights-result"} aria-pressed={selectedId === item.id} onClick={() => { setSelectedId(item.id); setLastFour(""); setError(""); }}><span className="final-rights-result-radio" /><span><strong>{item.candidate}</strong><small>เลขสอบ {item.heatId} · {item.school}</small><small>{finalRoundDeadlineText(item)}</small></span><Icon name="chevron" size={18} /></button>)}</div> : <div className="final-rights-search-hint"><Icon name="info" size={16} />ระบุชื่อเพื่อค้นหาใบสมัครที่ผ่านการสอบรอบ HEAT</div>}{selected ? <form onSubmit={verify} className="final-rights-verify-form"><div className="final-rights-section-label"><span>03</span><div><strong>ยืนยันตัวตน</strong><small>ใช้หมายเลขโทรศัพท์ในใบสมัคร HEAT ที่เลือก</small></div></div><Field label="เลข 4 ตัวท้ายของหมายเลขโทรศัพท์" required hint="กรอกเฉพาะตัวเลข 4 หลักสุดท้าย"><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => { setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} placeholder="••••" required /></Field>{error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}<Button type="submit" disabled={!canConfirm} icon="shield">ยืนยันตัวตน</Button></form> : null}</div>
              )}
            </section>
          ) : <section className="surface final-rights-locked"><span><Icon name="lock" size={26} /></span><h2>การยืนยันสิทธิ์ยังไม่เปิด</h2><p>เมื่อประกาศผล HEAT แล้ว ผู้ที่ผ่านการสอบสามารถค้นหาชื่อและเริ่มขั้นตอนนี้ได้ทันที</p><Button variant="outline" onClick={() => setShowPreview(true)}>ดูตัวอย่างหน้าจอ</Button></section>}
        </div>
        <aside className="final-rights-aside grid min-w-0 gap-4 max-[960px]:grid-cols-2 max-[700px]:grid-cols-1"><section className="surface final-rights-guide"><p className="eyebrow">ขั้นตอนการสมัคร</p><h2>ขั้นตอนสมัครรอบ Final</h2><ol><li><span>01</span><div><strong>ตรวจสอบสิทธิ์</strong><small>ตรวจสอบใบสมัครในบัญชี หรือค้นหาด้วยชื่อ</small></div></li><li><span>02</span><div><strong>ยืนยันตัวตน</strong><small>ผู้สมัครผ่านโรงเรียนต้องยืนยันด้วยหมายเลขโทรศัพท์ 4 หลักท้าย</small></div></li><li><span>03</span><div><strong>สมัครรอบ Final</strong><small>ตรวจสอบข้อมูลเดิม ชำระเงิน และแนบหลักฐานการชำระเงินใหม่</small></div></li></ol></section><div className="final-rights-help"><Icon name="info" size={18} /><p>การสมัครรอบ Final ใช้ใบสมัครใหม่ แยกจากรอบ HEAT และเจ้าหน้าที่จะตรวจสอบหลักฐานการชำระเงินอีกครั้ง</p></div></aside>
      </div>
    </div>
  );
}

export function PublicResultsPage({ resultRows = [] }) {
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
        <section className="surface results-pending grid min-h-[270px] content-center justify-items-center p-[25px] text-center">
          <span className="results-pending-icon"><Icon name="clock" /></span>
          <h2>รอประกาศผลการสอบอย่างเป็นทางการ</h2>
          <p>เมื่อมีการประกาศผลรายการสอบแล้ว จะสามารถเลือกดูผลของแต่ละรายการและรอบได้จากหน้านี้</p>
          <span className="result-date"><Icon name="calendar" size={15} />ประกาศผลตามกำหนดการของแต่ละรายการ</span>
        </section>
      ) : (
        <>
          <section className="surface results-public-filter-card p-[18px] max-[540px]:p-[14px]">
            <div className="results-public-filter-heading mb-[14px] flex items-center justify-between gap-3 max-[540px]:items-start"><div><p className="eyebrow">ค้นหาผลสอบ</p><h2>เลือกตัวกรองที่ต้องการ</h2></div><span className="result-announced"><span />ประกาศแล้ว</span></div>
            {latestTarget ? <div className="latest-result-hint -mt-1 mb-3 flex items-start gap-[7px] text-[10px] leading-[1.55]"><Icon name="clock" size={14} /><span>รายการผลสอบที่ประกาศล่าสุด: <strong>{resultTargetLabel(latestTarget)}</strong> · เลือกรายการสอบหรือรอบอื่นเพื่อดูผลสอบเพิ่มเติม</span></div> : null}
            <div className="results-public-filters grid grid-cols-[minmax(250px,1.5fr)_repeat(3,minmax(145px,1fr))] items-end gap-[11px] max-[850px]:grid-cols-2 max-[540px]:grid-cols-1">
              <label className="results-public-search grid min-w-0 gap-1.5 max-[850px]:col-span-full max-[540px]:[grid-column:auto]"><span>ค้นหาชื่อภาษาอังกฤษหรือ CANDIDATE NO</span><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="เช่น Kanya Rattanasuk หรือ 6000012" /></div></label>
              <label className="grid min-w-0 gap-1.5"><span>รายการสอบ</span><select value={selectedCompetition} onChange={(event) => { const value = event.target.value; setSelectedCompetition(value); const newestExamRound = value === "all" ? "all" : publishedTargets.find((target) => competitionKey(target) === value)?.roundType || "all"; setSelectedRound(newestExamRound); setSelectedGrade("all"); setPage(1); }}><option value="all">ทุกรายการสอบ</option>{competitionOptions.map((option) => <option key={option.key} value={option.key}>{option.title} · ปี {option.year}</option>)}</select></label>
              <label className="grid min-w-0 gap-1.5"><span>รอบสอบ</span><select value={selectedRound} onChange={(event) => { setSelectedRound(event.target.value); setSelectedGrade("all"); setPage(1); }}><option value="all">ทุกรอบสอบ</option>{roundOptions.map((round) => <option key={round} value={round}>{EXAM_ROUND_LABELS[round] || round}</option>)}</select></label>
              <label className="grid min-w-0 gap-1.5"><span>ระดับชั้น</span><select value={selectedGrade} onChange={(event) => { setSelectedGrade(event.target.value); setPage(1); }}><option value="all">ทุกระดับชั้น</option>{gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label>
            </div>
          </section>
          <section className="results-hero flex min-h-[156px] items-center justify-between gap-[18px] px-[26px] py-[23px] max-[540px]:min-h-[145px] max-[540px]:items-start max-[540px]:p-[17px]">
            <div className="min-w-0"><span className="result-announced"><span />ประกาศผลอย่างเป็นทางการ</span><h2>ผลการสอบของผู้เข้าสอบทั้งหมด</h2><p>ผู้ได้ GOLD, SILVER หรือ BRONZE ผ่านการสอบรอบ HEAT ยกเว้น BBB ซึ่งใช้เกณฑ์อันดับ 1st–3rd</p></div>
            <div className="result-total grid min-w-[88px] justify-items-center rounded-[13px] border border-[rgba(255,255,255,.25)] bg-[rgba(255,255,255,.12)] px-[14px] py-[10px] max-[540px]:min-w-[66px] max-[540px]:p-2"><strong>{results.length.toString().padStart(2, "0")}</strong><span>รายชื่อที่พบ</span></div>
          </section>
          <section className="surface results-table-card" ref={resultsTableRef}>
            <div className="results-public-table-heading"><div><strong>ผลการสอบ</strong><small>แสดง {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} จาก {results.length.toLocaleString()} รายชื่อ · สูงสุด {pageSize} รายการต่อหน้า</small></div></div>
            <div className="responsive-table w-full overflow-x-auto overscroll-x-contain"><table className="w-full min-w-[950px] border-separate border-spacing-0">
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
              </tbody>) : <tbody><tr><td colSpan="6"><div className="results-empty-state"><span><Icon name="search" /></span><strong>ไม่พบผลสอบที่ตรงกับคำค้นหาหรือตัวกรอง</strong><small>โปรดลองเปลี่ยนชื่อหรือเลขประจำตัวสอบ หรือเลือก “ทั้งหมด” ในตัวกรอง</small><Button variant="text" onClick={() => { setQuery(""); setSelectedCompetition("all"); setSelectedRound("all"); setSelectedGrade("all"); setPage(1); }}>ล้างคำค้นหาและตัวกรอง</Button></div></td></tr></tbody>}
            </table></div>
            {results.length ? <div className="results-pagination"><span>หน้า {currentPage.toLocaleString()} จาก {totalPages.toLocaleString()}</span>{totalPages > 1 ? <nav aria-label="แบ่งหน้าผลสอบ"><button type="button" className="pagination-step" aria-label="หน้าก่อนหน้า" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>ก่อนหน้า</button>{pageItems.map((item, index) => item === "ellipsis" ? <span className="pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</span> : <button type="button" key={item} className={`pagination-page${currentPage === item ? " is-active" : ""}`} aria-label={`หน้า ${item}`} aria-current={currentPage === item ? "page" : undefined} onClick={() => changePage(item)}>{item}</button>)}<button type="button" className="pagination-step" aria-label="หน้าถัดไป" disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)}>ถัดไป</button></nav> : null}</div> : null}
            <div className="table-footnote"><Icon name="info" size={15} />ผู้ที่ได้รับรางวัล GOLD, SILVER หรือ BRONZE (ยกเว้นรายการ BBB) และผู้ที่ได้อันดับ 1st–3rd ของรายการ BBB สามารถยืนยันสิทธิ์สมัครรอบ Final ได้หลังประกาศผลการสอบรอบ HEAT</div>
          </section>
        </>
      )}
    </div>
  );
}
