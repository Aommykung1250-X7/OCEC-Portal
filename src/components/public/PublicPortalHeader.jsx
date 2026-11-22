import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Icon, ProfileAvatar } from "../ui/index.jsx";
import { AuthDialog } from "./AuthDialog.jsx";

// Persist last active mobile tab index across route transitions so the floating cobalt bubble glides smoothly even if the header remounts.
let lastMobileTabIndex = 0;

function resolveNavTabIndex(page) {
  if (page === "home") return 0;
  if (page === "results") return 1;
  if (["applications", "application-detail", "school-application-group"].includes(page)) return 2;
  if (["final-confirm", "apply-final"].includes(page)) return 3;
  if (["lookup-choice", "check-status", "edit-verify", "edit-application", "slip-upload", "slip-replacement"].includes(page)) return 4;
  return -1;
}

export function PublicPortalHeader({
  page,
  navigate,
  setPersona,
  authProfile,
  onSignIn,
  onSignOut,
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
  const activeTabIndex = resolveNavTabIndex(page);
  const [visualMobileTab, setVisualMobileTab] = useState(lastMobileTabIndex);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (activeTabIndex >= 0) {
        setVisualMobileTab(activeTabIndex);
        lastMobileTabIndex = activeTabIndex;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTabIndex]);

  useEffect(() => {
    setLoginDialogOpen(requiresRegistrationLogin);
  }, [requiresRegistrationLogin]);

  useEffect(() => {
    setTabletMenuOpen(false);
  }, [page]);

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const navEl = desktopNavRef.current;
      const itemEl = activeTabIndex >= 0 ? desktopNavRefs.current[activeTabIndex] : null;
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
  }, [activeTabIndex, page]);

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

  const navItems = [
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
      key: "results",
      label: "ผลสอบ",
      icon: "award",
      onClick: () => {
        setLoginDialogOpen(false);
        setAccountMenuOpen(false);
        setVisualMobileTab(1);
        lastMobileTabIndex = 1;
        navigate("results");
      },
    },
    {
      key: "applications",
      label: "ใบสมัคร",
      icon: "file",
      onClick: () => {
        setLoginDialogOpen(false);
        setAccountMenuOpen(false);
        setVisualMobileTab(2);
        lastMobileTabIndex = 2;
        navigate("applications");
      },
    },
    {
      key: "final",
      label: "ยืนยันสิทธิ์",
      icon: "shield",
      onClick: () => {
        setLoginDialogOpen(false);
        setAccountMenuOpen(false);
        setVisualMobileTab(3);
        lastMobileTabIndex = 3;
        navigate("final-confirm");
      },
    },
    {
      key: "lookup",
      label: "ตรวจสอบ/แก้ไข",
      icon: "search",
      onClick: () => {
        setLoginDialogOpen(false);
        setAccountMenuOpen(false);
        setVisualMobileTab(4);
        lastMobileTabIndex = 4;
        navigate("lookup-choice");
      },
    },
  ];

  const hasActiveMobileTab = activeTabIndex >= 0;

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
              navItems[0].onClick();
            }}
          >
            <strong className="pc-brand-primary">OCEC</strong>
            <span className="pc-brand-secondary">Portal</span>
          </a>

          <nav className="pc-desktop-nav" aria-label="เมนูหน้าเว็บ" ref={desktopNavRef}>
            {navItems.map((item, index) => (
              <button
                key={item.key}
                ref={(el) => { desktopNavRefs.current[index] = el; }}
                className="pc-nav-item"
                type="button"
                aria-current={activeTabIndex === index ? "page" : undefined}
                onClick={item.onClick}
              >
                {item.label}
              </button>
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
              {navItems.map((item, index) => (
                <button
                  key={item.key}
                  type="button"
                  className={`pc-tablet-nav-link${activeTabIndex === index ? " is-active" : ""}`}
                  aria-current={activeTabIndex === index ? "page" : undefined}
                  tabIndex={tabletMenuOpen ? 0 : -1}
                  onClick={() => {
                    setTabletMenuOpen(false);
                    item.onClick();
                  }}
                >
                  <span className="pc-tablet-nav-link-main">
                    <Icon name={item.icon} size={17} />
                    <span>{item.label}</span>
                  </span>
                  <Icon name="chevron" size={14} />
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <nav className="pc-mobile-bottom-nav" aria-label="เมนูหลักมือถือ">
        <div
          className={`pc-mobile-nav-track${hasActiveMobileTab ? "" : " is-inactive"}`}
          style={{ "--active-tab": visualMobileTab, "--tab-count": navItems.length }}
        >
          <div className="pc-mobile-nav-bubble-slot" aria-hidden="true">
            <span className="pc-mobile-nav-bubble" />
          </div>
          <div className="pc-mobile-nav-pill-slot" aria-hidden="true">
            <span className="pc-mobile-nav-pill" />
          </div>
          {navItems.map((tab, index) => {
            const isActive = hasActiveMobileTab && visualMobileTab === index;
            return (
              <button
                key={tab.key}
                type="button"
                className={`pc-mobile-nav-tab${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                onClick={tab.onClick}
              >
                <span className="pc-mobile-nav-icon">
                  <Icon name={tab.icon} size={18} />
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
