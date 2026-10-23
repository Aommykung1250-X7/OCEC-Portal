import { useState } from "react";
import { Button, Field, Icon, PageHeading, StatusBadge } from "../../components/ui/index.jsx";

export function StatusLookupPage({ applications, navigate, backendEnabled }) {
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
      if (backendEnabled) {
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
      <section className="surface lookup-card mx-auto w-full max-w-[730px] p-[25px] max-[600px]:p-[17px]">
        <div className="lookup-icon"><Icon name="search" size={22} /></div>
        <h2>ค้นหาด้วยชื่อภาษาอังกฤษ</h2>
        <p>กรอกชื่อผู้เข้าสอบตามที่ระบุในใบสมัคร ระบบจะแสดงรายการสอบ สถานะ และเหตุผลสั้น ๆ หากไม่อนุมัติ</p>
        <form className="grid gap-[13px]" onSubmit={search}>
          <Field label="ชื่อภาษาอังกฤษของผู้เข้าสอบ" required hint="ตัวอย่าง: Nicha Srisawat">
            <div className="input-with-icon"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="กรอกชื่อและนามสกุลภาษาอังกฤษ" minLength={3} required /></div>
          </Field>
          <Button type="submit" icon="search" className="button-full" disabled={busy}>{busy ? "กำลังค้นหา…" : "ค้นหาสถานะ"}</Button>
        </form>
        {searched ? (
          <div className="lookup-results" aria-live="polite">
            <div className="lookup-results-head"><strong>ผลการค้นหา</strong><span>{results.length} รายการ</span></div>
            {error ? <div className="empty-inline"><Icon name="info" /><span>{error}</span></div> : results.length ? results.map((application, index) => (
              <div className="status-result grid grid-cols-[minmax(0,1fr)_auto] gap-x-[15px] gap-y-2 py-3 max-[600px]:grid-cols-1" key={`${application.id || application.candidate}-${index}`}>
                <div className="status-result-main flex flex-col gap-[5px]"><strong>{application.candidate}</strong><span>{application.exam}</span></div>
                <div className="status-result-side flex flex-col items-end gap-[5px] max-[600px]:items-start"><StatusBadge status={application.status} />{application.status === "rejected" && application.reason ? <small className="status-rejected-reason">เหตุผล: {application.reason}</small> : null}</div>
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

export function LookupChoicePage({ navigate }) {
  return (
    <div className="page-stack narrow-page">
      <PageHeading eyebrow="บริการผู้สมัคร" title="ค้นหาหรือแก้ไขใบสมัคร" description="เลือกสิ่งที่ต้องการทำ ระบบจะแสดงเฉพาะข้อมูลที่จำเป็นในแต่ละขั้นตอน" />
      <div className="grid gap-[11px]">
        <button className="lookup-choice-card grid min-h-32 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-[13px] p-[17px] text-left shadow-[0_2px_8px_rgba(31,50,81,.03)] transition-[border-color,background-color,transform] duration-[180ms] hover:-translate-y-px" onClick={() => navigate("check-status")}>
          <span className="lookup-choice-icon choice-search"><Icon name="search" size={22} /></span>
          <span className="lookup-choice-copy"><strong>ค้นหาสถานะใบสมัคร</strong><small>ตรวจสอบสถานะทั่วไปได้ทันที ไม่ต้องเข้าสู่ระบบ</small><em>ใช้ชื่อภาษาอังกฤษของผู้เข้าสอบ</em></span>
          <span className="lookup-choice-arrow"><Icon name="arrow" /></span>
        </button>
        <button className="lookup-choice-card grid min-h-32 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-[13px] p-[17px] text-left shadow-[0_2px_8px_rgba(31,50,81,.03)] transition-[border-color,background-color,transform] duration-[180ms] hover:-translate-y-px" onClick={() => navigate("edit-verify")}>
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

export function EditVerifyPage({ applications, onVerified, navigate, backendEnabled }) {
  const [name, setName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (backendEnabled) {
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
      <section className="surface verify-card grid gap-[18px] p-[25px] max-[600px]:p-[17px]">
        <div className="flex items-center justify-center gap-2 border-b border-[#eef1f5] pb-4 max-[600px]:justify-between max-[600px]:gap-1"><span className="verify-step verify-step-active"><b>1</b>ยืนยันตัวตน</span><i className="h-px w-[25px] bg-[#dfe5ed] max-[600px]:w-[10px]" /><span className="verify-step"><b>2</b>ตรวจสอบใบสมัคร</span><i className="h-px w-[25px] bg-[#dfe5ed] max-[600px]:w-[10px]" /><span className="verify-step"><b>3</b>แก้ไขข้อมูล</span></div>
        <form className="grid gap-[14px]" onSubmit={verify}>
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
