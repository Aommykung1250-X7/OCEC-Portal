import { useState } from "react";
import { PublicGradientBackground } from "../../components/public/PublicGradientBackground.jsx";
import { PublicPortalHeader } from "../../components/public/PublicPortalHeader.jsx";
import { ExamLogo, Icon, StatusBadge } from "../../components/ui/index.jsx";
import { formatThaiDate, getExamRoundType } from "../../examUtils.js";
import { getApplicationEditDeadline, getApplicationRoundType, isApplicationEditable } from "../applications/applicationUtils.js";
import { HomeFooter, HomeHero, Journey } from "./HomeSections.jsx";
import { registrationCountdown } from "./homeUtils.js";
import sceneStill from "./hero-3d-still.png";
import bbbLogo from "./exam-logos/bbb.png";
import hkicoLogo from "./exam-logos/hkico.png";
import hkimoLogo from "./exam-logos/hkimo.png";
import hkisoLogo from "./exam-logos/hkiso.png";
import timoLogo from "./exam-logos/timo.png";
import "./home-design-preview.css";

const competitionOrder = ["hkiso", "hkico", "bbb", "timo", "hkimo"];
const competitionLogos = { bbb: bbbLogo, hkico: hkicoLogo, hkimo: hkimoLogo, hkiso: hkisoLogo, timo: timoLogo };
const subjects = { Science: "วิทยาศาสตร์", Computer: "คอมพิวเตอร์", Mathematics: "คณิตศาสตร์" };
const roundLabels = { HEAT: "Heat", FINAL: "Final", FINAL_X: "Final X" };

function CompetitionMark({ competition, title = competition?.name }) {
  const id = competition?.id;
  const logo = competition?.logoDataUrl || competitionLogos[id];
  return <ExamLogo className="design-exam-mark" exam={{ title, logoDataUrl: logo }} />;
}

function QuickActions({ navigate }) {
  const actions = [
    ["file", "ใบสมัครของฉัน", "แบบร่าง ใบสมัคร และความคืบหน้า", "applications"],
    ["search", "ตรวจสอบสถานะใบสมัคร", "ค้นหาด้วยชื่อผู้สมัครหรือเบอร์โทร 4 หลักท้าย", "lookup-choice"],
    ["award", "ประกาศผล", "ค้นหาผลสอบด้วยชื่อหรือ Candidate No.", "results"],
  ];
  return (
    <nav className="design-shortcuts" aria-label="ทางลัด">
      {actions.map(([icon, title, description, destination]) => (
        <button className="design-shortcut" type="button" key={destination} onClick={() => navigate(destination)}>
          <span className="design-tile"><Icon name={icon} size={17} /></span>
          <span><strong>{title}</strong><small>{description}</small></span>
          <Icon name="arrow" size={15} />
        </button>
      ))}
    </nav>
  );
}

