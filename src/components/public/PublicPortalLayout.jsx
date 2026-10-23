import { Icon } from "../ui/index.jsx";
import { PublicPortalFooter } from "./PublicPortalFooter.jsx";
import { PublicPortalHeader } from "./PublicPortalHeader.jsx";

export function PublicPortalLayout({
  page,
  navigate,
  setPersona,
  authProfile,
  onSignIn,
  onSignOut,
  demoProfile,
  backendEnabled,
  toast,
  setToast,
  scheduleNotice,
  children,
}) {
  return (
    <div className="public-landing public-portal-page">
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหาหลัก</a>
      {scheduleNotice}
      <PublicPortalHeader
        page={page}
        navigate={navigate}
        setPersona={setPersona}
        authProfile={authProfile}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        demoProfile={demoProfile}
        backendEnabled={backendEnabled}
      />
      <main id="landing-main" className="public-page-main" tabIndex="-1">{children}</main>
      <PublicPortalFooter />
      {toast ? <div className="toast" role="status" aria-live="polite"><span><Icon name="check" size={16} /></span><p>{toast}</p><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div> : null}
    </div>
  );
}
