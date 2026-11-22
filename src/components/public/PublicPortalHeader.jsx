import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, ProfileAvatar } from "../ui/index.jsx";
import { AuthDialog } from "./AuthDialog.jsx";

function goToLandingSection(page, navigate, sectionId) {
  if (page === "home") {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  navigate("home");
  window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }), 80);
}

// Persist last active mobile tab index across route transitions so the floating cobalt bubble glides smoothly even if the header remounts.
let lastMobileTabIndex = 0;

function resolveMobileTabIndex(page, isAccountActive) {
  if (isAccountActive) return 4;
  if (page === "home") return 0;
  if (page === "apply-heat" || page === "apply-final") return 1;
  if (["applications", "application-detail", "edit-application", "school-application-group", "lookup-choice", "check-status", "edit-verify", "slip-upload", "slip-replacement"].includes(page)) return 2;
  if (page === "results" || page === "final-confirm") return 3;
  return 0;
}

export function PublicPortalHeader({
  page,
  navigate,
  setPersona,
  authProfile,
  onSignIn,
  onSignOut,
  onStartApplication,
  demoProfile,
  backendEnabled,
  demoSignIn = false,
}) {
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [tabletMenuOpen, setTabletMenuOpen] = useState(false);

  const accountRootRef = useRef(null);
  const dialogRef = useRef(null);
  const desktopNavRef = useRef(null);
  const desktopNavRefs = useRef([]);
  const [desktopIndicator, setDesktopIndicator] = useState({ left: 0, width: 0, visible: false });

  const requiresRegistrationLogin = !authProfile && page === "apply-heat";
  const isStatusPage = ["lookup-choice", "check-status", "edit-verify", "edit-application"].includes(page);
  const isAccountActive = loginDialogOpen || accountMenuOpen;

  const targetMobileTabIndex = resolveMobileTabIndex(page, isAccountActive);
  const [visualMobileTab, setVisualMobileTab] = useState(lastMobileTabIndex);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setVisualMobileTab(targetMobileTabIndex);
      lastMobileTabIndex = targetMobileTabIndex;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [targetMobileTabIndex]);

  useEffect(() => {
    setLoginDialogOpen(requiresRegistrationLogin);
  }, [requiresRegistrationLogin]);

  useEffect(() => {
    setTabletMenuOpen(false);
  }, [page]);

  const activeDesktopIndex = page === "home" ? 0 : isStatusPage ? 1 : page === "final-confirm" ? 2 : page === "results" ? 3 : -1;

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const navEl = desktopNavRef.current;
      const itemEl = activeDesktopIndex >= 0 ? desktopNavRefs.current[activeDesktopIndex] : null;
      if (!navEl || !itemEl) {
        setDesktopIndicator((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }
      const navRect = navEl.getBoundingClientRect();
      const itemRect = itemEl.getBoundingClientRect();
      setDesktopIndicator({
        left: itemRect.left - navRect.left,
        width: itemRect.width,
        visible: itemRect.width > 0,
      });
    };
    updateIndicator();
    window.addEventListener("resize", updateIndicator);
    return () => window.removeEventListener("resize", updateIndicator);
  }, [activeDesktopIndex, page]);

  useEffect(() => {
    if (!accountMenuOpen && !tabletMenuOpen) return undefined;
    const closeOnOutsidePress = (event) => {
      if (accountMenuOpen && !accountRootRef.current?.contains(event.target)) {
        setAccountMenuOpen(false);
      }
      if (tabletMenuOpen && !event.target.closest?.(".pc-header")) {
        setTabletMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePress);
  }, [accountMenuOpen, tabletMenuOpen]);

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

  function handleAccountTrigger() {
    if (authProfile) {
      setAccountMenuOpen((open) => !open);
      setTabletMenuOpen(false);
    } else {
      setLoginDialogOpen(true);
      setTabletMenuOpen(false);
    }
  }

  function handleStartApply() {
    if (onStartApplication) {
      onStartApplication();
      return;
    }
    setPersona?.("candidate");
    navigate("apply-heat");
  }

  const desktopNavItems = [
    {
      key: "exams",
      label: "รายการสอบ",
      href: "#open-exams",
      current: page === "home",
      onClick: (event) => {
        event.preventDefault();
        goToLandingSection(page, navigate, "open-exams");
      },
    },
    {
      key: "status",
      label: "ตรวจสอบสถานะ",
      current: isStatusPage,
      onClick: () => navigate("lookup-choice"),
    },
    {
      key: "final",
      label: "ยืนยันสิทธิ์",
      current: page === "final-confirm",
      onClick: () => navigate("final-confirm"),
    },
    {
      key: "results",
      label: "ประกาศผล",
      current: page === "results",
      onClick: () => navigate("results"),
    },
  ];

  const mobileTabs = [
    {
      key: "home",
      label: "หน้าแรก",
      icon: "home",
      onClick: () => {
        setLoginDialogOpen(false);
        setAccountMenuOpen(false);
        setVisualMobileTab(0);
        lastMobileTabIndex = 0;
        if (page === "home") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else {
          navigate("home");
        }
      },
    },
    {
      key: "apply",
      label: "สมัครสอบ",
      icon: "file",
      onClick: () => {
        setLoginDialogOpen(false);
        setAccountMenuOpen(false);
        setVisualMobileTab(1);
        lastMobileTabIndex = 1;
        handleStartApply();
      },
    },
    {
      key: "applications",
      label: "ใบสมัคร",
      icon: "check",
      onClick: () => {
        setLoginDialogOpen(false);
        setAccountMenuOpen(false);
        setVisualMobileTab(2);
        lastMobileTabIndex = 2;
        navigate("applications");
      },
    },
    {
      key: "results",
      label: "ผลสอบ",
      icon: "award",
      onClick: () => {
        setLoginDialogOpen(false);
        setAccountMenuOpen(false);
        setVisualMobileTab(3);
        lastMobileTabIndex = 3;
        navigate("results");
      },
    },
    {
      key: "account",
      label: "บัญชี",
      icon: "user",
      onClick: () => {
        setVisualMobileTab(4);
        lastMobileTabIndex = 4;
        handleAccountTrigger();
      },
    },
  ];

  return (
    <>
      <header className="pc-header">
        <div className="pc-header-inner">
          <a
            className="pc-brand"
            href="/"
            aria-label="OCEC Portal หน้าแรก"
            onClick={(event) => {
              event.preventDefault();
              navigate("home");
            }}
          >
            <strong className="pc-brand-primary">OCEC</strong>
            <span className="pc-brand-secondary">Portal</span>
          </a>

          <nav className="pc-desktop-nav" aria-label="เมนูหน้าเว็บ" ref={desktopNavRef}>
            {desktopNavItems.map((item, index) => (
              item.href ? (
                <a
                  key={item.key}
                  ref={(el) => { desktopNavRefs.current[index] = el; }}
                  className="pc-nav-item"
                  href={item.href}
                  aria-current={item.current ? "page" : undefined}
                  onClick={item.onClick}
                >
                  {item.label}
                </a>
              ) : (
                <button
                  key={item.key}
                  ref={(el) => { desktopNavRefs.current[index] = el; }}
                  className="pc-nav-item"
                  type="button"
                  aria-current={item.current ? "page" : undefined}
                  onClick={item.onClick}
                >
                  {item.label}
                </button>
              )
            ))}
            <span
              className="pc-desktop-nav-indicator"
              aria-hidden="true"
              style={{
                opacity: desktopIndicator.visible ? 1 : 0,
                transform: `translate3d(${desktopIndicator.left}px, 0, 0)`,
                width: `${desktopIndicator.width}px`,
              }}
            />
          </nav>

          <div className="pc-header-actions" ref={accountRootRef}>
            {authProfile ? (
              <>
                <button
                  className="pc-account-trigger"
                  type="button"
                  aria-haspopup="true"
                  aria-expanded={accountMenuOpen}
                  aria-controls="account-menu-panel"
                  aria-label={`บัญชีผู้ใช้ ${authProfile.name} ${authProfile.email}`}
                  onClick={() => setAccountMenuOpen((open) => !open)}
                >
                  <ProfileAvatar className="pc-account-avatar" src={authProfile.picture} alt={`รูปโปรไฟล์ ${authProfile.name}`} />
                  <span className="pc-account-copy">
                    <strong>{authProfile.name}</strong>
                    <small>{authProfile.email}</small>
                  </span>
                  <Icon name="chevron" size={14} className="pc-account-chevron" />
                </button>
                {accountMenuOpen ? (
                  <div className="pc-account-menu" id="account-menu-panel" aria-label="เมนูบัญชีผู้ใช้">
                    <div className="pc-account-menu-head">
                      <ProfileAvatar className="pc-account-avatar" src={authProfile.picture} alt="" />
                      <span className="pc-account-menu-identity">
                        <strong>{authProfile.name}</strong>
                        <small>{authProfile.email}</small>
                      </span>
                    </div>
                    <button
                      className="pc-account-menu-item"
                      type="button"
                      onClick={() => {
                        setPersona?.("candidate");
                        navigate("applications");
                        setAccountMenuOpen(false);
                      }}
                    >
                      <Icon name="file" size={15} />
                      <span>ใบสมัครของฉัน</span>
                    </button>
                    <button
                      className="pc-account-menu-item pc-account-menu-danger"
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onSignOut();
                      }}
                    >
                      <Icon name="close" size={15} />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <button
                  className="pc-login-btn"
                  type="button"
                  onClick={() => setLoginDialogOpen(true)}
                >
                  <Icon name="user" size={15} />
                  <span>เข้าสู่ระบบ</span>
                </button>
                <button
                  className="pc-icon-btn pc-compact-user-btn"
                  type="button"
                  aria-label="เข้าสู่ระบบ"
                  onClick={() => setLoginDialogOpen(true)}
                >
                  <Icon name="user" size={19} />
                </button>
              </>
            )}

            <button
              className="pc-icon-btn pc-tablet-menu-btn"
              type="button"
              aria-label={tabletMenuOpen ? "ปิดเมนู" : "เปิดเมนู"}
              aria-expanded={tabletMenuOpen}
              aria-controls="pc-tablet-drawer"
              onClick={() => {
                setTabletMenuOpen((open) => !open);
                setAccountMenuOpen(false);
              }}
            >
              <Icon name={tabletMenuOpen ? "close" : "menu"} size={20} />
            </button>
          </div>
        </div>

        <div
          id="pc-tablet-drawer"
          className={`pc-tablet-drawer${tabletMenuOpen ? " is-open" : ""}`}
          aria-hidden={!tabletMenuOpen}
        >
          <div className="pc-tablet-drawer-inner">
            <nav className="pc-tablet-nav" aria-label="เมนูแท็บเล็ต">
              {desktopNavItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`pc-tablet-nav-link${item.current ? " is-active" : ""}`}
                  tabIndex={tabletMenuOpen ? 0 : -1}
                  onClick={(event) => {
                    setTabletMenuOpen(false);
                    item.onClick(event);
                  }}
                >
                  <span>{item.label}</span>
                  <Icon name="chevron" size={14} />
                </button>
              ))}
              <button
                type="button"
                className={`pc-tablet-nav-link${page === "applications" ? " is-active" : ""}`}
                tabIndex={tabletMenuOpen ? 0 : -1}
                onClick={() => {
                  setTabletMenuOpen(false);
                  navigate("applications");
                }}
              >
                <span>ใบสมัครของฉัน</span>
                <Icon name="chevron" size={14} />
              </button>
            </nav>
          </div>
        </div>
      </header>

      <nav className="pc-mobile-bottom-nav" aria-label="เมนูหลักมือถือ">
        <div
          className="pc-mobile-nav-track"
          style={{ "--active-tab": visualMobileTab, "--tab-count": mobileTabs.length }}
        >
          <div className="pc-mobile-nav-bubble-slot" aria-hidden="true">
            <span className="pc-mobile-nav-bubble" />
          </div>
          <div className="pc-mobile-nav-pill-slot" aria-hidden="true">
            <span className="pc-mobile-nav-pill" />
          </div>
          {mobileTabs.map((tab, index) => {
            const isActive = visualMobileTab === index;
            return (
              <button
                key={tab.key}
                type="button"
                className={`pc-mobile-nav-tab${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={tab.onClick}
              >
                <span className="pc-mobile-nav-icon">
                  <Icon name={tab.icon} size={19} />
                </span>
                <span className="pc-mobile-nav-label">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {loginDialogOpen ? (
        <AuthDialog
          requiresRegistrationLogin={requiresRegistrationLogin}
          backendEnabled={backendEnabled}
          demoSignIn={demoSignIn}
          dialogRef={dialogRef}
          onKeyDown={keepFocusInsideDialog}
          onDismiss={dismissLoginDialog}
          onBackdropMouseDown={(event) => {
            if (!requiresRegistrationLogin && event.target === event.currentTarget) setLoginDialogOpen(false);
          }}
          onGoogleSignIn={() => {
            onSignIn(demoProfile);
            setLoginDialogOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
