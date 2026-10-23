import { ExamLogo, Icon } from "../../components/ui/index.jsx";
import { formatThaiDate, getExamRoundType } from "../../examUtils.js";

export function HomeHero({ featuredExam, onStartApplication, onLookup, onShowRounds }) {
  return (
    <section className="landing-gallery-hero relative isolate mt-0 block min-h-[100svh] w-full max-w-none overflow-hidden rounded-none border-0 bg-ocec-background bg-none p-0 shadow-none" aria-labelledby="homepage-title">
      <div className="landing-gallery-hero-inner pointer-events-none relative z-[2] mx-auto w-[calc(100%_-_80px)] max-w-[1280px] pt-[clamp(160px,19svh,210px)] pb-[110px] max-[700px]:w-[calc(100%_-_36px)] max-[700px]:pt-[198px] max-[700px]:pb-[275px] max-[390px]:pt-[195px] max-[390px]:pb-[267px] animate-[public-hero-enter_var(--motion-enter)_var(--motion-ease-out)_both] motion-reduce:animate-none">
        <p className="landing-gallery-kicker mt-0 mb-[19px] flex items-center gap-[14px] text-xs font-semibold tracking-[.08em] text-ocec-brand max-[390px]:flex-wrap max-[390px]:gap-[7px] max-[390px]:text-[10px]">OCEC EXAM PORTAL <span className="h-[2px] w-[30px] rounded-full bg-ocec-accent" /> ปีการศึกษา {featuredExam?.year || "2569"}</p>
        <h1 className="mt-0 mb-[18px] max-w-[780px] text-[clamp(70px,8.4vw,132px)] leading-[1.02] font-medium tracking-[-.055em] text-ocec-brand max-[1050px]:text-[clamp(68px,9vw,100px)] max-[700px]:max-w-full max-[700px]:text-[clamp(59px,12vw,83px)] max-[700px]:leading-[1.12] max-[390px]:text-[55px]" id="homepage-title">ก้าวต่อไป<br />เริ่มที่นี่<span className="refero-title-dot text-ocec-accent">.</span></h1>
        <p className="landing-gallery-lead m-0 max-w-[490px] text-[17px] leading-[1.8] text-ocec-muted max-[700px]:max-w-[430px] max-[700px]:text-[15px]">เลือกวิชาที่สนใจ ตรวจสอบกำหนดการ และสมัครหลายรายการได้ในครั้งเดียว</p>
        <div className="landing-gallery-actions mt-[26px] flex flex-wrap gap-4 max-[700px]:gap-[9px]">
          <button className="landing-gallery-primary pointer-events-auto inline-flex min-h-[60px] min-w-[196px] items-center justify-between gap-[26px] rounded-full px-[9px] py-2 pl-[23px] text-[15px] font-semibold text-ocec-brand shadow-none transition-[transform,background-color,border-color] duration-[220ms] ease-[cubic-bezier(.23,1,.32,1)] active:scale-[.98] motion-reduce:transition-none max-[700px]:min-h-[53px] max-[700px]:min-w-0 max-[700px]:gap-[11px] max-[700px]:p-[6px_6px_6px_14px] max-[700px]:text-xs max-[390px]:text-[11px]" type="button" onClick={onStartApplication}>เริ่มสมัครสอบ <Icon name="arrow" size={17} className="size-[41px] rounded-full p-[11px]" /></button>
          <button className="landing-gallery-secondary pointer-events-auto inline-flex min-h-[60px] min-w-[192px] items-center justify-between gap-[26px] rounded-full px-[9px] py-2 pl-[23px] text-[15px] font-semibold text-ocec-brand shadow-none transition-[transform,background-color,border-color] duration-[220ms] ease-[cubic-bezier(.23,1,.32,1)] active:scale-[.98] motion-reduce:transition-none max-[700px]:min-h-[53px] max-[700px]:min-w-0 max-[700px]:gap-[11px] max-[700px]:p-[6px_6px_6px_14px] max-[700px]:text-xs max-[390px]:text-[11px]" type="button" onClick={onLookup}>ตรวจสอบสถานะ <Icon name="arrow" size={17} className="size-[41px] rounded-full p-[11px]" /></button>
        </div>
        <div className="landing-gallery-assurance mt-[26px] flex flex-wrap gap-x-[23px] gap-y-2 text-xs text-ocec-muted max-[700px]:mt-5 max-[700px]:gap-x-[15px] max-[700px]:gap-y-[5px]"><span className="inline-flex items-center gap-[7px]"><Icon name="check" size={14} />สมัครหลายรายการในครั้งเดียว</span><span className="inline-flex items-center gap-[7px]"><Icon name="check" size={14} />ติดตามใบสมัครได้ตลอด</span></div>
      </div>
      <img className="refero-hero-illustration pointer-events-none absolute right-[max(-52px,calc((100vw_-_1530px)/2))] bottom-[-18px] z-[1] w-[min(58vw,835px)] h-auto object-contain [filter:none] max-[1050px]:right-[-65px] max-[1050px]:w-[58vw] max-[700px]:right-[-35px] max-[700px]:bottom-[-8px] max-[700px]:w-[min(110vw,570px)] max-[390px]:right-[-65px] max-[390px]:w-[120vw]" src="/ocec-exam-paper-cut-indigo.png" alt="ภาพประกอบนักเรียนเตรียมตัวสำหรับการสอบท่ามกลางต้นไม้และดอกไม้" />
      <button className="landing-scene-next absolute bottom-[30px] left-[max(40px,calc((100vw_-_1280px)/2))] z-[3] inline-flex cursor-pointer items-center gap-3 border-0 bg-transparent px-0 py-[6px] text-xs font-semibold text-ocec-brand max-[700px]:hidden" type="button" onClick={onShowRounds}>ดูขั้นตอนและรอบสอบ <Icon name="arrow" size={16} className="rotate-90" /></button>
    </section>
  );
}

