import { Button, Icon, PageHeading } from "../../components/ui/index.jsx";
import { routeUrlFor } from "../../routes.js";
import { getApplicationCompetitionFormat } from "../applications/applicationUtils.js";

export function AdminHomePage({ applications, examCatalog, resultWorkflows, navigate, resultPublished, backendEnabled }) {
  const pendingPaymentsFor = (item) => (item.paymentRecords || []).filter((payment) => payment.status === "pending");
  const pendingApps = applications.filter((item) => item.status === "pending" || pendingPaymentsFor(item).length);
  const confirmedApps = applications.filter((item) => item.status === "confirmed");
  const heatApps = applications.filter((item) => item.kind === "Heat");
  const finalApps = applications.filter((item) => item.kind === "Final");
  const issueApps = applications.filter((item) => item.slipIssue);
  const resultIssueCount = Object.values(resultWorkflows || {}).reduce((count, workflow) => count + ((workflow.rows || []).filter((row) => row.matchStatus !== "matched").length || Number(workflow.hasConflict && !workflow.conflictResolved)), 0);
  const finalIdsWaiting = finalApps.filter((item) => !item.finalId).length;
  const openRounds = examCatalog.filter((item) => item.isOpen);
  const paperlessCount = applications.filter((item) => (item.competitions || []).some((competition) => getApplicationCompetitionFormat(item, competition) === "Online")).length;
  const competitionCounts = applications.reduce((counts, item) => {
    (item.competitions || []).forEach((competition) => { counts[competition.short || competition.name] = (counts[competition.short || competition.name] || 0) + 1; });
    return counts;
  }, {});
  const tasks = [
    { id: "admin-review", icon: "file", tone: "amber", title: "คิวตรวจสลิป", detail: `${pendingApps.length} ใบสมัคร · เปิดคิวเพื่อตรวจและยืนยัน`, count: pendingApps.length },
    { id: "admin-results", icon: "info", tone: "violet", title: "รายการผลสอบที่ต้องตรวจ", detail: resultIssueCount ? `${resultIssueCount} รายการจากฉบับร่าง · กดเพื่อตรวจสอบก่อนประกาศ` : "ยังไม่มีรายการจากผลสอบที่ต้องตรวจ", count: resultIssueCount },
    { id: "admin-results", icon: "award", tone: "violet", title: resultPublished ? "ดูผลสอบที่ประกาศแล้ว" : "เตรียมผลสอบ", detail: resultPublished ? "ประกาศแล้ว · ข้อมูลผลสอบล็อก" : "เลือกรายการและรอบ นำเข้าฉบับร่างเพื่อตรวจสอบ", count: resultPublished ? 0 : 1 },
    { id: "admin-final-ids", icon: "users", tone: "blue", title: "นำเข้าเลขประจำตัว Final", detail: `${finalIdsWaiting} รายการยังไม่มีเลข`, count: finalIdsWaiting },
    { id: "admin-sheets", icon: "sync", tone: "blue", title: "คิวอีเมลและ Google Sheets", detail: "ตรวจสถานะงานจริงและเริ่มงานที่ล้มเหลวใหม่", count: "↗" },
  ];
  const byYear = Object.values(examCatalog.reduce((groups, item) => {
    groups[item.year] ||= { year: item.year, total: 0, open: 0 };
    groups[item.year].total += 1;
    groups[item.year].open += item.isOpen ? 1 : 0;
    return groups;
  }, {}));
  const totalDue = pendingApps.reduce((sum, item) => {
    const payments = pendingPaymentsFor(item);
    return sum + (payments.length
      ? payments.reduce((paymentSum, payment) => paymentSum + Number(payment.expectedAmount || 0), 0)
      : Number(item.totalPayment || 0));
  }, 0);
  const pendingStatusCount = applications.filter((item) => item.status === "pending").length;
  const otherStatusCount = Math.max(0, applications.length - confirmedApps.length - pendingStatusCount);
  const confirmedPercent = applications.length ? Math.round(confirmedApps.length / applications.length * 100) : 0;
  const confirmedSlice = applications.length ? confirmedApps.length / applications.length * 100 : 0;
  const pendingSlice = applications.length ? pendingStatusCount / applications.length * 100 : 0;
  const competitionLeaders = Object.entries(competitionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const largestCompetition = competitionLeaders[0]?.[1] || 1;
  const openAdminPage = (event, target) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigate(target);
  };

  return (
    <div className="page-stack admin-home-page gap-5 [&_.eyebrow]:text-[11px] [&_.eyebrow]:tracking-[.105em] [&_.eyebrow]:text-[#3A0F34] [&_.section-heading_h2]:text-[19px] [&_.section-heading_h2]:text-[#202027] [&_.page-description]:text-[#75747c]">
      <div className="admin-home-intro grid gap-[17px]">
        <PageHeading className="!mb-0 !min-h-0 !p-0 [&::before]:hidden [&_h1]:mt-1 [&_h1]:text-[clamp(27px,2.5vw,36px)] [&_h1]:font-semibold [&_h1]:tracking-normal [&_h1]:text-ocec-brand [&_.eyebrow]:text-[#3A0F34] [&_.page-description]:text-[#75747c] max-[600px]:items-start [&_.heading-action_.button]:w-full [&_.heading-action_.button]:justify-center" eyebrow={backendEnabled ? "OCEC WORKSPACE · ข้อมูลจริง" : "OCEC WORKSPACE · โหมดตัวอย่าง"} title="ภาพรวมแอดมิน" description="ติดตามใบสมัคร คิวตรวจ และความพร้อมของรอบสอบในที่เดียว" action={<Button icon="calendar" onClick={() => navigate("admin-round")}>จัดการรายการสอบ</Button>} />
        <nav className="admin-home-nav flex w-fit max-w-full gap-[3px] overflow-x-auto rounded-full border border-[#ecebee] bg-white p-[5px] shadow-[0_5px_18px_rgba(35,28,35,.035)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="ทางลัดหน้าแอดมิน">
          <a href={routeUrlFor("admin-home")} className="active inline-flex min-h-9 shrink-0 items-center rounded-full bg-ocec-brand px-[17px] text-xs font-medium text-white no-underline whitespace-nowrap" aria-current="page">ภาพรวม</a>
          <a href={routeUrlFor("admin-review")} className="inline-flex min-h-9 shrink-0 items-center rounded-full px-[17px] text-xs font-medium text-[#77747b] no-underline whitespace-nowrap hover:bg-[#f7f6f7] hover:text-[#29252a]" onClick={(event) => openAdminPage(event, "admin-review")}>ตรวจใบสมัคร</a>
          <a href={routeUrlFor("admin-round")} className="inline-flex min-h-9 shrink-0 items-center rounded-full px-[17px] text-xs font-medium text-[#77747b] no-underline whitespace-nowrap hover:bg-[#f7f6f7] hover:text-[#29252a]" onClick={(event) => openAdminPage(event, "admin-round")}>รอบสอบ</a>
          <a href={routeUrlFor("admin-results")} className="inline-flex min-h-9 shrink-0 items-center rounded-full px-[17px] text-xs font-medium text-[#77747b] no-underline whitespace-nowrap hover:bg-[#f7f6f7] hover:text-[#29252a]" onClick={(event) => openAdminPage(event, "admin-results")}>ผลสอบ</a>
          <a href={routeUrlFor("admin-sheets")} className="inline-flex min-h-9 shrink-0 items-center rounded-full px-[17px] text-xs font-medium text-[#77747b] no-underline whitespace-nowrap hover:bg-[#f7f6f7] hover:text-[#29252a]" onClick={(event) => openAdminPage(event, "admin-sheets")}>คิวระบบ</a>
        </nav>
      </div>
      <section className="admin-home-hero grid min-h-[238px] grid-cols-[minmax(0,1.5fr)_minmax(260px,.62fr)] items-center gap-[22px] rounded-[28px] px-[clamp(25px,3.2vw,48px)] py-[30px] text-white max-[800px]:grid-cols-1 max-[800px]:gap-[18px] max-[800px]:rounded-[23px] max-[800px]:px-[21px] max-[800px]:py-6" aria-labelledby="admin-home-hero-title">
        <div className="admin-hero-main max-w-[560px]">
          <span className="admin-hero-kicker inline-flex items-center gap-[7px] rounded-full border border-white/30 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold"> <Icon name="sparkle" size={15} /> ภาพรวมการรับสมัคร</span>
          <h2 className="mb-[7px] mt-[15px] text-[clamp(26px,2.75vw,39px)] font-semibold leading-[1.23] tracking-normal" id="admin-home-hero-title">ทุกงานสำคัญ<br />อยู่ในมุมมองเดียว</h2>
          <p className="m-0 max-w-[500px] text-[13px] leading-[1.65] text-white/85">เริ่มจากคิวที่ต้องดำเนินการ แล้วติดตามความคืบหน้าของใบสมัครและรอบสอบ</p>
          <button type="button" className="admin-hero-action mt-[19px] inline-flex min-h-[38px] items-center gap-3 rounded-full bg-white px-[15px] text-xs font-semibold text-[#303038] hover:bg-[#fff5f0]" onClick={() => navigate("admin-review")}>เปิดคิวตรวจใบสมัคร <Icon name="arrow" size={15} /></button>
        </div>
        <div className="admin-hero-progress grid max-w-[380px] gap-[7px] rounded-[22px] border border-white/30 bg-white/15 px-[21px] py-5 backdrop-blur-[9px]">
          <span className="text-xs text-white/90">ใบสมัครที่ยืนยันแล้ว</span>
          <strong className="font-portal text-[clamp(37px,4vw,57px)] font-medium leading-none tabular-nums">{confirmedPercent}<small className="text-[.43em]">%</small></strong>
          <div className="admin-hero-track h-[7px] overflow-hidden rounded-full bg-white/30" role="progressbar" aria-label="สัดส่วนใบสมัครที่ยืนยันแล้ว" aria-valuenow={confirmedPercent} aria-valuemin={0} aria-valuemax={100}><span className="block h-full rounded-full bg-white transition-[width] duration-[400ms]" style={{ width: `${confirmedPercent}%` }} /></div>
          <small className="text-[11px] text-white/85">{confirmedApps.length.toLocaleString("th-TH")} จาก {applications.length.toLocaleString("th-TH")} ใบสมัคร</small>
        </div>
      </section>
      <div className="admin-stat-grid grid grid-cols-4 gap-[14px] max-[1250px]:grid-cols-2 max-[600px]:gap-[9px] max-[420px]:grid-cols-1">
        <div className="admin-stat-card relative block min-h-[150px] rounded-[23px] border border-[#efedf0] bg-white p-[22px_22px_18px] shadow-[0_12px_36px_rgba(38,32,37,.035)] [&::before]:hidden max-[600px]:min-h-[143px] max-[600px]:rounded-[17px] max-[600px]:p-[15px_13px_32px] max-[420px]:min-h-[125px]"><span className="admin-stat-icon stat-blue absolute right-[19px] top-[19px] grid size-9 place-items-center rounded-[13px] max-[600px]:right-[11px] max-[600px]:top-3 max-[600px]:size-[29px]"><Icon name="file" /></span><div className="grid min-w-0 gap-[3px] pr-10 max-[600px]:pr-[21px]"><span className="text-xs text-[#77747b]">ใบสมัครทั้งหมด</span><strong className="mb-0 mt-[5px] text-[34px] font-semibold leading-[1.16] text-[#202027] tabular-nums max-[600px]:text-[27px]">{applications.length}</strong><small className="text-[11px] text-[#8c8990]">Heat {heatApps.length} · Final {finalApps.length}</small></div><span className="stat-ok absolute bottom-[15px] right-[18px] inline-flex items-center gap-1 text-[11px] text-[#297755] max-[600px]:bottom-2 max-[600px]:right-[11px]"><Icon name="users" size={13} />{applications.filter((item) => item.source === "school").length} ผ่านโรงเรียน</span></div>
        <div className="admin-stat-card relative block min-h-[150px] rounded-[23px] border border-[#efedf0] bg-white p-[22px_22px_18px] shadow-[0_12px_36px_rgba(38,32,37,.035)] [&::before]:hidden max-[600px]:min-h-[143px] max-[600px]:rounded-[17px] max-[600px]:p-[15px_13px_32px] max-[420px]:min-h-[125px]"><span className="admin-stat-icon stat-amber absolute right-[19px] top-[19px] grid size-9 place-items-center rounded-[13px] max-[600px]:right-[11px] max-[600px]:top-3 max-[600px]:size-[29px]"><Icon name="clock" /></span><div className="grid min-w-0 gap-[3px] pr-10 max-[600px]:pr-[21px]"><span className="text-xs text-[#77747b]">รอตรวจสลิป</span><strong className="mb-0 mt-[5px] text-[34px] font-semibold leading-[1.16] text-[#202027] tabular-nums max-[600px]:text-[27px]">{pendingApps.length}</strong><small className="text-[11px] text-[#8c8990]">ยอดรอตรวจ ฿{totalDue.toLocaleString()}</small></div><button className="stat-link absolute bottom-[15px] right-[18px] inline-flex min-h-[29px] items-center gap-1 bg-transparent px-[5px] text-[11px] font-semibold text-[#3A0F34] max-[600px]:bottom-2 max-[600px]:right-[11px]" onClick={() => navigate("admin-review")}>เปิดคิว <Icon name="arrow" size={14} /></button></div>
        <div className="admin-stat-card relative block min-h-[150px] rounded-[23px] border border-[#efedf0] bg-white p-[22px_22px_18px] shadow-[0_12px_36px_rgba(38,32,37,.035)] [&::before]:hidden max-[600px]:min-h-[143px] max-[600px]:rounded-[17px] max-[600px]:p-[15px_13px_32px] max-[420px]:min-h-[125px]"><span className="admin-stat-icon stat-green absolute right-[19px] top-[19px] grid size-9 place-items-center rounded-[13px] max-[600px]:right-[11px] max-[600px]:top-3 max-[600px]:size-[29px]"><Icon name="check" /></span><div className="grid min-w-0 gap-[3px] pr-10 max-[600px]:pr-[21px]"><span className="text-xs text-[#77747b]">ยืนยันใบสมัครแล้ว</span><strong className="mb-0 mt-[5px] text-[34px] font-semibold leading-[1.16] text-[#202027] tabular-nums max-[600px]:text-[27px]">{confirmedApps.length}</strong><small className="text-[11px] text-[#8c8990]">พร้อมส่งข้อมูลเข้าชีต</small></div><span className="stat-ok absolute bottom-[15px] right-[18px] inline-flex items-center gap-1 text-[11px] text-[#297755] max-[600px]:bottom-2 max-[600px]:right-[11px]"><Icon name="check" size={13} />{applications.length ? Math.round(confirmedApps.length / applications.length * 100) : 0}%</span></div>
        <div className="admin-stat-card relative block min-h-[150px] rounded-[23px] border border-[#efedf0] bg-white p-[22px_22px_18px] shadow-[0_12px_36px_rgba(38,32,37,.035)] [&::before]:hidden max-[600px]:min-h-[143px] max-[600px]:rounded-[17px] max-[600px]:p-[15px_13px_32px] max-[420px]:min-h-[125px]"><span className="admin-stat-icon stat-violet absolute right-[19px] top-[19px] grid size-9 place-items-center rounded-[13px] max-[600px]:right-[11px] max-[600px]:top-3 max-[600px]:size-[29px]"><Icon name="calendar" /></span><div className="grid min-w-0 gap-[3px] pr-10 max-[600px]:pr-[21px]"><span className="text-xs text-[#77747b]">รอบที่เปิดรับ</span><strong className="mb-0 mt-[5px] text-[34px] font-semibold leading-[1.16] text-[#202027] tabular-nums max-[600px]:text-[27px]">{openRounds.length}</strong><small className="text-[11px] text-[#8c8990]">จากทั้งหมด {examCatalog.length} รายการ</small></div><button className="stat-link absolute bottom-[15px] right-[18px] inline-flex min-h-[29px] items-center gap-1 bg-transparent px-[5px] text-[11px] font-semibold text-[#3A0F34] max-[600px]:bottom-2 max-[600px]:right-[11px]" onClick={() => navigate("admin-round")}>จัดการ <Icon name="arrow" size={14} /></button></div>
      </div>
      <div className="admin-insight-grid grid grid-cols-2 gap-[14px] max-[1050px]:grid-cols-1">
        <section className="surface admin-insight-card min-h-[290px] rounded-[24px] border border-[#efedf0] p-[21px_23px] shadow-[0_12px_36px_rgba(38,32,37,.035)] max-[600px]:min-h-0 max-[600px]:p-[18px_16px]" aria-labelledby="admin-status-title">
          <div className="section-heading"><div><p className="eyebrow">APPLICATION ANALYTICS</p><h2 id="admin-status-title">สถานะใบสมัคร</h2></div><span className="admin-insight-total">ทั้งหมด {applications.length.toLocaleString("th-TH")}</span></div>
          <div className="admin-status-body flex items-center justify-around gap-[26px] py-3 max-[600px]:gap-[15px]">
            <div className="admin-status-chart grid size-[178px] shrink-0 place-items-center rounded-full max-[600px]:size-[136px]" role="img" aria-label={`ยืนยันแล้ว ${confirmedApps.length} รอตรวจ ${pendingStatusCount} สถานะอื่น ${otherStatusCount}`} style={{ background: applications.length ? `conic-gradient(#FF2D95 0 ${confirmedSlice}%, #3A0F34 ${confirmedSlice}% ${confirmedSlice + pendingSlice}%, #CBD0D5 ${confirmedSlice + pendingSlice}% 100%)` : "#CBD0D5" }}><div className="grid size-[132px] content-center justify-items-center rounded-full bg-white max-[600px]:size-[102px]"><strong className="text-[30px] font-semibold leading-[1.2] text-[#202027] tabular-nums max-[600px]:text-2xl">{applications.length.toLocaleString("th-TH")}</strong><span className="text-[11px] text-[#928e95]">ใบสมัคร</span></div></div>
            <div className="admin-status-legend grid min-w-[140px] flex-1 gap-[15px] max-[600px]:min-w-0"><div className="flex items-center gap-2 text-xs text-[#77747b]"><i className="status-confirmed-dot size-[9px] shrink-0 rounded-full bg-[#FF2D95]" /><span>ยืนยันแล้ว</span><strong className="ml-auto text-[13px] font-semibold text-[#202027]">{confirmedApps.length.toLocaleString("th-TH")}</strong></div><div className="flex items-center gap-2 text-xs text-[#77747b]"><i className="status-pending-dot size-[9px] shrink-0 rounded-full bg-[#3A0F34]" /><span>รอตรวจ</span><strong className="ml-auto text-[13px] font-semibold text-[#202027]">{pendingStatusCount.toLocaleString("th-TH")}</strong></div><div className="flex items-center gap-2 text-xs text-[#77747b]"><i className="status-other-dot size-[9px] shrink-0 rounded-full bg-[#CBD0D5]" /><span>สถานะอื่น</span><strong className="ml-auto text-[13px] font-semibold text-[#202027]">{otherStatusCount.toLocaleString("th-TH")}</strong></div></div>
          </div>
        </section>
        <section className="surface admin-insight-card min-h-[290px] rounded-[24px] border border-[#efedf0] p-[21px_23px] shadow-[0_12px_36px_rgba(38,32,37,.035)] max-[600px]:min-h-0 max-[600px]:p-[18px_16px]" aria-labelledby="admin-competition-title">
          <div className="section-heading"><div><p className="eyebrow">TOP COMPETITIONS</p><h2 id="admin-competition-title">รายการสอบที่เลือกมากที่สุด</h2></div><Icon name="grid" size={18} /></div>
          {competitionLeaders.length ? <div className="admin-competition-bars mt-[19px] grid gap-[14px]">{competitionLeaders.map(([name, count]) => <div className="admin-competition-bar" key={name}><div className="flex justify-between gap-[15px] text-xs text-[#68656d]"><span className="overflow-hidden text-ellipsis whitespace-nowrap" title={name}>{name}</span><strong className="text-xs font-semibold text-[#2c292e]">{count.toLocaleString("th-TH")}</strong></div><div className="admin-bar-track mt-[7px] h-[7px] overflow-hidden rounded-full bg-[#f0edef]"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#fa9a6c,#f16b40)]" style={{ width: `${count / largestCompetition * 100}%` }} /></div></div>)}</div> : <p className="admin-insight-empty mb-0 mt-[52px] text-center text-[13px] text-[#8b8790]">ยังไม่มีข้อมูลรายการสอบ</p>}
        </section>
      </div>
      <div className="admin-home-grid grid grid-cols-[minmax(0,1.2fr)_minmax(330px,1fr)] gap-[14px] max-[1050px]:grid-cols-1">
        <section className="surface admin-queue-card rounded-[24px] border border-[#efedf0] p-[23px] shadow-[0_12px_36px_rgba(38,32,37,.035)] max-[600px]:p-[18px_16px]">
          <div className="section-heading"><div><p className="eyebrow">คิวงาน</p><h2>รายการที่ต้องดำเนินการ</h2></div><Button variant="text" icon="arrow" onClick={() => navigate("admin-review")}>เปิดคิวตรวจ</Button></div>
          {tasks.length ? <div className="admin-task-list mt-[11px] grid">{tasks.map((task) => (
            <button className="flex min-h-16 items-center gap-2.5 border-0 border-t border-[#edf0f4] bg-transparent px-0.5 py-2 text-left hover:bg-[#faf8f8]" key={task.title} onClick={() => navigate(task.id, task.targetId)}><span className={`task-icon task-${task.tone} grid size-[34px] shrink-0 place-items-center rounded-[9px]`}><Icon name={task.icon} /></span><span className="flex min-w-0 flex-1 flex-col gap-[3px]"><strong className="text-xs text-[#302d32]">{task.title}</strong><small className="text-xs text-[#8c8990]">{task.detail}</small></span><span className="task-count grid size-[25px] shrink-0 place-items-center rounded-[7px] bg-[#fff3d5] text-xs text-[#765518]">{String(task.count).padStart(2, "0")}</span></button>
          ))}</div> : <div className="admin-clear-state"><span><Icon name="check" /></span><div><strong>ไม่มีงานค้าง</strong><small>คิวตรวจสอบและงานหลังสอบเรียบร้อยแล้ว</small></div></div>}
        </section>
        <section className="surface round-status-card rounded-[24px] border border-[#efedf0] p-[23px] shadow-[0_12px_36px_rgba(38,32,37,.035)] max-[600px]:p-[18px_16px]">
          <div className="section-heading"><div><p className="eyebrow">รายการสอบ</p><h2>สถานะรับสมัคร</h2></div><span className={openRounds.length ? "schedule-open" : "closed-badge"}>{openRounds.length ? `เปิด ${openRounds.length} รายการ` : "ปิดรับสมัคร"}</span></div>
          <div className="admin-round-summary-list">{byYear.map((group) => <div className="admin-round-summary flex items-center justify-between gap-3 rounded-[15px] bg-[#faf9fa] p-3" key={group.year}><div><strong>รายการสอบปี {group.year}</strong><small>{group.open} รอบเปิดรับ · รวม {group.total} การ์ด</small></div><span>{group.open ? <i className="online-dot" /> : <i className="offline-dot" />}{group.open ? "เปิด" : "รอเปิด"}</span></div>)}</div>
          <div className="round-status-rows"><div><span><Icon name="users" />ใบสมัครออนไลน์</span><strong>{paperlessCount} รายการ</strong></div><div><span><Icon name="grid" />ผลสอบ Heat</span><strong>{resultPublished ? "ประกาศแล้ว" : "รอเตรียมฉบับร่าง"}</strong></div><div><span><Icon name="building" />ศูนย์สอบ</span><strong>{examCatalog.some((item) => item.isOpen) ? "ล็อกตามรอบที่เปิด" : "แก้ไขได้"}</strong></div></div>
          <Button variant="outline" className="button-full" onClick={() => navigate("admin-round")}>ตั้งค่ารอบสอบและศูนย์</Button>
        </section>
      </div>
      <section className="surface admin-exception-queue rounded-[24px] border border-[#efedf0] p-[23px] shadow-[0_12px_36px_rgba(38,32,37,.035)] max-[600px]:p-[18px_16px]"><div className="section-heading"><div><p className="eyebrow">ต้องติดตามเป็นพิเศษ</p><h2>คิวปัญหาใบสมัคร</h2></div><span className="conflict-count">{issueApps.length} รายการ</span></div>{issueApps.length ? <div className="admin-exception-list">{issueApps.map((item) => <button type="button" className="admin-exception-row" key={item.id} onClick={() => navigate("admin-review", item.id)}><span className="task-icon task-amber"><Icon name="file" /></span><span><strong>{item.candidate}</strong><small>{item.exam} · {item.school}</small><em>{item.slipIssue}</em></span><span>เปิดใบสมัคร <Icon name="arrow" size={14} /></span></button>)}</div> : <div className="admin-clear-state"><span><Icon name="check" /></span><div><strong>ไม่มีใบสมัครที่มีปัญหา</strong><small>ความผิดปกติของชื่อโรงเรียนในไฟล์ผลสอบจะแสดงในหน้านำเข้าผลสอบ</small></div></div>}</section>
      <section className="surface sync-banner flex items-center gap-[11px] rounded-[24px] border border-[#efedf0] px-[19px] py-4 shadow-[0_12px_36px_rgba(38,32,37,.035)]"><span className="sync-banner-icon"><Icon name="sync" /></span><div className="flex-1"><strong>คิวงานระบบ</strong><p>ดูผลการส่งอีเมลและการซิงก์ Google Sheets จากข้อมูลจริงในหน้าสถานะ</p></div><Button variant="text" onClick={() => navigate("admin-sheets")}>ดูสถานะ</Button></section>
    </div>
  );
}
