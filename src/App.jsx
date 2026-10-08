import React, { useEffect, useId, useMemo, useRef, useState } from "react";

const seedApplications = [
  {
    id: "heat-01",
    owner: "coordinator",
    kind: "Heat",
    exam: "OCEC Heat รอบที่ 1",
    year: "2569",
    candidate: "Nicha Srisawat",
    school: "Srinakharinwirot Demonstration School",
    grade: "มัธยมศึกษาปีที่ 5",
    format: "On-site",
    center: "ศูนย์สอบกรุงเทพฯ",
    contactEmail: "nicha.student@example.com",
    phoneLast4: "4821",
    submitted: "8 ต.ค. 2569",
    status: "pending",
    heatId: "2080014",
    finalId: "",
    result: "pass",
    canEdit: false,
    slipIssue: "",
    source: "school",
    batchId: "school-batch-2569-01",
    slipFileName: "payment-slip-heat-01.pdf",
    competitions: [
      { id: "bbb", name: "Big Bay Bei Mathematics", short: "BBB", grade: "มัธยมศึกษาปีที่ 5", fee: 755 },
      { id: "hkiso", name: "HKISO Science", short: "HKISO", grade: "มัธยมศึกษาปีที่ 5", fee: 755 },
    ],
    pastPapers: [{ id: "hkiso-2024", name: "HKISO Heat Round 2024–2025", fee: 200 }],
    registrationFee: 1510,
    pastPapersTotal: 200,
    totalPayment: 1710,
  },
  {
    id: "heat-02",
    owner: "coordinator",
    kind: "Heat",
    exam: "OCEC Heat รอบที่ 1",
    year: "2569",
    candidate: "Thanakorn Wattanakul",
    school: "Triam Udom Suksa School",
    grade: "มัธยมศึกษาปีที่ 6",
    format: "On-site",
    center: "ศูนย์สอบกรุงเทพฯ",
    contactEmail: "thanakorn.w@example.com",
    phoneLast4: "1936",
    submitted: "7 ต.ค. 2569",
    status: "confirmed",
    heatId: "2080015",
    finalId: "",
    result: "pass",
    canEdit: true,
    slipIssue: "",
    source: "school",
    batchId: "school-batch-2569-01",
    slipFileName: "payment-slip-heat-02.jpg",
    competitions: [
      { id: "bbb", name: "Big Bay Bei Mathematics", short: "BBB", grade: "มัธยมศึกษาปีที่ 6", fee: 755 },
      { id: "hkico", name: "HKICO Computer", short: "HKICO", grade: "มัธยมศึกษาปีที่ 6", fee: 755 },
    ],
    pastPapers: [{ id: "bbb-2025", name: "Big Bay Bei Qualifier Round 2025", fee: 250 }],
    registrationFee: 1510,
    pastPapersTotal: 250,
    totalPayment: 1760,
  },
  {
    id: "final-01",
    owner: "coordinator",
    kind: "Final",
    exam: "OCEC Final 2569",
    year: "2569",
    candidate: "Nicha Srisawat",
    school: "Srinakharinwirot Demonstration School",
    grade: "มัธยมศึกษาปีที่ 5",
    format: "On-site",
    center: "ศูนย์สอบฮ่องกง",
    contactEmail: "nicha.student@example.com",
    phoneLast4: "4821",
    submitted: "8 ต.ค. 2569",
    status: "pending",
    heatId: "2080014",
    finalId: "",
    result: "",
    canEdit: false,
    slipIssue: "",
    source: "self",
    slipFileName: "payment-slip-final-01.pdf",
    competitions: [{ id: "final", name: "OCEC Final", short: "Final", grade: "มัธยมศึกษาปีที่ 5", fee: 1550 }],
    pastPapers: [],
    registrationFee: 1550,
    pastPapersTotal: 0,
    totalPayment: 1550,
  },
  {
    id: "heat-03",
    owner: "candidate",
    kind: "Heat",
    exam: "OCEC Heat รอบที่ 1",
    year: "2568",
    candidate: "Pattara Chaiyasit",
    school: "Satit Kaset School",
    grade: "มัธยมศึกษาปีที่ 5",
    format: "On-site",
    center: "ศูนย์สอบเชียงใหม่",
    contactEmail: "pattara.c@example.com",
    phoneLast4: "6027",
    submitted: "14 ก.พ. 2568",
    status: "confirmed",
    heatId: "3050042",
    finalId: "",
    result: "not-passed",
    canEdit: false,
    slipIssue: "",
    source: "self",
    slipFileName: "payment-slip-heat-03.png",
    competitions: [{ id: "hkico", name: "HKICO Computer", short: "HKICO", grade: "มัธยมศึกษาปีที่ 5", fee: 755 }],
    pastPapers: [{ id: "hkico-2023", name: "HKICO Heat Round 2023–2024", fee: 250 }],
    registrationFee: 755,
    pastPapersTotal: 250,
    totalPayment: 1005,
  },
  {
    id: "heat-04",
    owner: "coordinator",
    kind: "Heat",
    exam: "OCEC Heat รอบที่ 2",
    year: "2569",
    candidate: "Pimchanok Rattanaporn",
    school: "Bangkok Patana School",
    grade: "BBB: มัธยมศึกษาปีที่ 4 · HKISO: มัธยมศึกษาปีที่ 4",
    format: "Online Exam",
    center: "Online Exam",
    contactEmail: "pimchanok.r@example.com",
    phoneLast4: "7634",
    submitted: "8 ต.ค. 2569",
    status: "pending",
    heatId: "",
    finalId: "",
    result: "",
    canEdit: false,
    slipIssue: "เปิดสลิปไม่ได้",
    source: "school",
    batchId: "school-batch-2569-02",
    slipFileName: "payment-slip-pimchanok.pdf",
    competitions: [
      { id: "bbb", name: "Big Bay Bei Mathematics", short: "BBB", grade: "มัธยมศึกษาปีที่ 4", fee: 655 },
      { id: "hkiso", name: "HKISO Science", short: "HKISO", grade: "มัธยมศึกษาปีที่ 4", fee: 655 },
    ],
    pastPapers: [],
    registrationFee: 1310,
    pastPapersTotal: 0,
    totalPayment: 1310,
  },
  {
    id: "final-02",
    owner: "coordinator",
    kind: "Final",
    exam: "OCEC Final 2569",
    year: "2569",
    candidate: "Thanakorn Wattanakul",
    school: "Triam Udom Suksa School",
    grade: "มัธยมศึกษาปีที่ 6",
    format: "Paper-Based",
    center: "ศูนย์สอบฮ่องกง",
    contactEmail: "thanakorn.w@example.com",
    phoneLast4: "1936",
    submitted: "8 ต.ค. 2569",
    status: "confirmed",
    heatId: "2080015",
    finalId: "",
    result: "",
    canEdit: true,
    slipIssue: "",
    source: "school",
    batchId: "school-final-2569-01",
    slipFileName: "payment-slip-final-02.pdf",
    competitions: [{ id: "final", name: "OCEC Final", short: "Final", grade: "มัธยมศึกษาปีที่ 6", fee: 1550 }],
    pastPapers: [],
    registrationFee: 1550,
    pastPapersTotal: 0,
    totalPayment: 1550,
  },
  {
    id: "final-03",
    owner: "coordinator",
    kind: "Final",
    exam: "OCEC Final 2569",
    year: "2569",
    candidate: "Siriporn Rattanakorn",
    school: "Satit Chula School",
    grade: "มัธยมศึกษาปีที่ 5",
    format: "Online Exam",
    center: "Online Exam",
    contactEmail: "siriporn.r@example.com",
    phoneLast4: "7042",
    submitted: "8 ต.ค. 2569",
    status: "pending",
    heatId: "",
    finalId: "",
    result: "",
    canEdit: false,
    slipIssue: "",
    source: "school",
    batchId: "school-final-2569-02",
    slipFileName: "payment-slip-final-03.pdf",
    competitions: [{ id: "final", name: "OCEC Final", short: "Final", grade: "มัธยมศึกษาปีที่ 5", fee: 1350 }],
    pastPapers: [],
    registrationFee: 1350,
    pastPapersTotal: 0,
    totalPayment: 1350,
  },
];

const demoExamCatalog = [
  {
    id: "heat-2569-round-1",
    title: "OCEC Heat 2569",
    year: "2569",
    round: "รอบคัดเลือก · รอบที่ 1",
    openDate: "2026-10-01",
    closeDate: "2026-11-30",
    examDate: "2026-12-13",
    editCloseDate: "2026-11-30",
    closes: "30 พฤศจิกายน 2569",
    isOpen: true,
    accent: "blue",
    description: "เลือกระดับชั้น รูปแบบสอบ และศูนย์สอบในฟอร์มสมัคร",
  },
  {
    id: "heat-2569-round-2",
    title: "OCEC Heat 2569",
    year: "2569",
    round: "รอบคัดเลือก · รอบที่ 2",
    openDate: "2026-10-15",
    closeDate: "2026-12-15",
    examDate: "2026-12-27",
    editCloseDate: "2026-12-15",
    closes: "15 ธันวาคม 2569",
    isOpen: true,
    accent: "coral",
    description: "เลือกสมัครพร้อมรอบอื่นได้ในฟอร์มเดียว ตรวจวันปิดรับก่อนส่ง",
  },
  {
    id: "heat-2570-round-1",
    title: "OCEC Heat 2570",
    year: "2570",
    round: "รอบคัดเลือก · รอบที่ 1",
    openDate: "2026-12-01",
    closeDate: "2027-01-15",
    examDate: "2027-02-14",
    editCloseDate: "2027-01-15",
    closes: "15 มกราคม 2570",
    isOpen: false,
    accent: "yellow",
    description: "กำหนดการจะแสดงเมื่อเปิดรับ และเลือกสมัครได้ในฟอร์มเดียว",
  },
  {
    id: "heat-2570-round-2",
    title: "OCEC Heat 2570",
    year: "2570",
    round: "รอบคัดเลือก · รอบที่ 2",
    openDate: "2026-12-15",
    closeDate: "2027-01-31",
    examDate: "2027-02-28",
    editCloseDate: "2027-01-31",
    closes: "31 มกราคม 2570",
    isOpen: false,
    accent: "violet",
    description: "รอติดตามสถานะและกำหนดการเปิดรับจากโครงการ",
  },
];

function formatThaiDate(date) {
  if (!date) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

const demoGoogleProfile = {
  name: "Nicha Srisawat",
  email: "nicha.student@example.com",
  picture: "/demo-google-avatar.svg",
};

const pageLabels = {
  home: "ภาพรวม",
  "apply-heat": "สมัครสอบ",
  "apply-final": "สมัครสอบ Final",
  applications: "ใบสมัครของฉัน",
  "application-detail": "รายละเอียดใบสมัคร",
  "lookup-choice": "ค้นหา / แก้ไขใบสมัคร",
  "check-status": "ค้นหาสถานะ",
  "edit-verify": "ยืนยันตัวตนเพื่อแก้ไข",
  "edit-application": "แก้ไขใบสมัคร",
  "slip-upload": "อัปโหลดสลิปใหม่",
  "final-confirm": "ยืนยันสิทธิ์ Final",
  results: "ประกาศผล",
  "admin-home": "ภาพรวมแอดมิน",
  "admin-review": "ตรวจใบสมัคร",
  "admin-round": "ตั้งค่ารอบสอบ",
  "admin-results": "ผลสอบ Heat",
  "admin-final-ids": "เลขประจำตัว Final",
  "admin-sheets": "Google Sheets",
};

const iconPaths = {
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9.5V21h14V9.5" /><path d="M9 21v-7h6v7" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
  check: <><path d="m5 12 4 4L19 6" /><circle cx="12" cy="12" r="9" /></>,
  award: <><circle cx="12" cy="8" r="6" /><path d="m8.5 13-1 8 4.5-2 4.5 2-1-8" /><path d="m9.5 8 1.7 1.7L14.8 6" /></>,
  grid: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.7a8 8 0 0 1-1.8 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.8-1l-1.7.7-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.7a8 8 0 0 1 1.8-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.8 1l1.7-.7 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2Z" transform="translate(-1 -1)" /></>,
  upload: <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M4 16v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" /></>,
  sync: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.4-3" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></>,
  edit: <><path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15z" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  building: <><path d="M3 21h18M5 21V5l7-3 7 3v16M9 9h1M14 9h1M9 13h1M14 13h1M10 21v-4h4v4" /></>,
  download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5M4 21h16" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 0 1 4.8 1c0 1.7-2.4 2-2.4 4M12 17h.01" /></>,
  shield: <><path d="M12 3 20 6v5c0 5-3.4 8.7-8 10-4.6-1.3-8-5-8-10V6z" /><path d="m9 12 2 2 4-4" /></>,
  hash: <><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" /></>,
  sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
};

function Icon({ name, size = 18, className = "" }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {iconPaths[name] || iconPaths.file}
    </svg>
  );
}

function BrandMark() {
  return (
    <span className="brand-logo-window" role="img" aria-label="OCEC TH">
      <img src="/ocec-logo.png" alt="" />
    </span>
  );
}

function Button({ children, variant = "primary", icon, type = "button", onClick, disabled = false, className = "" }) {
  return (
    <button
      className={"button button-" + variant + " " + className}
      type={type}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? <Icon name={icon} size={17} /> : null}
      <span>{children}</span>
    </button>
  );
}

function StatusBadge({ status }) {
  const pending = status !== "confirmed";
  return (
    <span className={"status-badge " + (pending ? "status-pending" : "status-confirmed")}>
      <span className="status-dot" aria-hidden="true" />
      {pending ? "รออนุมัติ/ตรวจสอบสลิป" : "ยืนยันใบสมัคร"}
    </span>
  );
}

function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {action ? <div className="heading-action">{action}</div> : null}
    </div>
  );
}

function Field({ label, hint, required = false, children, className = "" }) {
  const id = useId();
  const hintId = id + "-hint";
  let assigned = false;
  function labelControl(element) {
    if (!React.isValidElement(element)) return element;
    if (!assigned && typeof element.type === "string" && ["input", "select", "textarea"].includes(element.type)) {
      assigned = true;
      return React.cloneElement(element, {
        id: element.props.id || id,
        "aria-labelledby": [element.props["aria-labelledby"], id + "-label"].filter(Boolean).join(" "),
        "aria-describedby": [element.props["aria-describedby"], hint ? hintId : ""].filter(Boolean).join(" ") || undefined,
      });
    }
    if (element.props.children) {
      return React.cloneElement(element, undefined, React.Children.map(element.props.children, labelControl));
    }
    return element;
  }
  const controls = React.Children.map(children, labelControl);
  return (
    <div className={"field " + className}>
      <label id={id + "-label"} htmlFor={id}>
        {label}{required ? <span className="required-mark"> *</span> : null}
      </label>
      {controls}
      {hint ? <p className="field-hint" id={hintId}>{hint}</p> : null}
    </div>
  );
}