export function ExamRounds({ openExams, resultPublished, navigate }) {
  const openExamCount = openExams.length;
  const orderedExams = [...openExams];
  const cardSurfaces = ["bg-white", "bg-[#F8F9FB]", "bg-white", "bg-white"];
  const isEmpty = openExamCount === 0;
  return (
    <section className={`landing-gallery-section relative z-[2] m-0 min-h-[100svh] w-full scroll-mt-0 bg-ocec-background px-[max(40px,calc((100vw_-_1280px)/2))] pt-[clamp(150px,18svh,185px)] pb-[70px] max-[700px]:px-[18px] max-[700px]:pt-[205px] max-[700px]:pb-[55px]${isEmpty ? " is-empty pb-[clamp(70px,9svh,110px)] max-[700px]:pt-[165px] max-[700px]:min-h-0" : ""}`} id="open-exams" aria-labelledby="open-exams-title">
      <div className="landing-gallery-toolbar flex min-h-0 items-center justify-between gap-6 border-0 rounded-none bg-transparent px-[2px] pt-0 pb-[31px] shadow-none max-[700px]:items-start max-[700px]:flex-col max-[700px]:gap-[14px] max-[700px]:pb-[23px]">
        <div><p className="landing-gallery-toolbar-kicker mt-0 mb-[6px] text-xs text-ocec-brand">EXAM ROUNDS · รอบสอบปัจจุบัน</p><h2 className="m-0 text-[clamp(34px,4vw,54px)] leading-[1.2] font-medium tracking-[-.035em] text-ocec-brand max-[700px]:text-[32px]" id="open-exams-title">รอบสอบที่กำลังเปิดรับ</h2><p className="mt-[7px] mb-0 text-sm text-ocec-muted">{openExamCount ? "ตรวจสอบข้อมูลสำคัญก่อนเลือกสมัคร" : "เมื่อเปิดรับสมัคร รายการสอบและกำหนดการจะแสดงที่นี่"}</p></div>
        <div className="landing-gallery-summary flex flex-none items-center gap-3"><span className={`landing-gallery-open-count inline-flex items-center gap-[7px] rounded-full px-[15px] py-[10px] text-xs font-semibold whitespace-nowrap text-ocec-brand bg-ocec-brand-soft${openExamCount ? "" : " is-empty text-ocec-muted bg-[#F8F9FB]"}`}><i className={`size-[7px] flex-none rounded-full bg-ocec-brand${openExamCount ? "" : " bg-ocec-muted"}`} />{openExamCount} รายการเปิดรับ</span></div>
      </div>
      {orderedExams.length === 0 ? <div className="landing-gallery-empty relative grid min-h-[178px] grid-cols-[62px_minmax(0,1fr)_auto] items-center gap-[21px] overflow-hidden rounded-[42px] border border-ocec-border bg-white p-8 max-[950px]:grid-cols-[62px_minmax(0,1fr)] max-[700px]:grid-cols-[50px_minmax(0,1fr)] max-[700px]:gap-[14px] max-[700px]:rounded-[27px] max-[700px]:p-[21px] max-[700px]:min-h-0">
        <span className="landing-gallery-empty-icon relative z-[1] grid size-[62px] flex-none place-items-center rounded-[20px] bg-ocec-brand-soft text-ocec-brand max-[700px]:size-[50px]"><Icon name="calendar" size={26} /></span>
        <div className="landing-gallery-empty-copy relative z-[1] col-start-2 max-w-[470px]"><strong className="block text-[20px] text-ocec-brand max-[700px]:text-[17px]">ยังไม่มีรอบสอบที่เปิดรับ</strong><p className="mt-[7px] mb-0 text-[13px] leading-[1.65] text-ocec-muted">เมื่อมีรอบใหม่ รายการสอบและกำหนดการจะแสดงที่นี่ ระหว่างนี้ดูขั้นตอนสมัครหรือตรวจสอบใบสมัครเดิมได้</p></div>
        <div className="landing-gallery-empty-actions relative z-[1] flex flex-col gap-[9px] max-[950px]:col-start-2 max-[950px]:flex-row max-[950px]:flex-wrap max-[700px]:col-span-full">
          <a className="inline-flex min-h-11 items-center justify-between gap-[18px] rounded-full border border-ocec-border bg-white px-4 py-2 text-[13px] font-semibold text-ocec-brand no-underline whitespace-nowrap transition-[background-color,border-color,transform] duration-[180ms] motion-reduce:transition-none" href="#how-to-apply">ดูขั้นตอนสมัคร <Icon name="arrow" size={15} /></a>
          <button className="inline-flex min-h-11 items-center justify-between gap-[18px] rounded-full border border-ocec-brand bg-ocec-brand px-4 py-2 text-[13px] font-semibold text-white whitespace-nowrap transition-[background-color,border-color,transform] duration-[180ms] motion-reduce:transition-none" type="button" onClick={() => navigate("lookup-choice")}>ตรวจสอบสถานะ <Icon name="arrow" size={15} /></button>
        </div>
      </div> : <div className="landing-gallery-grid grid grid-cols-3 items-stretch gap-5 mt-0 max-[1050px]:grid-cols-2 max-[700px]:grid-cols-1 max-[700px]:gap-3" aria-label="รายการสอบที่เปิดรับ">
        {orderedExams.map((exam, index) => {
          const roundType = getExamRoundType(exam);
          const surfaceClass = cardSurfaces[index % cardSurfaces.length];
          return <article className={`landing-gallery-card exam-card-${exam.accent}${exam.isOpen ? "" : " is-upcoming"} relative flex min-h-[328px] min-w-0 flex-col overflow-hidden rounded-[42px] border border-[#E9DDEA] p-[30px] shadow-none transition-[transform,border-color] duration-[240ms] ease-[cubic-bezier(.23,1,.32,1)] motion-reduce:transition-none max-[700px]:min-h-0 max-[700px]:rounded-[28px] max-[700px]:p-6 ${surfaceClass}`} key={exam.id} style={{ "--exam-entrance-delay": `${Math.min(index, 8) * 110}ms` }}>
            <div className="landing-gallery-card-top flex items-start justify-between gap-[10px]"><ExamLogo exam={exam} className="landing-gallery-exam-mark grid size-[55px] flex-none place-items-center overflow-hidden rounded-[18px] bg-ocec-brand-soft text-ocec-brand" iconSize={22} /><span className={`landing-gallery-status inline-flex max-w-[70%] items-center justify-end gap-[7px] rounded-full px-[9px] py-[7px] text-right text-[10px] font-semibold leading-[1.35]${exam.isOpen ? " is-open whitespace-nowrap text-ocec-brand bg-ocec-brand-soft" : " text-ocec-muted bg-[#F8F9FB]"}`}><i className={`size-[6px] flex-none rounded-full ${exam.isOpen ? "bg-ocec-accent" : "bg-ocec-muted"}`} />{exam.isOpen ? "เปิดรับสมัคร" : exam.finalRegistrationStatus === "waiting-results" ? "รอประกาศผล HEAT" : exam.finalRegistrationStatus === "no-eligible-applicants" ? "ไม่มีผู้มีสิทธิ์ Final" : exam.finalRegistrationStatus === "closed-manual" ? "ปิดรับสมัครโดยแอดมิน" : exam.finalRegistrationStatus === "closed-deadline" ? "ปิดรับสมัครแล้ว" : "ยังไม่เปิดรับ"}</span></div>
            <p className="landing-gallery-card-round mt-[31px] mb-1 text-[11px] font-semibold tracking-[.045em] text-ocec-brand max-[700px]:mt-[22px]">{roundType === "HEAT" ? "HEAT ROUND · รอบคัดเลือก" : roundType === "FINAL" ? "FINAL ROUND · รอบชิงชนะเลิศ" : roundType === "FINAL_X" ? "FINAL X · รอบสอบ" : `${exam.round || roundType} · รอบสอบ`}</p>
            <h3 className="m-0 mb-1 text-[clamp(26px,2.7vw,38px)] leading-[1.27] font-medium tracking-[-.025em] text-ocec-brand max-[700px]:text-[27px]">{exam.title}</h3>
            <p className="landing-gallery-card-description m-0 mb-6 text-[13px] leading-[1.55] text-ocec-muted">{exam.description || `ปีการศึกษา ${exam.year}`}</p>
            <div className="landing-gallery-dates mt-auto grid grid-cols-2 gap-0 border-t border-ocec-border"><div className="min-w-0 rounded-none bg-transparent pt-[15px] pr-4"><small className="mb-[3px] block text-[10px] text-ocec-muted">วันสอบ</small><strong className="block text-xs font-semibold text-ocec-brand [overflow-wrap:anywhere]">{formatThaiDate(exam.examDate)}</strong></div><div className="min-w-0 rounded-none bg-transparent pt-[15px] pr-4"><small className="mb-[3px] block text-[10px] text-ocec-muted">ปิดรับสมัคร</small><strong className="block text-xs font-semibold text-ocec-brand [overflow-wrap:anywhere]">{formatThaiDate(exam.closeDate)}</strong></div></div>
            <div className="landing-gallery-card-foot mt-[19px] flex items-center justify-between gap-3 border-t border-ocec-border pt-[14px] text-[11px] text-ocec-muted"><span>ปีการศึกษา {exam.year}</span><span className="text-right font-semibold text-ocec-brand">{exam.isOpen ? "สมัครได้ในฟอร์มเดียว" : "ติดตามประกาศ"}</span></div>
          </article>;
        })}
      </div>}
      <Journey />
      {resultPublished ? <FinalOpportunity navigate={navigate} /> : null}
    </section>
  );
}

