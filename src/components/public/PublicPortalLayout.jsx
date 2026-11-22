import { Icon } from "../ui/index.jsx";
import { HomeFooter } from "../../features/home/HomeSections.jsx";
import { PublicPortalFooter } from "./PublicPortalFooter.jsx";
import { PublicPortalHeader } from "./PublicPortalHeader.jsx";
import { PublicGradientBackground } from "./PublicGradientBackground.jsx";

export function PublicPortalLayout({
  page,
  navigate,
  setPersona,
  authProfile,
  onSignIn,
  onSignOut,
  demoProfile,
  backendEnabled,
  demoSignIn,
  toast,
  setToast,
  scheduleNotice,
  children,
}) {
  const isPearlPage = page === "results";
  return (
    <div className={isPearlPage ? "public-landing public-portal-page pc-pearl-page" : "public-landing public-portal-page public-portal-gradient"}>
      {isPearlPage ? null : <PublicGradientBackground />}
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหาหลัก</a>
      {isPearlPage ? null : scheduleNotice}
      <PublicPortalHeader
        page={page}
        navigate={navigate}
        setPersona={setPersona}
        authProfile={authProfile}
        onSignIn={onSignIn}
        onSignOut={onSignOut}
        demoProfile={demoProfile}
        backendEnabled={backendEnabled}
        demoSignIn={demoSignIn}
      />
      <main id="landing-main" className={isPearlPage ? "pc-pearl-main" : "public-page-main"} tabIndex="-1">{children}</main>
      {isPearlPage ? <HomeFooter /> : <PublicPortalFooter />}
      {toast ? <div className="toast" role="status" aria-live="polite"><span><Icon name="check" size={16} /></span><p>{toast}</p><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div> : null}
    </div>
  );
}