const FORM_COMPETITIONS = [
  { id: "bbb", short: "BBB", name: "Big Bay Bei (BBB)", subject: "Mathematics", grades: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
  { id: "hkiso", short: "HKISO", name: "HKISO", subject: "Science", grades: ["Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
  { id: "hkico", short: "HKICO", name: "HKICO", subject: "Computer", grades: ["Primary 2 — Scratch", "Primary 3 — Scratch", "Primary 4 — Scratch", "Primary 5 — Blockly", "Primary 6 — Blockly", "Secondary 1 — Blockly", "Secondary 2 — Python", "Secondary 3 — Python", "Senior Secondary — Python"] },
];

const FORM_PAST_PAPER_GROUPS = [
  { id: "hkiso", title: "HKISO Past Papers", items: [
    { id: "hkiso-2023", title: "HKISO Heat Round 2023–2024", detail: "English Version", price: 200 },
    { id: "hkiso-2024", title: "HKISO Heat Round 2024–2025", detail: "English Version", price: 200 },
  ] },
  { id: "hkico", title: "HKICO Past Papers", items: [
    { id: "hkico-2023", title: "HKICO Heat Round 2023–2024", detail: "English Version", price: 250 },
    { id: "hkico-2024", title: "HKICO Heat Round 2024–2025", detail: "English Version", price: 250 },
  ] },
  { id: "bbb", title: "Big Bay Bei Past Papers", items: [
    { id: "bbb-2024", title: "Qualifier Round 2024", detail: "PDF English + Thai · Thai VDO", price: 250 },
    { id: "bbb-2025", title: "Qualifier Round 2025", detail: "PDF English + Thai · Thai VDO", price: 250 },
    { id: "bbb-2026", title: "Qualifier Round 2026", detail: "PDF English + Thai · Thai VDO", price: 250 },
  ] },
];

const FORM_CENTERS = ["Amnat Charoen", "Bangkok", "Buriram", "Chaiyaphum", "Chiang Mai", "Chiang Rai", "Chonburi", "Chumphon", "Khon Kaen", "Krabi", "Lampang", "Mukdahan", "Nakhon Ratchasima", "Nakhon Sawan", "Nonthaburi", "Pathum Thani", "Phatthalung", "Phitsanulok", "Phuket", "Ratchaburi", "Rayong", "Roi Et", "Sakon Nakhon", "Samut Prakan", "Saraburi", "Songkhla", "Surat Thani", "Trang", "Ubon Ratchathani", "Udon Thani"];
const FORM_SCHOOLS = ["AIT International School", "Aiyasiri School", "Amnuay Silpa School", "Bangkok Christian College", "Bangkok Patana School", "Chulalongkorn University Demonstration School", "Kasetsart University Laboratory School", "Satit Prasarnmit Demonstration School", "Triam Udom Suksa School", "Other"];

function createSchoolApplicant(id, prefill) {
  return {
    id,
    firstName: "",
    lastName: "",
    thaiFirstName: "",
    thaiLastName: "",
    gender: "",
    dateOfBirth: "",
    schoolName: "",
    certificateSchoolName: "",
    email: prefill?.contactEmail || "",
    address1: "",
    address2: "",
    city: "",
    province: "",
    postalCode: "",
    phone: "",
    competitionIds: [],
    grades: {},
    format: "Paper-Based",
    center: prefill?.center || "",
    pastPaperIds: [],
    fileName: "",
  };
}

function ApplicationCard({ application, onOpen }) {
  return (
    <article className="application-card">
      <div className="application-card-top">
        <div className="candidate-avatar">{application.candidate.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
        <div className="application-card-title">
          <p className="application-kind">{application.kind} · {application.year}</p>
          <h3>{application.candidate}</h3>
          <p>{application.school}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>
      <div className="application-meta-grid">
        <div>
          <span>รายการสอบ</span>
          <strong>{application.exam}</strong>
        </div>
        <div>
          <span>เลขประจำตัวสอบ</span>
          <strong>{application.kind === "Final" ? (application.finalId || "รอเลขประจำตัว") : (application.heatId || "รอเลขประจำตัว")}</strong>
        </div>
        <div>
          <span>วันที่ส่งใบสมัคร</span>
          <strong>{application.submitted}</strong>
        </div>
      </div>
      <div className="application-card-footer">
        <span className="muted-inline"><Icon name="building" size={15} />{application.center}</span>
        <Button variant="text" icon="arrow" onClick={onOpen}>ดูรายละเอียด</Button>
      </div>
    </article>
  );
}

function Sidebar({ page, persona, applications = [], navigate, open, onClose, notify }) {
  const pendingReviewCount = applications.filter((item) => item.status === "pending").length;
  const mainItems = [
    { id: "home", label: "ภาพรวม", icon: "home" },
    { id: "apply-heat", label: "สมัครสอบ", icon: "plus" },
    { id: "applications", label: "ใบสมัครของฉัน", icon: "file", count: persona === "coordinator" ? "3" : "2" },
    { id: "lookup-choice", label: "ค้นหา / แก้ไขใบสมัคร", icon: "search" },
    { id: "final-confirm", label: "ยืนยันสิทธิ์ Final", icon: "award" },
    { id: "results", label: "ประกาศผล", icon: "grid" },
  ];
  const adminItems = [
    { id: "admin-home", label: "ภาพรวมแอดมิน", icon: "grid" },
    { id: "admin-review", label: "ตรวจใบสมัคร", icon: "file", count: String(pendingReviewCount) },
    { id: "admin-round", label: "ตั้งค่ารอบสอบ", icon: "calendar" },
    { id: "admin-results", label: "ผลสอบ Heat", icon: "award" },
    { id: "admin-final-ids", label: "เลขประจำตัว Final", icon: "users" },
    { id: "admin-sheets", label: "Google Sheets", icon: "sync" },
  ];
  const renderItems = (items) => items.map((item) => (
    <a
      href={"#" + item.id}
      className={"nav-link " + (page === item.id ? "nav-link-active" : "")}
      key={item.id}
      onClick={() => navigate(item.id)}
    >
      <Icon name={item.icon} size={18} />
      <span>{item.label}</span>
      {item.count ? <span className="nav-count">{item.count}</span> : null}
    </a>
  ));

  return (
    <>
      {open ? <button className="sidebar-scrim" aria-label="ปิดเมนู" onClick={onClose} /> : null}
      <aside className={"sidebar " + (open ? "sidebar-open" : "")}>
        <div className="brand-lockup">
          <BrandMark />
          <div>
            <strong>OCEC Portal</strong>
            <span>ระบบสมัครสอบ</span>
          </div>
          <button className="icon-button sidebar-close" aria-label="ปิดเมนู" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="round-switch">
          <span className="round-icon"><Icon name="calendar" size={17} /></span>
          <div><span>รอบการสอบ</span><strong>ประจำปี 2569</strong></div>
          <span className="round-caret">⌄</span>
        </div>
        <nav aria-label={persona === "admin" ? "จัดการระบบ" : "เมนูหลัก"}>
          {persona !== "admin" ? <>
            <p className="nav-section-title">เมนูหลัก</p>
            <div className="nav-list">{renderItems(mainItems)}</div>
          </> : null}
          {persona === "admin" ? (
            <>
              <p className="nav-section-title nav-section-admin">จัดการระบบ</p>
              <div className="nav-list">{renderItems(adminItems)}</div>
            </>
          ) : null}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <span className="help-icon"><Icon name="help" size={17} /></span>
            <strong>ต้องการความช่วยเหลือ?</strong>
            <p>ดูคำแนะนำการสมัครและการใช้งาน</p>
            <a href="#help" onClick={(event) => { event.preventDefault(); notify("ศูนย์ช่วยเหลือเป็นตัวอย่างสำหรับ prototype"); }}>ศูนย์ช่วยเหลือ <Icon name="arrow" size={14} /></a>
          </div>
          <div className="sidebar-version"><span className="online-dot" />ระบบพร้อมใช้งาน <span>v1.0</span></div>
        </div>
      </aside>
    </>
  );
}

function Topbar({ title, persona, setPersona, menuOpen, setMenuOpen, navigate }) {
  const roleNames = {
    guest: "บุคคลทั่วไป",
    candidate: "ผู้สมัคร",
    coordinator: "ผู้ประสานงานโรงเรียน",
    admin: "ผู้ดูแลระบบ",
  };
  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          className="icon-button mobile-menu-button"
          aria-label="เปิดเมนู"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Icon name="menu" size={21} />
        </button>
        <div className="breadcrumb"><span>OCEC Portal</span><Icon name="chevron" size={14} /><strong>{title}</strong></div>
      </div>
      <div className="topbar-actions">
        <span className="topbar-round"><span className="online-dot" />รอบสอบ 2569</span>
        <label className="persona-control">
          <span className="sr-only">สลับมุมมองตัวอย่าง</span>
          <select
            value={persona}
            onChange={(event) => setPersona(event.target.value)}
          >
            {Object.keys(roleNames).map((key) => <option value={key} key={key}>{roleNames[key]}</option>)}
          </select>
        </label>
        {persona === "guest" ? (
          <Button variant="outline" icon="shield" onClick={() => { setPersona("candidate"); }}>เข้าสู่ระบบด้วย Google</Button>
        ) : (
          <button className="profile-chip" onClick={() => navigate("applications")} aria-label="เปิดใบสมัครของฉัน">
            <span className="profile-avatar">{persona === "admin" ? "AD" : persona === "coordinator" ? "PK" : "NS"}</span>
            <span className="profile-name">{persona === "admin" ? "ผู้ดูแลระบบ" : persona === "coordinator" ? "Pimchanok K." : "Nicha S."}</span>
            <span className="profile-caret">⌄</span>
          </button>
        )}
      </div>
    </header>
  );
}

function HomePage({ navigate, persona, applications }) {
  const activeCount = applications.filter((item) => item.status === "pending").length;
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="ยินดีต้อนรับ"
        title={persona === "admin" ? "ศูนย์จัดการการสอบ" : "สวัสดี, ยินดีต้อนรับกลับ"}
        description={persona === "coordinator" ? "ติดตามใบสมัครของนักเรียนและจัดการทุกขั้นตอนได้ในที่เดียว" : "จัดการใบสมัครและติดตามข่าวสารการสอบของคุณได้ที่นี่"}
      />
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-kicker"><span className="hero-kicker-dot" />เปิดรับสมัครรอบใหม่</span>
          <h2>ทุกขั้นตอนการสอบ<br /><span>อยู่ที่นี่ในที่เดียว</span></h2>
          <p>สมัครสอบ ติดตามสถานะ และรับข่าวสารจาก OCEC ได้อย่างสะดวกและปลอดภัย</p>
          <div className="hero-actions">
            <Button icon="arrow" onClick={() => navigate("apply-heat")}>เริ่มสมัครสอบ</Button>
            <Button variant="light" icon="search" onClick={() => navigate("lookup-choice")}>ตรวจสอบสถานะ</Button>
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
          <div className="hero-float hero-float-bottom"><span className="float-calendar"><Icon name="calendar" size={17} /></span><span><small>รอบสมัครปิด</small><strong>30 พฤศจิกายน 2569</strong></span></div>
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
          <div><span>รอตรวจสอบ</span><strong>{activeCount.toString().padStart(2, "0")} <small>ใบ</small></strong></div>
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
            <div><p className="eyebrow">เริ่มต้นใช้งาน</p><h2>คุณต้องการทำอะไร?</h2></div>
            <span className="section-index">01 / 04</span>
          </div>
          <div className="quick-action-grid">
            <button className="quick-action" onClick={() => navigate("apply-heat")}>
              <span className="quick-icon quick-blue"><Icon name="plus" /></span>
              <span><strong>สมัครสอบ Heat</strong><small>เริ่มสมัครสอบรอบคัดเลือก</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
            <button className="quick-action" onClick={() => navigate("applications")}>
              <span className="quick-icon quick-violet"><Icon name="file" /></span>
              <span><strong>ใบสมัครของฉัน</strong><small>ดูหรือแก้ไขใบสมัคร</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
            <button className="quick-action" onClick={() => navigate("final-confirm")}>
              <span className="quick-icon quick-teal"><Icon name="award" /></span>
              <span><strong>ยืนยันสิทธิ์ Final</strong><small>สำหรับผู้ผ่านรอบ Heat</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
            <button className="quick-action" onClick={() => navigate("results")}>
              <span className="quick-icon quick-amber"><Icon name="grid" /></span>
              <span><strong>ดูประกาศผลสอบ</strong><small>ค้นหาผลด้วยชื่อหรือเลขสอบ</small></span>
              <Icon name="chevron" className="quick-chevron" />
            </button>
          </div>
        </section>
        <aside className="surface schedule-panel">
          <div className="section-heading">
            <div><p className="eyebrow">กำหนดการ</p><h2>รอบสอบปัจจุบัน</h2></div>
            <span className="schedule-open">เปิดรับสมัคร</span>
          </div>
          <div className="schedule-name"><span className="schedule-mark"><Icon name="award" size={19} /></span><div><strong>OCEC Heat 2569</strong><span>รอบคัดเลือก · ปีการศึกษา 2569</span></div></div>
          <div className="schedule-line">
            <div className="schedule-step"><span className="step-dot step-done"><Icon name="check" size={12} /></span><div><strong>เปิดรับสมัคร</strong><small>1 ตุลาคม 2569</small></div></div>
            <div className="schedule-step"><span className="step-dot step-current" /><div><strong>ปิดรับสมัคร</strong><small>30 พฤศจิกายน 2569</small></div></div>
            <div className="schedule-step"><span className="step-dot" /><div><strong>ประกาศผล Heat</strong><small>15 ธันวาคม 2569</small></div></div>
          </div>
          <button className="schedule-link" onClick={() => navigate(persona === "admin" ? "admin-round" : "apply-heat")}>{persona === "admin" ? "ตั้งค่ารอบสอบ" : "ดูรายละเอียดและสมัคร"} <Icon name="arrow" size={15} /></button>
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

function goToLandingSection(page, navigate, sectionId) {
  if (page === "home") {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" });
    return;
  }
  navigate("home");
  window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }), 80);
}

function GoogleMark() {
  return <span className="google-mark" aria-hidden="true">G</span>;
}

function PublicPortalHeader({ page, navigate, setPersona, authProfile, onSignIn, onSignOut }) {
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const accountRootRef = useRef(null);
  const dialogRef = useRef(null);
  const loginTriggerRef = useRef(null);
  const requiresRegistrationLogin = !authProfile && (page === "apply-heat" || page === "apply-final");

  useEffect(() => {
    setLoginDialogOpen(requiresRegistrationLogin);
  }, [requiresRegistrationLogin]);

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
    <header className="landing-header">
      <a className="landing-brand" href="#home" aria-label="OCEC Portal หน้าแรก">
        <BrandMark />
        <span><strong>OCEC Portal</strong><small>ระบบสมัครสอบ</small></span>
      </a>
      <nav className="landing-nav" aria-label="เมนูหน้าเว็บ">
        <a href="#open-exams" onClick={(event) => { event.preventDefault(); goToLandingSection(page, navigate, "open-exams"); }}>รายการสอบ</a>
        <a href="#how-to-apply" onClick={(event) => { event.preventDefault(); goToLandingSection(page, navigate, "how-to-apply"); }}>วิธีสมัคร</a>
        <button onClick={() => navigate("lookup-choice")}>ค้นหาสถานะ</button>
        <button onClick={() => navigate("results")}>ประกาศผล</button>
      </nav>
      <div className="header-account" ref={accountRootRef}>
        {authProfile ? (
          <>
            <button
              className="account-menu-trigger"
              type="button"
              aria-haspopup="true"
              aria-expanded={accountMenuOpen}
              aria-controls="account-menu-panel"
              aria-label={`บัญชีผู้ใช้ ${authProfile.name} ${authProfile.email}`}
              onClick={() => setAccountMenuOpen((open) => !open)}
            >
              <img className="account-avatar" src={authProfile.picture} alt={`รูปโปรไฟล์ ${authProfile.name}`} />
              <span className="account-profile-copy"><strong>{authProfile.name}</strong><small>{authProfile.email}</small></span>
              <Icon name="chevron" size={16} className="account-chevron" />
            </button>
            {accountMenuOpen ? (
              <div className="account-menu-panel" id="account-menu-panel" aria-label="เมนูบัญชีผู้ใช้">
                <div className="account-menu-identity">
                  <img className="account-avatar" src={authProfile.picture} alt="" />
                  <span><strong>{authProfile.name}</strong><small>{authProfile.email}</small></span>
                </div>
                <button type="button" onClick={() => { setPersona("candidate"); navigate("applications"); setAccountMenuOpen(false); }}><Icon name="file" size={16} />ใบสมัครของฉัน</button>
                <button type="button" onClick={() => { setAccountMenuOpen(false); onSignOut(); }}><Icon name="close" size={16} />ออกจากระบบ</button>
              </div>
            ) : null}
          </>
        ) : (
          <button className="google-signin-button" type="button" ref={loginTriggerRef} onClick={() => setLoginDialogOpen(true)}>
            <GoogleMark /><span>เข้าสู่ระบบ</span>
          </button>
        )}
      </div>
      {loginDialogOpen ? (
        <div className="auth-dialog-backdrop" onMouseDown={(event) => { if (!requiresRegistrationLogin && event.target === event.currentTarget) setLoginDialogOpen(false); }}>
          <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title" ref={dialogRef} onKeyDown={keepFocusInsideDialog}>
            <button className="auth-dialog-close" type="button" aria-label={requiresRegistrationLogin ? "กลับหน้าหลัก" : "ปิดหน้าต่างเข้าสู่ระบบ"} onClick={dismissLoginDialog}><Icon name={requiresRegistrationLogin ? "arrow" : "close"} size={18} /></button>
            <span className="auth-dialog-mark"><GoogleMark /></span>
            <p className="eyebrow">เข้าสู่ระบบ OCEC Portal</p>
            <h2 id="auth-dialog-title">{requiresRegistrationLogin ? "เข้าสู่ระบบก่อนสมัคร" : "เลือกบัญชี Google"}</h2>
            <p className="auth-dialog-description">{requiresRegistrationLogin ? "เข้าสู่ระบบเพื่อเริ่มกรอกใบสมัครและติดตามสถานะในบัญชีของคุณ หลังเข้าสู่ระบบแล้วจะกลับมาที่หน้านี้" : "ใช้บัญชีของคุณเพื่อดูใบสมัครและข้อมูลที่เกี่ยวข้อง"}</p>
            <button className="demo-account-choice" type="button" onClick={() => { onSignIn(demoGoogleProfile); setLoginDialogOpen(false); }}>
              <img src={demoGoogleProfile.picture} alt="" />
              <span><strong>{demoGoogleProfile.name}</strong><small>{demoGoogleProfile.email}</small></span>
              <Icon name="chevron" size={17} />
            </button>
            <div className="auth-dialog-note"><Icon name="info" size={15} /><span>ตัวอย่างการเข้าสู่ระบบ · ยังไม่ได้เชื่อมต่อ Google OAuth จริง</span></div>
            <button className="auth-dialog-cancel" type="button" onClick={dismissLoginDialog}>{requiresRegistrationLogin ? "กลับหน้าหลัก" : "ยกเลิก"}</button>
          </section>
        </div>
      ) : null}
    </header>
  );
}

function PublicPortalFooter({ setPersona, navigate }) {
  return (
    <footer className="landing-footer">
      <a className="landing-footer-brand" href="#home"><BrandMark /><span><strong>OCEC Portal</strong><small>ระบบสมัครสอบ</small></span></a>
      <span>© 2569 OCEC Portal · หน้าต้นแบบ</span>
      <button onClick={() => { setPersona("admin"); navigate("admin-home"); }}>ดูตัวอย่างหลังบ้าน</button>
    </footer>
  );
}

function PublicPortalLayout({ page, navigate, setPersona, authProfile, onSignIn, onSignOut, toast, setToast, children }) {
  return (
    <div className="public-landing public-portal-page">
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหาหลัก</a>
      <div className="landing-note"><Icon name="info" size={15} /><span>หน้าตัวอย่างสำหรับออกแบบ · ข้อมูลและกำหนดการเป็นข้อมูลจำลอง</span></div>
      <PublicPortalHeader page={page} navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={onSignIn} onSignOut={onSignOut} />
      <main id="landing-main" className="public-page-main" tabIndex="-1">{children}</main>
      <PublicPortalFooter setPersona={setPersona} navigate={navigate} />
      {toast ? <div className="toast" role="status" aria-live="polite"><span><Icon name="check" size={16} /></span><p>{toast}</p><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div> : null}
    </div>
  );
}