export function Journey() {
  return (
    <div className="landing-journey mt-[26px] grid grid-cols-[minmax(215px,.8fr)_minmax(0,2fr)] gap-[30px] scroll-mt-[130px] rounded-[30px] border border-ocec-border bg-white px-[31px] py-[27px] shadow-[0_16px_38px_rgba(58,15,52,.035)] max-[950px]:grid-cols-1 max-[950px]:gap-[22px] max-[700px]:gap-[18px] max-[700px]:rounded-[27px] max-[700px]:p-[23px]" id="how-to-apply" aria-labelledby="how-to-apply-title">
      <div className="landing-journey-intro self-center"><span className="text-[10px] font-bold tracking-[.09em] text-[#3A0F34]">YOUR JOURNEY · ขั้นตอนการสมัคร</span><h3 className="mt-[7px] mb-1 text-[clamp(19px,2vw,26px)] leading-[1.3] font-semibold text-ocec-brand">เริ่มต้นได้ใน 3 ขั้นตอน</h3><p className="m-0 max-w-[270px] text-[13px] leading-[1.6] text-ocec-muted max-[950px]:max-w-none">เตรียมตัวให้พร้อมก่อนเปิดรับสมัคร แล้วกลับมาติดตามใบสมัครได้ทุกเมื่อ</p></div>
      <ol className="landing-journey-list m-0 grid list-none grid-cols-3 items-stretch p-0 max-[700px]:grid-cols-1 max-[700px]:gap-0">
        <li className="grid min-w-0 content-start gap-[10px] border-l border-[#E6E4E8] px-[19px] py-[2px] max-[950px]:first:border-l-0 max-[950px]:first:pl-0 max-[700px]:grid-cols-[37px_minmax(0,1fr)] max-[700px]:items-center max-[700px]:gap-[14px] max-[700px]:border-t max-[700px]:border-l-0 max-[700px]:py-[13px] max-[700px]:first:border-t-0"><span className="landing-journey-number grid size-[37px] place-items-center rounded-xl border border-[#EBD99E] bg-[#FFF7DC] text-[11px] font-bold text-ocec-brand">01</span><div><strong className="text-sm text-ocec-brand">เลือกรอบสอบ</strong><p className="mt-[3px] mb-0 text-xs leading-[1.55] text-ocec-muted">ดูวันสอบและวันปิดรับ ก่อนเลือกวิชาที่สนใจ</p></div></li>
        <li className="grid min-w-0 content-start gap-[10px] border-l border-[#E6E4E8] px-[19px] py-[2px] max-[700px]:grid-cols-[37px_minmax(0,1fr)] max-[700px]:items-center max-[700px]:gap-[14px] max-[700px]:border-t max-[700px]:border-l-0 max-[700px]:py-[13px]"><span className="landing-journey-number grid size-[37px] place-items-center rounded-xl border border-[#EBD99E] bg-[#FFF7DC] text-[11px] font-bold text-ocec-brand">02</span><div><strong className="text-sm text-ocec-brand">กรอกใบสมัคร</strong><p className="mt-[3px] mb-0 text-xs leading-[1.55] text-ocec-muted">เข้าสู่ระบบและส่งข้อมูลผ่านฟอร์มสมัครสอบ</p></div></li>
        <li className="grid min-w-0 content-start gap-[10px] border-l border-[#E6E4E8] px-[19px] py-[2px] max-[700px]:grid-cols-[37px_minmax(0,1fr)] max-[700px]:items-center max-[700px]:gap-[14px] max-[700px]:border-t max-[700px]:border-l-0 max-[700px]:py-[13px]"><span className="landing-journey-number grid size-[37px] place-items-center rounded-xl border border-[#EBD99E] bg-[#FFF7DC] text-[11px] font-bold text-ocec-brand">03</span><div><strong className="text-sm text-ocec-brand">ติดตามสถานะ</strong><p className="mt-[3px] mb-0 text-xs leading-[1.55] text-ocec-muted">ตรวจความคืบหน้าและแก้ไขข้อมูลเมื่อจำเป็น</p></div></li>
      </ol>
    </div>
  );
}

function FinalOpportunity({ navigate }) {
  return (
    <button className="final-opportunity-link mt-[15px] flex min-h-[73px] w-full items-center gap-3 rounded-xl border border-[#dcebe0] px-[14px] py-[11px] text-left text-[#38634b] bg-[#f6fbf6]" onClick={() => navigate("final-confirm")}>
      <span className="final-opportunity-icon grid size-[39px] flex-none place-items-center rounded-[11px] bg-[#e2f4e8] text-[#217249]"><Icon name="award" /></span>
      <span><strong>ผ่าน OCEC Heat แล้วใช่ไหม?</strong><small>ตรวจสอบสิทธิ์และขั้นตอนสมัคร OCEC Final</small></span>
      <Icon name="arrow" size={17} />
    </button>
  );
}
