import { useState } from "react";
import { Icon } from "../../components/ui/index.jsx";
import { formatThaiDate, getExamRoundType } from "../../examUtils.js";
import { getBangkokTodayISO } from "../applications/applicationUtils.js";
import { formatShortThaiDate, getCompetitionDisplayMeta, splitThaiDate, toThaiYear } from "./homeUtils.js";

const HERO_WAVE_PATH = "M0,26 C120,44 240,8 360,26 C480,44 600,8 720,26 C840,44 960,8 1080,26 C1200,44 1320,8 1440,26 L1440,48 L0,48 Z";
const COMPETITION_ORDER = ["timo", "bbb", "hkimo", "hkiso", "hkico"];
const ROUND_SHORT_LABELS = { HEAT: "รอบ Heat", FINAL: "รอบ Final", FINAL_X: "รอบ Final X" };
const FACEBOOK_PAGES = [
  ["OCEC-TH", "https://www.facebook.com/OCECTH"],
  ["TIMO", "https://www.facebook.com/timo.thailand"],
  ["BBB", "https://www.facebook.com/profile.php?id=100076545241501"],
  ["HKIMO", "https://www.facebook.com/profile.php?id=100063468886052"],
];
const HELP_URL = "https://lin.ee/3hzFg1z";

function FeaturedExamCard({ featuredExam, featuredCompetition, onStartApplication, navigate }) {
  const meta = getCompetitionDisplayMeta(featuredExam, featuredCompetition);
  const isOpen = Boolean(featuredExam?.isOpen);
  const roundType = featuredExam ? getExamRoundType(featuredExam) : "HEAT";
  const roundText = ROUND_SHORT_LABELS[roundType] || "รอบ Heat";
  const dateParts = splitThaiDate(featuredExam?.examDate);
  const closeDateText = featuredExam?.closeDate ? `ปิดรับสมัคร ${formatThaiDate(featuredExam.closeDate)}` : "ติดตามกำหนดการเปิดรับสมัคร";
  const displayYear = featuredExam?.year || String(new Date().getFullYear());

  const handleCardAction = () => {
    if (isOpen) {
      if (roundType === "HEAT") onStartApplication?.();
      else navigate?.("final-confirm");
      return;
    }
    document.getElementById("open-exams")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="home-featured-card" role="button" tabIndex={0} onClick={handleCardAction} onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        handleCardAction();
      }
    }}>
      <span className={`home-featured-pill${isOpen ? " is-open" : ""}`}>
        {isOpen ? "กำลังเปิดรับสมัคร" : "รอบสอบล่าสุด"}
      </span>
      <h2 className="home-featured-title">{meta.short} {displayYear}</h2>
      <p className="home-featured-subtitle">{meta.englishName || meta.thaiName}</p>
      <div className="home-featured-date">
        {dateParts ? (
          <>
            <strong className="home-featured-day">{dateParts.day}</strong>
            <div className="home-featured-date-copy">
              <span>{dateParts.monthYear}</span>
              <small>{roundText} • Paper / Online</small>
            </div>
          </>
        ) : (
          <div className="home-featured-date-copy">
            <span>รอประกาศวันสอบ</span>
            <small>{roundText} • Paper / Online</small>
          </div>
        )}
      </div>
      <p className="home-featured-close">{closeDateText}</p>
    </div>
  );
}

