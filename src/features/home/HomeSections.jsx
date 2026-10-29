import { lazy, Suspense } from "react";
import { BrandMark, Icon } from "../../components/ui/index.jsx";
import { formatThaiDate, getExamRoundType } from "../../examUtils.js";

const GraduationCapScene = lazy(() => import("./GraduationCapScene.jsx").then((module) => ({ default: module.GraduationCapScene })));
const HERO_DIVIDER_WAVES = 12;
const heroDividerPath = "M0 24 " + Array.from({ length: HERO_DIVIDER_WAVES }, (_, index) => {
  const x = index * 120;
  return "Q" + (x + 30) + " 0 " + (x + 60) + " 24 Q" + (x + 90) + " 48 " + (x + 120) + " 24";
}).join(" ") + " L1440 48 L0 48 Z";
const FACEBOOK_PAGES = [
  ["OCEC-TH", "https://www.facebook.com/OCECTH"],
  ["TIMO", "https://www.facebook.com/timo.thailand"],
  ["BBB", "https://www.facebook.com/profile.php?id=100076545241501"],
  ["HKIMO", "https://www.facebook.com/profile.php?id=100063468886052"],
];

function FacebookMark() {
  return <svg className="home-facebook-mark" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="12" fill="#1877f2" /><path d="M13.5 21v-7h2.4l.35-2.8H13.5V9.4c0-.8.22-1.35 1.36-1.35h1.45v-2.5c-.25-.03-1.11-.1-2.12-.1-2.1 0-3.54 1.3-3.54 3.68v2.07H8.3V14h2.35v7Z" fill="#fff" /></svg>;
}

export function HomeHero({ featuredExam, onStartApplication, onLookup }) {
  return (
    <section className="home-hero" aria-labelledby="homepage-title">
      <div className="home-container home-hero-grid">
        <div className="home-hero-copy">
          <p className="home-kicker"><Icon name="sparkle" size={14} /> OCEC EXAM PORTAL • ปีการศึกษา {featuredExam?.year || "2569"}</p>
          <h1 id="homepage-title">สมัครสอบกับ <span>OCEC.</span></h1>
          <span className="home-title-rule" aria-hidden="true" />
          <p className="home-hero-lead">เลือกรายการสอบที่สนใจ ตรวจสอบกำหนดการ และสมัครได้หลายรายการผ่านแบบฟอร์มเดียว</p>
          <div className="home-hero-actions">
            <button className="home-button home-button-primary" type="button" onClick={onStartApplication}>เข้าสู่การสมัครสอบ <Icon name="arrow" size={16} /></button>
            <button className="home-button home-button-secondary" type="button" onClick={onLookup}><Icon name="file" size={16} /> ตรวจสอบสถานะใบสมัคร</button>
          </div>
          <div className="home-social" role="group" aria-label="ติดตามข่าวสารและประชาสัมพันธ์ทาง Facebook">
            <FacebookMark />
            <ul className="home-social-links">
              {FACEBOOK_PAGES.map(([name, href]) => <li key={name}><a className="home-social-link" href={href} target="_blank" rel="noopener noreferrer" aria-label={"ติดตาม " + name + " บน Facebook (เปิดแท็บใหม่)"}>{name}</a></li>)}
            </ul>
          </div>
        </div>
        <div className="home-art">
          <div className="home-art-stage">
            <div className="home-art-panel" aria-hidden="true" />
            <Suspense fallback={<div className="home-scene-loading" aria-hidden="true" />}>
              <GraduationCapScene />
            </Suspense>
          </div>
        </div>
      </div>
      <svg className="home-section-wave" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true" data-wave-count={HERO_DIVIDER_WAVES}><path d={heroDividerPath} /></svg>
    </section>
  );
}

function RoundCard({ exam, index, onStartApplication }) {
  const roundType = getExamRoundType(exam);
  const roundLabel = roundType === "HEAT" ? "HEAT ROUND · รอบคัดเลือก" : roundType === "FINAL" ? "FINAL ROUND · รอบชิงชนะเลิศ" : roundType === "FINAL_X" ? "FINAL X · รอบสอบ" : (exam.round || roundType) + " · รอบสอบ";
  return (
    <article className="home-round-card" style={{ "--exam-entrance-delay": Math.min(index, 8) * 70 + "ms" }}>
      <div className="home-round-top">
        <div className="home-round-labels"><span className="home-round-status"><i />เปิดรับสมัคร</span><span>{roundLabel}</span></div>
        <span className="home-round-year">ปีการศึกษา {exam.year} <span>สมัครผ่านแบบฟอร์มเดียว</span></span>
      </div>
      <h3>{exam.title}</h3>
      <p className="home-round-description">{exam.description || "ตรวจสอบกำหนดการและรายละเอียดการสมัคร"}</p>
      <div className="home-round-dates">
        <div><i><Icon name="calendar" size={16} /></i><span><small>วันสอบ</small><strong>{exam.examDate ? formatThaiDate(exam.examDate) : "ยังไม่กำหนด"}</strong></span></div>
        <div><i><Icon name="clock" size={16} /></i><span><small>ปิดรับสมัคร</small><strong>{exam.closeDate ? formatThaiDate(exam.closeDate) : "ยังไม่กำหนด"}</strong></span></div>
      </div>
      <div className="home-round-foot"><button className="home-button home-button-primary" type="button" onClick={onStartApplication}>สมัครสอบทันที <Icon name="arrow" size={15} /></button></div>
    </article>
  );
}

