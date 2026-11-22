import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, GoogleMark, Icon, ProfileAvatar } from "../../components/ui/index.jsx";
import { formatThaiDate, getExamRoundType } from "../../examUtils.js";
import { getCompetitionDisplayMeta, toThaiYear } from "../home/homeUtils.js";
import {
  getActiveExamYear,
  getBangkokTodayISO,
  getEligibleFinalRounds,
  isFinalEligibleAward,
} from "../applications/applicationUtils.js";

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
      if (!result.choices?.length && !resultPublished) setError("รอประกาศผลรางวัลจาก HEAT ROUND ก่อน");
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
        <h1 id="final-rights-title">การสมัครรอบ Final / Final X<br /><em>เริ่มต้นด้วยการยืนยันสิทธิ์</em></h1>
        <p>ผู้ผ่าน HEAT สมัคร Final ได้ และผู้ได้รับเหรียญทอง เงิน หรือทองแดงของ BBB รอบ Final สมัคร Final X ได้</p>
        <div className="final-rights-hero-meta mt-[22px] flex flex-wrap gap-x-5 gap-y-2 text-xs"><span className="inline-flex items-center gap-[7px]"><Icon name="check" size={17} /> ใช้ข้อมูลจากใบสมัครรอบก่อนหน้า</span><span className="inline-flex items-center gap-[7px]"><Icon name="shield" size={17} /> ยืนยันตัวตนก่อนสมัคร</span></div>
      </div>
      <div className="final-rights-hero-art relative min-h-[260px] max-[700px]:hidden" aria-hidden="true"><span className="final-rights-orbit" /><span className="final-rights-medal"><Icon name="award" size={48} /></span><span className="final-rights-star final-rights-star-one">✦</span><span className="final-rights-star final-rights-star-two">✦</span><span className="final-rights-final-word">FINAL</span></div>
    </section>
    <div className="final-rights-info-row flex items-center justify-between gap-4 rounded-2xl border border-[#e2e4f2] bg-white px-[19px] py-[15px] max-[700px]:items-start max-[700px]:flex-col"><div className="flex flex-wrap items-center gap-x-[23px] gap-y-[10px]"><span className={resultPublished ? "final-rights-live" : "final-rights-waiting"}><i />{resultPublished ? "ตรวจสอบสิทธิ์สมัครรอบ Final" : "รอประกาศผลการสอบรอบ HEAT"}</span><span className="final-rights-deadline"><Icon name="calendar" size={17} /> กำหนดปิดยืนยันสิทธิ์แตกต่างกันตามรายการสอบและรอบ</span></div><Button variant="text" onClick={() => navigate("results")}>ดูประกาศผล <Icon name="arrow" size={16} /></Button></div>
    <div className="final-rights-layout grid grid-cols-[minmax(0,1.65fr)_minmax(260px,.75fr)] items-start gap-[18px] max-[960px]:grid-cols-1">
      <div className="final-rights-main grid min-w-0 gap-4">
        <section className="surface final-rights-workspace p-[29px] max-[700px]:p-5 max-[460px]:p-4 final-rights-api-workspace" aria-labelledby="final-rights-workspace-title">
          <div className="final-rights-workspace-heading mb-[22px] flex items-start justify-between gap-[14px]"><div><p className="eyebrow">ยืนยันสิทธิ์เข้าสอบ Final</p><h2 id="final-rights-workspace-title">คุณสมัครสอบรอบก่อนหน้าผ่านช่องทางใด?</h2><p>โปรดเลือกช่องทางที่ตรงกับใบสมัครรอบก่อนหน้า</p></div><span className="final-rights-step-number">01 / 03</span></div>
          <div className="final-rights-paths mb-[23px] grid grid-cols-2 gap-[11px] max-[700px]:gap-2 max-[460px]:grid-cols-1" role="tablist" aria-label="วิธียืนยันสิทธิ์">
            <button type="button" role="tab" aria-selected={path === "account"} className={"final-rights-path grid min-h-[145px] justify-items-start content-start gap-1.5 p-[18px] text-left cursor-pointer max-[700px]:min-h-[137px] max-[700px]:p-[14px] max-[460px]:min-h-[86px] max-[460px]:grid-cols-[36px_minmax(0,1fr)] max-[460px]:content-center max-[460px]:gap-x-[9px] " + (path === "account" ? "selected" : "")} onClick={() => { setPath("account"); setError(""); }}><span className="final-rights-path-icon grid size-[38px] place-items-center mb-[3px] max-[460px]:row-span-2 max-[460px]:mb-0"><Icon name="users" /></span><strong className="max-[460px]:col-start-2">สมัครด้วยบัญชีตนเอง</strong><small className="max-[460px]:col-start-2">เปิดใบสมัครของฉันเพื่อดำเนินการต่อ</small></button>
            <button type="button" role="tab" aria-selected={path === "school"} className={"final-rights-path grid min-h-[145px] justify-items-start content-start gap-1.5 p-[18px] text-left cursor-pointer max-[700px]:min-h-[137px] max-[700px]:p-[14px] max-[460px]:min-h-[86px] max-[460px]:grid-cols-[36px_minmax(0,1fr)] max-[460px]:content-center max-[460px]:gap-x-[9px] " + (path === "school" ? "selected" : "")} onClick={() => { setPath("school"); setError(""); }}><span className="final-rights-path-icon grid size-[38px] place-items-center mb-[3px] max-[460px]:row-span-2 max-[460px]:mb-0"><Icon name="building" /></span><strong className="max-[460px]:col-start-2">สมัครโดยโรงเรียน</strong><small className="max-[460px]:col-start-2">ค้นหาด้วยชื่อและยืนยันหมายเลขโทรศัพท์</small></button>
          </div>
          {error ? <p className="inline-error" role="alert">{error}</p> : null}
          {path === "account" ? <div role="tabpanel" className="final-rights-account-panel">
            {!authProfile ? <div className="final-rights-signin"><span className="final-rights-signin-icon"><GoogleMark /></span><div><strong>เข้าสู่ระบบเพื่อตรวจสอบสิทธิ์สอบ</strong><p>โปรดใช้บัญชี Google เดียวกับที่ใช้สมัครสอบรอบ HEAT</p></div><Button variant="outline" onClick={() => onSignIn(demoProfile)}>เข้าสู่ระบบ Google</Button></div> :
              accountChoices.length ? <div className="final-rights-match-list">{accountChoices.map((choice) => <div className="final-rights-match" key={`${choice.sourceHeatApplicationId}-${choice.item.roundId}`}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{choice.applicant.firstNameEn} {choice.applicant.lastNameEn}</strong><small>{choice.item.competition} · {choice.item.year}</small></div><Button icon="arrow" onClick={() => onContinue(choice)}>สมัครรอบ {choice.item.roundType === "FINAL_X" ? "Final X" : "Final"}</Button></div>)}</div> : <div className="final-rights-empty"><Icon name="info" /><div><strong>ไม่พบสิทธิ์สมัครรอบ Final ที่เปิดให้ยืนยันในบัญชีนี้</strong><p>หากสมัครผ่านโรงเรียน โปรดเลือกแท็บ “สมัครโดยโรงเรียน” เพื่อค้นหาด้วยชื่อ</p></div></div>}
          </div> : <div role="tabpanel" className="final-rights-school-panel">
            {schoolChoices.length ? <div className="final-rights-match-list">{schoolChoices.map((choice) => <div className="final-rights-match" key={`${choice.sourceHeatApplicationId}-${choice.item.roundId}`}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{choice.applicant.firstNameEn} {choice.applicant.lastNameEn}</strong><small>{choice.item.competition} · {choice.item.year}</small></div><Button icon="arrow" onClick={() => onContinue(choice)}>สมัครรอบ {choice.item.roundType === "FINAL_X" ? "Final X" : "Final"}</Button></div>)}</div> : verified ? <div className="notice notice-blue"><Icon name="check" /><div><strong>ยืนยันหมายเลขโทรศัพท์แล้ว</strong><p>โปรดเข้าสู่ระบบด้วยบัญชี Google ที่ต้องการใช้สำหรับใบสมัครรอบ Final</p><Button onClick={() => window.location.assign(`/api/auth/google/start?flow=final&returnTo=${encodeURIComponent("/final/confirm")}`)}>เข้าสู่ระบบ Google แล้วสมัคร</Button></div></div> : <>
              <div className="final-rights-section-label"><span>02</span><div><strong>ตรวจสอบใบสมัครรอบก่อนหน้า</strong><small>ระบุชื่อภาษาอังกฤษให้ตรงกับข้อมูลในใบสมัคร</small></div></div>
              <form className="final-rights-eligibility-search" onSubmit={search}><Field label="ชื่อและนามสกุลภาษาอังกฤษ" required><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setError(""); }} minLength={3} maxLength={255} required autoComplete="off" placeholder="เช่น Thanakorn Wattanakul" /></div></Field><Button type="submit" icon="search" disabled={busy}>{busy ? "กำลังค้นหา…" : "ค้นหาสิทธิ์ Final"}</Button></form>
              {choices.length ? <form className="final-rights-verify-form" onSubmit={verify}><div className="final-rights-section-label"><span>03</span><div><strong>ยืนยันตัวตน</strong><small>ใช้หมายเลขโทรศัพท์ในใบสมัครรอบก่อนหน้า</small></div></div><Field label="เลือกรายการสอบ" required><select value={selectedRoundId} onChange={(event) => setSelectedRoundId(event.target.value)} required><option value="">เลือกรายการสอบ</option>{choices.map((choice) => <option value={choice.finalRoundId} key={choice.finalRoundId}>{choice.competition} · {choice.round} · {choice.year}</option>)}</select></Field><Field label="เลข 4 ตัวท้ายของหมายเลขโทรศัพท์" required><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} required placeholder="••••" /></Field><Button type="submit" icon="shield" disabled={busy || !selectedRoundId}>{busy ? "กำลังยืนยัน…" : "ยืนยันตัวตน"}</Button></form> : <div className="final-rights-search-hint"><Icon name="info" size={16} />ค้นหาชื่อเพื่อตรวจสอบสิทธิ์สมัครรอบ Final</div>}
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
  const eligibleApplications = applications.filter((item) => getEligibleFinalRounds(item, examCatalog, publishedHeatResults, localToday).length > 0);
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
      setError("หมายเลขโทรศัพท์ 4 หลักท้ายไม่ตรงกับข้อมูลในใบสมัครรอบก่อนหน้า โปรดตรวจสอบอีกครั้ง");
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
          <h1 id="final-rights-title">การสมัครรอบ Final / Final X<br /><em>เริ่มต้นด้วยการยืนยันสิทธิ์</em></h1>
          <p>ผู้ผ่าน HEAT สมัคร Final ได้ และผู้ได้รับเหรียญทอง เงิน หรือทองแดงของ BBB รอบ Final สมัคร Final X ได้</p>
          <div className="final-rights-hero-meta mt-[22px] flex flex-wrap gap-x-5 gap-y-2 text-xs"><span className="inline-flex items-center gap-[7px]"><Icon name="check" size={17} /> ใช้ข้อมูลจากใบสมัครรอบก่อนหน้า</span><span className="inline-flex items-center gap-[7px]"><Icon name="shield" size={17} /> ยืนยันตัวตนก่อนสมัคร</span></div>
        </div>
        <div className="final-rights-hero-art relative min-h-[260px] max-[700px]:hidden" aria-hidden="true"><span className="final-rights-orbit" /><span className="final-rights-medal"><Icon name="award" size={48} /></span><span className="final-rights-star final-rights-star-one">✦</span><span className="final-rights-star final-rights-star-two">✦</span><span className="final-rights-final-word">FINAL</span></div>
      </section>

      <div className="final-rights-info-row flex items-center justify-between gap-4 rounded-2xl border border-[#e2e4f2] bg-white px-[19px] py-[15px] max-[700px]:items-start max-[700px]:flex-col"><div className="flex flex-wrap items-center gap-x-[23px] gap-y-[10px]"><span className={canConfirm ? "final-rights-live" : "final-rights-waiting"}><i />{canConfirm ? "เปิดยืนยันสิทธิ์" : pendingReason}</span><span className="final-rights-deadline"><Icon name="calendar" size={17} /> กำหนดปิดยืนยันสิทธิ์แตกต่างกันตามรายการสอบและรอบ</span></div><Button variant="text" onClick={() => navigate("results")}>ดูประกาศผล <Icon name="arrow" size={16} /></Button></div>

      <div className="final-rights-layout grid grid-cols-[minmax(0,1.65fr)_minmax(260px,.75fr)] items-start gap-[18px] max-[960px]:grid-cols-1">
        <div className="final-rights-main grid min-w-0 gap-4">
          {!canConfirm ? <div className="notice notice-amber final-rights-pending"><Icon name="clock" /><div><strong>{pendingReason}</strong><p>{!hasPublishedHeat ? "ระบบจะเปิดให้ยืนยันสิทธิ์โดยอัตโนมัติเมื่อผู้ดูแลระบบประกาศผลการสอบรอบ HEAT" : "พ้นกำหนดยืนยันสิทธิ์ของทุกรายการที่เกี่ยวข้องแล้ว"} ขณะนี้ระบบกำลังแสดงตัวอย่างขั้นตอนการใช้งาน</p></div><Button variant="outline" onClick={() => setShowPreview((value) => !value)}>{showPreview ? "ซ่อนตัวอย่าง" : "ดูตัวอย่างขั้นตอน"}</Button></div> : null}
          {canConfirm || showPreview ? (
            <section className="surface final-rights-workspace p-[29px] max-[700px]:p-5 max-[460px]:p-4" aria-labelledby="final-rights-workspace-title">
              <div className="final-rights-workspace-heading mb-[22px] flex items-start justify-between gap-[14px]"><div><p className="eyebrow">ยืนยันสิทธิ์เข้าสอบ Final</p><h2 id="final-rights-workspace-title">คุณสมัครสอบรอบก่อนหน้าผ่านช่องทางใด?</h2><p>โปรดเลือกช่องทางที่ตรงกับใบสมัครรอบก่อนหน้า</p></div><span className="final-rights-step-number">01 / 03</span></div>
              <div className="final-rights-paths mb-[23px] grid grid-cols-2 gap-[11px] max-[700px]:gap-2 max-[460px]:grid-cols-1" role="tablist" aria-label="วิธีตรวจสอบใบสมัครรอบก่อนหน้า">
                <button type="button" role="tab" aria-selected={path === "account"} className={"final-rights-path grid min-h-[145px] justify-items-start content-start gap-1.5 p-[18px] text-left cursor-pointer max-[700px]:min-h-[137px] max-[700px]:p-[14px] max-[460px]:min-h-[86px] max-[460px]:grid-cols-[36px_minmax(0,1fr)] max-[460px]:content-center max-[460px]:gap-x-[9px] " + (path === "account" ? "selected" : "")} onClick={() => { setPath("account"); setVerified(false); setError(""); }}><span className="final-rights-path-icon grid size-[38px] place-items-center mb-[3px] max-[460px]:row-span-2 max-[460px]:mb-0"><Icon name="users" /></span><strong className="max-[460px]:col-start-2">สมัครด้วยบัญชีตนเอง</strong><small className="max-[460px]:col-start-2">เปิดใบสมัครของฉันเพื่อดำเนินการต่อ</small></button>
                <button type="button" role="tab" aria-selected={path === "school"} className={"final-rights-path grid min-h-[145px] justify-items-start content-start gap-1.5 p-[18px] text-left cursor-pointer max-[700px]:min-h-[137px] max-[700px]:p-[14px] max-[460px]:min-h-[86px] max-[460px]:grid-cols-[36px_minmax(0,1fr)] max-[460px]:content-center max-[460px]:gap-x-[9px] " + (path === "school" ? "selected" : "")} onClick={() => { setPath("school"); setVerified(false); setError(""); }}><span className="final-rights-path-icon grid size-[38px] place-items-center mb-[3px] max-[460px]:row-span-2 max-[460px]:mb-0"><Icon name="building" /></span><strong className="max-[460px]:col-start-2">สมัครโดยโรงเรียน</strong><small className="max-[460px]:col-start-2">ค้นหาด้วยชื่อและยืนยันหมายเลขโทรศัพท์</small></button>
              </div>

              {path === "account" ? (
                <div className="final-rights-account-panel" role="tabpanel">
                  {authProfile ? <><div className="final-rights-account-identity"><ProfileAvatar src={authProfile.picture} alt="" /><div><small>บัญชีที่เข้าสู่ระบบ</small><strong>{authProfile.name}</strong><span>{authProfile.email}</span></div></div>{accountMatches.length ? <div className="final-rights-match-list">{accountMatches.map((item) => <div className="final-rights-match" key={item.id}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{item.candidate}</strong><small>เลขประจำตัวสอบ HEAT {item.heatId} · {item.school}</small><small>{finalRoundDeadlineText(item)}</small></div><Button disabled={!canConfirm} icon="arrow" onClick={() => onContinue(item, "account", null, getEligibleFinalRounds(item, examCatalog, publishedHeatResults, localToday))}>ยืนยันสิทธิ์</Button></div>)}</div> : <div className="final-rights-empty"><Icon name="info" /><div><strong>ยังไม่พบใบสมัครรอบก่อนหน้า ที่ผ่านการคัดเลือกในบัญชีนี้</strong><p>หากสมัครผ่านโรงเรียน โปรดเลือกแท็บ “สมัครโดยโรงเรียน” เพื่อค้นหาด้วยชื่อ</p></div></div>}</> : <div className="final-rights-signin"><span className="final-rights-signin-icon"><GoogleMark /></span><div><strong>เข้าสู่ระบบเพื่อตรวจสอบใบสมัคร</strong><p>ผู้สมัครรอบ HEAT ด้วยบัญชีตนเองไม่ต้องยืนยันหมายเลขโทรศัพท์อีกครั้ง</p></div><Button variant="outline" onClick={() => onSignIn(demoProfile)}>เข้าสู่ระบบโหมดตัวอย่าง</Button></div>}
                </div>
              ) : verified ? (
                <div className="final-rights-verified" role="tabpanel"><span className="final-rights-verified-icon"><Icon name="check" size={28} /></span><p className="eyebrow">ตัวอย่างขั้นตอน</p><h3>พร้อมสมัคร OCEC Final</h3><p>ระบบจะนำข้อมูลจากใบสมัครรอบก่อนหน้า ของ <strong>{selected?.candidate}</strong> มาเติมในแบบฟอร์มรอบ Final โปรดตรวจสอบข้อมูลก่อนส่งใบสมัคร</p><div className="final-rights-verified-summary"><span>เลขประจำตัวสอบ HEAT <strong>{selected?.heatId}</strong></span><span>โรงเรียน <strong>{selected?.school}</strong></span><span className="final-rights-deadline-list">รอบที่ยืนยันได้<strong>{selectedFinalRounds.map((exam) => `${exam.title} · ปิดยืนยันสิทธิ์ ${exam.finalConfirmCloseDate ? formatThaiDate(exam.finalConfirmCloseDate) : "ไม่กำหนด"}`).join(" / ")}</strong></span></div><div className="final-rights-verified-actions"><Button disabled={!canConfirm || !selectedFinalRounds.length} icon="arrow" onClick={() => onContinue(selected, "google", { name: selected?.candidate, email: selected?.contactEmail, picture: demoProfile.picture }, selectedFinalRounds)}>เข้าสู่ระบบ Google แล้วสมัคร</Button></div><button type="button" className="back-link" onClick={() => { setVerified(false); setSelectedId(""); setLastFour(""); }}><Icon name="arrow" size={15} />ค้นหารายชื่ออื่น</button></div>
              ) : (
                <div className="final-rights-school-panel" role="tabpanel"><div className="final-rights-section-label"><span>02</span><div><strong>ตรวจสอบใบสมัครรอบก่อนหน้า</strong><small>ระบุชื่อภาษาอังกฤษให้ตรงกับข้อมูลในใบสมัคร</small></div></div><Field label="ชื่อและนามสกุลภาษาอังกฤษ" required><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); setLastFour(""); setError(""); }} placeholder="เช่น Thanakorn Wattanakul" autoComplete="off" /></div></Field>{query.trim() ? <div className="final-rights-results" aria-live="polite"><p>{eligible.length ? `พบ ${eligible.length} รายการ · โปรดตรวจสอบเลขประจำตัวสอบและโรงเรียนก่อนเลือก` : "ไม่พบรายชื่อที่ตรงกับคำค้น"}</p>{eligible.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? "final-rights-result selected" : "final-rights-result"} aria-pressed={selectedId === item.id} onClick={() => { setSelectedId(item.id); setLastFour(""); setError(""); }}><span className="final-rights-result-radio" /><span><strong>{item.candidate}</strong><small>เลขสอบ {item.heatId} · {item.school}</small><small>{finalRoundDeadlineText(item)}</small></span><Icon name="chevron" size={18} /></button>)}</div> : <div className="final-rights-search-hint"><Icon name="info" size={16} />ระบุชื่อเพื่อค้นหาใบสมัครที่ผ่านการสอบรอบ HEAT</div>}{selected ? <form onSubmit={verify} className="final-rights-verify-form"><div className="final-rights-section-label"><span>03</span><div><strong>ยืนยันตัวตน</strong><small>ใช้หมายเลขโทรศัพท์ในใบสมัครรอบก่อนหน้า ที่เลือก</small></div></div><Field label="เลข 4 ตัวท้ายของหมายเลขโทรศัพท์" required hint="กรอกเฉพาะตัวเลข 4 หลักสุดท้าย"><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => { setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} placeholder="••••" required /></Field>{error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}<Button type="submit" disabled={!canConfirm} icon="shield">ยืนยันตัวตน</Button></form> : null}</div>
              )}
            </section>
          ) : <section className="surface final-rights-locked"><span><Icon name="lock" size={26} /></span><h2>การยืนยันสิทธิ์ยังไม่เปิด</h2><p>เมื่อประกาศผล HEAT แล้ว ผู้ที่ผ่านการสอบสามารถค้นหาชื่อและเริ่มขั้นตอนนี้ได้ทันที</p><Button variant="outline" onClick={() => setShowPreview(true)}>ดูตัวอย่างหน้าจอ</Button></section>}
        </div>
        <aside className="final-rights-aside grid min-w-0 gap-4 max-[960px]:grid-cols-2 max-[700px]:grid-cols-1"><section className="surface final-rights-guide"><p className="eyebrow">ขั้นตอนการสมัคร</p><h2>ขั้นตอนสมัครรอบ Final</h2><ol><li><span>01</span><div><strong>ตรวจสอบสิทธิ์</strong><small>ตรวจสอบใบสมัครในบัญชี หรือค้นหาด้วยชื่อ</small></div></li><li><span>02</span><div><strong>ยืนยันตัวตน</strong><small>ผู้สมัครผ่านโรงเรียนต้องยืนยันด้วยหมายเลขโทรศัพท์ 4 หลักท้าย</small></div></li><li><span>03</span><div><strong>สมัครรอบ Final</strong><small>ตรวจสอบข้อมูลเดิม ชำระเงิน และแนบหลักฐานการชำระเงินใหม่</small></div></li></ol></section><div className="final-rights-help"><Icon name="info" size={18} /><p>การสมัครรอบ Final ใช้ใบสมัครใหม่ แยกจากรอบ HEAT และเจ้าหน้าที่จะตรวจสอบหลักฐานการชำระเงินอีกครั้ง</p></div></aside>
      </div>
    </div>
  );
}