export function HomeHero({ featuredExam, featuredCompetition, onStartApplication, onLookup, navigate }) {
  const displayThaiYear = toThaiYear(featuredExam?.year || "2569");
  return (
    <section className="home-hero" aria-labelledby="homepage-title">
      <div className="home-container home-hero-grid">
        <div className="home-hero-copy">
          <p className="home-kicker">เปิดโลกการเรียนรู้ • ปีการศึกษา {displayThaiYear}</p>
          <h1 id="homepage-title">ก้าวแรกของคุณ<br />สู่เวทีนานาชาติ</h1>
          <p className="home-hero-lead">
            สมัครสอบ ติดตามสถานะ และต่อยอดความสำเร็จ<br className="home-lead-break" />
            ทุกโอกาสของน้อง ๆ เริ่มต้นได้ที่นี่
          </p>
          <div className="home-hero-actions">
            <button className="home-button home-button-primary" type="button" onClick={onStartApplication}>
              <span>เข้าสู่การสมัครสอบ</span>
              <span aria-hidden="true">→</span>
            </button>
            <button className="home-button home-button-secondary" type="button" onClick={onLookup}>
              ตรวจสอบสถานะใบสมัคร
            </button>
          </div>
          <p className="home-hero-note">สำหรับผู้สมัคร ผู้ปกครอง และโรงเรียน</p>
        </div>
        <div className="home-hero-aside">
          <FeaturedExamCard
            featuredExam={featuredExam}
            featuredCompetition={featuredCompetition}
            onStartApplication={onStartApplication}
            navigate={navigate}
          />
        </div>
      </div>
      <svg className="home-section-wave" viewBox="0 0 1440 48" preserveAspectRatio="none" aria-hidden="true">
        <path d={HERO_WAVE_PATH} />
      </svg>
    </section>
  );
}

export function HomeQuickActions({ navigate, applicationsSummary }) {
  const items = [
    { icon: "file", title: "ใบสมัครของฉัน", desc: "ดูใบสมัครและความคืบหน้า", to: "applications" },
    { icon: "search", title: "ตรวจสอบสถานะ", desc: "ค้นหาได้โดยไม่ต้องเข้าสู่ระบบ", to: "lookup-choice" },
    { icon: "award", title: "ประกาศผลสอบ", desc: "ดูผลและสิทธิ์สมัครรอบถัดไป", to: "results" },
  ];
  return (
    <section className="home-quick-section" aria-label="ทางลัดบริการหลัก">
      <div className="home-container">
        <div className="home-quick-grid">
          {items.map((item) => (
            <button
              key={item.to}
              type="button"
              className="home-quick-card"
              onClick={() => navigate(item.to)}
            >
              <span className="home-quick-icon"><Icon name={item.icon} size={18} /></span>
              <span className="home-quick-copy">
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
              </span>
            </button>
          ))}
        </div>
        {applicationsSummary}
      </div>
    </section>
  );
}

function RoundCard({ exam, competition, year, today, onStartApplication, navigate }) {
  const isOpen = Boolean(exam?.isOpen);
  const isClosed = !isOpen && Boolean(exam?.closeDate && today > exam.closeDate);
  const roundType = exam ? getExamRoundType(exam) : "HEAT";
  const roundLabel = ROUND_SHORT_LABELS[roundType] || "รอบ Heat";
  const meta = getCompetitionDisplayMeta(exam, competition);
  const thaiYear = toThaiYear(exam?.year || year);
  const shortExamDate = formatShortThaiDate(exam?.examDate);
  const shortCloseDate = formatShortThaiDate(exam?.closeDate);
  const badgeText = isOpen ? "เปิดรับสมัคร" : isClosed ? "ปิดรับสมัคร" : "ยังไม่เปิด";
  const isFinal = roundType === "FINAL" || roundType === "FINAL_X";

  return (
    <article className={`home-round-card${isOpen ? " is-open" : " is-closed"}`}>
      <div className="home-round-top">
        <strong className="home-round-code">{meta.short}</strong>
        <span className={`home-round-badge${isOpen ? " is-open" : ""}`}>{badgeText}</span>
      </div>
      <h3 className="home-round-title">{meta.thaiName}</h3>
      <p className="home-round-meta">ปี {thaiYear} / {roundLabel}</p>
      <div className="home-round-date-row">
        <Icon name="calendar" size={16} />
        <strong>{shortExamDate || "รอประกาศกำหนดการ"}</strong>
      </div>
      {isOpen ? (
        <>
          <p className="home-round-close">
            {shortCloseDate ? `ปิดรับ ${shortCloseDate}` : "เปิดรับสมัครแล้ว"}
          </p>
          <div className="home-round-foot">
            <button
              className="home-button home-button-primary home-round-cta"
              type="button"
              onClick={isFinal ? () => navigate("final-confirm") : onStartApplication}
            >
              <span>{isFinal ? "ยืนยันสิทธิ์และสมัคร" : "สมัครสอบทันที"}</span>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      ) : (
        <div className="home-round-closed-copy">
          <p>{isClosed ? (shortCloseDate ? `ปิดรับเมื่อ ${shortCloseDate}` : "ปิดรับสมัครแล้ว") : "ยังไม่เปิดรับสมัคร"}</p>
          <p>ติดตามประกาศจาก OCEC</p>
        </div>
      )}
    </article>
  );
}

