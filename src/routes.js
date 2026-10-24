export const pageLabels = {
  home: "ภาพรวม",
  "apply-heat": "สมัครสอบ",
  "apply-final": "สมัครสอบ Final",
  applications: "ใบสมัครของฉัน",
  "school-application-group": "รายชื่อผู้สมัครผ่านโรงเรียน",
  "application-detail": "รายละเอียดใบสมัคร",
  "lookup-choice": "ตรวจสอบ / แก้ไขใบสมัคร",
  "check-status": "ตรวจสอบสถานะ",
  "edit-verify": "ยืนยันตัวตนเพื่อแก้ไข",
  "edit-application": "แก้ไขใบสมัคร",
  "slip-upload": "อัปโหลดหลักฐานการชำระเงินใหม่",
  "slip-replacement": "ส่งหลักฐานการชำระเงินใหม่",
  "final-confirm": "ยืนยันสิทธิ์ Final",
  results: "ประกาศผล",
  "admin-login": "เข้าสู่ระบบผู้ดูแลระบบ",
  "admin-home": "ภาพรวมผู้ดูแลระบบ",
  "admin-review": "ตรวจใบสมัคร",
  "admin-round": "รายการสอบและกำหนดการ",
  "admin-form-options": "ข้อมูลตัวเลือกในแบบฟอร์ม",
  "admin-results": "นำเข้าผลสอบ",
  "admin-final-ids": "เลขประจำตัว Final",
  "admin-sheets": "Google Sheets",
  "admin-mock-papers": "Mock และข้อสอบเก่า",
  "admin-application-edit": "แก้ไขใบสมัคร (ผู้ดูแลระบบ)",
  "not-found": "ไม่พบหน้า",
};

export const ADMIN_PORTAL_PATH = "/portal-admin";

export function isAdminPortalPath(pathname = window.location.pathname) {
  return pathname.replace(/\/+$/, "") === ADMIN_PORTAL_PATH || pathname.startsWith(`${ADMIN_PORTAL_PATH}/`);
}

const staticRoutePaths = {
  home: "/", "apply-heat": "/apply", "apply-final": "/apply/final", applications: "/applications",
  "lookup-choice": "/lookup", "check-status": "/status", "edit-verify": "/edit/verify",
  "slip-upload": "/slip-upload", "slip-replacement": "/slip-replacement", "final-confirm": "/final/confirm", results: "/results",
  "admin-login": ADMIN_PORTAL_PATH, "admin-home": `${ADMIN_PORTAL_PATH}/dashboard`,
  "admin-review": `${ADMIN_PORTAL_PATH}/review`, "admin-application-edit": `${ADMIN_PORTAL_PATH}/applications`,
  "admin-round": `${ADMIN_PORTAL_PATH}/exams`, "admin-form-options": `${ADMIN_PORTAL_PATH}/form-options`,
  "admin-results": `${ADMIN_PORTAL_PATH}/results`, "admin-final-ids": `${ADMIN_PORTAL_PATH}/final-ids`,
  "admin-sheets": `${ADMIN_PORTAL_PATH}/integrations/sheets`, "admin-mock-papers": `${ADMIN_PORTAL_PATH}/mock-papers`,
  "not-found": "/404",
};

export function routeUrlFor(page, applicationId = "") {
  if (page === "school-application-group") return applicationId ? `/applications/school/${encodeURIComponent(applicationId)}` : "/applications";
  if (page === "application-detail") return applicationId ? `/applications/${encodeURIComponent(applicationId)}` : "/applications";
  if (page === "edit-application") return applicationId ? `/applications/${encodeURIComponent(applicationId)}/edit` : "/applications";
  if (page === "admin-review") return applicationId ? `${ADMIN_PORTAL_PATH}/applications/${encodeURIComponent(applicationId)}` : `${ADMIN_PORTAL_PATH}/review`;
  if (page === "admin-application-edit") return applicationId ? `${ADMIN_PORTAL_PATH}/applications/${encodeURIComponent(applicationId)}/edit` : `${ADMIN_PORTAL_PATH}/applications`;
  if (page === "slip-upload") return applicationId ? `/slip-upload/${encodeURIComponent(applicationId)}` : "/slip-upload";
  if (page === "edit-verify") return applicationId ? `/edit/verify/${encodeURIComponent(applicationId)}` : "/edit/verify";
  return staticRoutePaths[page] || "/";
}

function decodePathSegment(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

export function routeFromLocation(location = window.location) {
  const pathname = location.pathname.replace(/\/+$/, "") || "/";
  let route = { page: "home", applicationId: "", legacy: false };
  if (pathname === ADMIN_PORTAL_PATH) {
    const oldAdminPage = location.hash.slice(1);
    route = oldAdminPage.startsWith("admin-") && pageLabels[oldAdminPage]
      ? { page: oldAdminPage, applicationId: "", legacy: true }
      : { page: "admin-login", applicationId: "" };
  } else if (pathname.startsWith(`${ADMIN_PORTAL_PATH}/applications/`)) {
    const match = pathname.match(/^\/portal-admin\/applications\/([^/]+)(\/edit)?$/);
    if (match) route = { page: match[2] ? "admin-application-edit" : "admin-review", applicationId: decodePathSegment(match[1]) };
  } else if (pathname.startsWith(`${ADMIN_PORTAL_PATH}/`)) {
    const pathPage = Object.entries(staticRoutePaths).find(([page, path]) => page.startsWith("admin-") && path === pathname)?.[0];
    if (pathPage) route = { page: pathPage === "admin-application-edit" ? "admin-review" : pathPage, applicationId: "" };
  } else if (pathname.startsWith("/applications/school/")) {
    const match = pathname.match(/^\/applications\/school\/([^/]+)$/);
    if (match) route = { page: "school-application-group", applicationId: decodePathSegment(match[1]) };
  } else if (pathname.startsWith("/applications/")) {
    const match = pathname.match(/^\/applications\/([^/]+)(\/edit)?$/);
    if (match) route = { page: match[2] ? "edit-application" : "application-detail", applicationId: decodePathSegment(match[1]) };
  } else if (pathname.startsWith("/slip-upload/")) {
    const match = pathname.match(/^\/slip-upload\/([^/]+)$/);
    if (match) route = { page: "slip-upload", applicationId: decodePathSegment(match[1]) };
  } else if (pathname.startsWith("/edit/verify/")) {
    const match = pathname.match(/^\/edit\/verify\/([^/]+)$/);
    if (match) route = { page: "edit-verify", applicationId: decodePathSegment(match[1]) };
  } else {
    const pathPage = Object.entries(staticRoutePaths).find(([, path]) => path === pathname)?.[0];
    if (pathPage) route = { page: pathPage, applicationId: "" };
  }
  if (route.page === "home" && location.hash) {
    const oldPage = location.hash.slice(1);
    if (pageLabels[oldPage]) route = { page: oldPage, applicationId: "", legacy: true };
  }
  if (route.page === "home" && pathname !== "/") route = { page: "not-found", applicationId: "", legacy: false };
  return route;
}

export function isKnownSpaLocation(location) {
  return routeFromLocation(location).page !== "not-found";
}