function LandingPage({ navigate, setPersona, authProfile, onSignIn, onSignOut, onStartApplication, resultPublished, examCatalog }) {
  const openExamCount = examCatalog.filter((exam) => exam.isOpen).length;
  const examCarouselRef = useRef(null);
  const [examScrollState, setExamScrollState] = useState({ canPrevious: false, canNext: false });

  useEffect(() => {
    const track = examCarouselRef.current;
    if (!track) return undefined;
    const updateScrollState = () => {
      const maxScroll = track.scrollWidth - track.clientWidth;
      setExamScrollState({ canPrevious: track.scrollLeft > 2, canNext: track.scrollLeft < maxScroll - 2 });
    };
    updateScrollState();
    track.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollState);
    observer?.observe(track);
    Array.from(track.children).forEach((card) => observer?.observe(card));
    return () => {
      track.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      observer?.disconnect();
    };
  }, []);

  function scrollExamCarousel(direction) {
    const track = examCarouselRef.current;
    const firstCard = track?.querySelector(".exam-listing-card");
    if (!track || !firstCard) return;
    const gap = parseFloat(window.getComputedStyle(track).columnGap) || 16;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollBy({ left: direction * (firstCard.getBoundingClientRect().width + gap), behavior: reducedMotion ? "auto" : "smooth" });
  }

  return (
    <div className="public-landing">
      <a className="skip-link" href="#landing-main">ข้ามไปยังเนื้อหาหลัก</a>
      <div className="landing-note"><Icon name="info" size={15} /><span>หน้าตัวอย่างสำหรับออกแบบ · ชื่อรอบและกำหนดการเป็นข้อมูลจำลอง</span></div>
      <PublicPortalHeader page="home" navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={onSignIn} onSignOut={onSignOut} />

      <main id="landing-main" tabIndex="-1">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="landing-kicker"><span className="hero-kicker-dot" /> สมัครสอบ OCEC ได้ในที่เดียว</span>
            <h1>เลือกรายการที่เปิด<br /><em>สมัครในฟอร์มเดียว</em></h1>
            <p>ตรวจสอบรอบที่เปิดรับ แล้วเลือกรายการที่ต้องการสมัครได้ในฟอร์มเดียว</p>
            <div className="landing-hero-actions">
              <Button icon="arrow" onClick={onStartApplication}>สมัครสอบได้ที่นี่</Button>
              <Button variant="text" icon="search" onClick={() => navigate("lookup-choice")}>ค้นหาสถานะใบสมัคร</Button>
            </div>
            <div className="landing-hero-trust"><span><Icon name="check" size={15} /> เลือกได้หลายรายการในฟอร์มเดียว</span><span><Icon name="calendar" size={15} /> เห็นวันปิดรับก่อนสมัคร</span></div>
          </div>
            <div className="landing-hero-art" aria-label={`ตัวอย่างรายการสอบทั้งหมด ${examCatalog.length} รายการ เปิดรับ ${openExamCount} รายการ`}>
            <div className="landing-art-sun" />
            <div className="landing-art-orbit landing-art-orbit-one" />
            <div className="landing-art-orbit landing-art-orbit-two" />
            <div className="landing-art-card landing-art-card-back"><span className="art-mini-mark art-mark-muted">H</span><span><small>ยังไม่เปิดรับ</small><strong>OCEC Heat 2570</strong></span><Icon name="clock" size={16} /></div>
            <div className="landing-art-card landing-art-card-front"><span className="art-mini-mark art-mark-teal">H</span><span><small>เปิดรับสมัคร</small><strong>OCEC Heat 2569</strong></span><Icon name="arrow" size={16} /></div>
            <div className="landing-art-count"><span>เปิดรับ</span><strong>{openExamCount}</strong><span>รายการ</span></div>
            <span className="landing-art-spark landing-art-spark-a"><Icon name="sparkle" size={19} /></span>
            <span className="landing-art-spark landing-art-spark-b"><Icon name="sparkle" size={14} /></span>
          </div>
        </section>

        <section className="landing-section" id="open-exams">
          <div className="landing-section-heading">
            <div><p className="eyebrow">ตรวจสอบสถานะและกำหนดการ</p><h2>รายการสอบทั้งหมด</h2><p>หน้านี้แสดงรายการที่เปิดรับและรอบถัดไป เพื่อให้ตรวจสอบก่อนสมัคร</p></div>
            <div className="exam-heading-actions">
              <span className="landing-count"><span className="online-dot" />{openExamCount} เปิดรับ</span>
              <span className="exam-total-count">ทั้งหมด {examCatalog.length} รายการ</span>
              {examScrollState.canPrevious || examScrollState.canNext ? (
                <div className="exam-carousel-controls" role="group" aria-label="เลื่อนดูรายการสอบ">
                  <button className="exam-carousel-button" aria-label="เลื่อนรายการสอบไปทางซ้าย" disabled={!examScrollState.canPrevious} onClick={() => scrollExamCarousel(-1)}><Icon name="arrow" className="exam-arrow-left" size={17} /></button>
                  <button className="exam-carousel-button" aria-label="เลื่อนรายการสอบไปทางขวา" disabled={!examScrollState.canNext} onClick={() => scrollExamCarousel(1)}><Icon name="arrow" size={17} /></button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="exam-list-grid" ref={examCarouselRef} role="region" tabIndex={0} aria-label="รายการสอบทั้งหมด เลื่อนไปด้านข้างเพื่อดูรายการเพิ่มเติม">
            {examCatalog.map((exam) => (
              <article className={`exam-listing-card exam-card-${exam.accent}${exam.isOpen ? "" : " exam-card-upcoming"}`} key={exam.id}>
                <div className="exam-card-top"><span className="exam-type-mark"><Icon name="award" size={21} /></span><span className={exam.isOpen ? "exam-open-label" : "exam-upcoming-label"}><i />{exam.isOpen ? "เปิดรับสมัคร" : "ยังไม่เปิดรับ"}</span></div>
                <p className="exam-round-label">{exam.round} · ปีการศึกษา {exam.year}</p>
                <h3>{exam.title}</h3>
                <p className="exam-card-description">{exam.description}</p>
                <div className="exam-deadline"><span className="exam-deadline-icon"><Icon name={exam.isOpen ? "calendar" : "clock"} size={16} /></span><span><small>{exam.isOpen ? "ปิดรับสมัคร" : "กำหนดการ"}</small><strong>{exam.isOpen ? formatThaiDate(exam.closeDate) : "รอประกาศจากโครงการ"}</strong></span></div>
              </article>
            ))}
          </div>
          <p className="landing-demo-caption"><Icon name="info" size={14} /> ชื่อรายการและกำหนดการในหน้านี้เป็นข้อมูลจำลองสำหรับแสดงสถานะเปิดรับและรอบถัดไป</p>
          {resultPublished ? (
            <button className="final-opportunity-link" onClick={() => navigate("final-confirm")}><span className="final-opportunity-icon"><Icon name="award" /></span><span><strong>ผ่าน OCEC Heat แล้วใช่ไหม?</strong><small>ตรวจสอบสิทธิ์และขั้นตอนสมัคร OCEC Final</small></span><Icon name="arrow" size={17} /></button>
          ) : null}
        </section>

        <section className="landing-how" id="how-to-apply">
          <div className="landing-section-heading"><div><p className="eyebrow">ไม่กี่ขั้นตอนก็พร้อมสมัคร</p><h2>เริ่มต้นอย่างไร</h2></div><button className="text-arrow" onClick={() => navigate("lookup-choice")}>มีใบสมัครแล้ว? ค้นหาสถานะ <Icon name="arrow" size={15} /></button></div>
          <div className="landing-steps">
            <article><span className="landing-step-number">01</span><span className="landing-step-icon step-blue"><Icon name="grid" /></span><h3>ตรวจรายการที่เปิดรับ</h3><p>ดูวันปิดรับสมัครและสถานะของแต่ละรอบก่อนเลือก</p></article>
            <article><span className="landing-step-number">02</span><span className="landing-step-icon step-coral"><Icon name="file" /></span><h3>เลือกสอบในฟอร์มเดียว</h3><p>ติ๊กรายการที่ต้องการสมัครได้มากกว่าหนึ่งรายการ</p></article>
            <article><span className="landing-step-number">03</span><span className="landing-step-icon step-green"><Icon name="upload" /></span><h3>ส่งข้อมูลและแนบสลิป</h3><p>กรอกข้อมูลผู้เข้าสอบและแนบหลักฐานการชำระเงิน</p></article>
          </div>
        </section>

        <section className="landing-help-strip">
          <span className="landing-help-icon"><Icon name="search" size={19} /></span><div><strong>ส่งใบสมัครไปแล้ว?</strong><p>ค้นหาสถานะได้โดยไม่ต้องเข้าสู่ระบบ หรือเลือกแก้ไขใบสมัครเพื่อยืนยันตัวตน</p></div><Button variant="outline" onClick={() => navigate("lookup-choice")}>ค้นหาสถานะ</Button>
        </section>
      </main>
      <PublicPortalFooter setPersona={setPersona} navigate={navigate} />
    </div>
  );
}

function ApplicationsPage({ applications, navigate }) {
  const [filter, setFilter] = useState("ทั้งหมด");
  const filters = ["ทั้งหมด", "Heat", "Final"];
  const visible = applications.filter((item) => filter === "ทั้งหมด" || item.kind === filter);
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="บัญชีของฉัน"
        title="ใบสมัครของฉัน"
        description="ดูใบสมัครย้อนหลังตามรายการสอบและปี รวมถึงติดตามสถานะของผู้เข้าสอบทุกคน"
        action={<Button icon="plus" onClick={() => navigate("apply-heat")}>สร้างใบสมัครใหม่</Button>}
      />
      <div className="filter-toolbar">
        <div className="segmented-control" role="group" aria-label="กรองตามรายการสอบ">
          {filters.map((item) => <button key={item} className={filter === item ? "segment-active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
        </div>
        <span className="result-count">พบ {visible.length} ใบสมัคร</span>
      </div>
      <section className="application-group">
        <div className="group-heading"><div><span className="group-mark group-blue">H</span><div><h2>ปีการศึกษา 2569</h2><p>OCEC Heat และ OCEC Final</p></div></div><span>{visible.filter((item) => item.year === "2569").length} ใบ</span></div>
        <div className="application-card-list">
          {visible.filter((item) => item.year === "2569").map((application) => (
            <ApplicationCard key={application.id} application={application} onOpen={() => navigate("application-detail", application.id)} />
          ))}
        </div>
      </section>
      {visible.some((item) => item.year === "2568") ? (
        <section className="application-group">
          <div className="group-heading"><div><span className="group-mark group-gray">H</span><div><h2>ปีการศึกษา 2568</h2><p>ประวัติรายการสอบก่อนหน้า</p></div></div><span>{visible.filter((item) => item.year === "2568").length} ใบ</span></div>
          <div className="application-card-list">
            {visible.filter((item) => item.year === "2568").map((application) => (
              <ApplicationCard key={application.id} application={application} onOpen={() => navigate("application-detail", application.id)} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function StatusLookupPage({ applications, navigate }) {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const results = useMemo(() => {
    if (!searched || !query.trim()) return [];
    return applications.filter((item) => item.candidate.toLowerCase().includes(query.trim().toLowerCase()));
  }, [applications, query, searched]);
  return (
    <div className="page-stack narrow-page">
      <PageHeading eyebrow="บริการผู้สมัคร" title="ค้นหาสถานะใบสมัคร" description="ตรวจสอบสถานะล่าสุดของใบสมัครได้โดยไม่ต้องเข้าสู่ระบบ" />
      <section className="surface lookup-card">
        <div className="lookup-icon"><Icon name="search" size={22} /></div>
        <h2>ค้นหาด้วยชื่อภาษาอังกฤษ</h2>
        <p>กรอกชื่อผู้เข้าสอบตามที่ระบุในใบสมัคร ระบบจะแสดงสถานะทั่วไปของใบสมัคร</p>
        <form onSubmit={(event) => { event.preventDefault(); setSearched(true); }}>
          <Field label="ชื่อภาษาอังกฤษของผู้เข้าสอบ" required hint="ตัวอย่าง: Nicha Srisawat">
            <div className="input-with-icon"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="กรอกชื่อและนามสกุลภาษาอังกฤษ" required /></div>
          </Field>
          <Button type="submit" icon="search" className="button-full">ค้นหาสถานะ</Button>
        </form>
        {searched ? (
          <div className="lookup-results" aria-live="polite">
            <div className="lookup-results-head"><strong>ผลการค้นหา</strong><span>{results.length} รายการ</span></div>
            {results.length ? results.map((application) => (
              <div className="status-result" key={application.id}>
                <div className="status-result-main"><strong>{application.candidate}</strong><span>{application.exam} · {application.school}</span></div>
                <div className="status-result-side"><StatusBadge status={application.status} /><small>เลขสอบ: {application.kind === "Final" ? (application.finalId || "รอเลขประจำตัว") : (application.heatId || "รอเลขประจำตัว")}</small></div>
              </div>
            )) : <div className="empty-inline"><Icon name="info" /><span>ไม่พบใบสมัครที่ตรงกับชื่อ กรุณาตรวจการสะกดชื่อภาษาอังกฤษอีกครั้ง</span></div>}
          </div>
        ) : null}
      </section>
      <section className="info-banner"><Icon name="shield" /><div><strong>ต้องการแก้ไขใบสมัคร?</strong><p>ยืนยันตัวตนด้วยชื่อภาษาอังกฤษและเลข 4 ตัวท้ายของเบอร์โทรศัพท์ก่อนดูข้อมูล</p></div><Button variant="outline" onClick={() => navigate("edit-verify")}>ไปหน้าแก้ไข</Button></section>
      <p className="privacy-note"><Icon name="lock" size={14} />ระบบแสดงเฉพาะสถานะทั่วไป รายละเอียดปัญหาสลิปจะแจ้งทางอีเมลติดต่อที่ระบุในใบสมัคร</p>
    </div>
  );
}

function LookupChoicePage({ navigate }) {
  return (
    <div className="page-stack narrow-page">
      <PageHeading eyebrow="บริการผู้สมัคร" title="ค้นหาหรือแก้ไขใบสมัคร" description="เลือกสิ่งที่ต้องการทำ ระบบจะแสดงเฉพาะข้อมูลที่จำเป็นในแต่ละขั้นตอน" />
      <div className="lookup-choice-grid">
        <button className="lookup-choice-card" onClick={() => navigate("check-status")}>
          <span className="lookup-choice-icon choice-search"><Icon name="search" size={22} /></span>
          <span className="lookup-choice-copy"><strong>ค้นหาสถานะใบสมัคร</strong><small>ตรวจสอบสถานะทั่วไปได้ทันที ไม่ต้องเข้าสู่ระบบ</small><em>ใช้ชื่อภาษาอังกฤษของผู้เข้าสอบ</em></span>
          <span className="lookup-choice-arrow"><Icon name="arrow" /></span>
        </button>
        <button className="lookup-choice-card" onClick={() => navigate("edit-verify")}>
          <span className="lookup-choice-icon choice-edit"><Icon name="edit" size={21} /></span>
          <span className="lookup-choice-copy"><strong>แก้ไขข้อมูลใบสมัคร</strong><small>ยืนยันตัวตนก่อนดูข้อมูลและแก้ไขส่วนที่อนุญาต</small><em>ใช้ชื่อภาษาอังกฤษและเบอร์โทรศัพท์</em></span>
          <span className="lookup-choice-arrow"><Icon name="arrow" /></span>
        </button>
      </div>
      <div className="notice notice-blue"><Icon name="lock" /><div><strong>ข้อมูลส่วนตัวได้รับการปกป้อง</strong><p>การค้นหาสถานะจะแสดงเฉพาะชื่อ รายการสอบ เลขประจำตัวเมื่อมี และสถานะทั่วไป</p></div></div>
      <button className="back-link" onClick={() => navigate("home")}><Icon name="arrow" size={15} />กลับหน้าภาพรวม</button>
    </div>
  );
}

function EditVerifyPage({ applications, onVerified, navigate }) {
  const [name, setName] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [error, setError] = useState("");
  function verify(event) {
    event.preventDefault();
    const match = applications.find((item) => item.candidate.toLowerCase() === name.trim().toLowerCase() && item.phoneLast4 === lastFour);
    if (!match) {
      setError("ไม่พบข้อมูลที่ตรงกัน กรุณาตรวจชื่อภาษาอังกฤษและเลข 4 ตัวท้ายอีกครั้ง");
      return;
    }
    setError("");
    onVerified(match.id);
  }
  return (
    <div className="page-stack narrow-page">
      <PageHeading eyebrow="ยืนยันตัวตน" title="แก้ไขข้อมูลใบสมัคร" description="กรอกข้อมูลตรงกับใบสมัครเพื่อยืนยันตัวตนก่อนเปิดรายละเอียด" />
      <section className="surface verify-card">
        <div className="verify-steps"><span className="verify-step verify-step-active"><b>1</b>ยืนยันตัวตน</span><i /><span className="verify-step"><b>2</b>ตรวจสอบใบสมัคร</span><i /><span className="verify-step"><b>3</b>แก้ไขข้อมูล</span></div>
        <form onSubmit={verify}>
          <Field label="ชื่อภาษาอังกฤษตามใบสมัคร" required hint="กรอกชื่อและนามสกุลให้ตรงกับใบสมัคร">
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="เช่น Nicha Srisawat" required />
          </Field>
          <Field label="เลข 4 ตัวท้ายของเบอร์โทรศัพท์" required hint="เบอร์โทรศัพท์ที่ระบุไว้ในใบสมัคร">
            <input inputMode="numeric" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" required />
          </Field>
          {error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}
          <Button type="submit" icon="shield" className="button-full">ยืนยันและค้นหาใบสมัคร</Button>
        </form>
        <button className="back-link" onClick={() => navigate("lookup-choice")}><Icon name="arrow" size={15} />กลับไปเลือกบริการ</button>
      </section>
      <div className="privacy-note"><Icon name="lock" size={14} />ข้อมูลที่ใช้ยืนยันตัวตนจะถูกใช้เพื่อค้นหาใบสมัครเท่านั้น</div>
    </div>
  );
}

function EditApplicationPage({ application, onSave, navigate, editWindowOpen }) {
  const [form, setForm] = useState(() => ({
    candidate: application.candidate,
    school: application.school,
    contactEmail: application.contactEmail,
    phone: "08X-XXX-" + application.phoneLast4,
  }));
  const editable = application.status === "confirmed" && application.canEdit && editWindowOpen;
  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="page-stack">
      <PageHeading eyebrow="ใบสมัครของฉัน" title="แก้ไขข้อมูลใบสมัคร" description={application.candidate + " · " + application.exam} action={<Button variant="outline" icon="arrow" onClick={() => navigate("application-detail", application.id)}>กลับไปใบสมัคร</Button>} />
      <div className="form-layout">
        <section className="surface form-surface">
          <div className="form-section-heading"><span className="form-section-icon"><Icon name="edit" /></span><div><h2>ข้อมูลผู้เข้าสอบ</h2><p>แก้ไขข้อมูลที่อนุญาตก่อนถึงกำหนดปิดแก้ไข</p></div></div>
          {!editable ? <div className="notice notice-amber"><Icon name="lock" /><div><strong>ยังไม่สามารถแก้ไขใบสมัครนี้ได้</strong><p>{application.status === "pending" ? "ใบสมัครอยู่ระหว่างตรวจสอบ สามารถดูสถานะได้ แต่ยังแก้ไขข้อมูลไม่ได้" : "รอบแก้ไขข้อมูลปิดแล้ว"}</p></div></div> : null}
          <div className="form-grid">
            <Field label="ชื่อภาษาอังกฤษ" required><input value={form.candidate} disabled={!editable} onChange={(event) => updateField("candidate", event.target.value)} /></Field>
            <Field label="โรงเรียน" required><input value={form.school} disabled={!editable} onChange={(event) => updateField("school", event.target.value)} /></Field>
            <Field label="อีเมลติดต่อผู้เข้าสอบ" required hint="ใช้รับอีเมลสรุปใบสมัครและผลตรวจสลิป"><input type="email" value={form.contactEmail} disabled={!editable} onChange={(event) => updateField("contactEmail", event.target.value)} /></Field>
            <Field label="เบอร์โทรศัพท์" required><input value={form.phone} disabled={!editable} onChange={(event) => updateField("phone", event.target.value)} /></Field>
          </div>
          <div className="locked-fields">
            <div className="locked-fields-title"><Icon name="lock" size={16} /><strong>ข้อมูลที่ล็อกหลังอนุมัติ</strong></div>
            <div className="locked-chip-row"><span>รายการสอบ <b>{application.kind}</b></span><span>ระดับชั้น <b>{application.grade}</b></span><span>รูปแบบ <b>{application.format}</b></span><span>ศูนย์สอบ <b>{application.center}</b></span></div>
          </div>
          {editable ? <div className="form-footer"><span>แก้ไขได้ถึง 30 พฤศจิกายน 2569</span><Button icon="check" onClick={() => onSave(application.id, form)}>บันทึกการแก้ไข</Button></div> : null}
        </section>
        <aside className="surface side-note">
          <span className="side-note-icon"><Icon name="info" /></span>
          <h3>ข้อมูลสำคัญ</h3>
          <p>การแก้ไขข้อมูลที่อนุญาตจะไม่ทำให้ใบสมัครกลับไปรอตรวจสอบ</p>
          <hr />
          <p>อีเมลแจ้งเตือนจะส่งไปยังอีเมลติดต่อในใบสมัคร ไม่ใช่อีเมลบัญชี Google</p>
        </aside>
      </div>
    </div>
  );
}

function ApplicationDetailPage({ application, navigate, resultPublished, editWindowOpen }) {
  if (!application) return <div className="surface empty-state">ไม่พบใบสมัครที่เลือก</div>;
  const canEdit = application.status === "confirmed" && application.canEdit && editWindowOpen;
  return (
    <div className="page-stack">
      <PageHeading eyebrow={application.kind + " · ปีการศึกษา " + application.year} title="รายละเอียดใบสมัคร" description={application.candidate + " · " + application.school} action={<Button variant="outline" icon="arrow" onClick={() => navigate("applications")}>กลับไปใบสมัครของฉัน</Button>} />
      <div className="detail-layout">
        <div className="detail-main">
          <section className="surface detail-summary">
            <div className="detail-avatar">{application.candidate.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
            <div className="detail-ident"><span className="application-kind">{application.exam}</span><h2>{application.candidate}</h2><p>{application.school}</p></div>
            <StatusBadge status={application.status} />
            <div className="exam-number-box"><span>เลขประจำตัวสอบ</span><strong>{application.kind === "Final" ? (application.finalId || "รอเลขประจำตัว") : (application.heatId || "รอเลขประจำตัว")}</strong></div>
          </section>
          {application.status === "pending" ? <div className="notice notice-amber"><Icon name="clock" /><div><strong>ใบสมัครอยู่ระหว่างตรวจสอบ</strong><p>ตรวจสอบสถานะได้ตามปกติ แต่ยังแก้ไขข้อมูลไม่ได้</p></div></div> : null}
          <section className="surface detail-section">
            <div className="section-heading"><div><p className="eyebrow">ข้อมูลใบสมัคร</p><h2>ข้อมูลผู้เข้าสอบ</h2></div>{canEdit ? <Button variant="outline" icon="edit" onClick={() => navigate("edit-application", application.id)}>แก้ไขข้อมูล</Button> : null}</div>
            <div className="detail-info-grid">
              <div><span>ชื่อภาษาอังกฤษ</span><strong>{application.candidate}</strong></div>
              <div><span>โรงเรียน</span><strong>{application.school}</strong></div>
              <div><span>ระดับชั้น</span><strong>{application.grade}</strong></div>
              <div><span>รูปแบบการสอบ</span><strong>{application.format}</strong></div>
              <div><span>ศูนย์สอบ</span><strong>{application.center}</strong></div>
              <div><span>อีเมลติดต่อ</span><strong>{application.contactEmail}</strong></div>
              <div><span>วันที่ส่งใบสมัคร</span><strong>{application.submitted}</strong></div>
              <div><span>สถานะผลสอบ</span><strong>{!resultPublished ? "ยังไม่ประกาศผล" : application.result === "pass" ? "ผ่านรอบ Heat" : application.result === "not-passed" ? "ไม่ผ่านรอบ Heat" : "ไม่มีผลสอบ"}</strong></div>
            </div>
          </section>
          {resultPublished && application.result === "pass" ? (
            <div className="final-next-step"><span className="final-next-icon"><Icon name="award" /></span><div><strong>คุณผ่านเข้าสู่รอบ Final</strong><p>ยืนยันสิทธิ์และสมัครสอบ Final ได้ภายในเวลาที่กำหนด</p></div><Button onClick={() => navigate("final-confirm")}>ยืนยันสิทธิ์ <Icon name="arrow" size={16} /></Button></div>
          ) : null}
        </div>
        <aside className="surface timeline-card">
          <p className="eyebrow">ความคืบหน้า</p><h2>ขั้นตอนใบสมัคร</h2>
          <div className="timeline">
            <div className="timeline-item timeline-done"><span><Icon name="check" size={13} /></span><div><strong>ส่งใบสมัครแล้ว</strong><small>{application.submitted}</small></div></div>
            <div className={"timeline-item " + (application.status === "confirmed" ? "timeline-done" : "timeline-current")}><span>{application.status === "confirmed" ? <Icon name="check" size={13} /> : "2"}</span><div><strong>{application.status === "confirmed" ? "ตรวจสอบและยืนยันแล้ว" : "รอตรวจใบสมัครและสลิป"}</strong><small>{application.status === "confirmed" ? "ตรวจสอบเรียบร้อย" : "เจ้าหน้าที่กำลังตรวจสอบ"}</small></div></div>
            <div className={"timeline-item " + (resultPublished && application.result ? "timeline-done" : "")}><span>{resultPublished && application.result ? <Icon name="check" size={13} /> : "3"}</span><div><strong>ประกาศผลสอบ</strong><small>{!resultPublished ? "รอประกาศผล" : application.result === "pass" ? "ผ่านรอบ Heat" : application.result === "not-passed" ? "ประกาศผลแล้ว" : "ไม่มีผลสอบ"}</small></div></div>
          </div>
          <div className="timeline-contact"><Icon name="mail" size={16} /><span>แจ้งเตือนส่งไปที่<br /><strong>{application.contactEmail}</strong></span></div>
        </aside>
      </div>
    </div>
  );
}

function SlipUploadPage({ application, onUploaded, onReturn, notify }) {
  const [fileName, setFileName] = useState("");
  const [uploaded, setUploaded] = useState(false);
  return (
    <div className="page-stack narrow-page">
      <PageHeading eyebrow="ลิงก์ปลอดภัย" title="อัปโหลดสลิปใหม่" description="ใช้ลิงก์เฉพาะที่ได้รับทางอีเมลเพื่อส่งสลิปที่แก้ไขแล้ว" />
      <section className="surface upload-card">
        <div className="upload-token"><span className="upload-token-icon"><Icon name={uploaded ? "check" : "upload"} /></span><div><strong>{uploaded ? "อัปโหลดเรียบร้อยแล้ว" : "ส่งสลิปใบสมัครใหม่"}</strong><small>{application ? `${application.candidate} · ${application.contactEmail}` : "ลิงก์นี้ใช้ได้หนึ่งครั้งและใช้สำหรับแนบสลิปเท่านั้น"}</small></div></div>
        {!uploaded ? (
          <>
            <label className="file-drop">
              <input type="file" accept="image/*,.pdf" onChange={(event) => setFileName(event.target.files?.[0]?.name || "")} />
              <span className="file-drop-icon"><Icon name="upload" size={22} /></span>
              <strong>{fileName || "เลือกไฟล์สลิปเพื่ออัปโหลด"}</strong>
              <small>รองรับ JPG, PNG หรือ PDF · ขนาดไม่เกิน 10 MB</small>
            </label>
            <div className="notice notice-blue"><Icon name="info" /><div><strong>ลิงก์นี้แก้ไขได้เฉพาะสลิป</strong><p>ข้อมูลอื่นของใบสมัครจะไม่แสดงในหน้านี้</p></div></div>
            <Button className="button-full" icon="upload" disabled={!fileName} onClick={() => { setUploaded(true); if (application) onUploaded?.(application.id, fileName); notify("อัปโหลดสลิปตัวอย่างแล้ว ใบสมัครกลับเข้าสู่คิวตรวจสอบ"); }}>อัปโหลดสลิป</Button>
          </>
        ) : (
          <div className="upload-success"><p>ขอบคุณที่ส่งสลิปใหม่ เจ้าหน้าที่จะตรวจสอบและส่งผลไปยังอีเมลติดต่อในใบสมัคร</p><Button variant="outline" onClick={() => onReturn ? onReturn() : notify("ลิงก์นี้ถูกใช้แล้ว")}>กลับไปคิวตรวจสอบ</Button></div>
        )}
      </section>
      <div className="privacy-note"><Icon name="lock" size={14} />ลิงก์อัปโหลดไม่เปิดให้แก้ไขข้อมูลส่วนอื่นและจะใช้ได้หลังปิดรับสมัครจนกว่าจะส่งสลิปใหม่</div>
    </div>
  );
}

function FinalConfirmationPage({ applications, onContinue, navigate, resultPublished }) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const eligible = applications.filter((item) => item.kind === "Heat" && item.result === "pass" && item.candidate.toLowerCase().includes(query.trim().toLowerCase()));
  const selected = applications.find((item) => item.id === selectedId);
  function verify(event) {
    event.preventDefault();
    if (!selected || selected.phoneLast4 !== lastFour) {
      setError("ข้อมูลไม่ตรงกับใบสมัคร Heat กรุณาตรวจสอบเลข 4 ตัวท้าย");
      return;
    }
    setError("");
    setVerified(true);
  }
  return (
    <div className="page-stack narrow-page">
      <PageHeading eyebrow="OCEC Final 2569" title="ยืนยันสิทธิ์เข้าสอบ Final" description="สำหรับผู้ผ่านการคัดเลือกรอบ Heat เพื่อดำเนินการสมัครสอบ Final" />
      <div className="step-progress"><span className="step-active"><b>1</b>ค้นหาผู้ผ่าน</span><i /><span className={selectedId ? "step-active" : ""}><b>2</b>ยืนยันตัวตน</span><i /><span className={verified ? "step-active" : ""}><b>3</b>สมัคร Final</span></div>
      <section className="surface final-confirm-card">
        {!resultPublished ? (
          <div className="results-pending compact-pending"><span className="results-pending-icon"><Icon name="clock" /></span><h2>รอประกาศผล Heat</h2><p>ผู้ผ่านสามารถเริ่มยืนยันสิทธิ์ Final ได้ทันทีหลังแอดมินยืนยันประกาศผล</p></div>
        ) : !verified ? (
          <>
            <div className="callout-title"><span className="callout-icon"><Icon name="award" /></span><div><h2>ค้นหารายชื่อผู้ผ่าน Heat</h2><p>ใช้ชื่อภาษาอังกฤษและตรวจสอบเลขสอบกับโรงเรียนให้ตรงกับตัวคุณ</p></div></div>
            <Field label="ค้นหาชื่อภาษาอังกฤษ" required><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); }} placeholder="เช่น Nicha Srisawat" required /></div></Field>
            {query ? <div className="eligible-list">{eligible.map((item) => <button key={item.id} className={"eligible-option " + (selectedId === item.id ? "eligible-option-selected" : "")} onClick={() => { setSelectedId(item.id); setError(""); }}><span className="eligible-radio" /><span><strong>{item.candidate}</strong><small>เลขสอบ {item.heatId} · {item.school}</small></span><Icon name="chevron" /></button>)}{eligible.length === 0 ? <div className="empty-inline"><Icon name="info" /><span>ไม่พบรายชื่อผู้ผ่านที่ตรงกับชื่อ</span></div> : null}</div> : null}
            {selected ? (
              <form onSubmit={verify} className="verify-final-form">
                <div className="selected-candidate"><span className="selected-check"><Icon name="check" size={15} /></span><div><strong>{selected.candidate}</strong><small>{selected.heatId} · {selected.school}</small></div><span className="pass-label">ผ่าน Heat</span></div>
                <Field label="เลข 4 ตัวท้ายของเบอร์โทรศัพท์ในใบสมัคร Heat" required><input inputMode="numeric" maxLength={4} value={lastFour} onChange={(event) => setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="••••" required /></Field>
                {error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}
                <Button type="submit" icon="shield" className="button-full">ยืนยันตัวตน</Button>
              </form>
            ) : null}
          </>
        ) : (
          <div className="verified-panel">
            <span className="verified-badge"><Icon name="check" /></span>
            <p className="eyebrow">ยืนยันตัวตนสำเร็จ</p>
            <h2>พร้อมสมัครสอบ Final</h2>
            <p>ข้อมูลจากใบสมัคร Heat จะถูกนำมาเติมในฟอร์ม Final ให้ตรวจสอบและแก้ไขก่อนส่ง</p>
            <div className="verified-actions">
              <Button icon="shield" onClick={() => onContinue(selected, true)}>ผูกใบสมัครกับบัญชี Google</Button>
              <Button variant="outline" onClick={() => onContinue(selected, false)}>ดำเนินการต่อโดยไม่เข้าสู่ระบบ</Button>
            </div>
            <button className="back-link" onClick={() => { setVerified(false); setSelectedId(""); }}><Icon name="arrow" size={15} />ค้นหาชื่ออื่น</button>
          </div>
        )}
      </section>
      <div className="info-banner"><Icon name="clock" /><div><strong>กำหนดปิดยืนยันสิทธิ์</strong><p>15 มกราคม 2570 เวลา 23:59 น.</p></div><Button variant="text" onClick={() => navigate("home")}>ดูรอบสอบ</Button></div>
    </div>
  );
}

function PublicResultsPage({ applications, published }) {
  const [query, setQuery] = useState("");
  const results = applications.filter((item) => item.kind === "Heat" && item.result === "pass" && (item.candidate.toLowerCase().includes(query.trim().toLowerCase()) || (item.heatId || "").includes(query.trim())));
  return (
    <div className="page-stack">
      <PageHeading eyebrow="ผลการคัดเลือก" title="ประกาศผลสอบ OCEC Heat" description="ค้นหารายชื่อผู้ผ่านรอบ Heat ด้วยชื่อภาษาอังกฤษหรือเลขประจำตัวสอบ" />
      {!published ? (
        <section className="surface results-pending">
          <span className="results-pending-icon"><Icon name="clock" /></span>
          <h2>รอประกาศผลอย่างเป็นทางการ</h2>
          <p>เมื่อมีการยืนยันประกาศผลแล้ว สามารถค้นหารายชื่อผู้ผ่านได้จากหน้านี้</p>
          <span className="result-date"><Icon name="calendar" size={15} />กำหนดประกาศผล 15 ธันวาคม 2569</span>
        </section>
      ) : (
        <>
          <section className="results-hero">
            <div><span className="result-announced"><span />ประกาศผลอย่างเป็นทางการ</span><h2>รายชื่อผู้ผ่านการคัดเลือก</h2><p>OCEC Heat รอบที่ 1 · ปีการศึกษา 2569</p></div>
            <div className="result-total"><strong>{results.length.toString().padStart(2, "0")}</strong><span>รายชื่อที่พบ</span></div>
          </section>
          <section className="surface results-table-card">
            <div className="table-toolbar"><div className="input-with-icon search-table"><Icon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อหรือเลขประจำตัวสอบ" /></div><span>ค้นหาได้โดยไม่ต้องเข้าสู่ระบบ</span></div>
            <div className="responsive-table"><table><thead><tr><th>เลขประจำตัวสอบ</th><th>ชื่อภาษาอังกฤษ</th><th>โรงเรียน</th><th>ผลการคัดเลือก</th></tr></thead><tbody>{results.map((item) => <tr key={item.id}><td><strong className="mono-number">{item.heatId}</strong></td><td>{item.candidate}</td><td>{item.school}</td><td><span className="pass-label"><Icon name="check" size={13} />ผ่าน</span></td></tr>)}{results.length === 0 ? <tr><td colSpan="4"><div className="empty-table">ไม่พบรายชื่อที่ตรงกับคำค้น</div></td></tr> : null}</tbody></table></div>
            <div className="table-footnote"><Icon name="info" size={15} />หน้านี้แสดงเฉพาะผู้ผ่านการคัดเลือก ผู้มีบัญชีสามารถดูผลของตนเองได้ในใบสมัครของฉัน</div>
          </section>
        </>
      )}
    </div>
  );
}

function ApplicationFormPage({ kind, prefill, onSubmit, navigate }) {
  const isFinal = kind === "Final";
  const competitions = FORM_COMPETITIONS;
  const pastPaperGroups = FORM_PAST_PAPER_GROUPS;
  const centers = FORM_CENTERS;
  const schools = FORM_SCHOOLS;
  const [applicationSource, setApplicationSource] = useState("self");
  const [schoolBatch, setSchoolBatch] = useState(() => {
    const firstApplicant = createSchoolApplicant("school-applicant-1", prefill);
    return { applicants: [firstApplicant], activeId: firstApplicant.id, confirmDetails: false, marketingConsent: false };
  });
  const [form, setForm] = useState(() => ({
    source: "self",
    firstName: "",
    lastName: "",
    thaiFirstName: "",
    thaiLastName: "",
    gender: "",
    dateOfBirth: "",
    schoolName: "",
    certificateSchoolName: "",
    email: prefill?.contactEmail || "",
    address1: "",
    address2: "",
    city: "",
    province: "",
    postalCode: "",
    phone: "",
    competitionIds: [],
    grades: {},
    format: "Paper-Based",
    center: prefill?.center || "",
    pastPaperIds: [],
    confirmDetails: false,
    marketingConsent: false,
  }));
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [selectionError, setSelectionError] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const selectedCompetitions = competitions.filter((competition) => form.competitionIds.includes(competition.id));
  const allPastPapers = pastPaperGroups.flatMap((group) => group.items);
  const pastPapersTotal = allPastPapers.filter((paper) => form.pastPaperIds.includes(paper.id)).reduce((sum, paper) => sum + paper.price, 0);
  const registrationFee = selectedCompetitions.length * (form.format === "Online" ? 655 : 755);
  const totalPayment = pastPapersTotal + registrationFee;
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  function toggleCompetition(id) {
    setForm((current) => ({
      ...current,
      competitionIds: current.competitionIds.includes(id)
        ? current.competitionIds.filter((competitionId) => competitionId !== id)
        : [...current.competitionIds, id],
    }));
    setSelectionError("");
  }
  function togglePastPaper(id) {
    setForm((current) => ({ ...current, pastPaperIds: current.pastPaperIds.includes(id) ? current.pastPaperIds.filter((paperId) => paperId !== id) : [...current.pastPaperIds, id] }));
  }
  function submit(event) {
    event.preventDefault();
    if (selectedCompetitions.length === 0) {
      setSelectionError("กรุณาเลือกรายการสอบอย่างน้อย 1 รายการ");
      return;
    }
    if (selectedCompetitions.some((competition) => !form.grades[competition.id])) {
      setSelectionError("กรุณาเลือกระดับชั้นให้ครบทุกวิชาที่สมัคร");
      return;
    }
    if (form.format === "Paper-Based" && !form.center) {
      setPaymentError("กรุณาเลือกศูนย์สอบสำหรับการสอบแบบ Paper-Based");
      return;
    }
    if (!form.confirmDetails) {
      setPaymentError("กรุณายืนยันว่าตรวจสอบข้อมูลและยอดชำระเรียบร้อยแล้ว");
      return;
    }
    if (!fileName) {
      setFileError("กรุณาแนบสลิปการชำระเงินก่อนส่งใบสมัคร");
      return;
    }
    setFileError("");
    const candidate = `${form.firstName} ${form.lastName}`.trim();
    const school = form.schoolName === "Other" ? form.certificateSchoolName : form.schoolName;
    onSubmit({ ...form, kind, candidate, school, contactEmail: form.email, grade: selectedCompetitions.map((competition) => `${competition.short}: ${form.grades[competition.id]}`).join(" · "), center: form.format === "Online" ? "Online Exam" : form.center, examListings: selectedCompetitions, pastPaperSelections: allPastPapers.filter((paper) => form.pastPaperIds.includes(paper.id)), pastPapersTotal, registrationFee, totalPayment, fileName, sourceHeatId: prefill?.id || "" });
  }
  if (!isFinal && applicationSource === "school") {
    return <SchoolBatchForm kind={kind} prefill={prefill} batch={schoolBatch} setBatch={setSchoolBatch} onSubmit={onSubmit} navigate={navigate} onBack={() => { setApplicationSource("self"); update("source", "self"); }} />;
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow={isFinal ? "OCEC Final 2569" : "เปิดรับสมัคร · ปีการศึกษา 2569"}
        title={isFinal ? "สมัครสอบ Final" : "สมัครสอบ OCEC"}
        description={isFinal ? "ตรวจสอบข้อมูลและกรอกข้อมูลผู้เข้าสอบ รายการสอบ และการชำระเงินให้ครบในฟอร์มเดียว" : "สมัคร BBB, HKISO และ HKICO ได้ในฟอร์มเดียว เลือกระดับชั้นของแต่ละรายการแยกกันได้"}
        action={<Button variant="outline" icon="arrow" onClick={() => navigate(isFinal ? "final-confirm" : "home")}>ยกเลิก</Button>}
      />
      <div className="form-layout">
        <form className="surface form-surface registration-form" onSubmit={submit}>
          <section className="form-zone" aria-labelledby="zone-student">
          <div className="form-progress"><span className="form-progress-number">01</span><div><strong id="zone-student">Student Information <span>/ ข้อมูลผู้สมัคร</span></strong><small>กรอกชื่อให้ตรงกับเอกสารที่จะใช้ในการสอบและออกใบประกาศ</small></div><span className="required-note"><span className="required-mark">*</span> จำเป็น</span></div>
          {!isFinal ? (
            <div className="source-choice">
              <span className="field-title">สมัครในนาม</span>
              <div className="source-choice-grid">
                <label className={applicationSource === "self" ? "source-selected" : ""}><input type="radio" name="source" checked={applicationSource === "self"} onChange={() => { setApplicationSource("self"); update("source", "self"); }} /><span className="source-option-icon"><Icon name="users" /></span><span><strong>ผู้สมัครเอง</strong><small>ใช้บัญชีส่วนตัว</small></span></label>
                <label className={applicationSource === "school" ? "source-selected" : ""}><input type="radio" name="source" checked={applicationSource === "school"} onChange={() => { setApplicationSource("school"); update("source", "school"); }} /><span className="source-option-icon"><Icon name="building" /></span><span><strong>โรงเรียน</strong><small>ผู้ประสานงานส่งแทน</small></span></label>
              </div>
            </div>
          ) : (
            <div className="notice notice-blue"><Icon name="info" /><div><strong>ข้อมูลจากใบสมัคร Heat</strong><p>ตรวจสอบและแก้ไขข้อมูลที่อนุญาตได้ก่อนส่งใบสมัคร Final</p></div></div>
          )}
          <div className="form-grid">
            <Field label="English First Name" required><input autoComplete="given-name" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} placeholder="First name" required /></Field>
            <Field label="English Last Name" required><input autoComplete="family-name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} placeholder="Last name" required /></Field>
            <Field label="ชื่อ (ภาษาไทย)" required><input value={form.thaiFirstName} onChange={(event) => update("thaiFirstName", event.target.value)} placeholder="ชื่อจริงภาษาไทย" required /></Field>
            <Field label="นามสกุล (ภาษาไทย)" required><input value={form.thaiLastName} onChange={(event) => update("thaiLastName", event.target.value)} placeholder="นามสกุลภาษาไทย" required /></Field>
            <fieldset className="gender-fieldset"><legend className="field-title">Gender / เพศ <span className="required-mark">*</span></legend><div className="gender-options">{[["Male", "ชาย"], ["Female", "หญิง"], ["Prefer not to say", "ไม่ประสงค์ระบุ"]].map(([value, label]) => <label key={value}><input type="radio" name="gender" value={value} checked={form.gender === value} onChange={() => update("gender", value)} required /><span>{label}</span></label>)}</div></fieldset>
            <Field label="Date of Birth / วันเกิด" required><input type="date" autoComplete="bday" value={form.dateOfBirth} onChange={(event) => update("dateOfBirth", event.target.value)} required /></Field>
            <Field label="School Name / โรงเรียน" required hint="เลือกชื่อโรงเรียนจากรายการ หากไม่มีชื่อให้เลือก Other แล้วกรอกช่องด้านขวา"><select value={form.schoolName} onChange={(event) => { const schoolName = event.target.value; setForm((current) => ({ ...current, schoolName, certificateSchoolName: schoolName === "Other" ? "" : current.certificateSchoolName })); }} required><option value="">เลือกโรงเรียน</option>{schools.map((school) => <option key={school} value={school}>{school === "Other" ? "Other / ไม่พบโรงเรียน" : school}</option>)}</select></Field>
            <Field label={form.schoolName === "Other" ? "School Name in English / ชื่อโรงเรียน" : "School Name in English for Certificate"} required={form.schoolName === "Other"} hint={form.schoolName === "Other" ? "พิมพ์ชื่อโรงเรียนภาษาอังกฤษที่ไม่พบในรายการ" : "กรอกหากต้องการใช้ชื่อโรงเรียนภาษาอังกฤษแบบอื่นบนใบประกาศ"}><input value={form.certificateSchoolName} onChange={(event) => update("certificateSchoolName", event.target.value)} placeholder={form.schoolName === "Other" ? "พิมพ์ชื่อโรงเรียนที่นี่" : "ชื่อโรงเรียนภาษาอังกฤษบนใบประกาศ"} required={form.schoolName === "Other"} /></Field>
            <Field label="Email / อีเมล" required hint="ระบบจะส่งข้อมูลเข้าใช้งานข้อสอบเก่าภายใน 3–5 วันหลังสมัคร"><input type="email" autoComplete="email" value={form.email} onChange={(event) => update("email", event.target.value)} placeholder="student@example.com" required /></Field>
            <Field label="Phone Number / เบอร์โทรศัพท์" required hint="รูปแบบตัวอย่าง (000) 000-0000"><input type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder="(000) 000-0000" required /></Field>
            <section className="address-subzone" aria-labelledby="address-subzone-title">
              <div className="address-subzone-heading"><span className="address-subzone-icon"><Icon name="building" size={15} /></span><div><h3 id="address-subzone-title">Address <span>/ ที่อยู่</span></h3><p>กรอกที่อยู่สำหรับติดต่อ</p></div></div>
              <div className="address-subzone-grid">
                <Field label="Address Line 1 / ที่อยู่" required><input autoComplete="address-line1" value={form.address1} onChange={(event) => update("address1", event.target.value)} placeholder="บ้านเลขที่ ถนน" required /></Field>
                <Field label="Address Line 2 / ที่อยู่เพิ่มเติม"><input autoComplete="address-line2" value={form.address2} onChange={(event) => update("address2", event.target.value)} placeholder="อาคาร หมู่บ้าน (ถ้ามี)" /></Field>
                <Field label="District / City / เขตหรืออำเภอ" required><input autoComplete="address-level2" value={form.city} onChange={(event) => update("city", event.target.value)} required /></Field>
                <Field label="Province / จังหวัด" required><input autoComplete="address-level1" value={form.province} onChange={(event) => update("province", event.target.value)} required /></Field>
                <Field label="Postal Code / รหัสไปรษณีย์" required><input autoComplete="postal-code" inputMode="numeric" maxLength={10} value={form.postalCode} onChange={(event) => update("postalCode", event.target.value.replace(/[^\d-]/g, ""))} required /></Field>
              </div>
            </section>
          </div>
          </section>
          <section className="form-zone" aria-labelledby="zone-competition">
            <div className="form-progress"><span className="form-progress-number">02</span><div><strong id="zone-competition">Competition Selection <span>/ เลือกรายการสอบและระดับชั้น</span></strong><small>เลือกรายการที่ต้องการสมัคร แล้วเลือกระดับชั้นแยกในแต่ละรายการ</small></div></div>
            <div className="competition-list">
              {competitions.map((competition) => {
                const selected = form.competitionIds.includes(competition.id);
                return <article className={`competition-card${selected ? " competition-card-selected" : ""}`} key={competition.id}>
                  <label className="competition-select"><input type="checkbox" checked={selected} onChange={() => toggleCompetition(competition.id)} /><span className="competition-check-mark" aria-hidden="true" /><span><strong>{competition.name}</strong><small>{competition.subject}</small></span><span className="competition-fee">{form.format === "Online" ? "฿655" : "฿755"}<small> / รายการ</small></span></label>
                  {selected ? <Field label={`ระดับชั้น ${competition.short}`} required className="competition-grade"><select value={form.grades[competition.id] || ""} onChange={(event) => { setForm((current) => ({ ...current, grades: { ...current.grades, [competition.id]: event.target.value } })); setSelectionError(""); }} required><option value="">เลือกระดับชั้น</option>{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}</select></Field> : null}
                </article>;
              })}
            </div>
            <div className="schedule-note"><Icon name="calendar" size={16} /><div><strong>กำหนดการรอบสอบ</strong><span>ปิดรับสมัคร 30 พ.ย. 2569 · วันสอบ 13 ธ.ค. 2569</span><small>HKICO 08:30–09:30 · HKISO 09:45–10:45 · Big Bay Bei 11:15–12:30</small></div></div>
            {selectionError ? <p className="inline-error selection-error" role="alert"><Icon name="info" size={16} />{selectionError}</p> : null}
          </section>
          <section className="form-zone" aria-labelledby="zone-mode">
            <div className="form-progress"><span className="form-progress-number">03</span><div><strong id="zone-mode">Exam Mode and Exam Center <span>/ รูปแบบและศูนย์สอบ</span></strong><small>ค่าธรรมเนียมคิดแยกตามจำนวนรายการสอบ</small></div></div>
            <fieldset className="mode-fieldset"><legend className="field-title">เลือกรูปแบบการสอบ <span className="required-mark">*</span></legend><div className="mode-options">
              <label className={form.format === "Paper-Based" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name="exam-mode" checked={form.format === "Paper-Based"} onChange={() => { update("format", "Paper-Based"); update("center", ""); }} /><span><strong>Paper-Based</strong><small>สอบที่ศูนย์สอบ</small></span><b>฿755 <small>/ รายการ</small></b></label>
              <label className={form.format === "Online" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name="exam-mode" checked={form.format === "Online"} onChange={() => { update("format", "Online"); update("center", ""); }} /><span><strong>Online Exam</strong><small>สอบออนไลน์</small></span><b>฿655 <small>/ รายการ</small></b></label>
            </div></fieldset>
            {form.format === "Paper-Based" ? <Field label="Exam Center / ศูนย์สอบ" required hint="เลือกจังหวัด/ศูนย์สอบที่สะดวก"><select value={form.center} onChange={(event) => { update("center", event.target.value); setPaymentError(""); }} required><option value="">เลือกศูนย์สอบ</option>{centers.map((center) => <option key={center}>{center}</option>)}</select></Field> : <div className="online-device-note"><Icon name="monitor" /><div><strong>อุปกรณ์สำหรับสอบออนไลน์</strong><span>ใช้คอมพิวเตอร์หรือแล็ปท็อปสำหรับทำข้อสอบ และใช้สมาร์ตโฟนหรือแท็บเล็ตสำหรับ Zoom/กล้อง</span></div></div>}
            <p className="form-helper-note">โปรดตรวจสอบรายการสอบ ระดับชั้น รูปแบบ และศูนย์สอบให้ถูกต้องก่อนชำระเงิน</p>
          </section>
          <section className="form-zone" aria-labelledby="zone-papers">
            <div className="form-progress"><span className="form-progress-number">04</span><div><strong id="zone-papers">Past Papers <span>/ ข้อสอบเก่า</span></strong><small>เลือกซื้อเพิ่มเติมได้ รายการที่เลือกจะส่งข้อมูลเข้าใช้งานทางอีเมล</small></div><span className="paper-total-chip">รวม ฿{pastPapersTotal.toLocaleString()}</span></div>
            <div className="past-paper-grid">{pastPaperGroups.map((group) => <fieldset className="past-paper-group" key={group.id}><legend>{group.title}</legend><div>{group.items.map((paper) => <label className="past-paper-option" key={paper.id}><input type="checkbox" checked={form.pastPaperIds.includes(paper.id)} onChange={() => togglePastPaper(paper.id)} /><span className="past-paper-copy"><strong>{paper.title}</strong><small>{paper.detail}</small></span><b>฿{paper.price}</b></label>)}</div></fieldset>)}</div>
            <div className="past-paper-info"><strong>📚 ข้อมูลข้อสอบเก่า</strong><p><b>HKISO / HKICO:</b> English Version · <b>Big Bay Bei:</b> English + Thai Version พร้อม VDO ภาษาไทย</p><p>เข้าใช้งานผ่าน <a href="https://www.learnocecth.com/" target="_blank" rel="noreferrer">Learn OCEC Thailand</a> โดยเจ้าหน้าที่จะส่งข้อมูลทางอีเมลภายใน 3–5 วันหลังสมัคร</p><small>ข้อสอบที่ซื้อจะตรงกับระดับชั้นที่สมัคร · หากต้องการข้อสอบระดับชั้นเพิ่มเติม ติดต่อ LINE Official: <b>@ocecth</b> · กรุณาตรวจ Junk / Spam Mail</small></div>
          </section>
          <section className="form-zone form-zone-payment" aria-labelledby="zone-payment">
            <div className="form-progress"><span className="form-progress-number">05</span><div><strong id="zone-payment">Payment and Confirmation <span>/ ชำระเงินและยืนยัน</span></strong><small>ตรวจยอดชำระให้ครบก่อนแนบหลักฐาน</small></div></div>
            <div className="payment-total-grid"><div><span>ข้อสอบเก่า</span><small>Past Papers Total</small><strong>฿{pastPapersTotal.toLocaleString()}</strong></div><div><span>ค่าสมัครสอบ</span><small>Competition Registration Fee</small><strong>฿{registrationFee.toLocaleString()}</strong></div><div className="payment-total-grand"><span>ยอดที่ต้องชำระ</span><small>Total Payment</small><strong>฿{totalPayment.toLocaleString()}</strong></div></div>
            <div className="bank-payment-card"><div className="bank-payment-heading"><span className="bank-payment-icon"><Icon name="building" /></span><div><strong>โอนเงินผ่าน Kasikorn Bank</strong><small>กรุณาตรวจสอบยอดรวมก่อนชำระ</small></div></div><div className="bank-payment-details"><span><small>ACCOUNT NAME</small><strong>บจก. โอซีอีซี (ไทยแลนด์)</strong></span><span><small>ACCOUNT NO.</small><strong>219-3-78805-2</strong></span></div></div>
            <div className="refund-warning"><Icon name="info" /><div><strong>REGISTRATION FEES: NON-REFUNDABLE</strong><span>ค่าธรรมเนียมการสมัครขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนชำระเงิน</span></div></div>
            <label className="file-drop file-drop-inline">
              <input type="file" accept="image/*,.pdf" onChange={(event) => { setFileName(event.target.files?.[0]?.name || ""); setFileError(""); }} aria-label="แนบหลักฐานการชำระเงิน" />
              <span className="file-drop-icon"><Icon name="upload" /></span>
              <span className="file-drop-copy"><strong>{fileName || "แนบหลักฐานการชำระเงิน"}</strong><small>รองรับ JPG, PNG หรือ PDF · ไม่เกิน 10 MB</small></span>
              <span className="file-select-label">เลือกไฟล์</span>
            </label>
            {fileError ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{fileError}</p> : null}
            <label className="confirm-check"><input type="checkbox" checked={form.confirmDetails} onChange={(event) => { update("confirmDetails", event.target.checked); setSelectionError(""); setPaymentError(""); }} /><span>ข้าพเจ้ารับทราบและตรวจสอบข้อมูลเรียบร้อยแล้ว และต้องการยืนยันส่งแบบฟอร์มนี้ <b>*</b></span></label>
            <label className="confirm-check confirm-check-optional"><input type="checkbox" checked={form.marketingConsent} onChange={(event) => update("marketingConsent", event.target.checked)} /><span>ข้าพเจ้ายินยอมให้ OCEC Thailand เผยแพร่ชื่อผู้สมัคร ผลการแข่งขัน และรางวัล ผ่านช่องทางประชาสัมพันธ์อย่างเป็นทางการของ OCEC Thailand และรายการแข่งขัน</span></label>
            {paymentError ? <p className="inline-error selection-error" role="alert"><Icon name="info" size={16} />{paymentError}</p> : null}
          <div className="form-footer form-footer-submit"><span><Icon name="lock" size={14} />ข้อมูลถูกใช้เพื่อดำเนินการสมัครสอบ</span><Button type="submit" icon="arrow">ส่งใบสมัคร</Button></div>
          </section>
        </form>
        <aside className="surface side-note form-side-note">
          <span className="side-note-icon"><Icon name="shield" /></span><h3>สรุปการสมัคร</h3>
          <div className="live-total"><span>รายการสอบ</span><strong>{selectedCompetitions.length} รายการ</strong>{selectedCompetitions.map((competition) => <small key={competition.id}>{competition.short}{form.grades[competition.id] ? ` · ${form.grades[competition.id]}` : " · เลือกระดับชั้น"}</small>)}</div>
          <div className="live-total"><span>รูปแบบสอบ</span><strong>{form.format === "Online" ? "Online Exam" : "Paper-Based"}</strong><small>{form.format === "Online" ? "ใช้ 2 อุปกรณ์" : form.center || "ยังไม่ได้เลือกศูนย์สอบ"}</small></div>
          <div className="live-total live-total-highlight"><span>ยอดรวมปัจจุบัน</span><strong>฿{totalPayment.toLocaleString()}</strong><small>ค่าสอบ ฿{registrationFee.toLocaleString()} + ข้อสอบเก่า ฿{pastPapersTotal.toLocaleString()}</small></div>
          <hr /><div className="side-deadline"><Icon name="calendar" /><span><small>วันสอบ</small><strong>13 ธันวาคม 2569</strong></span></div>
          <p className="side-note-small">หลังสมัคร ข้อมูลสรุปและรายละเอียดข้อสอบเก่าจะส่งไปยังอีเมลที่กรอกไว้</p>
        </aside>
      </div>
    </div>
  );
}

function SchoolBatchForm({ kind, prefill, batch, setBatch, onSubmit, navigate, onBack }) {
  const [formError, setFormError] = useState("");
  const [errorSection, setErrorSection] = useState("");
  const competitions = FORM_COMPETITIONS;
  const pastPaperGroups = FORM_PAST_PAPER_GROUPS;
  const allPastPapers = pastPaperGroups.flatMap((group) => group.items);
  const activeApplicant = batch.applicants.find((applicant) => applicant.id === batch.activeId) || batch.applicants[0];
  const activeIndex = Math.max(0, batch.applicants.findIndex((applicant) => applicant.id === activeApplicant.id));

  function applicantIssue(applicant) {
    if (!applicant.firstName.trim()) return "กรุณากรอกชื่อภาษาอังกฤษ";
    if (!applicant.lastName.trim()) return "กรุณากรอกนามสกุลภาษาอังกฤษ";
    if (!applicant.thaiFirstName.trim()) return "กรุณากรอกชื่อภาษาไทย";
    if (!applicant.thaiLastName.trim()) return "กรุณากรอกนามสกุลภาษาไทย";
    if (!applicant.gender) return "กรุณาเลือกเพศ";
    if (!applicant.dateOfBirth) return "กรุณากรอกวันเกิด";
    if (!applicant.schoolName) return "กรุณาเลือกโรงเรียน";
    if (applicant.schoolName === "Other" && !applicant.certificateSchoolName.trim()) return "กรุณากรอกชื่อโรงเรียนภาษาอังกฤษ";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email)) return "กรุณากรอกอีเมลให้ถูกต้อง";
    if (applicant.phone.replace(/\D/g, "").length < 7) return "กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง";
    if (!applicant.address1.trim()) return "กรุณากรอกที่อยู่";
    if (!applicant.city.trim()) return "กรุณากรอกเขตหรืออำเภอ";
    if (!applicant.province.trim()) return "กรุณากรอกจังหวัด";
    if (!applicant.postalCode.trim()) return "กรุณากรอกรหัสไปรษณีย์";
    if (applicant.competitionIds.length === 0) return "กรุณาเลือกรายการสอบอย่างน้อย 1 รายการ";
    const selectedCompetitions = competitions.filter((competition) => applicant.competitionIds.includes(competition.id));
    if (selectedCompetitions.some((competition) => !applicant.grades[competition.id])) return "กรุณาเลือกระดับชั้นให้ครบทุกวิชาที่สมัคร";
    if (applicant.format === "Paper-Based" && !applicant.center) return "กรุณาเลือกศูนย์สอบ";
    return "";
  }

  function totalsFor(applicant) {
    const selectedCompetitions = competitions.filter((competition) => applicant.competitionIds.includes(competition.id));
    const selectedPapers = allPastPapers.filter((paper) => applicant.pastPaperIds.includes(paper.id));
    const papersTotal = selectedPapers.reduce((sum, paper) => sum + paper.price, 0);
    const registrationFee = selectedCompetitions.length * (applicant.format === "Online" ? 655 : 755);
    return { selectedCompetitions, selectedPapers, papersTotal, registrationFee, totalPayment: papersTotal + registrationFee };
  }

  const applicantTotals = batch.applicants.map((applicant) => totalsFor(applicant));
  const batchTotals = applicantTotals.reduce((sum, item) => ({
    papersTotal: sum.papersTotal + item.papersTotal,
    registrationFee: sum.registrationFee + item.registrationFee,
    totalPayment: sum.totalPayment + item.totalPayment,
  }), { papersTotal: 0, registrationFee: 0, totalPayment: 0 });

  function updateApplicant(id, key, value) {
    setBatch((current) => ({
      ...current,
      applicants: current.applicants.map((applicant) => applicant.id === id ? { ...applicant, [key]: value } : applicant),
    }));
    setFormError("");
    setErrorSection("");
  }

  function toggleCompetition(id) {
    const applicant = activeApplicant;
    updateApplicant(applicant.id, "competitionIds", applicant.competitionIds.includes(id)
      ? applicant.competitionIds.filter((competitionId) => competitionId !== id)
      : [...applicant.competitionIds, id]);
  }

  function togglePastPaper(id) {
    const applicant = activeApplicant;
    updateApplicant(applicant.id, "pastPaperIds", applicant.pastPaperIds.includes(id)
      ? applicant.pastPaperIds.filter((paperId) => paperId !== id)
      : [...applicant.pastPaperIds, id]);
  }

  function addApplicant() {
    setBatch((current) => {
      const id = `school-applicant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const applicant = createSchoolApplicant(id, prefill);
      return { ...current, applicants: [...current.applicants, applicant], activeId: id };
    });
    setFormError("");
    setErrorSection("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function removeApplicant(id) {
    setBatch((current) => {
      if (current.applicants.length <= 1) return current;
      const index = current.applicants.findIndex((applicant) => applicant.id === id);
      const applicants = current.applicants.filter((applicant) => applicant.id !== id);
      return { ...current, applicants, activeId: current.activeId === id ? applicants[Math.max(0, index - 1)].id : current.activeId };
    });
    setFormError("");
    setErrorSection("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const invalidApplicantIndex = batch.applicants.findIndex((applicant) => applicantIssue(applicant));
    if (invalidApplicantIndex >= 0) {
      const invalidApplicant = batch.applicants[invalidApplicantIndex];
      setBatch((current) => ({ ...current, activeId: invalidApplicant.id }));
      const name = `${invalidApplicant.firstName} ${invalidApplicant.lastName}`.trim();
      const label = name || `ผู้เข้าสอบคนที่ ${invalidApplicantIndex + 1}`;
      setFormError(`${label}: ${applicantIssue(invalidApplicant)}`);
      setErrorSection("applicant");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const missingSlip = batch.applicants.findIndex((applicant) => !applicant.fileName);
    if (missingSlip >= 0) {
      setFormError(`กรุณาแนบสลิปแยกสำหรับผู้เข้าสอบคนที่ ${missingSlip + 1}`);
      setErrorSection("payment");
      document.getElementById("school-payment-zone")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!batch.confirmDetails) {
      setFormError("กรุณายืนยันว่าตรวจสอบข้อมูลและยอดชำระของผู้สมัครทุกคนเรียบร้อยแล้ว");
      setErrorSection("payment");
      return;
    }
    setFormError("");
    setErrorSection("");
    const batchId = `school-batch-${Date.now()}`;
    const batchApplications = batch.applicants.map((applicant) => {
      const totals = totalsFor(applicant);
      const school = applicant.schoolName === "Other" ? applicant.certificateSchoolName.trim() : applicant.schoolName;
      return {
        ...applicant,
        source: "school",
        kind,
        candidate: `${applicant.firstName} ${applicant.lastName}`.trim(),
        school,
        contactEmail: applicant.email,
        grade: totals.selectedCompetitions.map((competition) => `${competition.short}: ${applicant.grades[competition.id]}`).join(" · "),
        center: applicant.format === "Online" ? "Online Exam" : applicant.center,
        examListings: totals.selectedCompetitions,
        pastPaperSelections: totals.selectedPapers,
        pastPapersTotal: totals.papersTotal,
        registrationFee: totals.registrationFee,
        totalPayment: totals.totalPayment,
        marketingConsent: Boolean(batch.marketingConsent),
        sourceHeatId: prefill?.id || "",
        batchId,
      };
    });
    onSubmit({ source: "school", kind, batchId, batchApplications, totalPayment: batchTotals.totalPayment });
  }

  const fullName = `${activeApplicant.firstName} ${activeApplicant.lastName}`.trim();
  const activeTotals = totalsFor(activeApplicant);
  const totalLabel = (value) => `฿${value.toLocaleString()}`;

  return (
    <div className="page-stack">
      <PageHeading
        eyebrow="สมัครผ่านโรงเรียน · ปีการศึกษา 2569"
        title={kind === "Final" ? "สมัครสอบ Final แบบโรงเรียน" : "สมัครสอบแบบโรงเรียน"}
        description="เพิ่มผู้เข้าสอบได้หลายคน กรอกข้อมูลและเลือกรายการสอบแยกสำหรับแต่ละคน"
        action={<div className="school-form-actions" role="group" aria-label="การดำเนินการสมัคร">
          <Button icon="arrow" className="school-mode-return-button" onClick={onBack}>กลับไปสมัครด้วยตนเอง</Button>
          <Button variant="outline" icon="close" onClick={() => navigate(kind === "Final" ? "final-confirm" : "home")}>ยกเลิก</Button>
        </div>}
      />
      <div className="form-layout school-batch-layout">
        <form className="surface form-surface registration-form school-batch-form" onSubmit={handleSubmit} noValidate>
          <section className="form-zone" aria-labelledby="school-zone-student">
            <div className="form-progress"><span className="form-progress-number">01</span><div><strong id="school-zone-student">Student Information <span>/ ข้อมูลผู้สมัคร</span></strong><small>สร้างใบสมัครแยก 1 ใบต่อผู้เข้าสอบ</small></div><span className="applicant-count-chip"><Icon name="users" size={14} />{batch.applicants.length} คน</span></div>
            <div className="school-mode-note"><Icon name="info" size={17} /><span>แต่ละคนมีข้อมูล รายการสอบ และระดับชั้นของตนเอง · กดสลับชื่อเพื่อแก้ไขข้อมูล</span></div>
            <div className="school-applicant-switcher" role="group" aria-label="เลือกผู้เข้าสอบ">
              {batch.applicants.map((applicant, index) => {
                const applicantName = `${applicant.firstName} ${applicant.lastName}`.trim();
                const complete = !applicantIssue(applicant);
                return <div className={`school-applicant-tab-wrap${applicant.id === activeApplicant.id ? " school-applicant-tab-active" : ""}`} key={applicant.id}>
                  <button type="button" aria-pressed={applicant.id === activeApplicant.id} className="school-applicant-tab" onClick={() => { setBatch((current) => ({ ...current, activeId: applicant.id })); setFormError(""); setErrorSection(""); }}>
                    <span className="applicant-number">{String(index + 1).padStart(2, "0")}</span>
                    <span className="school-applicant-copy"><strong>{applicantName || `ผู้เข้าสอบคนที่ ${index + 1}`}</strong><small>{applicant.schoolName === "Other" ? applicant.certificateSchoolName || "รอระบุโรงเรียน" : applicant.schoolName || "ยังไม่ได้เลือกโรงเรียน"} · {applicant.competitionIds.length} รายการสอบ</small></span>
                    <span className={complete ? "applicant-status applicant-status-ready" : "applicant-status"}>{complete ? "ข้อมูลครบ" : "กำลังกรอก"}</span>
                  </button>
                  {batch.applicants.length > 1 ? <button type="button" className="remove-applicant-button" aria-label={`ลบใบสมัครของผู้เข้าสอบคนที่ ${index + 1}`} onClick={() => removeApplicant(applicant.id)}><Icon name="close" size={16} /></button> : null}
                </div>;
              })}
            </div>
            <Button variant="outline" icon="plus" className="add-applicant-button" onClick={addApplicant}>เพิ่มผู้เข้าสอบ</Button>
            {formError && errorSection === "applicant" ? <p className="inline-error school-form-error" role="alert"><Icon name="info" size={16} />{formError}</p> : null}
            <div className="student-entry-card">
              <div className="student-entry-heading"><span className="student-entry-index">{String(activeIndex + 1).padStart(2, "0")}</span><div><strong>{fullName || `ผู้เข้าสอบคนที่ ${activeIndex + 1}`}</strong><small>ใบสมัครที่ {activeIndex + 1} จาก {batch.applicants.length}</small></div><span className="student-entry-total">รวม {totalLabel(activeTotals.totalPayment)}</span></div>
              <div className="form-grid">
                <Field label="English First Name" required><input autoComplete="given-name" value={activeApplicant.firstName} onChange={(event) => updateApplicant(activeApplicant.id, "firstName", event.target.value)} placeholder="First name" /></Field>
                <Field label="English Last Name" required><input autoComplete="family-name" value={activeApplicant.lastName} onChange={(event) => updateApplicant(activeApplicant.id, "lastName", event.target.value)} placeholder="Last name" /></Field>
                <Field label="ชื่อ (ภาษาไทย)" required><input value={activeApplicant.thaiFirstName} onChange={(event) => updateApplicant(activeApplicant.id, "thaiFirstName", event.target.value)} placeholder="ชื่อจริงภาษาไทย" /></Field>
                <Field label="นามสกุล (ภาษาไทย)" required><input value={activeApplicant.thaiLastName} onChange={(event) => updateApplicant(activeApplicant.id, "thaiLastName", event.target.value)} placeholder="นามสกุลภาษาไทย" /></Field>
                <fieldset className="gender-fieldset"><legend className="field-title">Gender / เพศ <span className="required-mark">*</span></legend><div className="gender-options">{[["Male", "ชาย"], ["Female", "หญิง"], ["Prefer not to say", "ไม่ประสงค์ระบุ"]].map(([value, label]) => <label key={value}><input type="radio" name={`gender-${activeApplicant.id}`} value={value} checked={activeApplicant.gender === value} onChange={() => updateApplicant(activeApplicant.id, "gender", value)} /><span>{label}</span></label>)}</div></fieldset>
                <Field label="Date of Birth / วันเกิด" required><input type="date" autoComplete="bday" value={activeApplicant.dateOfBirth} onChange={(event) => updateApplicant(activeApplicant.id, "dateOfBirth", event.target.value)} /></Field>
                <Field label="School Name / โรงเรียน" required hint="เลือกจากรายการ หากไม่มีชื่อให้เลือก Other แล้วกรอกช่องด้านขวา"><select value={activeApplicant.schoolName} onChange={(event) => { const schoolName = event.target.value; setBatch((current) => ({ ...current, applicants: current.applicants.map((applicant) => applicant.id === activeApplicant.id ? { ...applicant, schoolName, certificateSchoolName: schoolName === "Other" ? "" : applicant.certificateSchoolName } : applicant) })); setFormError(""); setErrorSection(""); }}><option value="">เลือกโรงเรียน</option>{FORM_SCHOOLS.map((school) => <option key={school} value={school}>{school === "Other" ? "Other / ไม่พบโรงเรียน" : school}</option>)}</select></Field>
                <Field label={activeApplicant.schoolName === "Other" ? "School Name in English / ชื่อโรงเรียน" : "School Name in English for Certificate"} required={activeApplicant.schoolName === "Other"} hint={activeApplicant.schoolName === "Other" ? "พิมพ์ชื่อโรงเรียนภาษาอังกฤษที่ไม่พบในรายการ" : "กรอกหากต้องการใช้ชื่อโรงเรียนภาษาอังกฤษแบบอื่นบนใบประกาศ"}><input value={activeApplicant.certificateSchoolName} onChange={(event) => updateApplicant(activeApplicant.id, "certificateSchoolName", event.target.value)} placeholder={activeApplicant.schoolName === "Other" ? "พิมพ์ชื่อโรงเรียนที่นี่" : "ชื่อโรงเรียนภาษาอังกฤษบนใบประกาศ"} /></Field>
                <Field label="Email / อีเมล" required hint="ระบบส่งข้อมูลข้อสอบเก่าไปยังอีเมลของผู้เข้าสอบ"><input type="email" autoComplete="email" value={activeApplicant.email} onChange={(event) => updateApplicant(activeApplicant.id, "email", event.target.value)} placeholder="student@example.com" /></Field>
                <Field label="Phone Number / เบอร์โทรศัพท์" required hint="รูปแบบตัวอย่าง (000) 000-0000"><input type="tel" inputMode="tel" autoComplete="tel" value={activeApplicant.phone} onChange={(event) => updateApplicant(activeApplicant.id, "phone", event.target.value)} placeholder="(000) 000-0000" /></Field>
                <section className="address-subzone" aria-labelledby={`address-${activeApplicant.id}`}>
                  <div className="address-subzone-heading"><span className="address-subzone-icon"><Icon name="building" size={15} /></span><div><h3 id={`address-${activeApplicant.id}`}>Address <span>/ ที่อยู่</span></h3><p>กรอกที่อยู่สำหรับติดต่อ</p></div></div>
                  <div className="address-subzone-grid">
                    <Field label="Address Line 1 / ที่อยู่" required><input autoComplete="address-line1" value={activeApplicant.address1} onChange={(event) => updateApplicant(activeApplicant.id, "address1", event.target.value)} placeholder="บ้านเลขที่ ถนน" /></Field>
                    <Field label="Address Line 2 / ที่อยู่เพิ่มเติม"><input autoComplete="address-line2" value={activeApplicant.address2} onChange={(event) => updateApplicant(activeApplicant.id, "address2", event.target.value)} placeholder="อาคาร หมู่บ้าน (ถ้ามี)" /></Field>
                    <Field label="District / City / เขตหรืออำเภอ" required><input autoComplete="address-level2" value={activeApplicant.city} onChange={(event) => updateApplicant(activeApplicant.id, "city", event.target.value)} /></Field>
                    <Field label="Province / จังหวัด" required><input autoComplete="address-level1" value={activeApplicant.province} onChange={(event) => updateApplicant(activeApplicant.id, "province", event.target.value)} /></Field>
                    <Field label="Postal Code / รหัสไปรษณีย์" required><input autoComplete="postal-code" inputMode="numeric" maxLength={10} value={activeApplicant.postalCode} onChange={(event) => updateApplicant(activeApplicant.id, "postalCode", event.target.value.replace(/[^\d-]/g, ""))} /></Field>
                  </div>
                </section>
              </div>
            </div>
          </section>

          <section className="form-zone" aria-labelledby={`school-zone-competition-${activeApplicant.id}`}>
            <div className="form-progress"><span className="form-progress-number">02</span><div><strong id={`school-zone-competition-${activeApplicant.id}`}>Competition Selection <span>/ รายการสอบและระดับชั้น</span></strong><small>เลือกได้หลายรายการ และเลือกระดับชั้นแยกในแต่ละรายการ</small></div></div>
            <div className="competition-list">{competitions.map((competition) => {
              const selected = activeApplicant.competitionIds.includes(competition.id);
              return <article className={`competition-card${selected ? " competition-card-selected" : ""}`} key={competition.id}>
                <label className="competition-select"><input type="checkbox" checked={selected} onChange={() => toggleCompetition(competition.id)} /><span className="competition-check-mark" aria-hidden="true" /><span><strong>{competition.name}</strong><small>{competition.subject}</small></span><span className="competition-fee">{activeApplicant.format === "Online" ? "฿655" : "฿755"}<small> / รายการ</small></span></label>
                {selected ? <Field label={`ระดับชั้น ${competition.short}`} required className="competition-grade"><select value={activeApplicant.grades[competition.id] || ""} onChange={(event) => updateApplicant(activeApplicant.id, "grades", { ...activeApplicant.grades, [competition.id]: event.target.value })}><option value="">เลือกระดับชั้น</option>{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}</select></Field> : null}
              </article>;
            })}</div>
            <div className="schedule-note"><Icon name="calendar" size={16} /><div><strong>กำหนดการรอบสอบ</strong><span>ปิดรับสมัคร 30 พ.ย. 2569 · วันสอบ 13 ธ.ค. 2569</span><small>HKICO 08:30–09:30 · HKISO 09:45–10:45 · Big Bay Bei 11:15–12:30</small></div></div>
          </section>

          <section className="form-zone" aria-labelledby={`school-zone-mode-${activeApplicant.id}`}>
            <div className="form-progress"><span className="form-progress-number">03</span><div><strong id={`school-zone-mode-${activeApplicant.id}`}>Exam Mode and Exam Center <span>/ รูปแบบและศูนย์สอบ</span></strong><small>เลือกให้ผู้เข้าสอบแต่ละคนได้อิสระ</small></div></div>
            <fieldset className="mode-fieldset"><legend className="field-title">เลือกรูปแบบการสอบ <span className="required-mark">*</span></legend><div className="mode-options">
              <label className={activeApplicant.format === "Paper-Based" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name={`exam-mode-${activeApplicant.id}`} checked={activeApplicant.format === "Paper-Based"} onChange={() => { setBatch((current) => ({ ...current, applicants: current.applicants.map((applicant) => applicant.id === activeApplicant.id ? { ...applicant, format: "Paper-Based", center: "" } : applicant) })); setFormError(""); setErrorSection(""); }} /><span><strong>Paper-Based</strong><small>สอบที่ศูนย์สอบ</small></span><b>฿755 <small>/ รายการ</small></b></label>
              <label className={activeApplicant.format === "Online" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name={`exam-mode-${activeApplicant.id}`} checked={activeApplicant.format === "Online"} onChange={() => { setBatch((current) => ({ ...current, applicants: current.applicants.map((applicant) => applicant.id === activeApplicant.id ? { ...applicant, format: "Online", center: "" } : applicant) })); setFormError(""); setErrorSection(""); }} /><span><strong>Online Exam</strong><small>สอบออนไลน์</small></span><b>฿655 <small>/ รายการ</small></b></label>
            </div></fieldset>
            {activeApplicant.format === "Paper-Based" ? <Field label="Exam Center / ศูนย์สอบ" required hint="เลือกจังหวัด/ศูนย์สอบที่สะดวก"><select value={activeApplicant.center} onChange={(event) => updateApplicant(activeApplicant.id, "center", event.target.value)}><option value="">เลือกศูนย์สอบ</option>{FORM_CENTERS.map((center) => <option key={center}>{center}</option>)}</select></Field> : <div className="online-device-note"><Icon name="monitor" /><div><strong>อุปกรณ์สำหรับสอบออนไลน์</strong><span>ใช้คอมพิวเตอร์หรือแล็ปท็อปสำหรับทำข้อสอบ และใช้สมาร์ตโฟนหรือแท็บเล็ตสำหรับ Zoom/กล้อง</span></div></div>}
            <p className="form-helper-note">โปรดตรวจสอบรายการสอบ ระดับชั้น รูปแบบ และศูนย์สอบของผู้เข้าสอบคนนี้</p>
          </section>

          <section className="form-zone" aria-labelledby={`school-zone-papers-${activeApplicant.id}`}>
            <div className="form-progress"><span className="form-progress-number">04</span><div><strong id={`school-zone-papers-${activeApplicant.id}`}>Past Papers <span>/ ข้อสอบเก่า</span></strong><small>เลือกรายการให้ผู้เข้าสอบคนนี้</small></div><span className="paper-total-chip">รวม {totalLabel(activeTotals.papersTotal)}</span></div>
            <div className="past-paper-grid">{pastPaperGroups.map((group) => <fieldset className="past-paper-group" key={group.id}><legend>{group.title}</legend><div>{group.items.map((paper) => <label className="past-paper-option" key={paper.id}><input type="checkbox" checked={activeApplicant.pastPaperIds.includes(paper.id)} onChange={() => togglePastPaper(paper.id)} /><span className="past-paper-copy"><strong>{paper.title}</strong><small>{paper.detail}</small></span><b>฿{paper.price}</b></label>)}</div></fieldset>)}</div>
            <div className="past-paper-info"><strong>ข้อมูลข้อสอบเก่า</strong><p><b>HKISO / HKICO:</b> English Version · <b>Big Bay Bei:</b> English + Thai Version พร้อม VDO ภาษาไทย</p><p>เจ้าหน้าที่ส่งข้อมูลเข้าใช้งานทางอีเมลภายใน 3–5 วันหลังสมัคร กรุณาตรวจ Junk / Spam Mail</p></div>
          </section>

          <section className="form-zone form-zone-payment" id="school-payment-zone" aria-labelledby="school-zone-payment">
            <div className="form-progress"><span className="form-progress-number">05</span><div><strong id="school-zone-payment">Payment and Confirmation <span>/ ชำระเงินและยืนยัน</span></strong><small>ยอดรวมของผู้เข้าสอบ {batch.applicants.length} คน · แนบสลิปแยกต่อใบสมัคร</small></div></div>
            <div className="payment-total-grid"><div><span>ข้อสอบเก่า</span><small>Past Papers Total · รวมทุกคน</small><strong>{totalLabel(batchTotals.papersTotal)}</strong></div><div><span>ค่าสมัครสอบ</span><small>Competition Registration Fee · รวมทุกคน</small><strong>{totalLabel(batchTotals.registrationFee)}</strong></div><div className="payment-total-grand"><span>ยอดที่ต้องชำระ</span><small>Total Payment · รวมทุกคน</small><strong>{totalLabel(batchTotals.totalPayment)}</strong></div></div>
            <div className="school-payment-breakdown"><div className="school-breakdown-heading"><strong>สรุปยอดแยกตามผู้เข้าสอบ</strong><small>ตรวจสอบยอดและสลิปของแต่ละคนก่อนส่ง</small></div>{batch.applicants.map((applicant, index) => {
              const totals = totalsFor(applicant);
              const applicantName = `${applicant.firstName} ${applicant.lastName}`.trim() || `ผู้เข้าสอบคนที่ ${index + 1}`;
              return <div className="school-breakdown-row" key={applicant.id}><div><strong>{String(index + 1).padStart(2, "0")} · {applicantName}</strong><small>{totals.selectedCompetitions.length} รายการสอบ · ข้อสอบเก่า {totalLabel(totals.papersTotal)}</small></div><b>{totalLabel(totals.totalPayment)}</b></div>;
            })}</div>
            <div className="bank-payment-card"><div className="bank-payment-heading"><span className="bank-payment-icon"><Icon name="building" /></span><div><strong>โอนเงินผ่าน Kasikorn Bank</strong><small>กรุณาตรวจสอบยอดรวมก่อนชำระ</small></div></div><div className="bank-payment-details"><span><small>ACCOUNT NAME</small><strong>บจก. โอซีอีซี (ไทยแลนด์)</strong></span><span><small>ACCOUNT NO.</small><strong>219-3-78805-2</strong></span></div></div>
            <div className="refund-warning"><Icon name="info" /><div><strong>REGISTRATION FEES: NON-REFUNDABLE</strong><span>ค่าธรรมเนียมการสมัครขอสงวนสิทธิ์ไม่คืนเงินทุกกรณี กรุณาตรวจสอบข้อมูลให้เรียบร้อยก่อนชำระเงิน</span></div></div>
            <div className="school-slip-list">{batch.applicants.map((applicant, index) => {
              const applicantName = `${applicant.firstName} ${applicant.lastName}`.trim() || `ผู้เข้าสอบคนที่ ${index + 1}`;
              return <label className="file-drop file-drop-inline school-slip-card" key={applicant.id}>
                <input type="file" accept="image/*,.pdf" aria-label={`แนบสลิปของ ${applicantName}`} onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file && file.size > 10 * 1024 * 1024) {
                    updateApplicant(applicant.id, "fileName", "");
                    updateApplicant(applicant.id, "fileError", "ไฟล์มีขนาดเกิน 10 MB");
                    event.target.value = "";
                    return;
                  }
                  updateApplicant(applicant.id, "fileName", file?.name || "");
                  updateApplicant(applicant.id, "fileError", "");
                  setFormError("");
                }} />
                <span className="file-drop-icon"><Icon name="upload" /></span><span className="file-drop-copy"><strong>{applicant.fileName || `แนบสลิปของ ${applicantName}`}</strong><small>ใบสมัครที่ {index + 1} · JPG, PNG หรือ PDF · ไม่เกิน 10 MB{applicant.fileError ? ` · ${applicant.fileError}` : ""}</small></span><span className="file-select-label">{applicant.fileName ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}</span>
              </label>;
            })}</div>
            <label className="confirm-check"><input type="checkbox" checked={batch.confirmDetails} onChange={(event) => { setBatch((current) => ({ ...current, confirmDetails: event.target.checked })); setFormError(""); setErrorSection(""); }} /><span>ข้าพเจ้าตรวจสอบข้อมูล ยอดชำระ และสลิปของผู้เข้าสอบทุกคนเรียบร้อยแล้ว <b>*</b></span></label>
            <label className="confirm-check confirm-check-optional"><input type="checkbox" checked={batch.marketingConsent} onChange={(event) => setBatch((current) => ({ ...current, marketingConsent: event.target.checked }))} /><span>ข้าพเจ้ายินยอมให้ OCEC Thailand เผยแพร่ชื่อผู้สมัคร ผลการแข่งขัน และรางวัล ผ่านช่องทางประชาสัมพันธ์อย่างเป็นทางการ</span></label>
            {formError && errorSection === "payment" ? <p className="inline-error school-form-error" role="alert"><Icon name="info" size={16} />{formError}</p> : null}
            <div className="form-footer form-footer-submit"><span><Icon name="lock" size={14} />ระบบสร้างใบสมัครแยกตามผู้เข้าสอบ</span><Button type="submit" icon="arrow">ส่งใบสมัคร {batch.applicants.length} คน</Button></div>
          </section>
        </form>
        <aside className="surface side-note form-side-note school-batch-summary">
          <span className="side-note-icon"><Icon name="users" /></span><h3>สรุปชุดใบสมัคร</h3>
          <div className="live-total"><span>ผู้เข้าสอบ</span><strong>{batch.applicants.length} คน</strong>{batch.applicants.map((applicant, index) => {
            const name = `${applicant.firstName} ${applicant.lastName}`.trim();
            const totals = totalsFor(applicant);
            return <small key={applicant.id}>{index + 1}. {name || "ยังไม่ระบุชื่อ"} · {totals.selectedCompetitions.length} รายการ</small>;
          })}</div>
          <div className="live-total live-total-highlight"><span>ยอดชำระรวม</span><strong>{totalLabel(batchTotals.totalPayment)}</strong><small>ค่าสอบ {totalLabel(batchTotals.registrationFee)} + ข้อสอบเก่า {totalLabel(batchTotals.papersTotal)}</small></div>
          <div className="side-deadline"><Icon name="calendar" /><span><small>วันสอบ</small><strong>13 ธันวาคม 2569</strong></span></div>
          <p className="side-note-small">แต่ละใบสมัครส่งอีเมลสรุปและตรวจสลิปแยกไปยังอีเมลของผู้เข้าสอบคนนั้น</p>
        </aside>
      </div>
    </div>
  );
}

function AdminHomePage({ applications, examCatalog, navigate, resultPublished, syncFailed }) {
  const pendingApps = applications.filter((item) => item.status === "pending");
  const confirmedApps = applications.filter((item) => item.status === "confirmed");
  const heatApps = applications.filter((item) => item.kind === "Heat");
  const finalApps = applications.filter((item) => item.kind === "Final");
  const openRounds = examCatalog.filter((item) => item.isOpen);
  const paperlessCount = applications.filter((item) => item.format === "Online Exam").length;
  const competitionCounts = applications.reduce((counts, item) => {
    (item.competitions || []).forEach((competition) => { counts[competition.short || competition.name] = (counts[competition.short || competition.name] || 0) + 1; });
    return counts;
  }, {});
  const tasks = [
    { id: "admin-review", icon: "file", tone: "amber", title: "ตรวจใบสมัครและสลิป", detail: `${pendingApps.length} ใบสมัคร · แยกตรวจรายผู้เข้าสอบ`, count: pendingApps.length },
    { id: "admin-results", icon: "award", tone: "violet", title: resultPublished ? "ดูผลสอบ Heat ที่ประกาศแล้ว" : "เตรียมผลสอบ Heat", detail: resultPublished ? "ผลสอบถูกเผยแพร่แล้ว" : "นำเข้าผลฉบับร่างและตรวจรายการจับคู่", count: resultPublished ? 0 : 1 },
    { id: "admin-final-ids", icon: "users", tone: "blue", title: "จัดการเลขประจำตัว Final", detail: `${finalApps.filter((item) => !item.finalId).length} รายการยังไม่มีเลข`, count: finalApps.filter((item) => !item.finalId).length },
    ...(syncFailed ? [{ id: "admin-sheets", icon: "sync", tone: "amber", title: "ติดตามการซิงก์ข้อมูล", detail: "ระบบกำลังลองซิงก์ใหม่อัตโนมัติ", count: 1 }] : []),
  ].filter((task) => task.count > 0);
  const byYear = Object.values(examCatalog.reduce((groups, item) => {
    groups[item.year] ||= { year: item.year, total: 0, open: 0 };
    groups[item.year].total += 1;
    groups[item.year].open += item.isOpen ? 1 : 0;
    return groups;
  }, {}));
  const totalDue = pendingApps.reduce((sum, item) => sum + (item.totalPayment || 0), 0);

  return (
    <div className="page-stack">
      <PageHeading eyebrow="พื้นที่เจ้าหน้าที่ · ข้อมูลตัวอย่าง" title="ภาพรวมแอดมิน" description="เห็นคิวตรวจใบสมัคร รอบสอบ และงานประกาศผลในจุดเดียว" action={<Button icon="calendar" onClick={() => navigate("admin-round")}>จัดการรายการสอบ</Button>} />
      <div className="admin-stat-grid">
        <div className="admin-stat-card"><span className="admin-stat-icon stat-blue"><Icon name="file" /></span><div><span>ใบสมัครทั้งหมด</span><strong>{applications.length}</strong><small>Heat {heatApps.length} · Final {finalApps.length}</small></div><span className="stat-ok"><Icon name="users" size={13} />{applications.filter((item) => item.source === "school").length} ผ่านโรงเรียน</span></div>
        <div className="admin-stat-card"><span className="admin-stat-icon stat-amber"><Icon name="clock" /></span><div><span>รอตรวจสลิป</span><strong>{pendingApps.length}</strong><small>ยอดรอตรวจ ฿{totalDue.toLocaleString()}</small></div><button className="stat-link" onClick={() => navigate("admin-review")}>เปิดคิว <Icon name="arrow" size={14} /></button></div>
        <div className="admin-stat-card"><span className="admin-stat-icon stat-green"><Icon name="check" /></span><div><span>ยืนยันใบสมัครแล้ว</span><strong>{confirmedApps.length}</strong><small>พร้อมส่งข้อมูลเข้าชีต</small></div><span className="stat-ok"><Icon name="check" size={13} />{applications.length ? Math.round(confirmedApps.length / applications.length * 100) : 0}%</span></div>
        <div className="admin-stat-card"><span className="admin-stat-icon stat-violet"><Icon name="calendar" /></span><div><span>รอบที่เปิดรับ</span><strong>{openRounds.length}</strong><small>จากทั้งหมด {examCatalog.length} รายการ</small></div><button className="stat-link" onClick={() => navigate("admin-round")}>จัดการ <Icon name="arrow" size={14} /></button></div>
      </div>
      <div className="admin-home-grid">
        <section className="surface admin-queue-card">
          <div className="section-heading"><div><p className="eyebrow">คิวงาน</p><h2>รายการที่ต้องดำเนินการ</h2></div><Button variant="text" icon="arrow" onClick={() => navigate("admin-review")}>เปิดคิวตรวจ</Button></div>
          {tasks.length ? <div className="admin-task-list">{tasks.map((task) => (
            <button key={task.id} onClick={() => navigate(task.id)}><span className={`task-icon task-${task.tone}`}><Icon name={task.icon} /></span><span><strong>{task.title}</strong><small>{task.detail}</small></span><span className="task-count">{String(task.count).padStart(2, "0")}</span></button>
          ))}</div> : <div className="admin-clear-state"><span><Icon name="check" /></span><div><strong>ไม่มีงานค้าง</strong><small>คิวตรวจสอบและงานหลังสอบเรียบร้อยแล้ว</small></div></div>}
        </section>
        <section className="surface round-status-card">
          <div className="section-heading"><div><p className="eyebrow">รายการสอบ</p><h2>สถานะรับสมัคร</h2></div><span className={openRounds.length ? "schedule-open" : "closed-badge"}>{openRounds.length ? `เปิด ${openRounds.length} รายการ` : "ปิดรับสมัคร"}</span></div>
          <div className="admin-round-summary-list">{byYear.map((group) => <div className="admin-round-summary" key={group.year}><div><strong>OCEC Heat {group.year}</strong><small>{group.open} จาก {group.total} รอบเปิดรับ</small></div><span>{group.open ? <i className="online-dot" /> : <i className="offline-dot" />}{group.open ? "เปิด" : "รอเปิด"}</span></div>)}</div>
          <div className="round-status-rows"><div><span><Icon name="users" />ใบสมัครออนไลน์</span><strong>{paperlessCount} รายการ</strong></div><div><span><Icon name="grid" />ผลสอบ Heat</span><strong>{resultPublished ? "ประกาศแล้ว" : "รอเตรียมฉบับร่าง"}</strong></div><div><span><Icon name="building" />ศูนย์สอบ</span><strong>{examCatalog.some((item) => item.isOpen) ? "ล็อกตามรอบที่เปิด" : "แก้ไขได้"}</strong></div></div>
          <Button variant="outline" className="button-full" onClick={() => navigate("admin-round")}>ตั้งค่ารอบสอบและศูนย์</Button>
        </section>
      </div>
      <section className="surface admin-competition-summary"><div><p className="eyebrow">ภาพรวมตามรายการสอบ</p><h2>รายการที่ผู้สมัครเลือก</h2><p>นับรายการแข่งขันที่เลือกในใบสมัครตัวอย่าง</p></div><div className="admin-competition-chips">{Object.entries(competitionCounts).map(([name, count]) => <span key={name}><strong>{count}</strong>{name}</span>)}</div><span className="admin-data-note"><Icon name="info" size={14} />ข้อมูล mock · ใช้ทดลองหน้าจอเท่านั้น</span></section>
      <section className={`surface sync-banner ${syncFailed ? "sync-banner-failed" : ""}`}><span className="sync-banner-icon"><Icon name={syncFailed ? "clock" : "sync"} /></span><div><strong>{syncFailed ? "กำลังรอซิงก์ข้อมูล" : "สถานะซิงก์ตัวอย่าง: ปกติ"}</strong><p>{syncFailed ? "ระบบจะลองใหม่อัตโนมัติทุก 2–3 นาที · ดูสถานะรายการได้ในหน้าซิงก์" : `${confirmedApps.length} ใบสมัครที่อนุมัติแล้ว · เชื่อมต่อจริงยังไม่เปิดใช้งาน`}</p></div><Button variant="text" onClick={() => navigate("admin-sheets")}>ดูสถานะ</Button></section>
    </div>
  );
}

function AdminReviewPage({ applications, onApprove, onSlipIssue, notify, navigate }) {
  const pendingApps = applications.filter((item) => item.status === "pending");
  const [selectedId, setSelectedId] = useState(pendingApps[0]?.id || applications[0]?.id || "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [kindFilter, setKindFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const filteredApplications = applications.filter((item) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [item.candidate, item.school, item.contactEmail, item.heatId, item.finalId, item.exam].filter(Boolean).some((value) => value.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === "all" || (statusFilter === "pending" ? item.status === "pending" : item.status === statusFilter)) && (kindFilter === "all" || item.kind === kindFilter) && (sourceFilter === "all" || (sourceFilter === "school" ? item.source === "school" : item.source !== "school"));
  });
  const selected = filteredApplications.find((item) => item.id === selectedId) || filteredApplications[0];
  const pendingCount = applications.filter((item) => item.status === "pending").length;
  const fmtMoney = (value) => `฿${Number(value || 0).toLocaleString()}`;
  return (
    <div className="page-stack">
      <PageHeading eyebrow="จัดการใบสมัคร · ข้อมูล mock" title="ตรวจใบสมัครและสลิป" description="เปิดดูข้อมูลแต่ละผู้สมัคร ตรวจรายการสอบและยอดชำระ ก่อนอนุมัติหรือแจ้งปัญหาสลิป" action={<span className="queue-indicator"><span />รอตรวจ {pendingCount} ใบ</span>} />
      <div className="review-layout">
        <section className="surface review-queue">
          <div className="review-queue-head"><div><h2>ใบสมัคร</h2><p>{filteredApplications.length} จาก {applications.length} รายการ</p></div><span className="queue-pill">{pendingCount}</span></div>
          <label className="input-with-icon review-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ โรงเรียน หรือเลขสอบ" /></label>
          <div className="review-filter-row" role="group" aria-label="กรองสถานะใบสมัคร">{[{ id: "pending", label: "รอตรวจ" }, { id: "confirmed", label: "ยืนยันแล้ว" }, { id: "all", label: "ทั้งหมด" }].map((filter) => <button type="button" key={filter.id} className={statusFilter === filter.id ? "review-filter-active" : ""} aria-pressed={statusFilter === filter.id} onClick={() => setStatusFilter(filter.id)}>{filter.label}<span>{filter.id === "all" ? applications.length : applications.filter((item) => item.status === filter.id).length}</span></button>)}</div>
          <div className="review-filter-selects"><label><span>ประเภท</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">Heat และ Final</option><option value="Heat">Heat</option><option value="Final">Final</option></select></label><label><span>ผู้สมัคร</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">ทุกช่องทาง</option><option value="school">ผ่านโรงเรียน</option><option value="self">สมัครด้วยตนเอง</option></select></label></div>
          <div className="review-list">
            {filteredApplications.map((item) => (
              <button className={`review-list-item ${selected?.id === item.id ? "review-list-selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)}>
                <span className="candidate-avatar">{item.candidate.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                <span className="review-list-copy"><strong>{item.candidate}</strong><small>{item.kind} · {item.school}</small><small>{item.source === "school" ? "ส่งผ่านโรงเรียน" : "สมัครด้วยตนเอง"} · {(item.competitions || []).length} รายการ · {fmtMoney(item.totalPayment)}</small></span>
                <span className={`review-status-dot ${item.status === "confirmed" ? "review-status-confirmed" : item.slipIssue ? "review-status-issue" : "review-status-pending"}`} title={item.status === "confirmed" ? "ยืนยันแล้ว" : item.slipIssue || "รอตรวจสลิป"} />
              </button>
            ))}
            {!filteredApplications.length ? <div className="review-empty-filter"><Icon name="search" /><strong>ไม่พบใบสมัคร</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div> : null}
          </div>
        </section>
        {selected ? (
          <section className="surface review-detail">
            <div className="review-detail-head"><div><p className="eyebrow">{selected.kind} · {selected.source === "school" ? "ส่งผ่านโรงเรียน" : "สมัครด้วยตนเอง"}</p><h2>{selected.candidate}</h2><span>{selected.school}{selected.batchId ? ` · ชุด ${selected.batchId}` : ""}</span></div><StatusBadge status={selected.status} /></div>
            <div className="review-detail-grid"><div><span>เลขที่ใบสมัคร</span><strong>OC-{selected.year}-{selected.id.toUpperCase()}</strong></div><div><span>อีเมลติดต่อผู้เข้าสอบ</span><strong>{selected.contactEmail}</strong></div><div><span>รูปแบบสอบ · ศูนย์สอบ</span><strong>{selected.format === "On-site" ? "Paper-Based" : selected.format} · {selected.center}</strong></div><div><span>ส่งใบสมัคร</span><strong>{selected.submitted} · โทรลงท้าย {selected.phoneLast4}</strong></div></div>
            <section className="review-data-section"><div className="review-data-heading"><div><strong>รายการสอบและระดับชั้น</strong><small>แยกตรวจตามข้อมูลของผู้สมัครแต่ละคน</small></div><span>{(selected.competitions || []).length} รายการ</span></div>{selected.competitions?.length ? <div className="review-competition-list">{selected.competitions.map((competition) => <div key={competition.id}><span><strong>{competition.short || competition.name}</strong><small>{competition.name}</small></span><span>{competition.grade}</span><b>{fmtMoney(competition.fee)}</b></div>)}</div> : <p className="review-no-data">ไม่มีรายละเอียดรายการสอบในข้อมูลตัวอย่าง</p>}</section>
            <section className="review-data-section"><div className="review-data-heading"><div><strong>ข้อสอบเก่าที่เลือก</strong><small>{selected.pastPapers?.length ? "จัดส่งข้อมูลเข้าใช้งานไปยังอีเมลผู้สมัคร" : "ไม่ได้เลือกซื้อข้อสอบเก่า"}</small></div><span>{selected.pastPapers?.length || 0} ชุด</span></div>{selected.pastPapers?.length ? <div className="review-paper-list">{selected.pastPapers.map((paper) => <div key={paper.id}><span>{paper.name}</span><b>{fmtMoney(paper.fee)}</b></div>)}</div> : null}</section>
            <div className="review-payment-grid"><div><span>ข้อสอบเก่า</span><strong>{fmtMoney(selected.pastPapersTotal)}</strong></div><div><span>ค่าสมัครสอบ</span><strong>{fmtMoney(selected.registrationFee)}</strong></div><div className="review-payment-total"><span>ยอดชำระรวม</span><strong>{fmtMoney(selected.totalPayment)}</strong></div></div>
            <div className="slip-preview">
              <div className="slip-preview-header"><span className="slip-file-icon"><Icon name="file" /></span><div><strong>{selected.slipFileName || `payment-slip-${selected.id}.pdf`}</strong><small>หลักฐานชำระเงิน · ยอดในใบสมัคร {fmtMoney(selected.totalPayment)}</small></div><Button variant="text" icon="download" onClick={() => notify("ไฟล์สลิปเป็นข้อมูลตัวอย่าง จึงไม่มีไฟล์จริงให้ดาวน์โหลด")}>ดูไฟล์</Button></div>
              <div className="slip-paper"><div className="slip-paper-logo">OCEC<span>PAYMENT</span></div><div className="slip-paper-title">PAYMENT CONFIRMATION · MOCK</div><div className="slip-paper-amount">{fmtMoney(selected.totalPayment)}</div><div className="slip-paper-lines"><i /><i /><i /><i /></div><span className={`slip-paper-status ${selected.slipIssue ? "slip-paper-status-issue" : ""}`}><Icon name={selected.slipIssue ? "info" : "check"} size={13} />{selected.slipIssue || "รอตรวจสอบสลิป"}</span></div>
            </div>
            {selected.slipIssue ? <div className="notice notice-amber"><Icon name="mail" /><div><strong>แจ้งปัญหาสลิปแล้ว</strong><p>เทมเพลต “{selected.slipIssue}” ส่งไปที่ {selected.contactEmail} · เมื่ออัปโหลดใหม่จะกลับเข้าคิวตรวจ</p><Button variant="text" icon="upload" onClick={() => navigate("slip-upload", selected.id)}>เปิดหน้าจำลองอัปโหลดใหม่</Button></div></div> : null}
            <div className="review-actions">
              <div className="review-action-label"><strong>ผลการตรวจสอบ</strong><small>{selected.status === "confirmed" ? "ใบสมัครนี้อนุมัติแล้ว" : selected.slipIssue ? "รอสลิปใหม่ก่อนอนุมัติ" : "การอนุมัติจะยืนยันใบสมัครและเข้าคิวซิงก์ชีต"}</small></div>
              <div className="review-action-buttons">
                {selected.status !== "confirmed" && !selected.slipIssue ? <div className="template-menu"><span>ส่งเทมเพลตแจ้งปัญหาสลิป</span><div><Button variant="outline" icon="mail" onClick={() => onSlipIssue(selected.id, "สลิปไม่ถูกต้อง")}>สลิปไม่ถูกต้อง</Button><Button variant="outline" icon="mail" onClick={() => onSlipIssue(selected.id, "เปิดสลิปไม่ได้")}>เปิดสลิปไม่ได้</Button></div></div> : null}
                <Button icon="check" disabled={selected.status === "confirmed" || Boolean(selected.slipIssue)} onClick={() => onApprove(selected.id)}>{selected.status === "confirmed" ? "อนุมัติแล้ว" : "อนุมัติใบสมัครนี้"}</Button>
              </div>
            </div>
          </section>
        ) : <div className="surface empty-state">เลือกใบสมัครเพื่อดูรายละเอียด</div>}
      </div>
    </div>
  );
}

function AdminRoundPage({ examCatalog, onUpdateExam, centerLocked, registrationOpen, editWindowOpen, setEditWindowOpen, finalCloseDate, setFinalCloseDate, heatIdsGenerated, onGenerateHeatIds, notify }) {
  const [centerFile, setCenterFile] = useState("");
  const heatRounds = examCatalog.filter((exam) => exam.year === "2569");
  const canGenerateHeatIds = heatRounds.length > 0 && heatRounds.every((exam) => !exam.isOpen);
  const centers = [
    { code: "208", name: "ศูนย์สอบกรุงเทพฯ", applicants: 18 },
    { code: "305", name: "ศูนย์สอบเชียงใหม่", applicants: 7 },
    { code: "412", name: "ศูนย์สอบขอนแก่น", applicants: 5 },
    { code: "888", name: "ศูนย์สอบฮ่องกง", applicants: 3 },
  ];
  return (
    <div className="page-stack">
      <PageHeading eyebrow="จัดการรายการสอบ · ข้อมูล mock" title="รายการสอบและกำหนดการ" description="สถานะที่แก้ที่นี่จะแสดงบนหน้าแรกทันทีในตัวอย่างนี้" action={<span className={registrationOpen ? "schedule-open" : "closed-badge"}>{registrationOpen ? `เปิดรับ ${examCatalog.filter((exam) => exam.isOpen).length} รายการ` : "ปิดรับสมัครทั้งหมด"}</span>} />
      <section className="surface admin-round-catalog">
        <div className="section-heading"><div><p className="eyebrow">แสดงบนหน้าสมัคร</p><h2>จัดการรายการสอบทั้งหมด</h2></div><span className="admin-data-note"><Icon name="info" size={14} />สถานะเปิดรับเชื่อมกับหน้าแรก</span></div>
        <div className="admin-round-card-grid">{examCatalog.map((exam) => (
          <article className={`admin-round-card ${exam.isOpen ? "admin-round-card-open" : ""}`} key={exam.id}>
            <div className="admin-round-card-head"><span className={`exam-type-mark exam-card-${exam.accent}`}><Icon name="award" size={18} /></span><div><small>{exam.round} · ปีการศึกษา {exam.year}</small><h3>{exam.title}</h3></div><span className={exam.isOpen ? "schedule-open" : "closed-badge"}>{exam.isOpen ? "เปิดรับสมัคร" : "ยังไม่เปิด"}</span></div>
            <div className="admin-round-fields">
              <label><span>เริ่มรับสมัคร</span><input type="date" value={exam.openDate || ""} onChange={(event) => onUpdateExam(exam.id, { openDate: event.target.value })} /></label>
              <label><span>ปิดรับสมัคร</span><input type="date" value={exam.closeDate || ""} onChange={(event) => onUpdateExam(exam.id, { closeDate: event.target.value })} /></label>
              <label><span>วันสอบ</span><input type="date" value={exam.examDate || ""} onChange={(event) => onUpdateExam(exam.id, { examDate: event.target.value })} /></label>
              <label><span>ปิดแก้ไขข้อมูล</span><input type="date" value={exam.editCloseDate || ""} onChange={(event) => onUpdateExam(exam.id, { editCloseDate: event.target.value })} /></label>
            </div>
            <div className="admin-round-card-foot"><span>{exam.isOpen ? `ปิดรับ ${formatThaiDate(exam.closeDate)}` : `กำหนดการ ${formatThaiDate(exam.examDate)}`}</span><Button variant={exam.isOpen ? "outline" : "primary"} icon={exam.isOpen ? "close" : "check"} onClick={() => { onUpdateExam(exam.id, { isOpen: !exam.isOpen }); notify(exam.isOpen ? `ปิดรับ ${exam.title} ${exam.round} แล้ว` : `เปิดรับ ${exam.title} ${exam.round} แล้ว · หน้าแรกอัปเดตแล้ว`); }}>{exam.isOpen ? "ปิดรับสมัคร" : "เปิดรับสมัคร"}</Button></div>
          </article>
        ))}</div>
        <div className="form-footer admin-round-save"><span><Icon name="info" size={15} />สถานะอยู่ในหน้าทดลองนี้เท่านั้น · ไม่บันทึกลงฐานข้อมูล</span><Button variant="outline" onClick={() => notify("บันทึกกำหนดการตัวอย่างในหน้าทดลองแล้ว")}>บันทึกกำหนดการ</Button></div>
      </section>
      <div className="round-admin-grid admin-round-operations">
        <section className="surface centers-card">
          <div className="section-heading"><div><p className="eyebrow">ข้อมูลตัวเลือกในฟอร์ม</p><h2>ศูนย์สอบ</h2></div><span className={centerLocked ? "lock-badge" : "schedule-open"}><Icon name={centerLocked ? "lock" : "check"} size={13} />{centerLocked ? "ล็อกเมื่อมีรอบเปิด" : "แก้ไขได้"}</span></div>
          {centerLocked ? <div className="notice notice-amber center-lock-note"><Icon name="lock" /><div><strong>ชุดศูนย์สอบถูกล็อก</strong><p>ปิดรับสมัครทุกช่วงก่อนเปลี่ยนหรือนำเข้ารายการศูนย์สอบ</p></div></div> : null}
          <div className="center-upload">
            <input id="center-file" type="file" accept=".xlsx,.xls,.csv" disabled={centerLocked} onChange={(event) => setCenterFile(event.target.files?.[0]?.name || "")} />
            <label htmlFor="center-file" className={centerLocked ? "file-drop file-disabled" : "file-drop"}><span className="file-drop-icon"><Icon name="upload" /></span><strong>{centerFile || "เลือกไฟล์ศูนย์สอบ"}</strong><small>Excel/CSV · มีรหัสศูนย์สอบและชื่อ · อัปโหลดทับชุดปัจจุบันได้ก่อนเปิดรับ</small></label>
            {centerFile ? <p className="upload-file-selected"><Icon name="check" size={14} />{centerFile} · ตัวอย่างไฟล์พร้อมนำเข้า</p> : null}
          </div>
          <div className="centers-table"><div className="center-row center-row-head"><span>รหัส</span><span>ชื่อศูนย์สอบ</span><span>ผู้สมัคร</span></div>{centers.map((center) => <div className="center-row" key={center.code}><strong>{center.code}</strong><span>{center.name}</span><span className="center-status">{center.applicants}</span></div>)}</div>
        </section>
        <section className="surface round-config-card">
          <div className="section-heading"><div><p className="eyebrow">การดำเนินงานหลังสมัคร</p><h2>เวลาปิดและเลขประจำตัว</h2></div></div>
          <div className="admin-inline-setting"><div><strong>เปิดให้แก้ข้อมูลใบสมัคร</strong><small>หลังอนุมัติ แก้ได้เฉพาะข้อมูลทั่วไปจนถึงวันปิดแก้ไข</small></div><label className="toggle-control"><span>{editWindowOpen ? "เปิด" : "ปิด"}</span><input type="checkbox" checked={editWindowOpen} onChange={(event) => setEditWindowOpen(event.target.checked)} /><i /></label></div>
          <Field label="ปิดยืนยันสิทธิ์สมัคร Final"><input type="date" value={finalCloseDate} onChange={(event) => setFinalCloseDate(event.target.value)} /></Field>
          <div className="admin-heat-id-summary"><span className="heat-id-icon"><Icon name="hash" /></span><div><strong>สร้างเลขประจำตัว Heat</strong><small>สร้างหลังปิดรอบปี 2569 · ทุกใบสมัคร แม้ยังรอตรวจ · เรียงศูนย์สอบ ระดับชั้น และชื่อ A–Z</small></div></div>
          <Button className="button-full" variant={heatIdsGenerated ? "success" : "outline"} disabled={!canGenerateHeatIds} icon={heatIdsGenerated ? "check" : "settings"} onClick={onGenerateHeatIds}>{heatIdsGenerated ? "สร้างเลข Heat แล้ว" : canGenerateHeatIds ? "สร้างเลข Heat" : "ปิดรอบปี 2569 ก่อนสร้างเลข"}</Button>
        </section>
      </div>
    </div>
  );
}

function AdminResultsPage({ applications, resultPublished, setResultPublished, draftImported, setDraftImported, conflictResolved, setConflictResolved, notify }) {
  const [fileName, setFileName] = useState("");
  const heatApplications = applications.filter((item) => item.kind === "Heat");
  const candidatesWithIds = heatApplications.filter((item) => item.heatId);
  const passApplications = heatApplications.filter((item) => item.result === "pass");
  const notPassedCount = heatApplications.filter((item) => item.result === "not-passed").length;
  return (
    <div className="page-stack">
      <PageHeading eyebrow="ผลการสอบ · ข้อมูล mock" title="ตรวจสอบและประกาศผล Heat" description="จับคู่ผลสอบด้วยเลข Heat ตรวจแถวที่มีปัญหา และดูตัวอย่างก่อนประกาศผล" action={<span className={resultPublished ? "schedule-open" : "draft-badge"}>{resultPublished ? "ประกาศแล้ว · ล็อกข้อมูล" : draftImported ? "ฉบับร่าง" : "ยังไม่ได้นำเข้า"}</span>} />
      {resultPublished ? (
        <div className="notice notice-green"><Icon name="check" /><div><strong>ประกาศผลเรียบร้อยแล้ว</strong><p>รายชื่อผู้ผ่านแสดงในหน้าประกาศผลสาธารณะ ผลสอบที่ประกาศแล้วไม่สามารถแก้ไขได้</p></div></div>
      ) : null}
      <div className="results-admin-grid">
        <section className="surface import-card">
          <div className="section-heading"><div><p className="eyebrow">ไฟล์ผลสอบ</p><h2>นำเข้าผลสอบฉบับร่าง</h2></div><span className="draft-badge">{draftImported ? "ฉบับร่าง" : "รอไฟล์"}</span></div>
          <label className={`file-drop file-drop-inline ${resultPublished ? "file-disabled" : ""}`}><input type="file" accept=".xlsx,.xls,.csv" disabled={resultPublished} onChange={(event) => { const file = event.target.files?.[0]; if (file) { setFileName(file.name); setDraftImported(true); setConflictResolved(false); notify(`อ่านไฟล์ ${file.name} ในโหมดตัวอย่างแล้ว`); } }} /><span className="file-drop-icon"><Icon name="upload" /></span><span className="file-drop-copy"><strong>{fileName || (draftImported ? "heat-results-draft.xlsx" : "เลือกไฟล์ Excel ผลสอบ")}</strong><small>จับคู่ด้วยเลขประจำตัว Heat · เปลี่ยนฉบับร่างได้จนกว่าจะประกาศผล</small></span><span className="file-select-label">เลือกไฟล์</span></label>
          {draftImported ? <div className="import-summary"><span className="summary-icon summary-green"><Icon name="check" /></span><div><strong>เตรียมฉบับร่างสำเร็จ</strong><small>ใบสมัคร Heat ที่มีเลขสอบ {candidatesWithIds.length} รายการ</small></div><span className="summary-pill">ผ่าน {passApplications.length} ราย</span></div> : null}
          <div className="results-count-strip"><span><strong>{heatApplications.length}</strong> ผู้เข้าสอบ Heat</span><span><strong>{passApplications.length}</strong> ผ่าน</span><span><strong>{notPassedCount}</strong> ไม่ผ่าน</span><span><strong>{draftImported && !conflictResolved ? 1 : 0}</strong> รายการต้องตรวจ</span></div>
          <div className="result-preview-heading"><div><strong>ตัวอย่างรายชื่อผู้ผ่าน</strong><small>ตรวจชื่อ โรงเรียน และเลขสอบก่อนประกาศ</small></div><span>{passApplications.length} ราย</span></div>
          {passApplications.slice(0, 5).map((item) => <div className="mini-result-row" key={item.id}><span className="mono-number">{item.heatId || "รอเลข"}</span><strong>{item.candidate}</strong><span>{item.school}</span><span className="pass-label">ผ่าน</span></div>)}
          {!passApplications.length ? <div className="empty-inline"><Icon name="info" /><span>ยังไม่มีรายชื่อผู้ผ่านในข้อมูลตัวอย่าง</span></div> : null}
        </section>
        <section className="surface conflicts-card">
          <div className="section-heading"><div><p className="eyebrow">ตรวจสอบข้อมูล</p><h2>รายการที่ต้องตรวจ</h2></div><span className="conflict-count">{draftImported && !conflictResolved ? "1" : "0"} รายการ</span></div>
          {!draftImported ? <div className="empty-inline"><Icon name="info" /><span>เลือกไฟล์ผลสอบเพื่อดูตัวอย่างและตรวจรายการที่จับคู่ไม่สำเร็จ</span></div> : conflictResolved ? (
            <div className="resolved-state"><span><Icon name="check" /></span><div><strong>แก้ไขรายการขัดแย้งแล้ว</strong><p>ข้อมูลผลสอบพร้อมสำหรับตรวจครั้งสุดท้าย</p></div></div>
          ) : (
            <div className="conflict-item"><div className="conflict-label"><span className="conflict-icon"><Icon name="info" /></span><div><strong>ไม่พบเลขประจำตัวสอบในใบสมัคร</strong><small>แถว 128 · เลขที่พบ 2080999</small></div></div><p>ตรวจสอบว่าเลขผิดในใบสมัครหรือไฟล์ผลสอบ หากข้อมูลใบสมัครผิดให้แก้ในเว็บ หากไฟล์ผิดให้นำไฟล์ Excel ฉบับแก้ไขเข้าซ้ำ</p><div className="conflict-actions"><Button variant="outline" icon="edit" onClick={() => { setConflictResolved(true); notify("ทำเครื่องหมายว่าแก้ข้อมูลใบสมัครแล้ว"); }}>แก้ข้อมูลใบสมัคร</Button><Button variant="text" icon="upload" onClick={() => { setDraftImported(true); setConflictResolved(true); notify("นำเข้าผลสอบฉบับแก้ไขแล้ว"); }}>นำไฟล์ Excel เข้าซ้ำ</Button></div></div>
          )}
          <div className="publish-box"><div><strong>ยืนยันประกาศผล</strong><small>เมื่อประกาศแล้ว หน้าแรกจะแสดงผลให้ผู้สมัครค้นหาได้</small></div><Button icon="check" disabled={!draftImported || !conflictResolved || resultPublished} onClick={() => { setResultPublished(true); notify("ประกาศผล Heat ในตัวอย่างแล้ว · ผลสอบถูกล็อก"); }}>ประกาศผล</Button></div>
        </section>
      </div>
      <div className="notice notice-amber results-mock-note"><Icon name="info" /><div><strong>โหมด mock</strong><p>เลือกไฟล์เพื่อจำลองสถานะนำเข้าเท่านั้น ยังไม่มีการอ่านข้อมูลหรือบันทึกไฟล์ผลสอบจริง</p></div></div>
    </div>
  );
}

function AdminFinalIdsPage({ applications, finalIdsImported, onImport, onManualMatch, notify }) {
  const [fileName, setFileName] = useState("");
  const finalApplications = applications.filter((item) => item.kind === "Final");
  const matchedCount = finalApplications.filter((item) => item.finalId).length;
  const waitingCount = Math.max(0, finalApplications.length - matchedCount);
  return (
    <div className="page-stack">
      <PageHeading eyebrow="ข้อมูลผู้เข้าสอบ Final · mock" title="นำเข้าและจับคู่เลข Final" description="จับคู่เลขจากไฟล์กับใบสมัคร Final ด้วยชื่อภาษาอังกฤษและโรงเรียน" action={<span className="queue-indicator"><span />รอตรวจ {waitingCount} รายการ</span>} />
      <section className="surface final-id-import">
        <div className="final-id-intro"><span className="final-id-intro-icon"><Icon name="users" /></span><div><h2>นำเข้าไฟล์เลขประจำตัวจากฮ่องกง</h2><p>ระบบจับคู่เบื้องต้นด้วยชื่อภาษาอังกฤษและโรงเรียน รายการที่ไม่พบหรือซ้ำจะพักไว้ให้ตรวจสอบ</p></div></div>
        <label className="file-drop file-drop-inline"><input type="file" accept=".xlsx,.xls" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setFileName(file.name); onImport(); } }} /><span className="file-drop-icon"><Icon name="upload" /></span><span className="file-drop-copy"><strong>{fileName || (finalIdsImported ? "final-candidate-ids.xlsx" : "เลือกไฟล์ Excel เลขประจำตัว Final")}</strong><small>รองรับไฟล์ .xlsx หรือ .xls · การนำเข้าในหน้านี้เป็นการจำลอง</small></span><span className="file-select-label">เลือกไฟล์</span></label>
        {finalIdsImported ? <div className="import-summary"><span className="summary-icon summary-green"><Icon name="check" /></span><div><strong>จำลองการนำเข้าเรียบร้อย</strong><small>จับคู่อัตโนมัติ {matchedCount} ราย · ต้องตรวจด้วยมือ {waitingCount} ราย</small></div><span className="summary-pill">พร้อมตรวจ</span></div> : null}
      </section>
      <section className="surface final-match-table">
        <div className="section-heading"><div><p className="eyebrow">รายการจับคู่</p><h2>ผลการนำเข้าเลข Final</h2></div><div className="match-legend"><span><i className="legend-green" />จับคู่แล้ว</span><span><i className="legend-amber" />รอตรวจ</span></div></div>
        <div className="responsive-table"><table><thead><tr><th>ชื่อภาษาอังกฤษ</th><th>โรงเรียน</th><th>เลขประจำตัว Final</th><th>สถานะจับคู่</th><th>ดำเนินการ</th></tr></thead><tbody>
          {finalApplications.map((item) => {
            const issue = item.id === "final-03" ? "ไม่พบใบสมัคร Heat ที่ผ่าน" : "พบผู้สมัครชื่อเดียวกัน ต้องตรวจยืนยัน";
            return <tr key={item.id}><td>{item.candidate}</td><td>{item.school}</td><td className="mono-number">{item.finalId || (finalIdsImported ? "รอตรวจจับคู่" : "รอนำเข้าเลขประจำตัว")}</td><td>{item.finalId ? <span className="match-status match-ok"><Icon name="check" size={13} />จับคู่แล้ว</span> : finalIdsImported ? <span className="match-status match-wait"><Icon name="info" size={13} />{issue}</span> : <span className="match-status match-wait"><Icon name="clock" size={13} />รอไฟล์นำเข้า</span>}</td><td>{item.finalId || !finalIdsImported ? <span className="table-dash">—</span> : <Button variant="outline" onClick={() => onManualMatch(item.id)}>จับคู่ด้วยมือ</Button>}</td></tr>;
          })}
        </tbody></table></div>
        {!finalApplications.length ? <div className="empty-inline"><Icon name="info" /><span>ยังไม่มีใบสมัคร Final ในข้อมูลตัวอย่าง</span></div> : null}
        <div className="table-footnote"><Icon name="info" size={15} />เลขที่จับคู่สำเร็จจะแสดงในใบสมัคร Final · หากมีหลายรายการให้ตรวจชื่อและโรงเรียนก่อนยืนยัน</div>
      </section>
    </div>
  );
}

function AdminSheetsPage({ applications, syncFailed, setSyncFailed }) {
  const confirmedApplications = applications.filter((item) => item.status === "confirmed");
  const heatCount = confirmedApplications.filter((item) => item.kind === "Heat").length;
  const finalCount = confirmedApplications.filter((item) => item.kind === "Final").length;
  return (
    <div className="page-stack">
      <PageHeading eyebrow="การเชื่อมต่อข้อมูล" title="สถานะ Google Sheets" description="ข้อมูลจากเว็บไซต์ส่งไปยังชีตทางเดียว การแก้ไขในชีตจะไม่ซิงก์กลับเข้าเว็บ" />
      {syncFailed ? <div className="notice notice-amber sync-failed-message"><Icon name="sync" /><div><strong>ไม่สามารถซิงก์ข้อมูลเข้าชีตได้ ตอนนี้ระบบกำลังพยายามซิงก์ข้อมูลอยู่</strong><p>มี {confirmedApplications.length} ใบสมัครที่รอซิงก์ ระบบจะลองใหม่อัตโนมัติทุก 2–3 นาที</p></div></div> : <div className="notice notice-green"><Icon name="check" /><div><strong>สถานะตัวอย่าง: ซิงก์ข้อมูลปกติ</strong><p>มี {confirmedApplications.length} ใบสมัครที่อนุมัติแล้ว · ยังไม่ได้เชื่อม Google Sheets จริง</p></div></div>}
      <div className="sheets-grid">
        <section className="surface sheets-status-card"><span className={"sheets-status-icon " + (syncFailed ? "sheets-status-wait" : "")}><Icon name={syncFailed ? "sync" : "check"} /></span><p className="eyebrow">สถานะการเชื่อมต่อ</p><h2>{syncFailed ? "กำลังซิงก์ข้อมูล" : "สถานะตัวอย่าง: ปกติ"}</h2><p>{syncFailed ? "มีรายการรอซิงก์ ระบบจะดำเนินการใหม่อัตโนมัติ" : "เมื่อใช้งานจริง ระบบจะส่งใบสมัครที่อนุมัติแล้วไปยังชีตทางเดียว"}</p><div className="sheets-last-sync"><span>ใบสมัครที่พร้อมซิงก์</span><strong>{confirmedApplications.length} รายการ</strong></div></section>
        <section className="surface sheets-activity"><div className="section-heading"><div><p className="eyebrow">กิจกรรมตัวอย่าง</p><h2>รายการที่จะซิงก์</h2></div><span className="activity-range">ตามสถานะปัจจุบัน</span></div><div className="activity-list"><div className="activity-row"><span className="activity-mark activity-ok"><Icon name="check" size={13} /></span><div><strong>ใบสมัคร Heat ที่อนุมัติแล้ว</strong><small>{heatCount} รายการ · ส่งจากเว็บทางเดียว</small></div><time>{syncFailed ? "รอซิงก์" : "พร้อม"}</time></div><div className={"activity-row " + (syncFailed ? "activity-row-failed" : "")}><span className={"activity-mark " + (syncFailed ? "activity-wait" : "activity-ok")}><Icon name={syncFailed ? "clock" : "check"} size={13} /></span><div><strong>ใบสมัคร Final ที่อนุมัติแล้ว</strong><small>{finalCount} รายการ · ไม่ซิงก์กลับจากชีต</small></div><time>{syncFailed ? "รอซิงก์" : "พร้อม"}</time></div></div><p className="sheets-rule"><Icon name="info" size={15} />การแก้ไขในชีตไม่ส่งกลับเข้าเว็บ · ถ้าซิงก์ไม่สำเร็จ ระบบจะลองใหม่ทุก 2–3 นาที</p></section>
      </div>
      <section className="surface sync-demo-control"><div><span className="sync-demo-icon"><Icon name="settings" /></span><div><strong>ตัวควบคุมข้อมูล mock</strong><p>สลับเพื่อดูข้อความระบบซิงก์ไม่สำเร็จ · ไม่มีการเชื่อมต่อภายนอก</p></div></div><label className="toggle-control"><span>จำลองซิงก์ไม่สำเร็จ</span><input type="checkbox" checked={syncFailed} onChange={(event) => setSyncFailed(event.target.checked)} /><i /></label></section>
    </div>
  );
}

function RegistrationLoginGate({ kind }) {
  return (
    <section className="surface registration-login-gate" aria-labelledby="registration-login-title">
      <span className="registration-login-icon"><Icon name="shield" size={22} /></span>
      <p className="eyebrow">{kind === "Final" ? "OCEC Final 2569" : "OCEC Portal"}</p>
      <h1 id="registration-login-title">เข้าสู่ระบบเพื่อเริ่มสมัคร</h1>
      <p>เมื่อเข้าสู่ระบบแล้ว ฟอร์มสมัครสอบจะเปิดขึ้นที่หน้านี้ คุณสามารถกรอกข้อมูลผู้สมัครและติดตามใบสมัครผ่านบัญชีได้</p>
    </section>
  );
}

function App() {
  const [page, setPage] = useState(() => window.location.hash.slice(1) || "home");
  const [persona, setPersona] = useState("coordinator");
  const [menuOpen, setMenuOpen] = useState(false);
  const [applications, setApplications] = useState(seedApplications);
  const [examCatalog, setExamCatalog] = useState(demoExamCatalog);
  const [activeApplicationId, setActiveApplicationId] = useState("heat-01");
  const [toast, setToast] = useState("");
  const [authProfile, setAuthProfile] = useState(null);
  const [editWindowOpen, setEditWindowOpen] = useState(true);
  const [finalCloseDate, setFinalCloseDate] = useState("2027-01-15");
  const [heatIdsGenerated, setHeatIdsGenerated] = useState(false);
  const [draftImported, setDraftImported] = useState(false);
  const [conflictResolved, setConflictResolved] = useState(false);
  const [resultPublished, setResultPublished] = useState(false);
  const [finalIdsImported, setFinalIdsImported] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const registrationOpen = examCatalog.some((exam) => exam.isOpen);
  const centerLocked = registrationOpen;
  const activeApplication = applications.find((item) => item.id === activeApplicationId) || applications[0];
  const visibleApplications = persona === "coordinator" || persona === "admin"
    ? applications
    : applications.filter((item) => item.owner === "candidate" || item.candidate === "Nicha Srisawat");
  const pageTitle = pageLabels[page] || pageLabels.home;
  const requiresRegistrationLogin = !authProfile && (page === "apply-heat" || page === "apply-final");

  useEffect(() => {
    const handleHash = () => setPage(pageLabels[window.location.hash.slice(1)] ? window.location.hash.slice(1) : "home");
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  function navigate(nextPage, applicationId) {
    if (applicationId) setActiveApplicationId(applicationId);
    setPage(nextPage);
    setMenuOpen(false);
    if (window.location.hash !== "#" + nextPage) window.location.hash = nextPage;
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function startApplication() {
    setPersona("candidate");
    navigate("apply-heat");
  }

  function notify(message) {
    setToast(message);
  }

  function signInWithGoogleDemo(profile) {
    setAuthProfile(profile);
    notify("เข้าสู่ระบบตัวอย่างสำเร็จ");
  }

  function signOut() {
    setAuthProfile(null);
    notify("ออกจากระบบแล้ว");
  }

  function updateApplication(id, updates) {
    setApplications((current) => current.map((item) => item.id === id ? { ...item, ...updates } : item));
  }

  function updateExam(id, updates) {
    setExamCatalog((current) => current.map((exam) => exam.id === id ? { ...exam, ...updates } : exam));
    if (updates.isOpen) setHeatIdsGenerated(false);
  }

  function submitApplication(values) {
    const applicants = values.batchApplications?.length ? values.batchApplications : [values];
    const batchId = values.batchId || "";
    const records = applicants.map((applicant, index) => {
      const id = batchId ? `${batchId}-${index + 1}` : "new-" + Date.now().toString().slice(-5);
      const examListings = applicant.examListings || [];
      const examLabel = applicant.kind === "Final"
        ? "OCEC Final 2569"
        : examListings.length
          ? examListings.map((exam) => `${exam.name} · ${applicant.grades?.[exam.id] || ""}`).join(", ")
          : "OCEC Heat รอบที่ 1";
      return {
        id,
        batchId: batchId || undefined,
        owner: applicant.source === "school" ? "coordinator" : "candidate",
        source: applicant.source || "self",
        kind: applicant.kind,
        exam: examLabel,
        examIds: examListings.map((exam) => exam.id),
        year: "2569",
        candidate: applicant.candidate,
        school: applicant.school,
        grade: applicant.grade,
        format: applicant.format === "Online" ? "Online Exam" : applicant.format,
        center: applicant.center,
        contactEmail: applicant.contactEmail,
        phoneLast4: (applicant.phone || "").slice(-4),
        studentInformation: {
          ...applicant,
          fileName: applicant.fileName,
        },
        slipFileName: applicant.fileName || `payment-slip-${id}.pdf`,
        competitions: examListings.map((exam) => ({ id: exam.id, name: exam.name, subject: exam.subject, grade: applicant.grades?.[exam.id] || "" })),
        pastPapers: applicant.pastPaperSelections || [],
        pastPapersTotal: applicant.pastPapersTotal || 0,
        registrationFee: applicant.registrationFee || 0,
        totalPayment: applicant.totalPayment || 0,
        marketingConsent: Boolean(applicant.marketingConsent),
        submitted: "วันนี้",
        status: "pending",
        heatId: "",
        finalId: "",
        result: "",
        canEdit: false,
        slipIssue: "",
      };
    });
    const id = records[0].id;
    setApplications((current) => [...records, ...current]);
    setActiveApplicationId(id);
    setPersona(values.source === "school" ? "coordinator" : "candidate");
    notify(records.length > 1 ? `ส่งใบสมัคร ${records.length} คนสำเร็จ ระบบส่งอีเมลสรุปแยกไปยังผู้เข้าสอบแต่ละคน` : "ส่งใบสมัครสำเร็จ ระบบส่งอีเมลสรุปไปยัง " + applicants[0].contactEmail);
    navigate("application-detail", id);
  }

  function saveApplication(id, form) {
    updateApplication(id, { ...form, phoneLast4: form.phone.slice(-4) });
    notify("บันทึกการแก้ไขแล้ว สถานะใบสมัครยังคงยืนยันใบสมัคร");
    navigate("application-detail", id);
  }

  function approveApplication(id) {
    const item = applications.find((entry) => entry.id === id);
    updateApplication(id, { status: "confirmed" });
    notify("อนุมัติใบสมัครแล้ว อีเมลแจ้งผลส่งไปยัง " + (item?.contactEmail || "อีเมลผู้เข้าสอบ"));
  }

  function notifySlipIssue(id, issue) {
    const item = applications.find((entry) => entry.id === id);
    updateApplication(id, { slipIssue: issue });
    notify("ส่งเทมเพลต “" + issue + "” พร้อมลิงก์อัปโหลดไปยัง " + (item?.contactEmail || "อีเมลผู้เข้าสอบ"));
  }

  function generateHeatIds() {
    const centerCodes = {
      "ศูนย์สอบกรุงเทพฯ": "208",
      "ศูนย์สอบเชียงใหม่": "305",
      "ศูนย์สอบขอนแก่น": "412",
      "ศูนย์สอบฮ่องกง": "888",
    };
    const gradeOrder = ["มัธยมศึกษาปีที่ 4", "มัธยมศึกษาปีที่ 5", "มัธยมศึกษาปีที่ 6"];
    const ordered = applications.filter((item) => item.kind === "Heat" && !item.heatId).slice().sort((a, b) => {
      const centerCompare = (centerCodes[a.center] || "999").localeCompare(centerCodes[b.center] || "999");
      if (centerCompare) return centerCompare;
      const gradeCompare = gradeOrder.indexOf(a.grade) - gradeOrder.indexOf(b.grade);
      if (gradeCompare) return gradeCompare;
      const nameCompare = a.candidate.localeCompare(b.candidate, "en");
      return nameCompare || a.submitted.localeCompare(b.submitted);
    });
    const sequenceByCenter = {};
    const assigned = {};
    ordered.forEach((item) => {
      const code = centerCodes[item.center] || "999";
      sequenceByCenter[code] = (sequenceByCenter[code] || 0) + 1;
      assigned[item.id] = code + String(sequenceByCenter[code]).padStart(4, "0");
    });
    setApplications((current) => current.map((item) => assigned[item.id] ? { ...item, heatId: assigned[item.id] } : item));
    setHeatIdsGenerated(true);
    notify("สร้างเลข Heat สำหรับใบสมัครที่ส่งแล้วทุกใบ โดยนับแยกตามศูนย์สอบ");
  }

  function importFinalIds() {
    setFinalIdsImported(true);
    setApplications((current) => current.map((item) => item.id === "final-02" ? { ...item, finalId: "F-69020815" } : item));
    notify("นำเข้าเลข Final ตัวอย่างแล้ว · จับคู่อัตโนมัติ 1 รายการ และรอตรวจด้วยมือ 2 รายการ");
  }

  function matchFinalId(id) {
    const target = applications.find((item) => item.id === id);
    const finalIds = { "final-01": "F-69020814", "final-02": "F-69020815", "final-03": "F-69020816" };
    const suggestedId = finalIds[id];
    if (target && suggestedId) updateApplication(target.id, { finalId: suggestedId });
    notify(`จับคู่เลข Final ให้ ${target?.candidate || "ผู้เข้าสอบ"} แล้ว`);
  }

  const content = (() => {
    switch (page) {
      case "apply-heat":
        return <ApplicationFormPage key={page} kind="Heat" onSubmit={submitApplication} navigate={navigate} />;
      case "apply-final":
        return <ApplicationFormPage key={page} kind="Final" prefill={activeApplication} onSubmit={submitApplication} navigate={navigate} />;
      case "applications":
        return <ApplicationsPage applications={visibleApplications} navigate={navigate} />;
      case "application-detail":
        return <ApplicationDetailPage application={applications.find((item) => item.id === activeApplicationId)} navigate={navigate} resultPublished={resultPublished} editWindowOpen={editWindowOpen} />;
      case "check-status":
        return <StatusLookupPage applications={applications} navigate={navigate} />;
      case "lookup-choice":
        return <LookupChoicePage navigate={navigate} />;
      case "edit-verify":
        return <EditVerifyPage applications={applications} onVerified={(id) => navigate("edit-application", id)} navigate={navigate} />;
      case "edit-application":
        return <EditApplicationPage key={activeApplicationId} application={activeApplication} onSave={saveApplication} navigate={navigate} editWindowOpen={editWindowOpen} />;
      case "slip-upload":
        return <SlipUploadPage application={activeApplication} onUploaded={(id, fileName) => updateApplication(id, { slipIssue: "", slipFileName: fileName })} onReturn={() => navigate("admin-review", activeApplication?.id)} notify={notify} />;
      case "final-confirm":
        return <FinalConfirmationPage applications={applications} onContinue={(selected, bindAccount) => { setActiveApplicationId(selected.id); if (bindAccount) setPersona("candidate"); notify(bindAccount ? "ผูกบัญชีตัวอย่างแล้ว" : "ดำเนินการต่อโดยไม่เข้าสู่ระบบ"); navigate("apply-final", selected.id); }} navigate={navigate} resultPublished={resultPublished} />;
      case "results":
        return <PublicResultsPage applications={applications} published={resultPublished} />;
      case "admin-home":
        return <AdminHomePage applications={applications} examCatalog={examCatalog} navigate={navigate} resultPublished={resultPublished} syncFailed={syncFailed} />;
      case "admin-review":
        return <AdminReviewPage applications={applications} onApprove={approveApplication} onSlipIssue={notifySlipIssue} notify={notify} navigate={navigate} />;
      case "admin-round":
        return <AdminRoundPage examCatalog={examCatalog} onUpdateExam={updateExam} centerLocked={centerLocked} registrationOpen={registrationOpen} editWindowOpen={editWindowOpen} setEditWindowOpen={setEditWindowOpen} finalCloseDate={finalCloseDate} setFinalCloseDate={setFinalCloseDate} heatIdsGenerated={heatIdsGenerated} onGenerateHeatIds={generateHeatIds} notify={notify} />;
      case "admin-results":
        return <AdminResultsPage applications={applications} resultPublished={resultPublished} setResultPublished={setResultPublished} draftImported={draftImported} setDraftImported={setDraftImported} conflictResolved={conflictResolved} setConflictResolved={setConflictResolved} notify={notify} />;
      case "admin-final-ids":
        return <AdminFinalIdsPage applications={applications} finalIdsImported={finalIdsImported} onImport={importFinalIds} onManualMatch={matchFinalId} notify={notify} />;
      case "admin-sheets":
        return <AdminSheetsPage applications={applications} syncFailed={syncFailed} setSyncFailed={setSyncFailed} />;
      default:
        return <HomePage navigate={navigate} persona={persona} applications={visibleApplications} />;
    }
  })();

  if (page === "home" && persona !== "admin") {
    return <LandingPage navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={signInWithGoogleDemo} onSignOut={signOut} onStartApplication={startApplication} resultPublished={resultPublished} examCatalog={examCatalog} />;
  }

  if (persona !== "admin" && !page.startsWith("admin-")) {
    return <PublicPortalLayout page={page} navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={signInWithGoogleDemo} onSignOut={signOut} toast={toast} setToast={setToast}>{requiresRegistrationLogin ? <RegistrationLoginGate kind={page === "apply-final" ? "Final" : "Heat"} /> : content}</PublicPortalLayout>;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
      <Sidebar page={page} persona={persona} applications={applications} navigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} notify={notify} />
      <main className="main-column" id="main-content" tabIndex="-1">
        <Topbar title={pageTitle} persona={persona} setPersona={(next) => { setPersona(next); if (next === "admin") navigate("admin-home"); else if (page.indexOf("admin-") === 0) navigate("home"); }} menuOpen={menuOpen} setMenuOpen={setMenuOpen} navigate={navigate} />
        <div className="content-wrap">
          <div className="prototype-banner"><Icon name="info" size={15} /><span>ต้นแบบสำหรับทดลองใช้งาน · ข้อมูลและการเชื่อมต่อภายนอกเป็นข้อมูลจำลอง</span><button onClick={(event) => event.currentTarget.parentElement.remove()} aria-label="ปิดข้อความ"><Icon name="close" size={14} /></button></div>
          {content}
          <footer className="page-footer"><span>© 2569 OCEC Portal</span><span>สำหรับการสอบถาม ติดต่อฝ่ายประสานงานโครงการ</span><a href="#help" onClick={(event) => { event.preventDefault(); notify("ศูนย์ช่วยเหลือเป็นตัวอย่างสำหรับ prototype"); }}>ศูนย์ช่วยเหลือ</a></footer>
        </div>
      </main>
      {toast ? <div className="toast" role="status" aria-live="polite"><span><Icon name="check" size={16} /></span><p>{toast}</p><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div> : null}
    </div>
  );
}

export default App;