export function ExamRounds({
  today = getBangkokTodayISO(),
  examCatalog = [],
  competitionCatalog = [],
  openExams: legacyOpenExams,
  resultPublished,
  navigate,
  onStartApplication,
}) {
  const sourceExams = examCatalog.length ? examCatalog : (legacyOpenExams || []);
  const catalogYears = [...new Set(sourceExams.map((exam) => String(exam.year)).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  const fallbackYear = String(Number(today.slice(0, 4)));
  const latestYear = catalogYears[0] || fallbackYear;
  const years = catalogYears.length ? catalogYears : [latestYear];

  const [selectedYear, setSelectedYear] = useState(latestYear);
  const [openOnly, setOpenOnly] = useState(false);

  const activeYear = years.includes(selectedYear) ? selectedYear : latestYear;
  const roundsForYear = sourceExams.filter((exam) => String(exam.year) === activeYear);
  const activeCompetitions = competitionCatalog.filter((comp) => comp.active !== false);

  const scheduledCards = roundsForYear.map((exam) => ({
    key: exam.id,
    exam,
    competition: activeCompetitions.find((comp) => comp.id === exam.competitionId) || { id: exam.competitionId, name: exam.title },
  }));

  const unscheduledCards = activeYear === latestYear
    ? activeCompetitions
      .filter((comp) => !roundsForYear.some((exam) => exam.competitionId === comp.id))
      .map((competition) => ({ key: `unscheduled-${competition.id}`, exam: null, competition }))
    : [];

  const allCards = [...scheduledCards, ...unscheduledCards].sort((left, right) => {
    const openDiff = Number(Boolean(right.exam?.isOpen)) - Number(Boolean(left.exam?.isOpen));
    if (openDiff !== 0) return openDiff;
    const leftIndex = COMPETITION_ORDER.indexOf(left.competition?.id);
    const rightIndex = COMPETITION_ORDER.indexOf(right.competition?.id);
    return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
  });

  const visibleCards = openOnly ? allCards.filter(({ exam }) => exam?.isOpen) : allCards;

  return (
    <section className="home-rounds" id="open-exams" aria-labelledby="open-exams-title">
      <div className="home-container">
        <div className="home-rounds-header">
          <h2 id="open-exams-title">ค้นหาเวทีที่ใช่สำหรับคุณ</h2>
          <p>เลือกรายการสอบและรอบที่ต้องการสมัคร</p>
        </div>

        <div className="home-rounds-filters">
          <label className="home-year-select-wrap">
            <span className="sr-only">เลือกปีการศึกษา</span>
            <select
              className="home-year-select"
              value={activeYear}
              onChange={(event) => setSelectedYear(event.target.value)}
            >
              {years.map((item) => (
                <option key={item} value={item}>ปีการศึกษา {toThaiYear(item)}</option>
              ))}
            </select>
            <span className="home-year-caret" aria-hidden="true">▾</span>
          </label>
          <button
            type="button"
            className={`home-filter-pill${openOnly ? " is-active" : ""}`}
            aria-pressed={openOnly}
            onClick={() => setOpenOnly((current) => !current)}
          >
            เฉพาะรอบที่เปิดรับ
          </button>
        </div>

        {visibleCards.length ? (
          <div className="home-rounds-grid" aria-label="รายการสอบที่เปิดรับ">
            {visibleCards.map(({ key, exam, competition }) => (
              <RoundCard
                key={key}
                exam={exam}
                competition={competition}
                year={activeYear}
                today={today}
                onStartApplication={onStartApplication}
                navigate={navigate}
              />
            ))}
          </div>
        ) : (
          <div className="home-rounds-empty">
            <span className="home-empty-icon"><Icon name="calendar" size={24} /></span>
            <h3>{openOnly ? "ขณะนี้ยังไม่มีรอบสอบที่เปิดรับสมัคร" : "ยังไม่มีรายการสอบในปีการศึกษานี้"}</h3>
            <p>
              {openOnly
                ? "คุณสามารถดูรายการสอบทั้งหมดของปีการศึกษานี้ หรือตรวจสอบสถานะใบสมัครที่มีอยู่ได้"
                : "เมื่อมีรายการเปิดรับสมัคร ระบบจะแสดงรายละเอียดและกำหนดการในส่วนนี้"}
            </p>
            <div className="home-empty-actions">
              {openOnly ? (
                <button className="home-button home-button-secondary" type="button" onClick={() => setOpenOnly(false)}>
                  ดูรายการสอบทั้งหมด
                </button>
              ) : null}
              <button className="home-button home-button-primary" type="button" onClick={() => navigate("lookup-choice")}>
                ตรวจสอบสถานะใบสมัคร
              </button>
            </div>
          </div>
        )}

        {resultPublished ? (
          <button className="home-final-link" type="button" onClick={() => navigate("final-confirm")}>
            <span className="home-final-link-icon"><Icon name="award" size={20} /></span>
            <span className="home-final-link-copy">
              <strong>ตรวจสอบสิทธิ์สมัครรอบ Final / Final X</strong>
              <small>สำหรับผู้ผ่านรอบ Heat หรือผู้ได้รับเหรียญตามเกณฑ์ของรายการ</small>
            </span>
            <span className="home-final-link-arrow" aria-hidden="true">→</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function Journey() {
  const steps = [
    ["01", "เลือกเวทีของคุณ", "เข้าสู่ระบบ เลือกรายการสอบ สมัครเองหรือสมัครผ่านโรงเรียน"],
    ["02", "กรอกข้อมูลและชำระเงิน", "ตรวจข้อมูล แนบหลักฐานการโอน และยืนยันการส่งใบสมัคร"],
    ["03", "ติดตามและไปต่อ", "ตรวจสอบสถานะ ดูผลสอบ และยืนยันสิทธิ์รอบถัดไป"],
  ];
  return (
    <section className="home-journey-section" id="how-to-apply" aria-labelledby="how-to-apply-title">
      <div className="home-container">
        <h2 id="how-to-apply-title">สมัครง่าย ใน 3 ขั้นตอน</h2>
        <ol className="home-steps-grid">
          {steps.map(([number, title, description]) => (
            <li key={number} className="home-step-item">
              <span className="home-step-number">{number}</span>
              <div className="home-step-copy">
                <h3>{title}</h3>
                <p>{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function HomeHelpCard() {
  return (
    <section className="home-help-section" aria-labelledby="home-help-title">
      <div className="home-container">
        <div className="home-help-card">
          <h2 id="home-help-title">ให้เราช่วยดูแลการสมัครของคุณ</h2>
          <p>
            มีคำถามเรื่องการสมัคร ข้อมูล หรือการชำระเงิน<br />
            ติดต่อทีม OCEC ได้ผ่าน LINE Official
          </p>
          <a className="home-help-link" href={HELP_URL} target="_blank" rel="noopener noreferrer">
            <span>ติดต่อศูนย์ช่วยเหลือ</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}

export function HomeFooter() {
  return (
    <footer className="home-footer">
      <div className="home-container home-footer-inner">
        <a className="home-footer-brand" href="/">OCEC Portal</a>
        <p className="home-footer-tagline">พื้นที่แห่งโอกาส สู่เวทีระดับนานาชาติ</p>
        <ul className="home-footer-socials" aria-label="ติดตามข่าวสารทาง Facebook">
          {FACEBOOK_PAGES.map(([name, href]) => (
            <li key={name}>
              <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`ติดตาม ${name} บน Facebook (เปิดแท็บใหม่)`}>
                {name}
              </a>
            </li>
          ))}
        </ul>
        <a className="home-footer-line" href={HELP_URL} target="_blank" rel="noopener noreferrer">
          ติดต่อศูนย์ช่วยเหลือผ่าน LINE Official
        </a>
        <p className="home-footer-copy">© 2026 OCEC • ความเป็นส่วนตัว</p>
      </div>
    </footer>
  );
}