const ROUND_DISPLAY = {
  HEAT: "Heat",
  FINAL: "Final",
  FINAL_X: "Final X",
};

function getAwardTone(award) {
  const value = String(award || "").toLowerCase();
  if (value.includes("gold") || value.includes("1st") || value.includes("ทอง") && !value.includes("ทองแดง")) return "gold";
  if (value.includes("silver") || value.includes("2nd") || value.includes("เงิน")) return "silver";
  if (value.includes("bronze") || value.includes("3rd") || value.includes("ทองแดง")) return "bronze";
  return "merit";
}

function getNextRoundEligibilityText(row) {
  if (row.competitionId === "bbb" && row.roundType === "FINAL") {
    return isFinalEligibleAward(row.award, row.competitionId, "FINAL")
      ? { short: "มีสิทธิ์สมัคร Final X", card: "ผ่านเกณฑ์เข้าร่วมรอบ Final X", eligible: true }
      : { short: "ประกาศผลแล้ว", card: "ประกาศผลอย่างเป็นทางการ", eligible: false };
  }
  if (row.roundType === "HEAT") {
    return isFinalEligibleAward(row.award, row.competitionId)
      ? { short: "มีสิทธิ์สมัคร Final", card: "ผ่านเกณฑ์เข้าร่วมรอบ Final", eligible: true }
      : { short: "ไม่ผ่านเกณฑ์รอบ Final", card: "ขอบคุณที่ร่วมแข่งขัน", eligible: false };
  }
  return { short: "ประกาศผลแล้ว", card: "ประกาศผลอย่างเป็นทางการ", eligible: false };
}

