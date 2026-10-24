import { useEffect, useRef, useState } from "react";
import { BrandMark, Button, GoogleMark, Icon, PageHeading, ProfileAvatar } from "../../components/ui/index.jsx";

export function Sidebar({ page, persona, applications = [], competitionCatalog = [], selectedAdminCompetitionId = "", navigate, open, onClose, notify, activeYear }) {
  const [examMenuOpen, setExamMenuOpen] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [adminTooltip, setAdminTooltip] = useState(null);
  const sidebarRef = useRef(null);
  const isAdmin = persona === "admin";
  const pendingReviewCount = applications.filter((item) => item.status === "pending").length;
  const adminNavWidthClass = sidebarExpanded
    ? "min-[801px]:w-[230px] min-[801px]:min-w-[230px] min-[801px]:justify-start min-[801px]:px-[14px]"
    : "min-[801px]:w-[54px] min-[801px]:min-w-[54px] min-[801px]:justify-center min-[801px]:px-0";
  const sidebarClass = isAdmin
    ? `z-30 overflow-hidden border-r border-[#ecebee] bg-white transition-[width,box-shadow,transform] duration-[220ms] motion-reduce:transition-none min-[801px]:px-[13px] min-[801px]:py-[22px] ${sidebarExpanded ? "min-[801px]:w-[260px] min-[801px]:shadow-[14px_0_34px_rgba(28,26,35,.085)]" : "min-[801px]:w-[82px]"} max-[800px]:z-[60] max-[800px]:w-[280px] max-[800px]:max-w-[calc(100vw-55px)] max-[800px]:-translate-x-[105%] max-[800px]:transition-transform max-[800px]:shadow-[12px_0_35px_rgba(24,43,75,.12)]`
    : "";
  const competitionMenuClass = examMenuOpen
    ? `mt-1 grid gap-1 pl-1 ${sidebarExpanded ? "min-[801px]:grid" : "min-[801px]:hidden"} max-[800px]:grid`
    : "hidden";
  const showAdminTooltip = (event, label) => {
    if (!isAdmin || sidebarExpanded || window.innerWidth < 801) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setAdminTooltip({ label, top: bounds.top + bounds.height / 2, left: bounds.right + 9 });
  };
  const hideAdminTooltip = () => setAdminTooltip(null);
  useEffect(() => {
    if (!isAdmin || !sidebarExpanded) return undefined;
    const collapseOnOutsideClick = (event) => {
      if (!sidebarRef.current?.contains(event.target)) {
        setSidebarExpanded(false);
        setAdminTooltip(null);
      }
    };
    document.addEventListener("click", collapseOnOutsideClick);
    return () => document.removeEventListener("click", collapseOnOutsideClick);
  }, [isAdmin, sidebarExpanded]);
  const mainItems = [
    { id: "home", label: "ภาพรวม", icon: "home" },
    { id: "apply-heat", label: "สมัครสอบ", icon: "plus" },
    { id: "applications", label: "ใบสมัครของฉัน", icon: "file", count: String(applications.filter((item) => persona === "coordinator" || item.owner === "candidate").length) },
    { id: "lookup-choice", label: "ค้นหา / แก้ไขใบสมัคร", icon: "search" },
    { id: "final-confirm", label: "ยืนยันสิทธิ์ Final", icon: "award" },
    { id: "results", label: "ประกาศผล", icon: "grid" },
  ];
  const adminItems = [
    { id: "admin-home", label: "ภาพรวมผู้ดูแลระบบ", icon: "grid" },
    { id: "admin-review", label: "ตรวจใบสมัคร", icon: "file", count: String(pendingReviewCount) },
    { id: "admin-form-options", label: "ข้อมูลตัวเลือกในแบบฟอร์ม", icon: "settings" },
    { id: "admin-results", label: "นำเข้าผลสอบ", icon: "award" },
    { id: "admin-final-ids", label: "เลขประจำตัว Final", icon: "users" },
    { id: "admin-mock-papers", label: "รายชื่อ Mock และข้อสอบเก่า", icon: "book" },
    { id: "admin-sheets", label: "Google Sheets", icon: "sync" },
  ];
  const renderItems = (items) => items.map((item) => (
    <a
      href={"#" + item.id}
      className={`nav-link relative flex min-h-12 w-full items-center justify-start gap-3 overflow-hidden rounded-[15px] px-[13px] text-[13px] font-medium text-[#706f78] transition-[width,background-color,color,transform] duration-200 hover:bg-[#f6f5f6] hover:text-[#29252a] ${isAdmin ? adminNavWidthClass : "min-[801px]:w-[54px] min-[801px]:min-w-[54px] min-[801px]:justify-center min-[801px]:gap-3 min-[801px]:px-0 min-[801px]:group-hover:w-[230px] min-[801px]:group-focus-within:w-[230px] min-[801px]:group-hover:justify-start min-[801px]:group-focus-within:justify-start min-[801px]:group-hover:px-[14px] min-[801px]:group-focus-within:px-[14px]"} motion-reduce:transition-none ${page === item.id ? "nav-link-active bg-ocec-brand-soft text-ocec-brand font-bold shadow-none hover:bg-ocec-brand-soft hover:text-ocec-brand" : ""}`}
      key={item.id}
      aria-label={isAdmin ? item.label : undefined}
      aria-describedby={adminTooltip?.label === item.label ? "admin-sidebar-tooltip" : undefined}
      aria-current={page === item.id ? "page" : undefined}
      onMouseEnter={(event) => showAdminTooltip(event, item.label)}
      onMouseLeave={hideAdminTooltip}
      onFocus={(event) => showAdminTooltip(event, item.label)}
      onBlur={hideAdminTooltip}
      onClick={(event) => { hideAdminTooltip(); event.preventDefault(); navigate(item.id); }}
    >
      <Icon name={item.icon} size={18} className={page === item.id && isAdmin ? "text-ocec-brand" : ""} />
      <span className={`min-w-0 whitespace-nowrap ${isAdmin ? sidebarExpanded ? "min-[801px]:inline max-[800px]:inline" : "min-[801px]:hidden max-[800px]:inline" : "min-[801px]:hidden min-[801px]:group-hover:inline min-[801px]:group-focus-within:inline"}`}>{item.label}</span>
      {item.count ? <span className={`nav-count absolute right-0 top-0 grid min-w-[17px] h-[17px] place-items-center rounded-[7px] bg-[#ffdf9e] px-[3px] text-[10px] font-bold text-[#6f4a00] ${isAdmin ? sidebarExpanded ? "min-[801px]:static min-[801px]:ml-auto min-[801px]:h-[21px] min-[801px]:min-w-[22px] min-[801px]:text-xs" : "" : "min-[801px]:group-hover:static min-[801px]:group-focus-within:static min-[801px]:group-hover:ml-auto min-[801px]:group-focus-within:ml-auto min-[801px]:group-hover:h-[21px] min-[801px]:group-focus-within:h-[21px] min-[801px]:group-hover:min-w-[22px] min-[801px]:group-focus-within:min-w-[22px] min-[801px]:group-hover:text-xs min-[801px]:group-focus-within:text-xs"}`}>{item.count}</span> : null}
    </a>
  ));

  return (
    <>
      <button className={`sidebar-scrim fixed inset-0 z-[55] border-0 bg-[rgba(18,32,54,.32)] ${open ? "block" : "hidden"}`} aria-label="ปิดเมนู" onClick={onClose} />
      <aside ref={sidebarRef} className={`sidebar ${sidebarClass} ${open ? "sidebar-open max-[800px]:translate-x-0" : ""}`}>
        <div className={`brand-lockup ${isAdmin ? sidebarExpanded ? "min-w-[234px] w-full flex-row gap-[14px] px-[7px] pb-7 max-[800px]:min-w-0" : "min-w-0 w-full flex-col items-center gap-3 px-0 pb-7 max-[800px]:flex-row max-[800px]:justify-start max-[800px]:gap-[14px] max-[800px]:px-[7px]" : ""}`}>
          {isAdmin ? <span className="admin-brand-symbol grid size-[46px] shrink-0 place-items-center rounded-[17px] bg-ocec-accent text-[27px] font-bold leading-none text-ocec-brand shadow-[0_7px_15px_rgba(255,45,149,.18)] max-[800px]:size-10 max-[800px]:rounded-[13px] max-[800px]:text-[22px]" aria-hidden="true">O</span> : <BrandMark />}
          <div className={isAdmin ? `min-w-0 flex-1 flex-col leading-[1.3] ${sidebarExpanded ? "flex" : "hidden max-[800px]:flex"}` : ""}>
            <strong className={isAdmin ? "text-[15px] text-[#202027]" : ""}>OCEC Portal</strong>
            <span className={isAdmin ? "mt-[3px] text-xs text-[#75747c]" : ""}>ระบบสมัครสอบ</span>
          </div>
          {isAdmin ? <button
            type="button"
            className={`grid size-10 shrink-0 place-items-center rounded-xl border border-[#e7e5f0] bg-[#f8f7ff] text-[#68658a] transition-colors hover:bg-[#f0effb] hover:text-ocec-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ocec-brand max-[800px]:hidden ${sidebarExpanded ? "ml-auto" : ""}`}
            aria-label={sidebarExpanded ? "ย่อแถบเมนู" : "ขยายแถบเมนู"}
            aria-expanded={sidebarExpanded}
            aria-controls="admin-sidebar-nav"
            title={sidebarExpanded ? "ย่อแถบเมนู" : "ขยายแถบเมนู"}
            onClick={() => { hideAdminTooltip(); setSidebarExpanded((isExpanded) => !isExpanded); }}
          ><Icon name="chevron" size={17} className={`transition-transform duration-200 motion-reduce:transition-none ${sidebarExpanded ? "rotate-180" : ""}`} /></button> : null}
          <button className={`icon-button sidebar-close max-[800px]:!inline-grid ${isAdmin ? "border-white/20 bg-white/10 text-white" : ""}`} aria-label="ปิดเมนู" onClick={onClose}><Icon name="close" /></button>
        </div>
        {!isAdmin ? <div className="round-switch">
          <span className="round-icon"><Icon name="calendar" size={17} /></span>
          <div><span>รอบการสอบ</span><strong>{activeYear ? `ประจำปี ${activeYear}` : "ยังไม่กำหนดปี"}</strong></div>
          <span className="round-caret">⌄</span>
        </div> : null}
        <nav id={isAdmin ? "admin-sidebar-nav" : undefined} className={isAdmin ? "min-h-0 flex-1 overflow-y-auto" : ""} aria-label={persona === "admin" ? "จัดการระบบ" : "เมนูหลัก"}>
          {persona !== "admin" ? <>
            <p className="nav-section-title">เมนูหลัก</p>
            <div className="nav-list">{renderItems(mainItems)}</div>
          </> : null}
          {persona === "admin" ? (
            <div className="grid gap-[7px]">
              <section className="min-w-0" aria-label="ภาพรวม">
                <p className={`m-0 mb-1 px-[14px] pt-1 text-[10px] font-semibold tracking-[.08em] text-[#928d98] ${sidebarExpanded ? "min-[801px]:block" : "min-[801px]:hidden"} max-[800px]:block`}>ภาพรวม</p>
                <div className="nav-list grid gap-[5px]">{renderItems(adminItems.slice(0, 1))}</div>
              </section>
              <section className={`min-w-0 ${sidebarExpanded ? "" : "min-[801px]:border-t min-[801px]:border-[#ecebee] min-[801px]:pt-2"}`} aria-label="งานสอบ">
                <p className={`m-0 mb-1 px-[14px] pt-1 text-[10px] font-semibold tracking-[.08em] text-[#928d98] ${sidebarExpanded ? "min-[801px]:block" : "min-[801px]:hidden"} max-[800px]:block`}>งานสอบ</p>
                <div className="nav-list grid gap-[5px]">
                  <section className="grid min-w-0" aria-label="รายการสอบ">
                    <div className="flex min-h-12 min-w-0 items-center gap-0">
                      <a
                        href="#admin-round"
                        className={`nav-link relative flex min-h-12 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-[15px] text-[13px] font-medium text-[#706f78] transition-colors hover:bg-[#f6f5f6] hover:text-[#29252a] ${sidebarExpanded ? "min-[801px]:justify-start min-[801px]:gap-3 min-[801px]:px-[14px]" : "min-[801px]:justify-center min-[801px]:px-0"} ${page === "admin-round" ? "nav-link-active bg-ocec-brand-soft text-ocec-brand font-bold hover:bg-ocec-brand-soft hover:text-ocec-brand" : ""}`}
                        aria-label="รายการสอบ"
                        aria-describedby={adminTooltip?.label === "รายการสอบ" ? "admin-sidebar-tooltip" : undefined}
                        aria-current={page === "admin-round" ? "page" : undefined}
                        onMouseEnter={(event) => showAdminTooltip(event, "รายการสอบ")}
                        onMouseLeave={hideAdminTooltip}
                        onFocus={(event) => showAdminTooltip(event, "รายการสอบ")}
                        onBlur={hideAdminTooltip}
                        onClick={(event) => { hideAdminTooltip(); event.preventDefault(); navigate("admin-round"); }}
                      >
                        <Icon name="calendar" size={18} className="shrink-0" />
                        <span className={`min-w-0 whitespace-nowrap ${sidebarExpanded ? "min-[801px]:inline max-[800px]:inline" : "min-[801px]:hidden max-[800px]:inline"}`}>รายการสอบ</span>
                      </a>
                      <button
                        type="button"
                        className={`grid size-8 max-[800px]:size-11 shrink-0 place-items-center rounded-md text-[#85828e] transition-colors hover:bg-[#f0effb] hover:text-ocec-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ocec-brand ${sidebarExpanded ? "min-[801px]:grid" : "min-[801px]:hidden"} ${page === "admin-round" ? "text-ocec-brand" : ""}`}
                        aria-expanded={examMenuOpen && (sidebarExpanded || open)}
                        aria-controls="admin-exam-nav-items"
                        aria-label={`${examMenuOpen ? "ยุบ" : "ขยาย"}เมนูรายการสอบ`}
                        title={`${examMenuOpen ? "ยุบ" : "ขยาย"}รายการสอบ`}
                        onClick={() => setExamMenuOpen((isOpen) => !isOpen)}
                      >
                        <Icon name="chevron" size={14} className={`transition-transform duration-200 motion-reduce:transition-none ${examMenuOpen ? "rotate-90" : ""}`} />
                      </button>
                    </div>
                    <div id="admin-exam-nav-items" className={competitionMenuClass}>
                      {competitionCatalog.length ? competitionCatalog.map((competition) => {
                        const label = competition.short || competition.name;
                        const selected = page === "admin-round" && competition.id === selectedAdminCompetitionId;
                        return <button
                          type="button"
                          key={competition.id}
                          title={label}
                          aria-current={selected ? "page" : undefined}
                          className={`admin-exam-nav-link appearance-none flex min-h-11 w-full min-w-0 items-center rounded-xl border-0 px-3 text-left text-xs font-semibold shadow-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ocec-brand ${sidebarExpanded ? "min-[801px]:flex" : "min-[801px]:hidden"} max-[800px]:flex ${selected ? "bg-ocec-brand-soft text-ocec-brand hover:bg-ocec-brand-soft hover:text-ocec-brand" : "bg-transparent text-[#615663] hover:bg-[#f7f5f7] hover:text-ocec-brand"}`}
                          onClick={() => navigate("admin-round", "", competition.id)}
                        >{label}</button>;
                      }) : <p className={`px-3 py-2 text-[11px] leading-5 text-[#8d8b95] ${sidebarExpanded ? "min-[801px]:block" : "min-[801px]:hidden"} max-[800px]:block`}>ไม่พบรายการสอบ</p>}
                    </div>
                  </section>
                  {renderItems(adminItems.slice(1, 2))}
                </div>
              </section>
              <section className={`min-w-0 ${sidebarExpanded ? "" : "min-[801px]:border-t min-[801px]:border-[#ecebee] min-[801px]:pt-2"}`} aria-label="เครื่องมือผู้ดูแลระบบ">
                <p className={`m-0 mb-1 px-[14px] pt-1 text-[10px] font-semibold tracking-[.08em] text-[#928d98] ${sidebarExpanded ? "min-[801px]:block" : "min-[801px]:hidden"} max-[800px]:block`}>เครื่องมือผู้ดูแลระบบ</p>
                <div className="nav-list grid gap-[5px]">{renderItems(adminItems.slice(2))}</div>
              </section>
            </div>
          ) : null}
        </nav>
        <div className={`sidebar-bottom ${isAdmin ? "mt-[18px] text-[#75747c]" : ""}`}>
          {persona !== "admin" ? <div className="help-card">
            <span className="help-icon"><Icon name="help" size={17} /></span>
            <strong>ต้องการความช่วยเหลือหรือไม่?</strong>
            <p>ดูคำแนะนำการสมัครและการใช้งาน</p>
            <a href="https://lin.ee/3hzFg1z" target="_blank" rel="noopener noreferrer">ศูนย์ช่วยเหลือ <Icon name="arrow" size={14} /></a>
          </div> : null}
          <div role={isAdmin ? "status" : undefined} aria-label={isAdmin ? "ระบบพร้อมใช้งาน" : undefined} title={isAdmin && !sidebarExpanded ? "ระบบพร้อมใช้งาน" : undefined} className={`sidebar-version ${isAdmin ? `flex items-center gap-[7px] border-t border-[#ecebee] pt-[13px] text-xs text-[#75747c] ${sidebarExpanded ? "justify-start" : "justify-center"}` : ""}`}>
            <span className="online-dot" />
            <span className={isAdmin ? `${sidebarExpanded ? "min-[801px]:inline" : "min-[801px]:hidden"} max-[800px]:inline` : ""}>ระบบพร้อมใช้งาน</span>
            <span className={isAdmin ? `ml-auto ${sidebarExpanded ? "min-[801px]:inline" : "min-[801px]:hidden"} max-[800px]:inline` : ""}>v1.0</span>
          </div>
        </div>
      </aside>
      {adminTooltip ? <div
        id="admin-sidebar-tooltip"
        role="tooltip"
        className="pointer-events-none fixed z-[70] -translate-y-1/2 rounded-md bg-[#302e35] px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_4px_12px_rgba(23,20,28,.18)]"
        style={{ top: adminTooltip.top, left: adminTooltip.left }}
      >{adminTooltip.label}</div> : null}
    </>
  );
}

export function Topbar({ title, persona, setPersona, menuOpen, setMenuOpen, navigate, authProfile, onSignOut, activeYear, backendEnabled }) {
  const roleNames = {
    guest: "บุคคลทั่วไป",
    candidate: "ผู้สมัคร",
    coordinator: "ผู้ประสานงานโรงเรียน",
    admin: "ผู้ดูแลระบบ",
  };
  return (
    <header className={`topbar ${persona === "admin" ? "sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-4 border-[#ecebee] bg-[rgba(250,249,250,.9)] px-[34px] backdrop-blur-[12px] max-[800px]:min-h-[68px] max-[800px]:px-5 max-[600px]:min-h-[62px] max-[600px]:px-[13px]" : ""}`}>
      <div className={`topbar-left ${persona === "admin" ? "flex min-w-0 items-center gap-[15px] max-[800px]:gap-2.5" : ""}`}>
        <button
          className="icon-button mobile-menu-button max-[800px]:!inline-grid max-[800px]:size-[38px]"
          aria-label="เปิดเมนู"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name="menu" size={21} />
        </button>
        <div className={`breadcrumb ${persona === "admin" ? "flex min-w-0 items-center gap-[9px] text-xs text-[#8290a3] max-[800px]:gap-1.5 max-[600px]:gap-0" : ""}`}><span className={persona === "admin" ? "max-[600px]:hidden" : ""}>OCEC Portal</span><Icon className={persona === "admin" ? "max-[600px]:hidden" : ""} name="chevron" size={14} /><strong className={persona === "admin" ? "text-[13px] text-[#2c315b]" : ""}>{title}</strong></div>
      </div>
      <div className={`topbar-actions ${persona === "admin" ? "flex min-w-0 items-center gap-3 max-[800px]:gap-2 max-[600px]:gap-1.5" : ""}`}>
        <span className={`topbar-round ${persona === "admin" ? "border-[#e7e7f0] bg-[#f7f7fd] text-[#475678] max-[800px]:hidden" : ""}`}><span className="online-dot" />{activeYear ? `รอบสอบ ${activeYear}` : "รอบสอบ"}</span>
        {backendEnabled && persona === "admin" ? (
          <div className="admin-session-chip">
            <ProfileAvatar src={authProfile?.picture} alt="" />
            <span><strong>{authProfile?.name || "ผู้ดูแลระบบ"}</strong><small>{authProfile?.email || ""}</small></span>
            <button type="button" onClick={onSignOut}>ออกจากระบบ</button>
          </div>
        ) : <>
        {!backendEnabled ? <label className="persona-control">
          <span className="sr-only">สลับมุมมองตัวอย่าง</span>
          <select value={persona} onChange={(event) => setPersona(event.target.value)}>
            {Object.keys(roleNames).map((key) => <option value={key} key={key}>{roleNames[key]}</option>)}
          </select>
        </label> : null}
        {persona === "guest" ? (
          <Button variant="outline" icon="shield" onClick={() => { setPersona("candidate"); }}>เข้าสู่ระบบด้วย Google</Button>
        ) : (
          <button className="profile-chip" onClick={() => navigate(persona === "admin" ? "admin-home" : "applications")} aria-label={persona === "admin" ? "เปิดภาพรวมผู้ดูแลระบบ" : "เปิดใบสมัครของฉัน"}>
            <span className="profile-avatar">{persona === "admin" ? "AD" : persona === "coordinator" ? "PK" : "NS"}</span>
            <span className="profile-name">{persona === "admin" ? "ผู้ดูแลระบบ" : persona === "coordinator" ? "Pimchanok K." : "Nicha S."}</span>
            <span className="profile-caret">⌄</span>
          </button>
        )}
        </>}
      </div>
    </header>
  );
}

export function HomePage({ navigate, persona, applications }) {
  const activeCount = applications.filter((item) => item.status === "pending").length;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="ยินดีต้อนรับ"
        title={persona === "admin" ? "ศูนย์จัดการการสอบ" : "ยินดีต้อนรับ"}
        description={persona === "coordinator" ? "ตรวจสอบใบสมัครของนักเรียนและดำเนินงานที่เกี่ยวข้องได้จากระบบเดียว" : "ตรวจสอบใบสมัครและติดตามประกาศการสอบผ่านระบบ OCEC"}
      />
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker"><span className="hero-kicker-dot" />ระบบสมัครสอบ OCEC</span>
          <h2>สมัครสอบและติดตามข้อมูล<br /><span>ผ่านระบบเดียว</span></h2>
          <p>สมัครสอบ ตรวจสอบสถานะใบสมัคร และติดตามประกาศจาก OCEC ผ่านระบบออนไลน์</p>
          <div className="hero-actions">
            <Button icon="arrow" onClick={() => navigate("apply-heat")}>เข้าสู่การสมัครสอบ</Button>
            <Button variant="light" icon="search" onClick={() => navigate("lookup-choice")}>ตรวจสอบสถานะใบสมัคร</Button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-paper">
            <div className="paper-top"><span /><span /><span /></div>
            <div className="paper-seal"><Icon name="shield" size={28} /></div>
            <div className="paper-lines"><i /><i /><i /></div>
            <div className="paper-check"><Icon name="check" size={16} /></div>
          </div>
          <div className="hero-float hero-float-top"><span className="float-check"><Icon name="check" size={15} /></span><span><strong>สมัครสำเร็จ</strong><small>ใบสมัครของคุณถูกบันทึกแล้ว</small></span></div>
          <div className="hero-float hero-float-bottom"><span className="float-calendar"><Icon name="calendar" size={17} /></span><span><small>ปิดรับสมัคร</small><strong>30 พฤศจิกายน 2569</strong></span></div>
        </div>
      </section>

      <div className="summary-grid">
        <div className="summary-card">
          <span className="summary-icon summary-blue"><Icon name="file" /></span>
          <div><span>ใบสมัครทั้งหมด</span><strong>{applications.length.toString().padStart(2, "0")} <small>ใบ</small></strong></div>
          <span className="summary-trend">ปี 2569</span>
        </div>
        <div className="summary-card">
          <span className="summary-icon summary-amber"><Icon name="clock" /></span>
          <div><span>อยู่ระหว่างตรวจสอบ</span><strong>{activeCount.toString().padStart(2, "0")} <small>ใบ</small></strong></div>
          <span className="summary-trend trend-amber">ต้องติดตาม</span>
        </div>
        <div className="summary-card">
          <span className="summary-icon summary-green"><Icon name="check" /></span>
          <div><span>ยืนยันแล้ว</span><strong>{(applications.length - activeCount).toString().padStart(2, "0")} <small>ใบ</small></strong></div>
          <span className="summary-trend trend-green">เรียบร้อย</span>
        </div>
      </div>

      <div className="home-content-grid">
        <section className="surface quick-panel">
          <div className="section-heading">
          <div><p className="eyebrow">บริการสำหรับผู้สมัคร</p><h2>เลือกบริการที่ต้องการ</h2></div>
            <span className="section-index">01 / 04</span>
          </div>
          <div className="quick-action-grid">
            <button className="quick-action" onClick={() => navigate("apply-heat")}>
              <span className="quick-icon quick-blue"><Icon name="plus" /></span>
              <span><strong>สมัครสอบรอบ HEAT</strong><small>สมัครสอบในรอบคัดเลือก</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
            <button className="quick-action" onClick={() => navigate("applications")}>
              <span className="quick-icon quick-violet"><Icon name="file" /></span>
              <span><strong>ใบสมัครของฉัน</strong><small>ตรวจสอบหรือแก้ไขใบสมัคร</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
            <button className="quick-action" onClick={() => navigate("final-confirm")}>
              <span className="quick-icon quick-teal"><Icon name="award" /></span>
              <span><strong>ยืนยันสิทธิ์ Final</strong><small>สำหรับผู้ผ่านการสอบรอบ HEAT</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
            <button className="quick-action" onClick={() => navigate("results")}>
              <span className="quick-icon quick-amber"><Icon name="grid" /></span>
              <span><strong>ตรวจสอบประกาศผลสอบ</strong><small>ค้นหาผลสอบด้วยชื่อหรือเลขประจำตัวสอบ</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
          </div>
        </section>
        <aside className="surface schedule-panel">
          <div className="section-heading">
            <div><p className="eyebrow">กำหนดการ</p><h2>รอบสอบปัจจุบัน</h2></div>
            <span className="schedule-open">เปิดรับสมัคร</span>
          </div>
          <div className="schedule-name"><span className="schedule-mark"><Icon name="award" size={19} /></span><div><strong>OCEC HEAT 2569</strong><span>รอบคัดเลือก · ปีการศึกษา 2569</span></div></div>
          <div className="schedule-line">
            <div className="schedule-step"><span className="step-dot step-done"><Icon name="check" size={12} /></span><div><strong>เปิดรับสมัคร</strong><small>1 ตุลาคม 2569</small></div></div>
            <div className="schedule-step"><span className="step-dot step-current" /><div><strong>ปิดรับสมัคร</strong><small>30 พฤศจิกายน 2569</small></div></div>
            <div className="schedule-step"><span className="step-dot" /><div><strong>ประกาศผลรอบ HEAT</strong><small>15 ธันวาคม 2569</small></div></div>
          </div>
          <button className="schedule-link" onClick={() => navigate(persona === "admin" ? "admin-round" : "apply-heat")}>{persona === "admin" ? "จัดการรอบสอบ" : "ตรวจสอบรายละเอียดและสมัครสอบ"} <Icon name="arrow" size={15} /></button>
        </aside>
      </div>

      <section className="surface recent-panel">
        <div className="section-heading">
          <div><p className="eyebrow">อัปเดตล่าสุด</p><h2>ใบสมัครล่าสุด</h2></div>
          <Button variant="text" icon="arrow" onClick={() => navigate("applications")}>ดูใบสมัครทั้งหมด</Button>
        </div>
        <div className="recent-list">
          {applications.slice(0, 2).map((application) => (
            <button className="recent-row" key={application.id} onClick={() => navigate("application-detail", application.id)}>
              <span className="recent-icon"><Icon name={application.kind === "Final" ? "award" : "file"} /></span>
              <span className="recent-main"><strong>{application.candidate}</strong><small>{application.exam} · {application.school}</small></span>
              <StatusBadge status={application.status} />
              <span className="recent-date">{application.submitted}</span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export function AdminLoginPage({ authProfile, authChecked, backendEnabled, onSignIn, onSignOut }) {
  const isUnauthorized = authProfile && !authProfile.isAdmin;
  return (
    <main className="admin-login-page">
      <a className="admin-login-brand" href="/" aria-label="กลับสู่หน้า OCEC Portal">
        <BrandMark /><span><strong>OCEC Portal</strong><small>ระบบสมัครสอบ</small></span>
      </a>
      <section className="admin-login-card" aria-labelledby="admin-login-title">
        <span className="admin-login-mark"><Icon name="shield" size={24} /></span>
        <p className="admin-login-eyebrow">พื้นที่เจ้าหน้าที่</p>
        <h1 id="admin-login-title">เข้าสู่ระบบผู้ดูแลระบบ</h1>
        <p className="admin-login-description">ใช้บัญชี Google ที่ได้รับอนุญาตเพื่อจัดการรายการสอบและใบสมัคร</p>
        {!backendEnabled ? (
          <div className="admin-login-message admin-login-message-error" role="alert">ระบบเข้าสู่ระบบยังไม่เปิดใช้งาน · โปรดตั้งค่า <code>VITE_BACKEND_ENABLED=true</code> แล้วสร้างเว็บไซต์ใหม่</div>
        ) : !authChecked ? (
          <div className="admin-login-message" role="status"><span className="admin-login-spinner" />กำลังตรวจสอบข้อมูลบัญชี…</div>
        ) : isUnauthorized ? (
          <>
            <div className="admin-login-message admin-login-message-error" role="alert">
              บัญชี {authProfile.email} ไม่มีสิทธิ์เข้าถึงระบบผู้ดูแล โปรดเข้าสู่ระบบด้วยอีเมลที่กำหนดใน <code>ADMIN_EMAILS</code>
            </div>
            <button className="admin-login-button admin-login-secondary" type="button" onClick={onSignOut}>ออกจากระบบเพื่อเลือกบัญชีอื่น</button>
          </>
        ) : authProfile?.isAdmin ? (
          <div className="admin-login-message" role="status">กำลังเปิดหน้าผู้ดูแลระบบสำหรับ {authProfile.email}…</div>
        ) : (
          <>
            <button className="admin-login-button" type="button" onClick={onSignIn}>
              <GoogleMark /><span>เข้าสู่ระบบด้วย Google</span><Icon name="arrow" size={17} />
            </button>
            <p className="admin-login-hint">กำหนดอีเมลผู้ดูแลระบบใน <code>.env</code> ที่ <code>ADMIN_EMAILS</code> สามารถระบุอีเมลได้หลายรายการ โดยคั่นแต่ละรายการด้วยเครื่องหมายจุลภาค</p>
          </>
        )}
      </section>
      <a className="admin-login-back" href="/">กลับสู่หน้าเว็บไซต์</a>
    </main>
  );
}

export function AdminShell({ page, title, persona, applications, competitionCatalog, selectedAdminCompetitionId, navigate, menuOpen, setMenuOpen, onSetPersona, authProfile, onSignOut, activeYear, backendEnabled, children, toast, setToast, notify }) {
  const isAdmin = persona === "admin";
  return (
    <div className={`app-shell min-h-screen ${isAdmin ? "admin-shell bg-[#f6f5f7]" : ""}`}>
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
      <Sidebar page={page} persona={persona} applications={applications} competitionCatalog={competitionCatalog} selectedAdminCompetitionId={selectedAdminCompetitionId} navigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} notify={notify} activeYear={activeYear} />
      <main className={`main-column min-h-screen min-w-0 ${isAdmin ? "min-[801px]:ml-[82px] bg-[radial-gradient(circle_at_100%_150px,rgba(235,225,255,.36),transparent_30%),#f6f5f7]" : ""}`} id="main-content" tabIndex="-1">
        <Topbar backendEnabled={backendEnabled} title={title} persona={persona} setPersona={onSetPersona} menuOpen={menuOpen} setMenuOpen={setMenuOpen} navigate={navigate} authProfile={authProfile} onSignOut={onSignOut} activeYear={activeYear} />
        <div className={`content-wrap min-w-0 ${isAdmin ? "mx-auto w-full max-w-[1560px] px-[34px] pt-[30px] max-[1250px]:px-[25px] max-[800px]:px-5 max-[800px]:pt-[19px] max-[600px]:px-[13px] max-[600px]:pt-[13px]" : ""}`}>
          {!backendEnabled ? <div className={`prototype-banner ${isAdmin ? "mb-[27px] min-h-[42px] rounded-xl border-[#e7e3f3] bg-[#f0effb] text-[#5d5a88]" : ""}`}><Icon name="info" size={15} /><span>โหมดตัวอย่าง · ข้อมูลไม่ได้เชื่อมต่อกับฐานข้อมูลจริง</span><button onClick={(event) => event.currentTarget.parentElement.remove()} aria-label="ปิดข้อความ"><Icon name="close" size={14} /></button></div> : null}
          {children}
          <footer className={`page-footer ${isAdmin ? "text-[#79859b]" : ""}`}><span>© 2569 OCEC Portal</span><span>หากมีข้อสงสัย โปรดติดต่อฝ่ายประสานงานโครงการ</span><a href="https://lin.ee/3hzFg1z" target="_blank" rel="noopener noreferrer">ศูนย์ช่วยเหลือ</a><a className="flaticon-attribution" href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">UIcons by Flaticon</a></footer>
        </div>
      </main>
      {toast ? <div className="toast" role="status" aria-live="polite"><span><Icon name="check" size={16} /></span><p>{toast}</p><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div> : null}
    </div>
  );
}