function ActiveApplications({ applications, examCatalog, competitionCatalog, today, navigate }) {
  const active = applications.filter((application) => {
    if (isApplicationEditable(application, examCatalog)) return true;
    if (!["pending", "slip_issue", "confirmed"].includes(application.status)) return false;
    return examCatalog.some((exam) => String(exam.year) === String(application.year)
      && getExamRoundType(exam) === getApplicationRoundType(application)
      && application.competitions?.some((entry) => entry.roundId ? entry.roundId === exam.id : entry.id === exam.competitionId)
      && (exam.isOpen || (exam.examDate && today <= exam.examDate)));
  }).sort((a, b) => (Date.parse(b.submitted) || 0) - (Date.parse(a.submitted) || 0)).slice(0, 3);

  if (!active.length) return null;
  return (
    <section className="design-applications" aria-labelledby="design-applications-title">
      <div className="design-applications-heading">
        <h2 id="design-applications-title">ใบสมัครที่กำลังดำเนินการ</h2>
        <button className="home-button home-button-secondary" type="button" onClick={() => navigate("applications")}>ดูใบสมัครทั้งหมด <Icon name="arrow" size={14} /></button>
      </div>
      <div className="design-app-list">
        {active.map((application) => {
          const editable = isApplicationEditable(application, examCatalog);
          const deadline = editable ? getApplicationEditDeadline(application, examCatalog) : "";
          const competition = competitionCatalog.find((item) => item.id === application.competitions?.[0]?.id);
          return (
            <article className="design-app-card" key={application.id} data-editable={editable}>
              <CompetitionMark competition={competition} />
              <div className="design-app-info">
                <div><StatusBadge status={application.status} /> <span>{application.id}</span></div>
                <h3>{application.exam} {roundLabels[getApplicationRoundType(application)]} · {application.year}</h3>
                <p>{application.candidate}{deadline ? ` · แก้ไขได้ถึง ${formatThaiDate(deadline)}` : ""}</p>
              </div>
              <div className="design-app-actions">
                {editable ? <button className="home-button home-button-primary" type="button" onClick={() => navigate("edit-application", application.id)}>แก้ไขใบสมัคร <Icon name="edit" size={14} /></button> : null}
                <button className="home-button home-button-secondary" type="button" onClick={() => navigate("application-detail", application.id)}>ดูรายละเอียด <Icon name="arrow" size={14} /></button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RoundCard({ exam, competition, year, today, onStartApplication, navigate }) {
  const isOpen = Boolean(exam?.isOpen);
  const isClosed = !isOpen && Boolean(exam?.closeDate && today > exam.closeDate);
  const roundType = exam ? getExamRoundType(exam) : null;
  const countdown = isOpen ? registrationCountdown(exam.closeDate, today) : null;
  const title = exam?.title || competition.name;
  const label = isOpen ? "เปิดรับสมัคร" : isClosed ? "ปิดรับสมัคร" : "ยังไม่เปิดรับสมัคร";
  return (
    <article className="design-round-card" data-open={isOpen}>
      <CompetitionMark competition={competition} title={title} />
      <div className="design-round-info">
        <div className="design-round-meta">
          <span className="design-round-status"><span aria-hidden="true" />{label}</span>
          {competition.subject ? <span>{subjects[competition.subject] || competition.subject}</span> : null}
          <span>ปีการศึกษา {year}</span>
          {exam ? <span>{roundType === "HEAT" ? "HEAT ROUND · รอบคัดเลือก" : roundLabels[roundType]}</span> : null}
        </div>
        <h3>{title}</h3>
        {exam && (exam.examDate || exam.closeDate) ? (
          <div className="design-round-dates">
            {exam.examDate ? <span><Icon name="calendar" size={14} /> วันสอบ <strong>{formatThaiDate(exam.examDate)}</strong></span> : null}
            {exam.closeDate ? <span><Icon name="clock" size={14} /> ปิดรับสมัคร <strong>{formatThaiDate(exam.closeDate)}</strong></span> : null}
          </div>
        ) : null}
        <ol className="design-round-timeline" aria-label="ลำดับรอบสอบ">
          <li aria-current={exam && roundType === "HEAT" ? "step" : undefined}>Heat</li>
          <li>ประกาศผล Heat</li>
          <li aria-current={exam && roundType === "FINAL" ? "step" : undefined}>Final</li>
          {competition.id === "bbb" ? <li aria-current={roundType === "FINAL_X" ? "step" : undefined}>Final X</li> : null}
        </ol>
      </div>
      {isOpen ? (
        <div className="design-round-action">
          {countdown ? <small>{countdown}</small> : null}
          <button className="home-button home-button-primary" type="button" onClick={roundType === "HEAT" ? onStartApplication : () => navigate("final-confirm")}>
            {roundType === "HEAT" ? "สมัครสอบทันที" : "ตรวจสอบสิทธิ์สมัคร"} <Icon name="arrow" size={15} />
          </button>
        </div>
      ) : null}
    </article>
  );
}

function YearlyRounds({ examCatalog, competitionCatalog, today, onStartApplication, navigate }) {
  const catalogYears = [...new Set(examCatalog.map((exam) => String(exam.year)))].sort((a, b) => Number(b) - Number(a));
  const latestYear = catalogYears[0] || String(Number(today.slice(0, 4)) + 543);
  const years = [...new Set([...catalogYears, latestYear, String(Number(latestYear) - 1)])];
  const [selectedYear, setSelectedYear] = useState(latestYear);
  const [openOnly, setOpenOnly] = useState(false);
  const year = years.includes(selectedYear) ? selectedYear : latestYear;
  const rounds = examCatalog.filter((exam) => String(exam.year) === year);
  const activeCompetitions = competitionCatalog.filter((competition) => competition.active !== false);
  const scheduled = rounds.map((exam) => ({
    exam,
    competition: activeCompetitions.find((item) => item.id === exam.competitionId) || { id: exam.competitionId, name: exam.title },
  }));
  const unscheduled = year === latestYear ? activeCompetitions
    .filter((competition) => !rounds.some((exam) => exam.competitionId === competition.id))
    .map((competition) => ({ competition })) : [];
  const cards = [...scheduled, ...unscheduled].sort((a, b) =>
    Number(Boolean(b.exam?.isOpen)) - Number(Boolean(a.exam?.isOpen))
    || competitionOrder.indexOf(a.competition.id) - competitionOrder.indexOf(b.competition.id));
  const openCount = scheduled.filter(({ exam }) => exam.isOpen).length;
  const visible = openOnly ? cards.filter(({ exam }) => exam?.isOpen) : cards;
  return (
    <section className="design-rounds" id="open-exams" aria-labelledby="open-exams-title">
      <div className="design-rounds-heading">
        <div>
          <p className="design-rounds-kicker"><Icon name="calendar" size={15} /> EXAM ROUNDS · รอบสอบปัจจุบัน</p>
          <h2 id="open-exams-title">รายการสอบตามปี</h2>
          <p>โปรดตรวจสอบรายละเอียดก่อนสมัคร</p>
        </div>
        <label>ปีการศึกษา
          <select value={year} onChange={(event) => setSelectedYear(event.target.value)}>
            {years.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="design-rounds-toolbar">
        <div className="design-round-filters" role="group" aria-label="ตัวกรองรายการสอบ">
          <button type="button" aria-pressed={!openOnly} onClick={() => setOpenOnly(false)}>ทุกรายการ</button>
          <button type="button" aria-pressed={openOnly} onClick={() => setOpenOnly(true)}>เปิดรับสมัคร</button>
        </div>
        <span role="status">{openCount} รายการเปิดรับสมัคร</span>
      </div>
      <div className="design-round-list">
        {visible.length ? visible.map(({ exam, competition }) => (
          <RoundCard key={exam?.id || competition.id} {...{ exam, competition, year, today, onStartApplication, navigate }} />
        )) : (
          <p className="design-round-empty">{openOnly ? "ขณะนี้ไม่มีรายการสอบที่เปิดรับสมัคร" : "ยังไม่มีข้อมูลรอบสอบสำหรับปีการศึกษานี้"}</p>
        )}
      </div>
      <div className="design-final-note">
        <span className="design-tile"><Icon name="award" size={18} /></span>
        <div>
          <strong>ตรวจสอบสิทธิ์สมัครรอบ Final / Final X</strong>
          <p>หลังประกาศผล Heat ผู้ได้เหรียญทอง เงิน หรือทองแดงมีสิทธิ์สมัคร Final ของรายการเดิมในปีเดียวกัน ส่วน BBB ใช้เกณฑ์เฉพาะของรายการ</p>
        </div>
        <button className="home-button home-button-secondary" type="button" onClick={() => navigate("final-confirm")}>ยืนยันสิทธิ์ <Icon name="arrow" size={14} /></button>
      </div>
    </section>
  );
}

export default function HomeDesignPreview({ applications, today, navigate, setPersona, authProfile, onSignIn, onSignOut, onStartApplication, examCatalog, competitionCatalog }) {
  const featuredExam = examCatalog.find((exam) => exam.isOpen) || examCatalog[0];
  return (
    <div className="public-landing public-landing-home home-design-preview">
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหาหลัก</a>
      <PublicPortalHeader page="home" {...{ navigate, setPersona, authProfile, onSignIn, onSignOut }} demoSignIn backendEnabled={false} />
      <main id="landing-main" className="m-0 w-full max-w-none" tabIndex="-1">
        <div className="home-container design-home-content">
          <HomeHero {...{ featuredExam, onStartApplication }} sceneStill={sceneStill} background={<PublicGradientBackground />} onLookup={() => navigate("lookup-choice")} />
          <QuickActions navigate={navigate} />
          {authProfile ? <ActiveApplications {...{ applications, examCatalog, competitionCatalog, today, navigate }} /> : null}
          <YearlyRounds {...{ examCatalog, competitionCatalog, today, onStartApplication, navigate }} />
          <details className="design-guide">
            <summary>ขั้นตอนการสมัคร 3 ขั้นตอน</summary>
            <Journey navigate={navigate} />
          </details>
        </div>
      </main>
      <HomeFooter navigate={navigate} />
    </div>
  );
}