export function PublicResultsPage({
  resultRows = [],
  navigate,
  examCatalog = [],
  competitionCatalog = [],
  backendEnabled = false,
}) {
  const [mode, setMode] = useState("search");
  const resultsListRef = useRef(null);

  const publishedTargets = useMemo(() => [...new Map(resultRows.map((row) => [row.targetId, {
    targetId: row.targetId,
    competitionId: row.competitionId,
    competitionTitle: row.competitionTitle,
    shortName: row.shortName || getCompetitionDisplayMeta(row, competitionCatalog.find((c) => c.id === row.competitionId)).short,
    roundType: row.roundType,
    round: row.round,
    year: String(row.year),
    publishedAt: row.publishedAt,
  }])).values()].sort((left, right) => Date.parse(right.publishedAt || 0) - Date.parse(left.publishedAt || 0)), [resultRows, competitionCatalog]);

  const latestTarget = publishedTargets[0] || null;
  const compYearKey = (item) => `${item.competitionId}::${item.year}`;

  // Tab 1 (ค้นหาผลสอบ) filter state
  const [searchCompYear, setSearchCompYear] = useState(() => (latestTarget ? compYearKey(latestTarget) : "all"));
  const [searchRound, setSearchRound] = useState(() => latestTarget?.roundType || "all");
  const [searchGrade, setSearchGrade] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchRows, setSearchRows] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Tab 2 (ดูประกาศผลทั้งหมด) filter state
  const [allCompetitionId, setAllCompetitionId] = useState(() => latestTarget?.competitionId || "all");
  const [allYear, setAllYear] = useState(() => latestTarget?.year || "all");
  const [allInlineQuery, setAllInlineQuery] = useState("");
  const [allGrade, setAllGrade] = useState("all");
  const [allFetchedRows, setAllFetchedRows] = useState(null);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 100;

  // Sync defaults when resultRows arrives asynchronously from /api/results
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && latestTarget) {
      initializedRef.current = true;
      setSearchCompYear(compYearKey(latestTarget));
      setSearchRound(latestTarget.roundType || "all");
      setAllCompetitionId(latestTarget.competitionId || "all");
      setAllYear(latestTarget.year || "all");
    }
  }, [latestTarget]);

  const compYearOptions = useMemo(() => [...new Map(publishedTargets.map((target) => [compYearKey(target), {
    key: compYearKey(target),
    competitionId: target.competitionId,
    short: target.shortName,
    year: target.year,
  }])).values()], [publishedTargets]);

  const competitionOptions = useMemo(() => [...new Map(publishedTargets.map((target) => {
    const comp = competitionCatalog.find((c) => c.id === target.competitionId);
    const meta = getCompetitionDisplayMeta(target, comp);
    return [target.competitionId, {
      id: target.competitionId,
      short: meta.short,
      label: `${meta.short} — ${comp?.name && comp.name !== meta.short ? comp.name : meta.thaiName}`,
    }];
  })).values()], [publishedTargets, competitionCatalog]);

  const yearOptions = useMemo(() => [...new Set(publishedTargets
    .filter((target) => allCompetitionId === "all" || target.competitionId === allCompetitionId)
    .map((target) => String(target.year)))].sort((a, b) => Number(b) - Number(a)), [publishedTargets, allCompetitionId]);

  const searchRoundOptions = useMemo(() => [...new Set(publishedTargets
    .filter((target) => searchCompYear === "all" || compYearKey(target) === searchCompYear)
    .map((target) => target.roundType))], [publishedTargets, searchCompYear]);

  const searchGradeOptions = useMemo(() => [...new Set(resultRows
    .filter((row) => (searchCompYear === "all" || compYearKey(row) === searchCompYear)
      && (searchRound === "all" || row.roundType === searchRound))
    .map((row) => row.grade)
    .filter(Boolean))].sort((a, b) => a.localeCompare(b, "en")), [resultRows, searchCompYear, searchRound]);

  async function fetchServerResults(params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && value !== "all") searchParams.set(key, String(value));
    });
    const response = await fetch(`/api/results?${searchParams.toString()}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "ไม่สามารถโหลดข้อมูลผลสอบได้");
    return payload.results || [];
  }

  async function handleSearchSubmit(event) {
    event?.preventDefault();
    setSearchError("");
    if (!backendEnabled) {
      setSearchRows(null);
      return;
    }
    const [competitionId, year] = searchCompYear === "all" ? ["all", "all"] : searchCompYear.split("::");
    setSearchLoading(true);
    try {
      const rows = await fetchServerResults({
        competitionId,
        year,
        roundType: searchRound,
        grade: searchGrade,
        q: searchQuery.trim(),
      });
      setSearchRows(rows);
    } catch (error) {
      setSearchError(error.message || "ไม่สามารถค้นหาผลสอบได้");
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleAllSubmit(event) {
    event?.preventDefault();
    setAllError("");
    setPage(1);
    if (!backendEnabled) {
      setAllFetchedRows(null);
      return;
    }
    setAllLoading(true);
    try {
      const rows = await fetchServerResults({
        competitionId: allCompetitionId,
        year: allYear,
      });
      setAllFetchedRows(rows);
    } catch (error) {
      setAllError(error.message || "ไม่สามารถโหลดประกาศผลสอบได้");
    } finally {
      setAllLoading(false);
    }
  }

  // Client-side filtered list for Tab 1 (instant reactive + synced with server submit)
  const localSearchResults = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    return resultRows.filter((row) => {
      if (searchCompYear !== "all" && compYearKey(row) !== searchCompYear) return false;
      if (searchRound !== "all" && row.roundType !== searchRound) return false;
      if (searchGrade !== "all" && row.grade !== searchGrade) return false;
      if (!term) return true;
      return (row.candidateName || row.candidate || "").toLowerCase().includes(term)
        || (row.candidateNameTh || "").toLowerCase().includes(term)
        || String(row.candidateNo || row.examNumber || "").toLowerCase().includes(term)
        || (row.schoolName || row.school || "").toLowerCase().includes(term);
    });
  }, [resultRows, searchCompYear, searchRound, searchGrade, searchQuery]);

  const activeSearchResults = searchRows ?? localSearchResults;

  // Tab 2 base rows + inline search & grade filter
  const allBaseRows = useMemo(() => {
    if (allFetchedRows !== null) return allFetchedRows;
    return resultRows.filter((row) => {
      if (allCompetitionId !== "all" && row.competitionId !== allCompetitionId) return false;
      if (allYear !== "all" && String(row.year) !== String(allYear)) return false;
      return true;
    });
  }, [allFetchedRows, resultRows, allCompetitionId, allYear]);

  const allGradeOptions = useMemo(() => [...new Set(allBaseRows.map((row) => row.grade).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "en")), [allBaseRows]);

  const filteredAllResults = useMemo(() => {
    const term = allInlineQuery.trim().toLowerCase();
    return allBaseRows.filter((row) => {
      if (allGrade !== "all" && row.grade !== allGrade) return false;
      if (!term) return true;
      return (row.candidateName || row.candidate || "").toLowerCase().includes(term)
        || (row.candidateNameTh || "").toLowerCase().includes(term)
        || String(row.candidateNo || row.examNumber || "").toLowerCase().includes(term)
        || (row.schoolName || row.school || "").toLowerCase().includes(term);
    });
  }, [allBaseRows, allGrade, allInlineQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAllResults.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedAllResults = filteredAllResults.slice(pageStart, pageStart + pageSize);

  const pageItems = totalPages <= 6
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : currentPage <= 4
      ? [1, 2, 3, 4, "ellipsis", totalPages]
      : currentPage >= totalPages - 3
        ? [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];

  function changePage(nextPage) {
    setPage(nextPage);
    window.requestAnimationFrame(() => resultsListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  // Labels for summary headers
  const selectedCompYearObj = compYearOptions.find((option) => option.key === searchCompYear);
  const searchSummaryTitle = selectedCompYearObj
    ? `ผลสอบ ${selectedCompYearObj.short} ${toThaiYear(selectedCompYearObj.year)}${searchRound !== "all" ? ` • ${ROUND_DISPLAY[searchRound] || searchRound}` : ""}`
    : "ผลสอบทั้งหมด";

  const selectedAllComp = competitionOptions.find((option) => option.id === allCompetitionId);
  const allSummaryTitle = selectedAllComp
    ? `ผลสอบ ${selectedAllComp.short}${allYear !== "all" ? ` ${toThaiYear(allYear)}` : ""}`
    : `ผลสอบทั้งหมด${allYear !== "all" ? ` ${toThaiYear(allYear)}` : ""}`;

  // Open Final round info for CTA banner
  const openFinalRound = useMemo(() => examCatalog.find((exam) => ["FINAL", "FINAL_X"].includes(getExamRoundType(exam)) && exam.isOpen)
    || examCatalog.find((exam) => ["FINAL", "FINAL_X"].includes(getExamRoundType(exam)) && exam.closeDate)
    || null, [examCatalog]);

  function resetSearchFilters() {
    setSearchQuery("");
    setSearchCompYear("all");
    setSearchRound("all");
    setSearchGrade("all");
    setSearchRows(null);
    setSearchError("");
  }

  function resetAllFilters() {
    setAllInlineQuery("");
    setAllGrade("all");
    setAllCompetitionId("all");
    setAllYear("all");
    setAllFetchedRows(null);
    setAllError("");
    setPage(1);
  }

  return (
    <div className="pc-results-wrap">
      <div className="pc-results-container">
        <header className="pc-results-header">
          <p className="pc-results-eyebrow">ผลสอบ</p>
          <h1>ทุกความพยายาม <span className="pc-results-nowrap">มีความหมาย</span></h1>
          <p className="pc-results-lead">ค้นหาผลสอบและตรวจสอบโอกาสในรอบถัดไป</p>
        </header>

        {!publishedTargets.length ? (
          <section className="pc-results-pending" aria-live="polite">
            <span className="pc-results-pending-icon"><Icon name="clock" size={24} /></span>
            <h2>รอประกาศผลอย่างเป็นทางการ</h2>
            <p>เมื่อมีการประกาศผลรายการสอบแล้ว สามารถค้นหาผลสอบและดูประกาศผลทั้งหมดได้จากหน้านี้</p>
            <span className="pc-results-pending-pill">
              <Icon name="calendar" size={14} />
              <span>ประกาศผลตามกำหนดการของแต่ละรายการ</span>
            </span>
          </section>
        ) : (
          <>
            <div className="pc-results-tabs" role="tablist" aria-label="รูปแบบการดูผลสอบ" data-active={mode}>
              <span className="pc-results-tab-slider" aria-hidden="true" />
              <button
                type="button"
                role="tab"
                aria-selected={mode === "search"}
                className={`pc-results-tab${mode === "search" ? " is-active" : ""}`}
                onClick={() => setMode("search")}
              >
                ค้นหาผลสอบ
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "all"}
                className={`pc-results-tab${mode === "all" ? " is-active" : ""}`}
                onClick={() => setMode("all")}
              >
                ดูประกาศผลทั้งหมด
              </button>
            </div>

            {mode === "search" ? (
              <div className="pc-results-panel" role="tabpanel">
                <form className="pc-results-card pc-results-search-form" onSubmit={handleSearchSubmit}>
                  <div className="pc-results-form-grid">
                    <label className="pc-results-field">
                      <span>รายการสอบ / ปี</span>
                      <div className="pc-results-select-wrap">
                        <select
                          value={searchCompYear}
                          onChange={(event) => {
                            const value = event.target.value;
                            setSearchCompYear(value);
                            const nextRound = value === "all"
                              ? "all"
                              : publishedTargets.find((target) => compYearKey(target) === value)?.roundType || "all";
                            setSearchRound(nextRound);
                            setSearchGrade("all");
                            setSearchRows(null);
                          }}
                        >
                          <option value="all">ทุกรายการสอบ</option>
                          {compYearOptions.map((option) => (
                            <option key={option.key} value={option.key}>
                              {option.short} • {toThaiYear(option.year)}
                            </option>
                          ))}
                        </select>
                        <span className="pc-results-caret" aria-hidden="true">▾</span>
                      </div>
                    </label>

                    <label className="pc-results-field">
                      <span>รอบสอบ</span>
                      <div className="pc-results-select-wrap">
                        <select
                          value={searchRound}
                          onChange={(event) => {
                            setSearchRound(event.target.value);
                            setSearchGrade("all");
                            setSearchRows(null);
                          }}
                        >
                          <option value="all">ทุกรอบสอบ</option>
                          {searchRoundOptions.map((round) => (
                            <option key={round} value={round}>
                              {ROUND_DISPLAY[round] || round}
                            </option>
                          ))}
                        </select>
                        <span className="pc-results-caret" aria-hidden="true">▾</span>
                      </div>
                    </label>

                    <label className="pc-results-field">
                      <span>ระดับชั้น</span>
                      <div className="pc-results-select-wrap">
                        <select
                          value={searchGrade}
                          onChange={(event) => {
                            setSearchGrade(event.target.value);
                            setSearchRows(null);
                          }}
                        >
                          <option value="all">ทุกระดับชั้น</option>
                          {searchGradeOptions.map((grade) => (
                            <option key={grade} value={grade}>{grade}</option>
                          ))}
                        </select>
                        <span className="pc-results-caret" aria-hidden="true">▾</span>
                      </div>
                    </label>
                  </div>

                  <label className="pc-results-field pc-results-field-full">
                    <span>ชื่อภาษาอังกฤษ หรือเลขประจำตัวสอบ</span>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setSearchRows(null);
                      }}
                      placeholder="ค้นหาชื่อหรือเลขประจำตัวสอบ..."
                    />
                  </label>

                  {searchError ? <p className="pc-results-error" role="alert">{searchError}</p> : null}

                  <button type="submit" className="pc-results-submit-btn" disabled={searchLoading}>
                    {searchLoading ? "กำลังค้นหา..." : "ค้นหาผลสอบ"}
                  </button>
                </form>

                <div className="pc-results-section-head">
                  <h2>{searchSummaryTitle} / พบ {activeSearchResults.length.toLocaleString()} รายชื่อ</h2>
                </div>

                {activeSearchResults.length ? (
                  <>
                    <div className="pc-results-table-shell pc-results-desktop-only">
                      <table className="pc-results-table pc-results-table-navy">
                        <thead>
                          <tr>
                            <th>เลขประจำตัวสอบ</th>
                            <th>ชื่อภาษาอังกฤษ</th>
                            <th>ระดับชั้น</th>
                            <th>โรงเรียน</th>
                            <th>รางวัล</th>
                            <th>การสมัครรอบถัดไป</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeSearchResults.slice(0, 100).map((item) => {
                            const eligibility = getNextRoundEligibilityText(item);
                            return (
                              <tr key={`${item.applicationItemId || item.applicationId}-${item.targetId}`}>
                                <td className="pc-results-mono">{item.candidateNo || item.examNumber || "—"}</td>
                                <td className="pc-results-name">{item.candidateName || item.candidate}</td>
                                <td>{item.grade}</td>
                                <td>{item.schoolName || item.school}</td>
                                <td>
                                  <span className={`pc-award-pill is-${getAwardTone(item.award)}`}>
                                    {item.award}
                                  </span>
                                </td>
                                <td>
                                  <span className={`pc-eligibility-text${eligibility.eligible ? " is-eligible" : ""}`}>
                                    {eligibility.short}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="pc-results-mobile-cards pc-results-mobile-only">
                      {activeSearchResults.slice(0, 50).map((item) => {
                        const eligibility = getNextRoundEligibilityText(item);
                        const comp = competitionCatalog.find((c) => c.id === item.competitionId);
                        const meta = getCompetitionDisplayMeta(item, comp);
                        return (
                          <article className="pc-result-individual-card" key={`${item.applicationItemId || item.applicationId}-${item.targetId}`}>
                            <span className="pc-result-status-chip">ประกาศผลแล้ว</span>
                            <h3 className="pc-result-candidate-name">{(item.candidateName || item.candidate || "").toUpperCase()}</h3>
                            <p className="pc-result-candidate-meta">
                              <span className="pc-results-mono">{item.candidateNo || item.examNumber || "—"}</span>
                              <span>{item.schoolName || item.school} • {item.grade}</span>
                            </p>
                            <div className="pc-result-award-box">
                              <span className="pc-result-award-round">
                                {meta.short} {toThaiYear(item.year)} • {ROUND_DISPLAY[item.roundType] || item.round}
                              </span>
                              <strong className="pc-result-award-value">{item.award}</strong>
                              <span className="pc-result-award-elig">{eligibility.card}</span>
                            </div>
                            {eligibility.eligible ? (
                              <p className="pc-result-congrats">ขอแสดงความยินดีกับความสำเร็จครั้งนี้</p>
                            ) : null}
                          </article>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="pc-results-empty-card results-empty-state">
                    <span className="pc-results-empty-icon"><Icon name="search" size={20} /></span>
                    <strong>ไม่พบผลสอบที่ตรงกับคำค้นหาหรือตัวกรอง</strong>
                    <small>โปรดลองเปลี่ยนชื่อหรือเลขประจำตัวสอบ หรือเลือก “ทุกรายการสอบ” ในตัวกรอง</small>
                    <button type="button" className="pc-results-reset-btn" onClick={resetSearchFilters}>
                      ล้างคำค้นหาและตัวกรอง
                    </button>
                  </div>
                )}

                <section className="pc-results-final-cta" aria-labelledby="pc-results-final-cta-title">
                  <h3 id="pc-results-final-cta-title">พร้อมก้าวสู่รอบ Final?</h3>
                  <p>
                    ตรวจสอบสิทธิ์และสมัครภายในช่วงที่เปิดรับ
                    {openFinalRound?.closeDate ? (
                      <>
                        <br />
                        {getCompetitionDisplayMeta(openFinalRound, competitionCatalog.find((c) => c.id === openFinalRound.competitionId)).short} Final ปิดรับ {formatThaiDate(openFinalRound.closeDate)}
                      </>
                    ) : null}
                  </p>
                  <button
                    type="button"
                    className="pc-results-submit-btn"
                    onClick={() => navigate?.("final-confirm")}
                  >
                    <span>ยืนยันสิทธิ์รอบถัดไป</span>
                    <span aria-hidden="true">→</span>
                  </button>
                </section>
              </div>
            ) : (
              <div className="pc-results-panel" role="tabpanel" ref={resultsListRef}>
                <form className="pc-results-card pc-results-all-form" onSubmit={handleAllSubmit}>
                  <div className="pc-results-all-grid">
                    <label className="pc-results-field">
                      <span>รายการสอบ</span>
                      <div className="pc-results-select-wrap">
                        <select
                          value={allCompetitionId}
                          onChange={(event) => {
                            const nextComp = event.target.value;
                            setAllCompetitionId(nextComp);
                            const validYears = [...new Set(publishedTargets
                              .filter((target) => nextComp === "all" || target.competitionId === nextComp)
                              .map((target) => String(target.year)))];
                            if (allYear !== "all" && validYears.length && !validYears.includes(String(allYear))) {
                              setAllYear(validYears[0]);
                            }
                            setAllGrade("all");
                            setAllFetchedRows(null);
                            setPage(1);
                          }}
                        >
                          <option value="all">ทุกรายการสอบ</option>
                          {competitionOptions.map((option) => (
                            <option key={option.id} value={option.id}>{option.label}</option>
                          ))}
                        </select>
                        <span className="pc-results-caret" aria-hidden="true">▾</span>
                      </div>
                    </label>

                    <label className="pc-results-field">
                      <span>ปี</span>
                      <div className="pc-results-select-wrap">
                        <select
                          value={allYear}
                          onChange={(event) => {
                            setAllYear(event.target.value);
                            setAllGrade("all");
                            setAllFetchedRows(null);
                            setPage(1);
                          }}
                        >
                          <option value="all">ทุกปีการศึกษา</option>
                          {yearOptions.map((year) => (
                            <option key={year} value={year}>{toThaiYear(year)}</option>
                          ))}
                        </select>
                        <span className="pc-results-caret" aria-hidden="true">▾</span>
                      </div>
                    </label>

                    <button type="submit" className="pc-results-submit-btn pc-results-all-submit" disabled={allLoading}>
                      {allLoading ? "กำลังโหลด..." : "ค้นหา"}
                    </button>
                  </div>
                  {allError ? <p className="pc-results-error" role="alert">{allError}</p> : null}
                </form>

                <div className="pc-results-list-head">
                  <h2>{allSummaryTitle}</h2>
                  <span className="pc-results-list-count">ทั้งหมด {filteredAllResults.length.toLocaleString()} รายชื่อ</span>
                </div>

                <div className="pc-results-inline-controls">
                  <label className="pc-results-inline-search">
                    <span className="sr-only">ค้นหาชื่อ หรือเลขประจำตัวสอบ</span>
                    <Icon name="search" size={16} />
                    <input
                      type="text"
                      value={allInlineQuery}
                      onChange={(event) => {
                        setAllInlineQuery(event.target.value);
                        setPage(1);
                      }}
                      placeholder="ค้นหาชื่อ หรือเลขประจำตัวสอบ..."
                    />
                  </label>
                  <label className="pc-results-inline-grade">
                    <span className="pc-results-inline-grade-label">ระดับชั้น:</span>
                    <select
                      value={allGrade}
                      onChange={(event) => {
                        setAllGrade(event.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">ทุกระดับชั้น</option>
                      {allGradeOptions.map((grade) => (
                        <option key={grade} value={grade}>{grade}</option>
                      ))}
                    </select>
                    <span className="pc-results-caret" aria-hidden="true">▾</span>
                  </label>
                </div>

                {pagedAllResults.length ? (
                  <div className="pc-results-table-shell">
                    <table className="pc-results-table pc-results-table-clean">
                      <thead>
                        <tr>
                          <th>เลขประจำตัว</th>
                          <th>ชื่อ</th>
                          <th className="pc-results-col-school">โรงเรียน</th>
                          <th>ระดับชั้น</th>
                          <th>รางวัล</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedAllResults.map((item) => (
                          <tr key={`${item.applicationItemId || item.applicationId}-${item.targetId}`}>
                            <td className="pc-results-mono">{item.candidateNo || item.examNumber || "—"}</td>
                            <td className="pc-results-name">
                              <span>{item.candidateNameTh || item.candidateName || item.candidate}</span>
                              {item.candidateNameTh && item.candidateName ? (
                                <small>{item.candidateName}</small>
                              ) : null}
                            </td>
                            <td className="pc-results-col-school">{item.schoolName || item.school}</td>
                            <td>{item.grade}</td>
                            <td>
                              <span className={`pc-award-pill is-${getAwardTone(item.award)}`}>
                                {item.award}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {totalPages > 1 ? (
                      <div className="pc-results-pagination">
                        <span>หน้า {currentPage.toLocaleString()} จาก {totalPages.toLocaleString()}</span>
                        <nav aria-label="แบ่งหน้าผลสอบ">
                          <button type="button" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>ก่อนหน้า</button>
                          {pageItems.map((item, index) => item === "ellipsis" ? (
                            <span key={`ellipsis-${index}`} aria-hidden="true">…</span>
                          ) : (
                            <button
                              key={item}
                              type="button"
                              className={currentPage === item ? "is-active" : ""}
                              aria-current={currentPage === item ? "page" : undefined}
                              onClick={() => changePage(item)}
                            >
                              {item}
                            </button>
                          ))}
                          <button type="button" disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)}>ถัดไป</button>
                        </nav>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="pc-results-empty-card results-empty-state">
                    <span className="pc-results-empty-icon"><Icon name="search" size={20} /></span>
                    <strong>ไม่พบผลสอบที่ตรงกับคำค้นหาหรือตัวกรอง</strong>
                    <small>โปรดลองเปลี่ยนคำค้นหา หรือเลือกรายการสอบ/ระดับชั้นอื่น</small>
                    <button type="button" className="pc-results-reset-btn" onClick={resetAllFilters}>
                      ล้างคำค้นหาและตัวกรอง
                    </button>
                  </div>
                )}
              </div>
            )}

            <p className="pc-results-footnote">
              หากยังไม่พบผลสอบ กรุณาตรวจรายการ ปี และรอบสอบ<br />
              ผลจะแสดงเมื่อมีประกาศอย่างเป็นทางการ
            </p>
          </>
        )}
      </div>
    </div>
  );
}