export function ExamRounds({ openExams, resultPublished, navigate, onStartApplication }) {
  return (
    <section className="home-rounds" id="open-exams" aria-labelledby="open-exams-title">
      <div className="home-container">
        <div className="home-rounds-layout">
          <div className="home-rounds-intro">
            <div className="home-rounds-logo"><BrandMark /></div>
            <p className="home-section-kicker">EXAM ROUNDS · รอบสอบปัจจุบัน</p>
            <h2 id="open-exams-title">รายการสอบที่เปิดรับสมัคร</h2>
            <span className="home-title-rule" aria-hidden="true" />
            <p>{openExams.length ? "โปรดตรวจสอบรายละเอียดก่อนสมัคร" : "เมื่อมีรายการเปิดรับสมัคร รายละเอียดและกำหนดการจะแสดงในส่วนนี้"}</p>
            <span className="home-open-count"><i />{openExams.length} รายการเปิดรับสมัคร</span>
          </div>
          <div className="home-rounds-list" aria-label="รายการสอบที่เปิดรับ">
            {openExams.length ? openExams.map((exam, index) => <RoundCard key={exam.id} exam={exam} index={index} onStartApplication={getExamRoundType(exam) === "HEAT" ? onStartApplication : () => navigate("final-confirm")} />) : (
              <div className="home-rounds-empty">
                <span className="home-empty-icon"><Icon name="calendar" size={28} /></span>
                <h3>ขณะนี้ไม่มีรายการสอบที่เปิดรับสมัคร</h3>
                <p>เมื่อมีรายการเปิดรับสมัคร ระบบจะแสดงรายละเอียดและกำหนดการในส่วนนี้ ระหว่างนี้สามารถศึกษาขั้นตอนการสมัครหรือตรวจสอบใบสมัครได้</p>
                <div><a className="home-button home-button-secondary" href="#how-to-apply">ดูขั้นตอนการสมัคร <Icon name="arrow" size={15} /></a><button className="home-button home-button-primary" type="button" onClick={() => navigate("lookup-choice")}>ตรวจสอบสถานะใบสมัคร</button></div>
              </div>
            )}
          </div>
        </div>
        <Journey navigate={navigate} />
        {resultPublished ? <button className="home-final-link" onClick={() => navigate("final-confirm")}><Icon name="award" size={24} /><span><strong>ตรวจสอบสิทธิ์สมัครรอบ Final / Final X</strong><small>สำหรับผู้ผ่าน HEAT หรือผู้ได้เหรียญ BBB รอบ Final</small></span><Icon name="arrow" size={18} /></button> : null}
      </div>
    </section>
  );
}

export function Journey({ navigate }) {
  const steps = [
    ["01", "file", "เลือกรอบสอบ", "โปรดตรวจสอบวันสอบและกำหนดปิดรับสมัครก่อนเลือกรายการสอบ"],
    ["02", "user", "กรอกใบสมัคร", "เข้าสู่ระบบ กรอกข้อมูลให้ครบถ้วน และส่งใบสมัครผ่านแบบฟอร์ม"],
    ["03", "check", "ตรวจสอบสถานะ", "ตรวจสอบสถานะใบสมัคร และแก้ไขข้อมูลตามสิทธิ์ที่กำหนด"],
  ];
  return (
    <div className="home-journey" id="how-to-apply" aria-labelledby="how-to-apply-title">
      <p className="home-guide-kicker">APPLICATION GUIDE · ขั้นตอนการสมัคร</p>
      <h3 id="how-to-apply-title">ขั้นตอนการสมัคร 3 ขั้นตอน</h3>
      <p className="home-guide-description">โปรดเตรียมข้อมูลให้พร้อมก่อนสมัคร และตรวจสอบสถานะใบสมัครได้ทุกเมื่อ</p>
      <ol>{steps.map(([number, icon, title, description]) => <li key={number}><div className="home-step-top"><span>{number}</span><i><Icon name={icon} size={20} /></i></div><h4>{title}</h4><p>{description}</p>{number === "03" ? <button type="button" onClick={() => navigate("lookup-choice")}>ดูรายละเอียด <Icon name="arrow" size={13} /></button> : null}</li>)}</ol>
    </div>
  );
}

export function HomeFooter({ navigate }) {
  const links = [["รายการสอบ", "home"], ["ตรวจสอบสถานะใบสมัคร", "lookup-choice"], ["ยืนยันสิทธิ์", "final-confirm"], ["ประกาศผล", "results"]];
  const goTo = (page) => {
    if (page === "home") document.getElementById("open-exams")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    else navigate(page);
  };
  return (
    <footer className="home-footer">
      <div className="home-container">
        <div className="home-help"><span className="home-help-icon"><Icon name="headset" size={25} /></span><div><h3>ต้องการความช่วยเหลือในการสมัครสอบ?</h3><p>ติดต่อศูนย์ช่วยเหลือของเรา</p></div><a className="home-button" href="https://lin.ee/3hzFg1z" target="_blank" rel="noopener noreferrer">ศูนย์ช่วยเหลือ <Icon name="arrow" size={16} /></a></div>
        <div className="home-footer-bottom"><a className="home-footer-brand" href="/"><BrandMark /><span>OCEC Portal ระบบสมัครสอบ<small>© 2569 OCEC Portal. All rights reserved.</small></span></a><nav aria-label="เมนูส่วนท้าย">{links.map(([label, page]) => <button type="button" key={page} onClick={() => goTo(page)}>{label}</button>)}</nav></div>
        <div className="home-footer-credit"><a href="https://lin.ee/3hzFg1z" target="_blank" rel="noopener noreferrer">ศูนย์ช่วยเหลือ</a><a href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">UIcons by Flaticon</a></div>
      </div>
    </footer>
  );
}
