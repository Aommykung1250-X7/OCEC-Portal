import { useEffect, useRef, useState } from "react";
import { BrandMark, GoogleMark, Icon, ProfileAvatar } from "../ui/index.jsx";
import { AuthDialog } from "./AuthDialog.jsx";

function goToLandingSection(page, navigate, sectionId) {
  if (page === "home") {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  navigate("home");
  window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }), 80);
}

export function PublicPortalHeader({ page, navigate, setPersona, authProfile, onSignIn, onSignOut, demoProfile, backendEnabled }) {
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const headerOffsetRef = useRef(0);
  const accountRootRef = useRef(null);
  const dialogRef = useRef(null);
  const loginTriggerRef = useRef(null);
  const requiresRegistrationLogin = !authProfile && page === "apply-heat";
  const homeHeader = page === "home";
  const headerPositionClasses = homeHeader
    ? "fixed top-[22px] right-[max(28px,calc((100vw-1340px)/2))] left-[max(28px,calc((100vw-1340px)/2))] mx-0 mt-0 w-auto"
    : "sticky top-[14px] mx-auto mt-[22px] w-[calc(100%-56px)]";
  const headerMobileColumns = authProfile
    ? "max-[700px]:grid-cols-[minmax(0,1fr)_44px]"
    : "max-[700px]:grid-cols-[minmax(0,1fr)_auto]";
  const headerMobilePosition = homeHeader
    ? "max-[700px]:top-3 max-[700px]:right-[14px] max-[700px]:left-[14px] max-[700px]:mx-0 max-[700px]:mt-0 max-[700px]:w-auto"
    : "max-[700px]:top-3 max-[700px]:mt-3 max-[700px]:w-[calc(100%-28px)]";
  const navItemClasses = "inline-flex min-h-11 items-center border-0 bg-transparent px-0 text-[13px] font-medium whitespace-nowrap text-ocec-brand no-underline transition-colors hover:text-ocec-brand-dark max-[700px]:min-h-[38px] max-[700px]:text-xs max-[390px]:text-[10.5px]";
  const isStatusPage = ["lookup-choice", "check-status", "edit-verify", "edit-application"].includes(page);
  const focusRingClasses = "focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-ocec-accent";

  useEffect(() => {
    setLoginDialogOpen(requiresRegistrationLogin);
  }, [requiresRegistrationLogin]);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return undefined;
    headerOffsetRef.current = 0;
    header.style.setProperty("--header-hide-offset", "0px");
    if (loginDialogOpen || accountMenuOpen) return undefined;

    let lastY = window.scrollY;
    let frame = 0;
    const update = () => {
      frame = 0;
      const currentY = Math.max(0, window.scrollY);
      const delta = currentY - lastY;
      lastY = currentY;
      const maxOffset = header.offsetHeight + 40;
      const focusedInside = header.contains(document.activeElement) && document.activeElement?.matches(":focus-visible");
      const nextOffset = focusedInside || currentY === 0
        ? 0
        : Math.max(0, Math.min(maxOffset, headerOffsetRef.current + delta));
      if (nextOffset === headerOffsetRef.current) return;
      headerOffsetRef.current = nextOffset;
      header.style.setProperty("--header-hide-offset", `${nextOffset}px`);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [page, loginDialogOpen, accountMenuOpen]);

  useEffect(() => {
    if (!accountMenuOpen) return undefined;
    const closeOnOutsidePress = (event) => {
      if (!accountRootRef.current?.contains(event.target)) setAccountMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!loginDialogOpen) return undefined;
    const previousFocus = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.querySelector(".demo-account-choice")?.focus());
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        if (requiresRegistrationLogin) navigate("home");
        setLoginDialogOpen(false);
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscape);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [loginDialogOpen, requiresRegistrationLogin, navigate]);

  function keepFocusInsideDialog(event) {
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll("button:not([disabled]), a[href]");
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function dismissLoginDialog() {
    setLoginDialogOpen(false);
    if (requiresRegistrationLogin) navigate("home");
  }

  return (
    <>
      <header ref={headerRef} className={`landing-header z-30 flex min-h-[72px] max-w-[1340px] items-center justify-between gap-[25px] rounded-full border border-ocec-border bg-white py-[9px] pr-[17px] pl-[25px] ${headerPositionClasses} max-[700px]:grid max-[700px]:min-h-0 ${headerMobileColumns} max-[700px]:gap-x-2 max-[700px]:gap-y-[9px] max-[700px]:rounded-[28px] max-[700px]:p-[10px_14px_8px] ${headerMobilePosition}${authProfile ? " landing-header-authenticated" : ""}`} onFocusCapture={() => {
        headerOffsetRef.current = 0;
        headerRef.current?.style.setProperty("--header-hide-offset", "0px");
      }}>
        <a className="landing-brand flex flex-none items-center gap-[10px] overflow-hidden no-underline max-[700px]:min-w-0 max-[700px]:gap-2" href="/" aria-label="OCEC Portal หน้าแรก">
          <BrandMark />
          <span className="flex min-w-0 flex-col gap-[2px] leading-[1.25]"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-[750] tracking-[0.025em] text-ocec-brand max-[700px]:text-[13px]">OCEC Portal</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-xs text-ocec-muted">ระบบสมัครสอบ</small></span>
        </a>
        <nav className="landing-nav flex flex-1 items-center justify-center gap-[clamp(16px,2.6vw,35px)] max-[700px]:col-span-full max-[700px]:row-start-2 max-[700px]:w-full max-[700px]:justify-between max-[700px]:gap-1 max-[700px]:overflow-x-auto max-[700px]:border-t max-[700px]:border-ocec-border max-[700px]:pt-[5px] max-[700px]:[scrollbar-width:none] max-[390px]:gap-[10px]" aria-label="เมนูหน้าเว็บ">
          <a className={navItemClasses} href="#open-exams" aria-current={page === "home" ? "page" : undefined} onClick={(event) => { event.preventDefault(); goToLandingSection(page, navigate, "open-exams"); }}>รายการสอบ</a>
          <button className={navItemClasses} type="button" aria-current={isStatusPage ? "page" : undefined} onClick={() => navigate("lookup-choice")}>ตรวจสอบสถานะใบสมัคร</button>
          <button className={navItemClasses} type="button" aria-current={page === "final-confirm" ? "page" : undefined} onClick={() => navigate("final-confirm")}>ยืนยันสิทธิ์</button>
          <button className={navItemClasses} type="button" aria-current={page === "results" ? "page" : undefined} onClick={() => navigate("results")}>ประกาศผล</button>
        </nav>
        <div className="header-account relative flex-none max-[700px]:col-start-2 max-[700px]:row-start-1 max-[700px]:justify-self-end" ref={accountRootRef}>
          {authProfile ? (
            <>
              <button
                className={`account-menu-trigger flex min-h-[52px] max-w-[252px] items-center gap-[10px] rounded-[15px] border border-[#e4e6ed] bg-white p-[5px_10px_5px_6px] text-left text-[#303752] shadow-[0_3px_10px_rgba(34,50,77,0.04)] hover:border-[#c9c5ea] hover:bg-[#fdfcff] ${focusRingClasses} max-[920px]:max-w-[215px] max-[920px]:gap-2 max-[700px]:h-11 max-[700px]:w-11 max-[700px]:min-h-11 max-[700px]:max-w-none max-[700px]:justify-center max-[700px]:rounded-full max-[700px]:p-[3px]`}
                type="button"
                aria-haspopup="true"
                aria-expanded={accountMenuOpen}
                aria-controls="account-menu-panel"
                aria-label={`บัญชีผู้ใช้ ${authProfile.name} ${authProfile.email}`}
                onClick={() => setAccountMenuOpen((open) => !open)}
              >
                <ProfileAvatar className="account-avatar block h-[39px] w-[39px] flex-none rounded-full bg-[#eeeaf8] object-cover max-[700px]:h-9 max-[700px]:w-9" src={authProfile.picture} alt={`รูปโปรไฟล์ ${authProfile.name}`} />
                <span className="account-profile-copy flex min-w-0 max-w-[135px] flex-col gap-[3px] leading-[1.15] max-[920px]:max-w-[135px] max-[700px]:hidden"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] font-[750] text-[#303752]">{authProfile.name}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-[#7b879a]">{authProfile.email}</small></span>
                <Icon name="chevron" size={16} className="account-chevron flex-none rotate-90 text-[#8993a5] max-[700px]:hidden" />
              </button>
              {accountMenuOpen ? (
              <div className="account-menu-panel absolute top-[calc(100%+9px)] right-0 z-30 w-[275px] rounded-2xl border border-[#e9eaf0] bg-white p-2 shadow-[0_16px_36px_rgba(38,45,73,0.16)] max-[700px]:w-[min(275px,calc(100vw-32px))]" id="account-menu-panel" aria-label="เมนูบัญชีผู้ใช้">
                <div className="account-menu-identity mb-[6px] flex items-center gap-[11px] border-b border-[#f0f1f5] p-[10px]">
                  <ProfileAvatar className="account-avatar block h-[39px] w-[39px] flex-none rounded-full bg-[#eeeaf8] object-cover" src={authProfile.picture} alt="" />
                  <span className="flex min-w-0 flex-col gap-[3px]"><strong className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[#303752]">{authProfile.name}</strong><small className="overflow-hidden text-ellipsis whitespace-nowrap text-[10px] text-[#7b879a]">{authProfile.email}</small></span>
                  </div>
                <button className={`flex min-h-[42px] w-full items-center gap-[9px] rounded-[10px] border-0 bg-white px-[10px] text-left text-xs font-[650] text-[#536177] hover:bg-[#f5f4fc] hover:text-[#403c9e] ${focusRingClasses}`} type="button" onClick={() => { setPersona("candidate"); navigate("applications"); setAccountMenuOpen(false); }}><Icon name="file" size={16} />ใบสมัครของฉัน</button>
                <button className={`flex min-h-[42px] w-full items-center gap-[9px] rounded-[10px] border-0 bg-white px-[10px] text-left text-xs font-[650] text-[#536177] hover:bg-[#f5f4fc] hover:text-[#403c9e] ${focusRingClasses}`} type="button" onClick={() => { setAccountMenuOpen(false); onSignOut(); }}><Icon name="close" size={16} />ออกจากระบบ</button>
                </div>
              ) : null}
            </>
          ) : (
            <button className={`google-signin-button inline-flex min-h-[42px] min-w-[156px] items-center justify-center gap-2 rounded-full border border-[#E9DDEA] bg-[#F8F9FB] px-4 text-[15px] font-[750] text-ocec-brand shadow-none transition-[transform,background,box-shadow] duration-[180ms] hover:-translate-y-px hover:bg-[#E9DDEA] hover:shadow-[0_10px_20px_rgba(60,55,159,0.24)] ${focusRingClasses} max-[920px]:min-h-10 max-[920px]:min-w-[142px] max-[920px]:gap-[7px] max-[920px]:px-[13px] max-[920px]:text-[14px] max-[700px]:min-h-10 max-[700px]:min-w-[112px] max-[700px]:gap-[5px] max-[700px]:px-[10px] max-[700px]:text-xs max-[380px]:min-w-[108px] max-[380px]:px-2`}
              type="button" ref={loginTriggerRef} onClick={() => setLoginDialogOpen(true)}
            >
              <GoogleMark className="max-[700px]:h-[18px] max-[700px]:w-[18px] max-[700px]:text-[19px]" /><span>เข้าสู่ระบบ</span>
            </button>
          )}
        </div>
      </header>
      {loginDialogOpen ? (
        <AuthDialog
          requiresRegistrationLogin={requiresRegistrationLogin}
          backendEnabled={backendEnabled}
          dialogRef={dialogRef}
          onKeyDown={keepFocusInsideDialog}
          onDismiss={dismissLoginDialog}
          onBackdropMouseDown={(event) => {
            if (!requiresRegistrationLogin && event.target === event.currentTarget) setLoginDialogOpen(false);
          }}
          onGoogleSignIn={() => { onSignIn(demoProfile); setLoginDialogOpen(false); }}
        />
      ) : null}
    </>
  );
}
