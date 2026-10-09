import React, { useEffect, useId, useMemo, useRef, useState } from "react";

const seedApplications = [
  {
    id: "heat-01",
    owner: "coordinator",
    kind: "Heat",
    exam: "OCEC Heat รอบที่ 1",
    year: "2569",
    candidate: "Nicha Srisawat",
    nameParts: { firstName: "Nicha", lastName: "Srisawat" },
    school: "Srinakharinwirot Demonstration School",
    grade: "มัธยมศึกษาปีที่ 5",
    format: "On-site",
    center: "ศูนย์สอบกรุงเทพฯ",
    contactEmail: "nicha.student@example.com",
    phoneLast4: "4821",
    studentInformation: { firstName: "Nicha", lastName: "Srisawat", thaiFirstName: "ณิชา", thaiLastName: "ศรีสวัสดิ์", gender: "Female", dateOfBirth: "2010-05-12", email: "nicha.student@example.com", phone: "0812344821", address1: "88 ถนนสุขุมวิท", address2: "", city: "วัฒนา", province: "กรุงเทพมหานคร", postalCode: "10110" },
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
    nameParts: { firstName: "Thanakorn", lastName: "Wattanakul" },
    school: "Triam Udom Suksa School",
    grade: "มัธยมศึกษาปีที่ 6",
    format: "On-site",
    center: "ศูนย์สอบกรุงเทพฯ",
    contactEmail: "thanakorn.w@example.com",
    phoneLast4: "1936",
    studentInformation: { firstName: "Thanakorn", lastName: "Wattanakul", thaiFirstName: "ธนกร", thaiLastName: "วัฒนกุล", gender: "Male", dateOfBirth: "2009-08-19", email: "thanakorn.w@example.com", phone: "0815671936", address1: "52 ถนนพญาไท", address2: "", city: "ปทุมวัน", province: "กรุงเทพมหานคร", postalCode: "10330" },
    submitted: "7 ต.ค. 2569",
    status: "confirmed",
    heatId: "2080015",
    finalId: "",
    result: "pass",
    changeHistory: [{ id: "audit-heat-02-1", editor: "ผู้ดูแลระบบ · Chayanit", at: "8 ต.ค. 2569 · 13:42", changes: [{ label: "โรงเรียน", oldValue: "Triam Udom Suksa", newValue: "Triam Udom Suksa School" }] }],
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
    nameParts: { firstName: "Nicha", lastName: "Srisawat" },
    school: "Srinakharinwirot Demonstration School",
    grade: "มัธยมศึกษาปีที่ 5",
    format: "On-site",
    center: "ศูนย์สอบฮ่องกง",
    contactEmail: "nicha.student@example.com",
    phoneLast4: "4821",
    studentInformation: { firstName: "Nicha", lastName: "Srisawat", thaiFirstName: "ณิชา", thaiLastName: "ศรีสวัสดิ์", gender: "Female", dateOfBirth: "2010-05-12", email: "nicha.student@example.com", phone: "0812344821", address1: "88 ถนนสุขุมวิท", address2: "", city: "วัฒนา", province: "กรุงเทพมหานคร", postalCode: "10110" },
    submitted: "8 ต.ค. 2569",
    status: "pending",
    heatId: "2080014",
    finalId: "",
    result: "",
    canEdit: false,
    slipIssue: "",
    source: "self",
    slipFileName: "payment-slip-final-01.pdf",
    competitions: [
      { id: "bbb", name: "Big Bay Bei Mathematics", short: "BBB", grade: "มัธยมศึกษาปีที่ 5", fee: 1550 },
      { id: "hkiso", name: "HKISO Science", short: "HKISO", grade: "มัธยมศึกษาปีที่ 5", fee: 1550 },
    ],
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
    nameParts: { firstName: "Pattara", lastName: "Chaiyasit" },
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
    id: "heat-05",
    owner: "candidate",
    kind: "Heat",
    exam: "OCEC Heat รอบที่ 2",
    year: "2569",
    candidate: "Nicha Srisawat",
    nameParts: { firstName: "Nicha", lastName: "Srisawat" },
    school: "Srinakharinwirot Demonstration School",
    grade: "มัธยมศึกษาปีที่ 5",
    format: "On-site",
    center: "ศูนย์สอบกรุงเทพฯ",
    contactEmail: "nicha.student@example.com",
    phoneLast4: "4821",
    studentInformation: { firstName: "Nicha", lastName: "Srisawat", thaiFirstName: "ณิชา", thaiLastName: "ศรีสวัสดิ์", gender: "Female", dateOfBirth: "2010-05-12", email: "nicha.student@example.com", phone: "0812344821", address1: "88 ถนนสุขุมวิท", address2: "", city: "วัฒนา", province: "กรุงเทพมหานคร", postalCode: "10110" },
    submitted: "8 ต.ค. 2569",
    status: "confirmed",
    heatId: "2080031",
    finalId: "",
    result: "pass",
    canEdit: true,
    slipIssue: "",
    source: "self",
    slipFileName: "payment-slip-heat-05.pdf",
    competitions: [{ id: "hkiso", name: "HKISO Science", short: "HKISO", grade: "มัธยมศึกษาปีที่ 5", fee: 755 }],
    pastPapers: [],
    registrationFee: 755,
    pastPapersTotal: 0,
    totalPayment: 755,
  },
  {
    id: "heat-04",
    owner: "coordinator",
    kind: "Heat",
    exam: "OCEC Heat รอบที่ 2",
    year: "2569",
    candidate: "Pimchanok Rattanaporn",
    nameParts: { firstName: "Pimchanok", lastName: "Rattanaporn" },
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
    nameParts: { firstName: "Thanakorn", lastName: "Wattanakul" },
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
    competitions: [
      { id: "bbb", name: "Big Bay Bei Mathematics", short: "BBB", grade: "มัธยมศึกษาปีที่ 6", fee: 1550 },
      { id: "hkico", name: "HKICO Computer", short: "HKICO", grade: "มัธยมศึกษาปีที่ 6", fee: 1550 },
    ],
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
    nameParts: { firstName: "Siriporn", lastName: "Rattanakorn" },
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
    competitions: [{ id: "hkimo", name: "HKIMO Mathematics", short: "HKIMO", grade: "มัธยมศึกษาปีที่ 5", fee: 1350 }],
    pastPapers: [],
    registrationFee: 1350,
    pastPapersTotal: 0,
    totalPayment: 1350,
  },
  {
    id: "demo-hkimo-heat-01",
    owner: "candidate",
    kind: "Heat",
    exam: "HKIMO HEAT ROUND 2569",
    year: "2569",
    candidate: "Kanya Rattanasuk",
    school: "Assumption College",
    grade: "มัธยมศึกษาปีที่ 5",
    format: "Online Exam",
    center: "Online Exam",
    contactEmail: "kanya.r@example.com",
    phoneLast4: "3814",
    submitted: "6 ต.ค. 2569",
    status: "confirmed",
    heatId: "3100012",
    finalId: "",
    result: "pass",
    canEdit: true,
    source: "self",
    competitions: [{ id: "hkimo", name: "HKIMO Mathematics", short: "HKIMO", grade: "มัธยมศึกษาปีที่ 5", fee: 655 }],
    pastPapers: [],
    registrationFee: 655,
    pastPapersTotal: 0,
    totalPayment: 655,
  },
  {
    id: "demo-hkimo-final-01",
    owner: "candidate",
    kind: "Final",
    exam: "HKIMO FINAL ROUND 2569",
    year: "2569",
    candidate: "Kanya Rattanasuk",
    school: "Assumption College",
    grade: "มัธยมศึกษาปีที่ 5",
    format: "Online Exam",
    center: "Online Exam",
    contactEmail: "kanya.r@example.com",
    phoneLast4: "3814",
    submitted: "8 ต.ค. 2569",
    status: "confirmed",
    heatId: "3100012",
    finalId: "F-69031012",
    result: "pass",
    canEdit: true,
    source: "self",
    sourceHeatId: "demo-hkimo-heat-01",
    competitions: [{ id: "hkimo", name: "HKIMO Mathematics", short: "HKIMO", grade: "มัธยมศึกษาปีที่ 5", fee: 1350 }],
    pastPapers: [],
    registrationFee: 1350,
    pastPapersTotal: 0,
    totalPayment: 1350,
  },
  {
    id: "demo-hkiso-heat-01",
    owner: "candidate",
    kind: "Heat",
    exam: "HKISO HEAT ROUND 2569",
    year: "2569",
    candidate: "Punnita Wattanapong",
    school: "Satit Kaset School",
    grade: "มัธยมศึกษาปีที่ 4",
    format: "Paper-Based",
    center: "ศูนย์สอบกรุงเทพฯ",
    contactEmail: "punnita.w@example.com",
    phoneLast4: "5920",
    submitted: "6 ต.ค. 2569",
    status: "confirmed",
    heatId: "4200025",
    finalId: "",
    result: "pass",
    canEdit: true,
    source: "school",
    competitions: [{ id: "hkiso", name: "HKISO Science", short: "HKISO", grade: "มัธยมศึกษาปีที่ 4", fee: 755 }],
    pastPapers: [],
    registrationFee: 755,
    pastPapersTotal: 0,
    totalPayment: 755,
  },
];

const EXAM_ROUND_LABELS = { HEAT: "HEAT ROUND", FINAL: "FINAL ROUND", FINAL_X: "FINAL X" };
const RESULT_AWARDS = ["GOLD AWARD", "SILVER AWARD", "BRONZE AWARD", "MERIT AWARD", "PARTICIPATION"];
const FINAL_ELIGIBLE_AWARDS = new Set(["GOLD AWARD", "SILVER AWARD", "BRONZE AWARD"]);
const DEMO_RESULT_ROSTER = [
  { candidateName: "Kanya Rattanasuk", grade: "Grade 5", schoolName: "Assumption College", award: "GOLD AWARD" },
  { candidateName: "Thanakorn Wattanakul", grade: "Grade 6", schoolName: "Triam Udom Suksa School", award: "GOLD AWARD" },
  { candidateName: "Punnita Wattanapong", grade: "Grade 4", schoolName: "Satit Kaset School", award: "SILVER AWARD" },
  { candidateName: "Nicha Srisawat", grade: "Grade 5", schoolName: "Srinakharinwirot Demonstration School", award: "SILVER AWARD" },
  { candidateName: "Pimchanok Rattanaporn", grade: "Grade 4", schoolName: "Bangkok Patana School", award: "BRONZE AWARD" },
  { candidateName: "Pattara Chaiyasit", grade: "Grade 5", schoolName: "Satit Kaset School", award: "BRONZE AWARD" },
  { candidateName: "Narin Petchthong", grade: "Grade 3", schoolName: "Suankularb Wittayalai School", award: "MERIT AWARD" },
  { candidateName: "Ananya Kittisak", grade: "Grade 6", schoolName: "St. Joseph Convent School", award: "MERIT AWARD" },
  { candidateName: "Chanon Pongsiri", grade: "Grade 4", schoolName: "Triam Udom Suksa School", award: "PARTICIPATION" },
  { candidateName: "Mali Srisuk", grade: "Grade 5", schoolName: "Satit Kaset School", award: "PARTICIPATION" },
];
const DEMO_LARGE_RESULT_ROSTER = (() => {
  const firstNames = ["Aaron", "Aileen", "Ananya", "Arun", "Benjamin", "Chanon", "Chayut", "Daniel", "Ethan", "Faye", "Grace", "Haruto", "Ittipon", "James", "Kanya", "Kavin", "Liam", "Mali", "Megan", "Narin", "Nicha", "Noah", "Olivia", "Pattara", "Pimchanok", "Punnita", "Rina", "Sanya", "Tara", "Thanakorn", "Thida", "Tinn", "Wichai", "Yuki", "Zane"];
  const lastNames = ["Rattanasuk", "Wattanakul", "Srisawat", "Petchthong", "Kittisak", "Chaiyasit", "Wattanapong", "Rattanaporn", "Pongsiri", "Srisuk", "Sukprasert", "Noppakun", "Thammasiri", "Boonmee", "Kanjana", "Sukhum", "Jirawat", "Chantarangsu", "Piyakul", "Phromsri", "Rojanaporn", "Suwannarat", "Akarapong", "Sangthong", "Maneerat", "Thongchai", "Kongkaew", "Limsakul", "Prasertchai", "Srisombat"];
  const schools = ["Assumption College", "Triam Udom Suksa School", "Satit Kaset School", "Srinakharinwirot Demonstration School", "Bangkok Patana School", "Suankularb Wittayalai School", "St. Joseph Convent School", "บดินทรเดชา (สิงห์ สิงหเสนี)", "สวนกุหลาบวิทยาลัย", "โรงเรียนมหิดลวิทยานุสรณ์"];
  return firstNames.flatMap((firstName, firstIndex) => lastNames.map((lastName, lastIndex) => {
    const index = firstIndex * lastNames.length + lastIndex;
    return {
      candidateName: `${firstName} ${lastName}`,
      grade: `Grade ${3 + (index % 6)}`,
      schoolName: schools[index % schools.length],
      award: RESULT_AWARDS[(index * 7) % RESULT_AWARDS.length],
    };
  }));
})();
const DEMO_COMPETITION_ROUNDS = [
  { competitionId: "hkimo", title: "HKIMO", rounds: ["HEAT", "FINAL"], accent: "blue" },
  { competitionId: "bbb", title: "Big Bay Bei (BBB)", rounds: ["HEAT", "FINAL", "FINAL_X"], accent: "coral" },
  { competitionId: "hkiso", title: "HKISO", rounds: ["HEAT", "FINAL"], accent: "violet" },
  { competitionId: "hkico", title: "HKICO", rounds: ["HEAT", "FINAL"], accent: "yellow" },
  { competitionId: "timo", title: "TIMO", rounds: ["HEAT", "FINAL"], accent: "blue" },
];
const ROUND_SCHEDULES = {
  HEAT: { openDate: "2026-10-01", closeDate: "2026-11-30", examDate: "2026-12-13", editCloseDate: "2026-11-30" },
  FINAL: { openDate: "2026-11-15", closeDate: "2027-01-15", examDate: "2027-02-14", editCloseDate: "2027-01-15", finalConfirmCloseDate: "2027-01-15" },
  FINAL_X: { openDate: "2026-12-01", closeDate: "2027-02-15", examDate: "2027-03-14", editCloseDate: "2027-02-15", finalConfirmCloseDate: "2027-02-15" },
};
const demoExamCatalog = DEMO_COMPETITION_ROUNDS.flatMap((competition) => competition.rounds.map((roundType) => ({
  id: `${competition.competitionId}-${roundType.toLowerCase()}-2569`,
  competitionId: competition.competitionId,
  title: competition.title,
  year: "2569",
  roundType,
  round: EXAM_ROUND_LABELS[roundType],
  ...ROUND_SCHEDULES[roundType],
  isOpen: roundType === "HEAT" && ["hkimo", "bbb"].includes(competition.competitionId),
  accent: competition.accent,
  prices: roundType === "HEAT" ? { paperBased: 755, onlineExam: 655 } : { paperBased: 1550, onlineExam: 1350 },
  description: `${competition.title} · ${EXAM_ROUND_LABELS[roundType]} · ปีการศึกษา 2569`,
})));
const DEMO_PUBLISHED_RESULT_WORKFLOWS = {
  "hkimo-heat-2569": { fileName: "ผลสอบ HKIMO HEAT ตัวอย่าง.xlsx", publishedAt: "2026-09-28T09:00:00+07:00", draftImported: true, hasConflict: false, conflictResolved: true, published: true, rows: makeMockResultRows(seedApplications, demoExamCatalog.find((exam) => exam.id === "hkimo-heat-2569")) },
  "hkimo-final-2569": { fileName: "ผลสอบ HKIMO FINAL ตัวอย่าง.xlsx", publishedAt: "2026-10-02T10:00:00+07:00", draftImported: true, hasConflict: false, conflictResolved: true, published: true, rows: makeMockResultRows(seedApplications, demoExamCatalog.find((exam) => exam.id === "hkimo-final-2569")) },
  "timo-heat-2569": { fileName: "ผลสอบ TIMO HEAT ตัวอย่าง.xlsx", publishedAt: "2026-10-09T08:00:00+07:00", draftImported: true, hasConflict: false, conflictResolved: true, published: true, rows: makeMockResultRows(seedApplications, demoExamCatalog.find((exam) => exam.id === "timo-heat-2569")) },
};
const DEMO_DRAFT_RESULT_WORKFLOWS = {
  "bbb-heat-2569": { fileName: "ผลสอบ BBB HEAT ฉบับร่าง.xlsx", draftImported: true, hasConflict: true, conflictResolved: false, published: false, rows: makeMockResultRows(seedApplications, demoExamCatalog.find((exam) => exam.id === "bbb-heat-2569")) },
};

function getExamRoundType(exam) {
  if (exam.roundType) return exam.roundType;
  const round = String(exam.round || "").toUpperCase();
  if (round.includes("FINAL X") || round.includes("FINAL_X")) return "FINAL_X";
  if (round.includes("FINAL")) return "FINAL";
  return "HEAT";
}

function isFinalEligibleAward(award) {
  return FINAL_ELIGIBLE_AWARDS.has(String(award || "").trim().toUpperCase());
}

function getPublicResultStatus(row) {
  if (row.roundType === "HEAT") {
    return isFinalEligibleAward(row.award)
      ? { label: "ผ่านรอบ HEAT ROUND", tone: "eligible" }
      : { label: "ไม่ผ่านรอบ HEAT ROUND", tone: "not-eligible" };
  }
  return { label: "ประกาศผลแล้ว", tone: "published" };
}

function getResultIssueKey(row) {
  return `${row.applicationId || ""}::${row.candidateNo || row.examNumber || ""}::${row.candidateName || row.candidate || ""}`;
}

function getActiveExamYear(examCatalog, roundType, fallbackYear = "2569") {
  const roundExams = (examCatalog || []).filter((item) => getExamRoundType(item) === roundType);
  const openYears = [...new Set(roundExams.filter((item) => item.isOpen).map((item) => item.year).filter(Boolean))];
  const years = openYears.length ? openYears : [...new Set(roundExams.map((item) => item.year).filter(Boolean))];
  return years.sort((left, right) => Number(right) - Number(left))[0] || fallbackYear;
}

function getCompetitionExamPrice(examCatalog, competitionId, roundType, format, competitionFees, year = "2569") {
  const roundExams = (examCatalog || []).filter((item) => item.competitionId === competitionId && getExamRoundType(item) === roundType);
  const exam = roundExams.find((item) => item.year === year) || roundExams.find((item) => item.isOpen) || roundExams[0];
  const priceKey = format === "Online" || format === "Online Exam" ? "onlineExam" : "paperBased";
  const configuredPrice = exam?.prices?.[priceKey];
  if (configuredPrice !== undefined && configuredPrice !== null && configuredPrice !== "") return Math.max(0, Number(configuredPrice) || 0);
  const legacyKey = roundType === "HEAT"
    ? (priceKey === "onlineExam" ? "heatOnline" : "heatOnsite")
    : (priceKey === "onlineExam" ? "finalOnline" : "finalOnsite");
  return Number(competitionFees?.[legacyKey] || 0);
}

function formatThaiDate(date) {
  if (!date) return "ยังไม่กำหนด";
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function getBangkokTodayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function getApplicationEditDeadline(application, examCatalog) {
  const roundType = application?.kind === "Final" ? "FINAL" : "HEAT";
  const roundExams = (examCatalog || []).filter((exam) => exam.year === application?.year && getExamRoundType(exam) === roundType);
  const competitionIds = new Set((application?.competitions || []).map((item) => item.id));
  const matchingExams = roundExams.filter((exam) => competitionIds.has(exam.competitionId));
  return (matchingExams.length ? matchingExams : roundExams)
    .map((exam) => exam.editCloseDate)
    .filter(Boolean)
    .sort()[0] || "";
}

function isApplicationEditable(application, examCatalog) {
  if (application?.status !== "confirmed") return false;
  const deadline = getApplicationEditDeadline(application, examCatalog);
  return Boolean(deadline && getBangkokTodayISO() <= deadline);
}

function getApplicationsForResultTarget(applications, target) {
  if (!target) return [];
  const kind = target.roundType === "HEAT" ? "Heat" : "Final";
  return applications.filter((application) => application.kind === kind
    && application.year === target.year
    && ((application.competitions || []).some((competition) => competition.id === target.competitionId)
      || (application.examIds || []).includes(target.competitionId)));
}

function getApplicationPhone(application) {
  return application?.studentInformation?.phone || application?.phone || (application?.phoneLast4 ? `08X-XXX-${application.phoneLast4}` : "ไม่ระบุ");
}

function makeMockResultRows(applications, target) {
  if (!target) return [];
  const roundType = getExamRoundType(target);
  const targetApplications = getApplicationsForResultTarget(applications, target);
  const examPrefix = { hkimo: "31", bbb: "20", hkiso: "42", hkico: "50", timo: "60" }[target.competitionId] || "90";
  const roster = target.competitionId === "timo" && roundType === "HEAT" ? DEMO_LARGE_RESULT_ROSTER : DEMO_RESULT_ROSTER;
  return roster.map((person, index) => {
    const linkedApplication = targetApplications.find((application) => application.candidate.toLowerCase() === person.candidateName.toLowerCase());
    const hasSchoolMismatch = roundType === "HEAT" && target.competitionId === "bbb" && linkedApplication?.id === "heat-01";
    const fallbackNumber = `${examPrefix}${String(index + 1).padStart(5, "0")}`;
    const examNumber = roundType === "HEAT"
      ? (linkedApplication?.heatId || fallbackNumber)
      : (linkedApplication?.finalId || `F-69${fallbackNumber}`);
    const finalEligible = isFinalEligibleAward(person.award);
    const schoolName = hasSchoolMismatch ? `${person.schoolName} · Bangkok` : person.schoolName;
    return {
      applicationId: linkedApplication?.id || `mock-${target.id}-${index + 1}`,
      issueApplicationId: hasSchoolMismatch ? linkedApplication.id : "",
      examNumber,
      candidateNo: examNumber,
      grade: person.grade,
      school: schoolName,
      schoolName,
      applicationSchoolName: linkedApplication?.school || "",
      candidate: person.candidateName,
      candidateName: person.candidateName,
      award: person.award,
      matchStatus: hasSchoolMismatch ? "school-mismatch" : "matched",
      result: finalEligible ? "pass" : "not-passed",
      score: 68 + ((index * 7 + target.competitionId.length * 3) % 31),
    };
  });
}

function resultTargetLabel(target) {
  const title = target?.title || target?.competitionTitle || "รายการสอบ";
  const round = EXAM_ROUND_LABELS[target?.roundType] || target?.round || "รอบสอบ";
  return `${title} · ${round} · ปี ${target?.year || "ไม่ระบุ"}`;
}

function isFinalConfirmationWindowOpen(exam, today = getBangkokTodayISO()) {
  return !exam?.finalConfirmCloseDate || today <= exam.finalConfirmCloseDate;
}

function getEligibleFinalRounds(application, examCatalog, publishedHeatResults, today = getBangkokTodayISO()) {
  const passedCompetitions = new Set(publishedHeatResults
    .filter((result) => result.applicationId === application?.id && (isFinalEligibleAward(result.award) || result.result === "pass"))
    .map((result) => result.competitionId));
  const applicationCompetitions = new Set((application?.competitions || []).map((competition) => competition.id));
  return (examCatalog || []).filter((exam) => exam.year === application?.year
    && getExamRoundType(exam) === "FINAL"
    && passedCompetitions.has(exam.competitionId)
    && applicationCompetitions.has(exam.competitionId)
    && isFinalConfirmationWindowOpen(exam, today));
}

function ExamLogo({ exam, className = "exam-type-mark", iconSize = 20 }) {
  return <span className={`${className}${exam.logoDataUrl ? " exam-logo-has-image" : ""}`}>{exam.logoDataUrl ? <img src={exam.logoDataUrl} alt={`โลโก้ ${exam.title}`} /> : <Icon name="award" size={iconSize} />}</span>;
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
  "admin-results": "นำเข้าผลสอบ",
  "admin-final-ids": "เลขประจำตัว Final",
  "admin-sheets": "Google Sheets",
  "admin-mock-papers": "Mock และข้อสอบเก่า",
  "admin-application-edit": "แก้ไขใบสมัคร (แอดมิน)",
};

const iconGlyphs = {
  home: "home",
  file: "file",
  book: "book",
  search: "search",
  check: "check",
  award: "medal",
  grid: "apps",
  users: "users",
  settings: "settings",
  upload: "upload",
  sync: "refresh",
  bell: "bell",
  arrow: "arrow-to-right",
  chevron: "angle-small-right",
  clock: "clock",
  lock: "lock",
  info: "circle-i",
  edit: "edit",
  plus: "add",
  menu: "menu-burger",
  mail: "envelope",
  phone: "phone-call",
  calendar: "calendar",
  building: "building",
  monitor: "monitor",
  download: "download",
  close: "cross-small",
  cursor: "cursor",
  trash: "trash",
  help: "interrogation",
  shield: "shield-check",
  hash: "hastag",
  sparkle: "sparkles",
};

function Icon({ name, size = 18, className = "" }) {
  const glyph = iconGlyphs[name] || iconGlyphs.file;
  return <i className={`ocec-icon fi fi-rr-${glyph} ${className}`} style={{ fontSize: `${size}px` }} aria-hidden="true" />;
}

function BrandMark() {
  return (
    <span className="brand-logo-window" role="img" aria-label="OCEC TH">
      <img src="/ocec-logo.png" alt="" />
    </span>
  );
}

function Button({ children, variant = "primary", icon, type = "button", onClick, disabled = false, className = "", ariaLabel, title }) {
  return (
    <button
      className={"button button-" + variant + " " + className}
      type={type}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={title}
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
  { id: "hkimo", short: "HKIMO", name: "Hong Kong International Mathematical Olympiad (HKIMO)", subject: "Mathematics", grades: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
  { id: "bbb", short: "BBB", name: "Big Bay Bei (BBB)", subject: "Mathematics", grades: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
  { id: "hkiso", short: "HKISO", name: "HKISO", subject: "Science", grades: ["Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
  { id: "hkico", short: "HKICO", name: "HKICO", subject: "Computer", grades: ["Primary 2 — Scratch", "Primary 3 — Scratch", "Primary 4 — Scratch", "Primary 5 — Blockly", "Primary 6 — Blockly", "Secondary 1 — Blockly", "Secondary 2 — Python", "Secondary 3 — Python", "Senior Secondary — Python"] },
  { id: "timo", short: "TIMO", name: "Thailand International Mathematical Olympiad (TIMO)", subject: "Mathematics", grades: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
];

function getFormCompetitions(examCatalog, roundType, options = {}) {
  const matchingExams = (examCatalog || []).filter((exam) => getExamRoundType(exam) === roundType && (!options.openOnly || exam.isOpen) && (!options.year || exam.year === options.year));
  if (!matchingExams.length) return examCatalog?.length ? [] : FORM_COMPETITIONS;
  const catalogById = new Map(FORM_COMPETITIONS.map((competition) => [competition.id, competition]));
  const uniqueExams = [...new Map(matchingExams.map((exam) => [exam.competitionId || exam.id, exam])).values()];
  return uniqueExams.map((exam) => ({ ...(catalogById.get(exam.competitionId) || ({
    id: exam.competitionId || exam.id,
    short: exam.title.length > 18 ? `${exam.title.slice(0, 16)}…` : exam.title,
    name: exam.title,
    subject: "Academic Competition",
    grades: FORM_COMPETITIONS[0].grades,
  })), year: exam.year }));
}

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

const DEMO_CENTER_CATALOG = [
  { code: "208", name: "ศูนย์สอบกรุงเทพฯ", applicants: 18 },
  { code: "305", name: "ศูนย์สอบเชียงใหม่", applicants: 7 },
  { code: "412", name: "ศูนย์สอบขอนแก่น", applicants: 5 },
  { code: "888", name: "ศูนย์สอบฮ่องกง", applicants: 3 },
];

const DEMO_PAST_PAPERS = FORM_PAST_PAPER_GROUPS.flatMap((group) => group.items.map((item) => ({ id: item.id, group: group.title, title: item.title, detail: item.detail, name: `${item.title} — ${item.detail}`, price: item.price, active: true })));

function groupPastPaperCatalog(catalog) {
  return Object.values((catalog || []).filter((paper) => paper.active).reduce((groups, paper) => {
    const groupName = paper.group || "ข้อสอบเก่า";
    const id = groupName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "past-papers";
    groups[id] ||= { id, title: groupName, items: [] };
    groups[id].items.push({ id: paper.id, title: paper.title || paper.name, detail: paper.detail || "", price: Number(paper.price || 0) });
    return groups;
  }, {}));
}

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
        <div className="application-card-footer-meta">
          <span className="muted-inline"><Icon name="building" size={15} />{application.center}</span>
          <span className="muted-inline"><Icon name="phone" size={15} />{getApplicationPhone(application)}</span>
        </div>
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
  const adminGroups = [
    { label: "ภาพรวม", items: [{ id: "admin-home", label: "ภาพรวมแอดมิน", icon: "grid" }] },
    { label: "ใบสมัคร", items: [{ id: "admin-review", label: "ตรวจใบสมัคร", icon: "file", count: String(pendingReviewCount) }] },
    { label: "รอบสอบและข้อมูลตั้งต้น", items: [{ id: "admin-round", label: "รอบสอบ ศูนย์สอบ และราคา", icon: "calendar" }] },
    { label: "ผลสอบและ Final", items: [{ id: "admin-results", label: "นำเข้าผลสอบ", icon: "award" }, { id: "admin-final-ids", label: "เลขประจำตัว Final", icon: "users" }] },
    { label: "รายงานและการจัดส่ง", items: [{ id: "admin-mock-papers", label: "รายชื่อ Mock และข้อสอบเก่า", icon: "book" }, { id: "admin-sheets", label: "Google Sheets", icon: "sync" }] },
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
            adminGroups.map((group) => <section className="admin-nav-group" key={group.label}><p className="nav-section-title nav-section-admin">{group.label}</p><div className="nav-list">{renderItems(group.items)}</div></section>)
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
  const requiresRegistrationLogin = !authProfile && page === "apply-heat";

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
        <button type="button" aria-current={page === "final-confirm" ? "page" : undefined} className={page === "final-confirm" ? "landing-nav-current" : ""} onClick={() => navigate("final-confirm")}>ยืนยันสิทธิ์</button>
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
      <a className="flaticon-attribution" href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">UIcons by Flaticon</a>
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
  const openExams = examCatalog.filter((exam) => exam.isOpen);
  const openExamCount = openExams.length;
  const heroOpenExams = openExams.slice(0, 2);
  const orderedExams = [...examCatalog].sort((left, right) => Number(Boolean(right.isOpen)) - Number(Boolean(left.isOpen)));
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
  }, [examCatalog.length]);

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
            {heroOpenExams.length ? heroOpenExams.map((exam, index) => <div className={`landing-art-card ${index === 0 ? "landing-art-card-front" : "landing-art-card-back"}`} key={exam.id}>
              <ExamLogo exam={exam} className={`art-mini-mark ${index === 0 ? "art-mark-teal" : "art-mark-muted"}`} iconSize={18} />
              <span><small>เปิดรับสมัคร · {EXAM_ROUND_LABELS[getExamRoundType(exam)] || exam.round}</small><strong>{exam.title} {exam.year}</strong></span>
              <Icon name="arrow" size={16} />
            </div>) : <div className="landing-art-card landing-art-card-front"><span className="art-mini-mark art-mark-muted"><Icon name="clock" size={18} /></span><span><small>ยังไม่มีรายการเปิดรับ</small><strong>ติดตามกำหนดการรอบถัดไป</strong></span><Icon name="clock" size={16} /></div>}
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
            {orderedExams.map((exam) => (
              <article className={`exam-listing-card exam-card-${exam.accent}${exam.isOpen ? "" : " exam-card-upcoming"}`} key={exam.id}>
                <div className="exam-card-top"><ExamLogo exam={exam} iconSize={21} /><span className={exam.isOpen ? "exam-open-label" : "exam-upcoming-label"}><i />{exam.isOpen ? "เปิดรับสมัคร" : "ยังไม่เปิดรับ"}</span></div>
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

function getApplicantEditValues(application) {
  const studentInformation = application?.studentInformation || {};
  const nameParts = application?.nameParts || {};
  const candidateParts = application?.candidate?.trim().split(/\s+/) || [];
  const phone = studentInformation.phone || application?.phone || (application?.phoneLast4 ? `08X-XXX-${application.phoneLast4}` : "");
  return {
    firstName: nameParts.firstName || studentInformation.firstName || candidateParts[0] || "",
    lastName: nameParts.lastName || studentInformation.lastName || candidateParts.slice(1).join(" "),
    school: application?.school || studentInformation.school || "",
    email: application?.contactEmail || studentInformation.email || "",
    phone,
    address1: studentInformation.address1 || "",
    address2: studentInformation.address2 || "",
    city: studentInformation.city || "",
    province: studentInformation.province || "",
    postalCode: studentInformation.postalCode || "",
  };
}

function ApplicantProfileFields({ values, onChange, disabled = false }) {
  const field = (key) => (event) => onChange(key, event.target.value);
  return (
    <div className="admin-edit-person-grid">
      <Field label="ชื่อจริงภาษาอังกฤษ" required><input value={values.firstName} disabled={disabled} autoComplete="given-name" onChange={field("firstName")} /></Field>
      <Field label="นามสกุลภาษาอังกฤษ" required><input value={values.lastName} disabled={disabled} autoComplete="family-name" onChange={field("lastName")} /></Field>
      <Field label="โรงเรียน" required><input value={values.school} disabled={disabled} onChange={field("school")} /></Field>
      <Field label="อีเมลติดต่อผู้เข้าสอบ" required hint="ใช้รับอีเมลสรุปใบสมัครและผลตรวจสลิป"><input type="email" value={values.email} disabled={disabled} autoComplete="email" onChange={field("email")} /></Field>
      <Field label="เบอร์โทรศัพท์" required><input type="tel" inputMode="tel" autoComplete="tel" value={values.phone} disabled={disabled} onChange={field("phone")} placeholder="(000) 000-0000" /></Field>
      <Field label="ที่อยู่ (บ้านเลขที่ / หมู่บ้าน / ถนน)"><input value={values.address1} disabled={disabled} autoComplete="street-address" onChange={field("address1")} placeholder="ระบุบ้านเลขที่ หมู่บ้าน และถนน" /></Field>
      <Field label="อาคาร / ซอย / รายละเอียดเพิ่มเติม"><input value={values.address2} disabled={disabled} onChange={field("address2")} placeholder="ถ้ามี" /></Field>
      <Field label="เขต / อำเภอ"><input value={values.city} disabled={disabled} onChange={field("city")} /></Field>
      <Field label="จังหวัด"><input value={values.province} disabled={disabled} autoComplete="address-level1" onChange={field("province")} /></Field>
      <Field label="รหัสไปรษณีย์"><input value={values.postalCode} disabled={disabled} inputMode="numeric" autoComplete="postal-code" onChange={field("postalCode")} /></Field>
    </div>
  );
}

function EditApplicationPage({ application, onSave, navigate, examCatalog }) {
  const [form, setForm] = useState(() => getApplicantEditValues(application));
  const [error, setError] = useState("");
  const editDeadline = getApplicationEditDeadline(application, examCatalog);
  const editable = isApplicationEditable(application, examCatalog);
  const updateField = (key, value) => { setForm((current) => ({ ...current, [key]: value })); setError(""); };
  const editReason = application.status === "pending"
    ? "ใบสมัครอยู่ระหว่างตรวจสอบ สามารถดูสถานะได้ แต่ยังแก้ไขข้อมูลไม่ได้"
    : !application.canEdit
      ? "ใบสมัครนี้ไม่ได้เปิดสิทธิ์แก้ข้อมูล"
      : !editDeadline
        ? "ยังไม่ได้กำหนดวันปิดแก้ไขของรอบนี้"
        : "รอบแก้ไขข้อมูลปิดแล้ว";

  function submit(event) {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) { setError("กรุณากรอกชื่อและนามสกุลภาษาอังกฤษ"); return; }
    if (!form.school.trim()) { setError("กรุณากรอกชื่อโรงเรียน"); return; }
    if (!form.email.trim()) { setError("กรุณากรอกอีเมลติดต่อ"); return; }
    if (!form.phone.trim()) { setError("กรุณากรอกเบอร์โทรศัพท์"); return; }
    const nameParts = { firstName: form.firstName.trim(), lastName: form.lastName.trim() };
    const studentInformation = { ...application.studentInformation, ...form, ...nameParts, school: form.school.trim(), email: form.email.trim(), phone: form.phone.trim() };
    onSave(application.id, {
      candidate: `${nameParts.firstName} ${nameParts.lastName}`,
      nameParts,
      school: form.school.trim(),
      contactEmail: form.email.trim(),
      phone: form.phone.trim(),
      phoneLast4: form.phone.replace(/\D/g, "").slice(-4),
      studentInformation,
    });
  }

  const competitionNames = application.competitions?.map((item) => item.short || item.name).filter(Boolean).join(", ");
  const examNames = [competitionNames, application.kind === "Final" ? "FINAL ROUND" : "HEAT ROUND"].filter(Boolean).join(" · ");
  return (
    <div className="page-stack admin-edit-application-page user-edit-application-page">
      <PageHeading eyebrow="ใบสมัครของฉัน" title="แก้ไขข้อมูลใบสมัคร" description={`${application.candidate} · ${application.exam}`} action={<Button variant="outline" icon="arrow" onClick={() => navigate("application-detail", application.id)}>กลับไปใบสมัคร</Button>} />
      {!editable ? <div className="notice notice-amber"><Icon name="lock" /><div><strong>ยังไม่สามารถแก้ไขใบสมัครนี้ได้</strong><p>{editReason}</p></div></div> : null}
      <form className="user-edit-form" onSubmit={submit}>
        <section className="surface admin-edit-section">
          <div className="admin-edit-section-heading"><span><Icon name="edit" size={16} /></span><div><h2>ข้อมูลผู้เข้าสอบ</h2><p>แก้ไขข้อมูลติดต่อและที่อยู่ได้ตามกำหนด</p></div></div>
          <ApplicantProfileFields values={form} onChange={updateField} disabled={!editable} />
        </section>
        <section className="surface admin-edit-section user-edit-locked-section">
          <div className="admin-edit-section-heading"><span><Icon name="lock" size={16} /></span><div><h2>ข้อมูลที่ล็อกหลังอนุมัติ</h2><p>ข้อมูลส่วนนี้ไม่สามารถแก้ไขได้ด้วยตนเอง</p></div></div>
          <div className="locked-chip-row"><span>รายการสอบ <b>{examNames}</b></span><span>ระดับชั้น <b>{application.grade}</b></span><span>รูปแบบ <b>{application.format === "On-site" ? "Paper-Based" : application.format}</b></span><span>ศูนย์สอบ <b>{application.center}</b></span></div>
        </section>
        <section className="notice notice-blue user-edit-support-note"><Icon name="info" /><div><strong>ต้องการแก้ไขข้อมูลที่ล็อกไว้?</strong><p>หากประสงค์แก้ไขรายการสอบ ระดับชั้น รูปแบบการสอบ หรือศูนย์สอบ กรุณาติดต่อผู้ดูแลระบบผ่าน LINE Official Account</p><a href="https://lin.ee/3hzFg1z" target="_blank" rel="noreferrer">OCEC_Thailand <Icon name="arrow" size={14} /></a></div></section>
        {error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}
        {editable ? <div className="admin-edit-footer user-edit-footer"><span><Icon name="info" size={15} />แก้ไขได้ถึง {formatThaiDate(editDeadline)} · การแก้ไขจะไม่ทำให้ใบสมัครกลับไปรอตรวจสอบ</span><Button variant="outline" type="button" onClick={() => navigate("application-detail", application.id)}>ยกเลิก</Button><Button type="submit" icon="check">บันทึกการแก้ไข</Button></div> : null}
      </form>
    </div>
  );
}

function ApplicationDetailPage({ application, navigate, resultRows = [], examCatalog }) {
  if (!application) return <div className="surface empty-state">ไม่พบใบสมัครที่เลือก</div>;
  const canEdit = isApplicationEditable(application, examCatalog);
  const applicationResults = resultRows.filter((result) => result.applicationId === application.id);
  const hasPassedHeat = applicationResults.some((result) => result.roundType === "HEAT" && result.result === "pass");
  const studentInformation = application.studentInformation || {};
  const applicantAddress = [studentInformation.address1, studentInformation.address2, studentInformation.city, studentInformation.province, studentInformation.postalCode].filter(Boolean).join(", ");
  const resultSummary = applicationResults.length
    ? applicationResults.map((result) => `${result.competitionTitle} ${EXAM_ROUND_LABELS[result.roundType] || result.roundType}: ${result.result === "pass" ? "ผ่าน" : "ไม่ผ่าน"}`).join(" · ")
    : "ยังไม่ประกาศผล";
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
              <div><span>เบอร์โทรศัพท์</span><strong>{getApplicationPhone(application)}</strong></div>
              <div><span>ที่อยู่</span><strong>{applicantAddress || "ยังไม่ได้ระบุข้อมูลที่อยู่"}</strong></div>
              <div><span>วันที่ส่งใบสมัคร</span><strong>{application.submitted}</strong></div>
              <div><span>สถานะผลสอบ</span><strong>{resultSummary}</strong></div>
            </div>
          </section>
          {hasPassedHeat ? (
            <div className="final-next-step"><span className="final-next-icon"><Icon name="award" /></span><div><strong>คุณผ่านเข้าสู่รอบ Final</strong><p>ยืนยันสิทธิ์และสมัครสอบ Final ได้ภายในเวลาที่กำหนด</p></div><Button onClick={() => navigate("final-confirm", application.id)}>ยืนยันสิทธิ์ <Icon name="arrow" size={16} /></Button></div>
          ) : null}
        </div>
        <aside className="surface timeline-card">
          <p className="eyebrow">ความคืบหน้า</p><h2>ขั้นตอนใบสมัคร</h2>
          <div className="timeline">
            <div className="timeline-item timeline-done"><span><Icon name="check" size={13} /></span><div><strong>ส่งใบสมัครแล้ว</strong><small>{application.submitted}</small></div></div>
            <div className={"timeline-item " + (application.status === "confirmed" ? "timeline-done" : "timeline-current")}><span>{application.status === "confirmed" ? <Icon name="check" size={13} /> : "2"}</span><div><strong>{application.status === "confirmed" ? "ตรวจสอบและยืนยันแล้ว" : "รอตรวจใบสมัครและสลิป"}</strong><small>{application.status === "confirmed" ? "ตรวจสอบเรียบร้อย" : "เจ้าหน้าที่กำลังตรวจสอบ"}</small></div></div>
            <div className={"timeline-item " + (applicationResults.length ? "timeline-done" : "")}><span>{applicationResults.length ? <Icon name="check" size={13} /> : "3"}</span><div><strong>ประกาศผลสอบ</strong><small>{applicationResults.length ? resultSummary : "รอประกาศผล"}</small></div></div>
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

function FinalConfirmationPage({ applications, applicationHint, onContinue, navigate, publishedHeatResults = [], examCatalog, authProfile, onSignIn }) {
  const [path, setPath] = useState(applicationHint?.source === "self" ? "account" : "school");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const localToday = getBangkokTodayISO();
  const hasPublishedHeat = publishedHeatResults.length > 0;
  const eligibleApplications = applications.filter((item) => item.kind === "Heat" && getEligibleFinalRounds(item, examCatalog, publishedHeatResults, localToday).length > 0);
  const canConfirm = hasPublishedHeat && eligibleApplications.length > 0;
  const pendingReason = !hasPublishedHeat ? "รอประกาศผล Heat" : "ปิดยืนยันสิทธิ์ครบแล้ว";
  const accountMatches = canConfirm ? eligibleApplications.filter((item) => item.source === "self" && authProfile && item.contactEmail?.toLowerCase() === authProfile.email.toLowerCase()) : [];
  const eligible = canConfirm ? eligibleApplications.filter((item) => item.source === "school" && item.candidate.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const selected = applications.find((item) => item.id === selectedId);
  const selectedFinalRounds = selected ? getEligibleFinalRounds(selected, examCatalog, publishedHeatResults, localToday) : [];
  const finalRoundDeadlineText = (application) => getEligibleFinalRounds(application, examCatalog, publishedHeatResults, localToday)
    .map((exam) => `${exam.title}: ${exam.finalConfirmCloseDate ? formatThaiDate(exam.finalConfirmCloseDate) : "ไม่กำหนดวันปิด"}`)
    .join(" · ");

  function verify(event) {
    event.preventDefault();
    if (!selected || selected.phoneLast4 !== lastFour) {
      setError("เลข 4 ตัวท้ายไม่ตรงกับใบสมัคร Heat กรุณาตรวจสอบอีกครั้ง");
      return;
    }
    setError("");
    setVerified(true);
  }

  return (
    <div className="page-stack final-rights-page">
      <section className="final-rights-hero" aria-labelledby="final-rights-title">
        <div className="final-rights-hero-copy">
          <span className="final-rights-kicker"><Icon name="award" size={16} /> OCEC FINAL 2569</span>
          <h1 id="final-rights-title">ก้าวต่อไปของคุณ<br /><em>เริ่มที่การยืนยันสิทธิ์</em></h1>
          <p>สำหรับผู้ผ่านรอบ Heat ตรวจสอบข้อมูลให้ตรงกับใบสมัครเดิม แล้วเริ่มสมัคร Final ในขั้นตอนเดียว</p>
          <div className="final-rights-hero-meta"><span><Icon name="check" size={17} /> ใช้ข้อมูล Heat เดิม</span><span><Icon name="shield" size={17} /> ยืนยันตัวตนก่อนสมัคร</span></div>
        </div>
        <div className="final-rights-hero-art" aria-hidden="true"><span className="final-rights-orbit" /><span className="final-rights-medal"><Icon name="award" size={48} /></span><span className="final-rights-star final-rights-star-one">✦</span><span className="final-rights-star final-rights-star-two">✦</span><span className="final-rights-final-word">FINAL</span></div>
      </section>

      <div className="final-rights-info-row"><div><span className={canConfirm ? "final-rights-live" : "final-rights-waiting"}><i />{canConfirm ? "เปิดยืนยันสิทธิ์" : pendingReason}</span><span className="final-rights-deadline"><Icon name="calendar" size={17} /> วันปิดยืนยันสิทธิ์แยกตามรายการสอบและรอบ</span></div><Button variant="text" onClick={() => navigate("results")}>ดูประกาศผล <Icon name="arrow" size={16} /></Button></div>

      <div className="final-rights-layout">
        <div className="final-rights-main">
          {!canConfirm ? <div className="notice notice-amber final-rights-pending"><Icon name="clock" /><div><strong>{pendingReason}</strong><p>{!hasPublishedHeat ? "ระบบจะเปิดยืนยันสิทธิ์ให้อัตโนมัติทันทีหลังแอดมินประกาศผล Heat" : "วันปิดยืนยันสิทธิ์ของทุกรายการที่เกี่ยวข้องผ่านแล้ว"} ขณะนี้แสดงขั้นตอนตัวอย่างเพื่อดูหน้าจอ</p></div><Button variant="outline" onClick={() => setShowPreview((value) => !value)}>{showPreview ? "ซ่อนตัวอย่าง" : "ดูตัวอย่างขั้นตอน"}</Button></div> : null}
          {canConfirm || showPreview ? (
            <section className="surface final-rights-workspace" aria-labelledby="final-rights-workspace-title">
              <div className="final-rights-workspace-heading"><div><p className="eyebrow">ยืนยันสิทธิ์เข้าสอบ Final</p><h2 id="final-rights-workspace-title">คุณสมัคร Heat แบบไหน?</h2><p>เลือกวิธีที่ตรงกับใบสมัคร Heat ของคุณ</p></div><span className="final-rights-step-number">01 / 03</span></div>
              <div className="final-rights-paths" role="tablist" aria-label="วิธีค้นหาใบสมัคร Heat">
                <button type="button" role="tab" aria-selected={path === "account"} className={path === "account" ? "final-rights-path selected" : "final-rights-path"} onClick={() => { setPath("account"); setVerified(false); setError(""); }}><span className="final-rights-path-icon"><Icon name="users" /></span><strong>สมัครด้วยบัญชีตนเอง</strong><small>เปิดใบสมัครของฉันแล้วไปต่อได้เลย</small></button>
                <button type="button" role="tab" aria-selected={path === "school"} className={path === "school" ? "final-rights-path selected" : "final-rights-path"} onClick={() => { setPath("school"); setVerified(false); setError(""); }}><span className="final-rights-path-icon"><Icon name="building" /></span><strong>โรงเรียนสมัครให้</strong><small>ค้นหาชื่อและยืนยันเบอร์โทรศัพท์</small></button>
              </div>

              {path === "account" ? (
                <div className="final-rights-account-panel" role="tabpanel">
                  {authProfile ? <><div className="final-rights-account-identity"><img src={authProfile.picture} alt="" /><div><small>บัญชีที่เข้าสู่ระบบ</small><strong>{authProfile.name}</strong><span>{authProfile.email}</span></div></div>{accountMatches.length ? <div className="final-rights-match-list">{accountMatches.map((item) => <div className="final-rights-match" key={item.id}><span className="final-rights-match-icon"><Icon name="award" /></span><div><strong>{item.candidate}</strong><small>เลขสอบ {item.heatId} · {item.school}</small><small>{finalRoundDeadlineText(item)}</small></div><Button disabled={!canConfirm} icon="arrow" onClick={() => onContinue(item, "account", null, getEligibleFinalRounds(item, examCatalog, publishedHeatResults, localToday))}>ยืนยันสิทธิ์</Button></div>)}</div> : <div className="final-rights-empty"><Icon name="info" /><div><strong>ยังไม่พบใบสมัคร Heat ที่ผ่านในบัญชีนี้</strong><p>หากโรงเรียนเป็นผู้สมัครให้ เลือกแท็บ “โรงเรียนสมัครให้” เพื่อค้นหาด้วยชื่อ</p></div></div>}</> : <div className="final-rights-signin"><span className="final-rights-signin-icon"><GoogleMark /></span><div><strong>เข้าสู่ระบบเพื่อดูใบสมัครของฉัน</strong><p>ผู้ที่สมัคร Heat ด้วยบัญชีตนเองไม่ต้องยืนยันเบอร์โทรศัพท์ซ้ำ</p></div><Button variant="outline" onClick={() => onSignIn(demoGoogleProfile)}>เข้าสู่ระบบตัวอย่าง</Button></div>}
                </div>
              ) : verified ? (
                <div className="final-rights-verified" role="tabpanel"><span className="final-rights-verified-icon"><Icon name="check" size={28} /></span><p className="eyebrow">ยืนยันตัวตนสำเร็จ</p><h3>พร้อมสมัคร OCEC Final</h3><p>ข้อมูลจากใบสมัคร Heat ของ <strong>{selected?.candidate}</strong> จะถูกเติมในฟอร์ม Final ให้ตรวจสอบก่อนส่ง</p><div className="final-rights-verified-summary"><span>เลขสอบ Heat <strong>{selected?.heatId}</strong></span><span>โรงเรียน <strong>{selected?.school}</strong></span><span className="final-rights-deadline-list">รอบที่ยืนยันได้<strong>{selectedFinalRounds.map((exam) => `${exam.title} · ปิด ${exam.finalConfirmCloseDate ? formatThaiDate(exam.finalConfirmCloseDate) : "ไม่กำหนด"}`).join(" / ")}</strong></span></div><div className="final-rights-verified-actions"><Button disabled={!canConfirm || !selectedFinalRounds.length} icon="arrow" onClick={() => onContinue(selected, "google", { name: selected?.candidate, email: selected?.contactEmail, picture: demoGoogleProfile.picture }, selectedFinalRounds)}>เข้าสู่ระบบ Google แล้วสมัคร</Button><Button disabled={!canConfirm || !selectedFinalRounds.length} variant="outline" onClick={() => onContinue(selected, "guest", null, selectedFinalRounds)}>สมัครต่อโดยไม่เข้าสู่ระบบ</Button></div><button type="button" className="back-link" onClick={() => { setVerified(false); setSelectedId(""); setLastFour(""); }}><Icon name="arrow" size={15} />ค้นหารายชื่ออื่น</button></div>
              ) : (
                <div className="final-rights-school-panel" role="tabpanel"><div className="final-rights-section-label"><span>02</span><div><strong>ค้นหาใบสมัคร Heat</strong><small>ใช้ชื่อภาษาอังกฤษตามใบสมัคร</small></div></div><Field label="ชื่อและนามสกุลภาษาอังกฤษ" required><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); setLastFour(""); setError(""); }} placeholder="เช่น Thanakorn Wattanakul" autoComplete="off" /></div></Field>{query.trim() ? <div className="final-rights-results" aria-live="polite"><p>{eligible.length ? `พบ ${eligible.length} รายการ · ตรวจเลขสอบและโรงเรียนก่อนเลือก` : "ไม่พบรายชื่อที่ตรงกับคำค้น"}</p>{eligible.map((item) => <button type="button" key={item.id} className={selectedId === item.id ? "final-rights-result selected" : "final-rights-result"} aria-pressed={selectedId === item.id} onClick={() => { setSelectedId(item.id); setLastFour(""); setError(""); }}><span className="final-rights-result-radio" /><span><strong>{item.candidate}</strong><small>เลขสอบ {item.heatId} · {item.school}</small><small>{finalRoundDeadlineText(item)}</small></span><Icon name="chevron" size={18} /></button>)}</div> : <div className="final-rights-search-hint"><Icon name="info" size={16} />เริ่มพิมพ์ชื่อเพื่อดูใบสมัครที่ผ่านรอบ Heat</div>}{selected ? <form onSubmit={verify} className="final-rights-verify-form"><div className="final-rights-section-label"><span>03</span><div><strong>ยืนยันตัวตน</strong><small>ใช้เบอร์โทรศัพท์ในใบสมัคร Heat ที่เลือก</small></div></div><Field label="เลข 4 ตัวท้ายของเบอร์โทรศัพท์" required hint="กรอกเฉพาะตัวเลข 4 หลักสุดท้าย"><input inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={lastFour} onChange={(event) => { setLastFour(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} placeholder="••••" required /></Field>{error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}<Button type="submit" disabled={!canConfirm} icon="shield">ยืนยันตัวตน</Button></form> : null}</div>
              )}
            </section>
          ) : <section className="surface final-rights-locked"><span><Icon name="lock" size={26} /></span><h2>การยืนยันสิทธิ์ยังไม่เปิด</h2><p>เมื่อประกาศผล Heat แล้ว ผู้ผ่านจะค้นหาชื่อและเริ่มขั้นตอนนี้ได้ทันที</p><Button variant="outline" onClick={() => setShowPreview(true)}>ดูตัวอย่างหน้าจอ</Button></section>}
        </div>
        <aside className="final-rights-aside"><section className="surface final-rights-guide"><p className="eyebrow">ขั้นตอนสั้น ๆ</p><h2>จาก Heat สู่ Final</h2><ol><li><span>01</span><div><strong>ตรวจสอบสิทธิ์</strong><small>ดูใบสมัครในบัญชี หรือค้นหาชื่อ</small></div></li><li><span>02</span><div><strong>ยืนยันตัวตน</strong><small>ผู้สมัครผ่านโรงเรียนใช้เลขโทรศัพท์ 4 ตัวท้าย</small></div></li><li><span>03</span><div><strong>สมัคร Final</strong><small>ตรวจข้อมูลเดิม ชำระเงิน และแนบสลิปใหม่</small></div></li></ol></section><div className="final-rights-help"><Icon name="info" size={18} /><p>ใบสมัคร Final เป็นใบสมัครใหม่ แยกจาก Heat และรอเจ้าหน้าที่ตรวจสลิปอีกครั้ง</p></div></aside>
      </div>
    </div>
  );
}

function PublicResultsPage({ resultRows = [] }) {
  const [query, setQuery] = useState("");
  const resultsTableRef = useRef(null);
  const publishedTargets = [...new Map(resultRows.map((row) => [row.targetId, {
    targetId: row.targetId,
    competitionId: row.competitionId,
    competitionTitle: row.competitionTitle,
    roundType: row.roundType,
    round: row.round,
    year: row.year,
    publishedAt: row.publishedAt,
  }])).values()].sort((left, right) => Date.parse(right.publishedAt || 0) - Date.parse(left.publishedAt || 0));
  const competitionKey = (target) => `${target.competitionId}::${target.year}`;
  const latestTarget = publishedTargets[0];
  const [selectedCompetition, setSelectedCompetition] = useState(() => latestTarget ? competitionKey(latestTarget) : "all");
  const [selectedRound, setSelectedRound] = useState(() => latestTarget?.roundType || "all");
  const [selectedGrade, setSelectedGrade] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 100;
  function changePage(nextPage) {
    setPage(nextPage);
    window.requestAnimationFrame(() => resultsTableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  const competitionOptions = [...new Map(publishedTargets.map((target) => [competitionKey(target), {
    key: competitionKey(target),
    title: target.competitionTitle,
    year: target.year,
  }])).values()];
  const targetMatchesCompetition = (target) => selectedCompetition === "all" || competitionKey(target) === selectedCompetition;
  const roundOptions = [...new Set(publishedTargets.filter(targetMatchesCompetition).map((target) => target.roundType))];
  const targetMatchesRound = (target) => selectedRound === "all" || target.roundType === selectedRound;
  const gradeOptions = [...new Set(resultRows.filter((row) => {
    const target = publishedTargets.find((item) => item.targetId === row.targetId);
    return target && targetMatchesCompetition(target) && targetMatchesRound(target);
  }).map((row) => row.grade).filter(Boolean))].sort((left, right) => left.localeCompare(right, "en"));
  const searchTerm = query.trim().toLowerCase();
  const results = resultRows.filter((row) => {
    const target = publishedTargets.find((item) => item.targetId === row.targetId);
    const matchesSearch = !searchTerm || (row.candidateName || row.candidate || "").toLowerCase().includes(searchTerm) || String(row.candidateNo || row.examNumber || "").toLowerCase().includes(searchTerm);
    return target && targetMatchesCompetition(target) && targetMatchesRound(target)
      && (selectedGrade === "all" || row.grade === selectedGrade) && matchesSearch;
  });
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const resultsOnPage = results.slice(pageStart, pageStart + pageSize);
  const rangeStart = results.length ? pageStart + 1 : 0;
  const rangeEnd = Math.min(pageStart + pageSize, results.length);
  const pageItems = totalPages <= 6
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : currentPage <= 4
      ? [1, 2, 3, 4, "ellipsis", totalPages]
      : currentPage >= totalPages - 3
        ? [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, "ellipsis", currentPage - 1, currentPage, currentPage + 1, "ellipsis", totalPages];
  const resultGroups = publishedTargets.filter((target) => targetMatchesCompetition(target) && targetMatchesRound(target))
    .map((target) => ({ target, rows: resultsOnPage.filter((row) => row.targetId === target.targetId) }))
    .filter((group) => group.rows.length);
  return (
    <div className="page-stack">
      <PageHeading eyebrow="ผลการคัดเลือก" title="ประกาศผลสอบ OCEC" description="ตรวจผลสอบทุกระดับรางวัล ค้นหาด้วยชื่อภาษาอังกฤษหรือ CANDIDATE NO และกรองรายการสอบ รอบสอบ และระดับชั้นได้" />
      {!publishedTargets.length ? (
        <section className="surface results-pending">
          <span className="results-pending-icon"><Icon name="clock" /></span>
          <h2>รอประกาศผลอย่างเป็นทางการ</h2>
          <p>เมื่อมีการประกาศผลรายการสอบแล้ว จะสามารถเลือกดูผลของแต่ละรายการและรอบได้จากหน้านี้</p>
          <span className="result-date"><Icon name="calendar" size={15} />ประกาศผลตามกำหนดการของแต่ละรายการ</span>
        </section>
      ) : (
        <>
          <section className="surface results-public-filter-card">
            <div className="results-public-filter-heading"><div><p className="eyebrow">ค้นหาผลสอบ</p><h2>เลือกตัวกรองที่ต้องการ</h2></div><span className="result-announced"><span />ประกาศแล้ว</span></div>
            {latestTarget ? <div className="latest-result-hint"><Icon name="clock" size={14} /><span>เริ่มจากผลที่ประกาศล่าสุด: <strong>{resultTargetLabel(latestTarget)}</strong> · เลือกรายการสอบหรือรอบอื่นเพื่อดูผลเพิ่มเติม</span></div> : null}
            <div className="results-public-filters">
              <label className="results-public-search"><span>ค้นหาชื่อภาษาอังกฤษหรือ CANDIDATE NO</span><div className="input-with-icon"><Icon name="search" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="เช่น Kanya Rattanasuk หรือ 6000012" /></div></label>
              <label><span>รายการสอบ</span><select value={selectedCompetition} onChange={(event) => { const value = event.target.value; setSelectedCompetition(value); const newestExamRound = value === "all" ? "all" : publishedTargets.find((target) => competitionKey(target) === value)?.roundType || "all"; setSelectedRound(newestExamRound); setSelectedGrade("all"); setPage(1); }}><option value="all">ทุกรายการสอบ</option>{competitionOptions.map((option) => <option key={option.key} value={option.key}>{option.title} · ปี {option.year}</option>)}</select></label>
              <label><span>รอบสอบ</span><select value={selectedRound} onChange={(event) => { setSelectedRound(event.target.value); setSelectedGrade("all"); setPage(1); }}><option value="all">ทุกรอบสอบ</option>{roundOptions.map((round) => <option key={round} value={round}>{EXAM_ROUND_LABELS[round] || round}</option>)}</select></label>
              <label><span>ระดับชั้น</span><select value={selectedGrade} onChange={(event) => { setSelectedGrade(event.target.value); setPage(1); }}><option value="all">ทุกระดับชั้น</option>{gradeOptions.map((grade) => <option key={grade} value={grade}>{grade}</option>)}</select></label>
            </div>
          </section>
          <section className="results-hero">
            <div><span className="result-announced"><span />ประกาศผลอย่างเป็นทางการ</span><h2>ผลสอบผู้เข้าสอบทั้งหมด</h2><p>แสดงทุกรางวัล · GOLD, SILVER และ BRONZE ผ่านรอบ HEAT ROUND</p></div>
            <div className="result-total"><strong>{results.length.toString().padStart(2, "0")}</strong><span>รายชื่อที่พบ</span></div>
          </section>
          <section className="surface results-table-card" ref={resultsTableRef}>
            <div className="results-public-table-heading"><div><strong>ผลการสอบ</strong><small>แสดง {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} จาก {results.length.toLocaleString()} รายชื่อ · สูงสุด {pageSize} รายการต่อหน้า</small></div></div>
            <div className="responsive-table"><table>
              <thead><tr><th>CANDIDATE NO</th><th>GRADE</th><th>SCHOOL NAME</th><th>CANDIDATE NAME</th><th>AWARD</th><th>ผลการสอบ / RESULT</th></tr></thead>
              {results.length ? resultGroups.map((group) => <tbody key={group.target.targetId}>
                <tr className="result-target-group-row"><th colSpan="6" scope="rowgroup">{resultTargetLabel(group.target)}</th></tr>
                {group.rows.map((item) => {
                  const resultStatus = getPublicResultStatus(item);
                  return <tr key={`${item.applicationId}-${item.targetId}`}>
                    <td><strong className="mono-number">{item.candidateNo || item.examNumber}</strong></td>
                    <td>{item.grade}</td>
                    <td>{item.schoolName || item.school}</td>
                    <td>{item.candidateName || item.candidate}</td>
                    <td><span className={`award-badge award-${String(item.award || "").toLowerCase().replaceAll(" ", "-")}`}>{item.award}</span></td>
                    <td><span className={`result-outcome result-outcome-${resultStatus.tone}`}>{resultStatus.tone === "eligible" ? <Icon name="check" size={12} /> : null}{resultStatus.label}</span></td>
                  </tr>;
                })}
              </tbody>) : <tbody><tr><td colSpan="6"><div className="results-empty-state"><span><Icon name="search" /></span><strong>ไม่พบผลสอบที่ตรงกับคำค้นหาหรือตัวกรอง</strong><small>ลองเปลี่ยนชื่อหรือเลขสอบ หรือเลือกตัวกรองเป็น “ทั้งหมด”</small><Button variant="text" onClick={() => { setQuery(""); setSelectedCompetition("all"); setSelectedRound("all"); setSelectedGrade("all"); setPage(1); }}>ล้างคำค้นและตัวกรอง</Button></div></td></tr></tbody>}
            </table></div>
            {results.length ? <div className="results-pagination"><span>หน้า {currentPage.toLocaleString()} จาก {totalPages.toLocaleString()}</span>{totalPages > 1 ? <nav aria-label="แบ่งหน้าผลสอบ"><button type="button" className="pagination-step" aria-label="หน้าก่อนหน้า" disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>ก่อนหน้า</button>{pageItems.map((item, index) => item === "ellipsis" ? <span className="pagination-ellipsis" key={`ellipsis-${index}`} aria-hidden="true">…</span> : <button type="button" key={item} className={`pagination-page${currentPage === item ? " is-active" : ""}`} aria-label={`หน้า ${item}`} aria-current={currentPage === item ? "page" : undefined} onClick={() => changePage(item)}>{item}</button>)}<button type="button" className="pagination-step" aria-label="หน้าถัดไป" disabled={currentPage >= totalPages} onClick={() => changePage(currentPage + 1)}>ถัดไป</button></nav> : null}</div> : null}
            <div className="table-footnote"><Icon name="info" size={15} />ผู้ได้ GOLD, SILVER หรือ BRONZE สามารถเริ่มยืนยันสิทธิ์ Final ได้เมื่อมีการประกาศผล HEAT แล้ว</div>
          </section>
        </>
      )}
    </div>
  );
}

function ApplicationFormPage({ kind, prefill, applicationMode, allowedRoundIds, onSubmit, navigate, competitionFees, examCatalog, centerCatalog, pastPaperCatalog }) {
  const isFinal = kind === "Final";
  const examRoundType = isFinal ? "FINAL" : "HEAT";
  const examYear = isFinal && prefill?.year ? prefill.year : getActiveExamYear(examCatalog, examRoundType);
  // Final applications are reached only through a verified Heat result; show the matching Final rounds
  // after that gate even when the public registration card is still marked closed.
  const catalogCompetitions = getFormCompetitions(examCatalog, examRoundType, { openOnly: !isFinal, year: examYear });
  const allowedFinalRounds = Array.isArray(allowedRoundIds) ? new Set(allowedRoundIds) : null;
  const openCompetitions = isFinal
    ? catalogCompetitions.filter((competition) => {
      const finalRound = examCatalog.find((exam) => exam.competitionId === competition.id && exam.year === examYear && getExamRoundType(exam) === "FINAL");
      return finalRound && isFinalConfirmationWindowOpen(finalRound) && (!allowedFinalRounds || allowedFinalRounds.has(finalRound.id));
    })
    : catalogCompetitions;
  const competitions = isFinal && prefill?.competitions?.length
    ? openCompetitions.filter((competition) => prefill.competitions.some((selected) => selected.id === competition.id))
    : openCompetitions;
  const pastPaperGroups = groupPastPaperCatalog(pastPaperCatalog);
  const centers = [...new Set([...FORM_CENTERS, ...(centerCatalog || []).map((center) => center.name)])];
  const schools = FORM_SCHOOLS;
  const [applicationSource, setApplicationSource] = useState("self");
  const [schoolBatch, setSchoolBatch] = useState(() => {
    const firstApplicant = createSchoolApplicant("school-applicant-1", prefill);
    return { applicants: [firstApplicant], activeId: firstApplicant.id, confirmDetails: false, marketingConsent: false };
  });
  const [form, setForm] = useState(() => ({
    source: applicationMode === "guest" ? "guest" : "self",
    firstName: prefill?.studentInformation?.firstName || prefill?.candidate?.split(" ")[0] || "",
    lastName: prefill?.studentInformation?.lastName || prefill?.candidate?.split(" ").slice(1).join(" ") || "",
    thaiFirstName: prefill?.studentInformation?.thaiFirstName || "",
    thaiLastName: prefill?.studentInformation?.thaiLastName || "",
    gender: prefill?.studentInformation?.gender || "",
    dateOfBirth: prefill?.studentInformation?.dateOfBirth || "",
    schoolName: prefill?.school && FORM_SCHOOLS.includes(prefill.school) ? prefill.school : prefill?.school ? "Other" : "",
    certificateSchoolName: prefill?.studentInformation?.certificateSchoolName || (prefill?.school && !FORM_SCHOOLS.includes(prefill.school) ? prefill.school : ""),
    email: prefill?.studentInformation?.email || prefill?.contactEmail || "",
    address1: prefill?.studentInformation?.address1 || "",
    address2: prefill?.studentInformation?.address2 || "",
    city: prefill?.studentInformation?.city || "",
    province: prefill?.studentInformation?.province || "",
    postalCode: prefill?.studentInformation?.postalCode || "",
    phone: prefill?.studentInformation?.phone || "",
    competitionIds: isFinal ? (prefill?.competitions || []).map((competition) => competition.id) : [],
    grades: isFinal ? Object.fromEntries((prefill?.competitions || []).map((competition) => [competition.id, competition.grade])) : {},
    format: prefill?.format === "Online Exam" ? "Online" : "Paper-Based",
    center: prefill?.center && prefill.center !== "Online Exam" ? prefill.center : "",
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
  const priceForCompetition = (competition, format = form.format) => getCompetitionExamPrice(examCatalog, competition.id, examRoundType, format, competitionFees, examYear);
  const registrationFee = selectedCompetitions.reduce((sum, competition) => sum + priceForCompetition(competition), 0);
  const paperBasedFee = selectedCompetitions.reduce((sum, competition) => sum + priceForCompetition(competition, "Paper-Based"), 0);
  const onlineExamFee = selectedCompetitions.reduce((sum, competition) => sum + priceForCompetition(competition, "Online"), 0);
  const scheduleExam = (examCatalog || []).find((exam) => exam.year === examYear && getExamRoundType(exam) === examRoundType);
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
    onSubmit({ ...form, kind, examYear, candidate, school, contactEmail: form.email, grade: selectedCompetitions.map((competition) => `${competition.short}: ${form.grades[competition.id]}`).join(" · "), center: form.format === "Online" ? "Online Exam" : form.center, examListings: selectedCompetitions, pastPaperSelections: allPastPapers.filter((paper) => form.pastPaperIds.includes(paper.id)), pastPapersTotal, registrationFee, totalPayment, fileName, sourceHeatId: prefill?.id || "" });
  }
  if (!isFinal && applicationSource === "school") {
    return <SchoolBatchForm kind={kind} prefill={prefill} batch={schoolBatch} setBatch={setSchoolBatch} onSubmit={onSubmit} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} examYear={examYear} centerCatalog={centerCatalog} pastPaperCatalog={pastPaperCatalog} onBack={() => { setApplicationSource("self"); update("source", "self"); }} />;
  }
  return (
    <div className="page-stack">
      <PageHeading
        eyebrow={isFinal ? `OCEC Final ${examYear}` : `เปิดรับสมัคร · ปีการศึกษา ${examYear}`}
        title={isFinal ? "สมัครสอบ Final" : "สมัครสอบ OCEC"}
        description={isFinal ? "ตรวจสอบข้อมูลและกรอกข้อมูลผู้เข้าสอบ รายการสอบ และการชำระเงินให้ครบในฟอร์มเดียว" : "เลือกรายการที่เปิดรับสมัครและเลือกระดับชั้นแยกกันได้ในฟอร์มเดียว"}
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
            <div className="notice notice-blue"><Icon name="info" /><div><strong>ข้อมูลจากใบสมัคร Heat · เลขสอบ {prefill?.heatId}</strong><p>ตรวจสอบข้อมูลที่เติมให้แล้ว และกรอกช่องที่ยังว่างก่อนส่งใบสมัคร Final ใบใหม่</p></div></div>
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
                  <label className="competition-select"><input type="checkbox" checked={selected} onChange={() => toggleCompetition(competition.id)} /><span className="competition-check-mark" aria-hidden="true" /><span><strong>{competition.name}</strong><small>{competition.subject}</small></span><span className="competition-fee">฿{priceForCompetition(competition).toLocaleString()}<small> / รายการ</small></span></label>
                  {selected ? <Field label={`ระดับชั้น ${competition.short}`} required className="competition-grade"><select value={form.grades[competition.id] || ""} onChange={(event) => { setForm((current) => ({ ...current, grades: { ...current.grades, [competition.id]: event.target.value } })); setSelectionError(""); }} required><option value="">เลือกระดับชั้น</option>{form.grades[competition.id] && !competition.grades.includes(form.grades[competition.id]) ? <option value={form.grades[competition.id]}>{form.grades[competition.id]} (จาก Heat)</option> : null}{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}</select></Field> : null}
                </article>;
              })}
              {!competitions.length ? <div className="empty-inline"><Icon name="calendar" /><span>ขณะนี้ยังไม่มีรายการสอบรอบนี้ที่เปิดรับสมัคร</span></div> : null}
            </div>
            <div className="schedule-note"><Icon name="calendar" size={16} /><div><strong>{isFinal ? "การสมัครรอบ Final" : "กำหนดการรอบสอบ"}</strong><span>{isFinal ? "ใบสมัคร Final แยกจาก Heat และต้องแนบสลิปชำระเงินใหม่" : `ปิดรับสมัคร ${formatThaiDate(scheduleExam?.closeDate)} · วันสอบ ${formatThaiDate(scheduleExam?.examDate)}`}</span><small>{isFinal ? "ตรวจรายการสอบและระดับชั้นจาก Heat ก่อนส่งใบสมัคร" : scheduleExam?.description || "ตรวจสอบวันสอบและรายละเอียดของรอบที่เลือก"}</small></div></div>
            {selectionError ? <p className="inline-error selection-error" role="alert"><Icon name="info" size={16} />{selectionError}</p> : null}
          </section>
          <section className="form-zone" aria-labelledby="zone-mode">
            <div className="form-progress"><span className="form-progress-number">03</span><div><strong id="zone-mode">Exam Mode and Exam Center <span>/ รูปแบบและศูนย์สอบ</span></strong><small>ค่าธรรมเนียมคิดแยกตามจำนวนรายการสอบ</small></div></div>
            <fieldset className="mode-fieldset"><legend className="field-title">เลือกรูปแบบการสอบ <span className="required-mark">*</span></legend><div className="mode-options">
              <label className={form.format === "Paper-Based" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name="exam-mode" checked={form.format === "Paper-Based"} onChange={() => { update("format", "Paper-Based"); update("center", ""); }} /><span><strong>Paper-Based</strong><small>สอบที่ศูนย์สอบ</small></span><b>{selectedCompetitions.length ? `฿${paperBasedFee.toLocaleString()}` : "เลือกวิชาก่อน"} <small>{selectedCompetitions.length ? `/ ${selectedCompetitions.length} รายการ` : ""}</small></b></label>
              <label className={form.format === "Online" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name="exam-mode" checked={form.format === "Online"} onChange={() => { update("format", "Online"); update("center", ""); }} /><span><strong>Online Exam</strong><small>สอบออนไลน์</small></span><b>{selectedCompetitions.length ? `฿${onlineExamFee.toLocaleString()}` : "เลือกวิชาก่อน"} <small>{selectedCompetitions.length ? `/ ${selectedCompetitions.length} รายการ` : ""}</small></b></label>
            </div></fieldset>
            {form.format === "Paper-Based" ? <Field label="Exam Center / ศูนย์สอบ" required hint="เลือกจังหวัด/ศูนย์สอบที่สะดวก"><select value={form.center} onChange={(event) => { update("center", event.target.value); setPaymentError(""); }} required><option value="">เลือกศูนย์สอบ</option>{form.center && !centers.includes(form.center) ? <option value={form.center}>{form.center} (จาก Heat)</option> : null}{centers.map((center) => <option key={center}>{center}</option>)}</select></Field> : <div className="online-device-note"><Icon name="monitor" /><div><strong>อุปกรณ์สำหรับสอบออนไลน์</strong><span>ใช้คอมพิวเตอร์หรือแล็ปท็อปสำหรับทำข้อสอบ และใช้สมาร์ตโฟนหรือแท็บเล็ตสำหรับ Zoom/กล้อง</span></div></div>}
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

function SchoolBatchForm({ kind, prefill, batch, setBatch, onSubmit, navigate, onBack, competitionFees, examCatalog, examYear, centerCatalog, pastPaperCatalog }) {
  const [formError, setFormError] = useState("");
  const [errorSection, setErrorSection] = useState("");
  const activeExamYear = examYear || getActiveExamYear(examCatalog, "HEAT");
  const competitions = getFormCompetitions(examCatalog, "HEAT", { openOnly: true, year: activeExamYear });
  const pastPaperGroups = groupPastPaperCatalog(pastPaperCatalog);
  const allPastPapers = pastPaperGroups.flatMap((group) => group.items);
  const centers = [...new Set([...FORM_CENTERS, ...(centerCatalog || []).map((center) => center.name)])];
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
    const registrationFee = selectedCompetitions.reduce((sum, competition) => sum + getCompetitionExamPrice(examCatalog, competition.id, "HEAT", applicant.format, competitionFees, activeExamYear), 0);
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
        examYear: activeExamYear,
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
                <label className="competition-select"><input type="checkbox" checked={selected} onChange={() => toggleCompetition(competition.id)} /><span className="competition-check-mark" aria-hidden="true" /><span><strong>{competition.name}</strong><small>{competition.subject}</small></span><span className="competition-fee">฿{getCompetitionExamPrice(examCatalog, competition.id, "HEAT", activeApplicant.format, competitionFees, activeExamYear).toLocaleString()}<small> / รายการ</small></span></label>
                {selected ? <Field label={`ระดับชั้น ${competition.short}`} required className="competition-grade"><select value={activeApplicant.grades[competition.id] || ""} onChange={(event) => updateApplicant(activeApplicant.id, "grades", { ...activeApplicant.grades, [competition.id]: event.target.value })}><option value="">เลือกระดับชั้น</option>{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}</select></Field> : null}
              </article>;
            })}{!competitions.length ? <div className="empty-inline"><Icon name="calendar" /><span>ขณะนี้ยังไม่มีรายการสอบรอบ HEAT ที่เปิดรับสมัคร</span></div> : null}</div>
            <div className="schedule-note"><Icon name="calendar" size={16} /><div><strong>กำหนดการรอบสอบ</strong><span>ปิดรับสมัคร 30 พ.ย. 2569 · วันสอบ 13 ธ.ค. 2569</span><small>HKICO 08:30–09:30 · HKISO 09:45–10:45 · Big Bay Bei 11:15–12:30</small></div></div>
          </section>

          <section className="form-zone" aria-labelledby={`school-zone-mode-${activeApplicant.id}`}>
            <div className="form-progress"><span className="form-progress-number">03</span><div><strong id={`school-zone-mode-${activeApplicant.id}`}>Exam Mode and Exam Center <span>/ รูปแบบและศูนย์สอบ</span></strong><small>เลือกให้ผู้เข้าสอบแต่ละคนได้อิสระ</small></div></div>
            <fieldset className="mode-fieldset"><legend className="field-title">เลือกรูปแบบการสอบ <span className="required-mark">*</span></legend><div className="mode-options">
              <label className={activeApplicant.format === "Paper-Based" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name={`exam-mode-${activeApplicant.id}`} checked={activeApplicant.format === "Paper-Based"} onChange={() => { setBatch((current) => ({ ...current, applicants: current.applicants.map((applicant) => applicant.id === activeApplicant.id ? { ...applicant, format: "Paper-Based", center: "" } : applicant) })); setFormError(""); setErrorSection(""); }} /><span><strong>Paper-Based</strong><small>สอบที่ศูนย์สอบ</small></span><b>{activeTotals.selectedCompetitions.length ? `฿${activeTotals.selectedCompetitions.reduce((sum, competition) => sum + getCompetitionExamPrice(examCatalog, competition.id, "HEAT", "Paper-Based", competitionFees, activeExamYear), 0).toLocaleString()}` : "เลือกวิชาก่อน"} <small>{activeTotals.selectedCompetitions.length ? `/ ${activeTotals.selectedCompetitions.length} รายการ` : ""}</small></b></label>
              <label className={activeApplicant.format === "Online" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name={`exam-mode-${activeApplicant.id}`} checked={activeApplicant.format === "Online"} onChange={() => { setBatch((current) => ({ ...current, applicants: current.applicants.map((applicant) => applicant.id === activeApplicant.id ? { ...applicant, format: "Online", center: "" } : applicant) })); setFormError(""); setErrorSection(""); }} /><span><strong>Online Exam</strong><small>สอบออนไลน์</small></span><b>{activeTotals.selectedCompetitions.length ? `฿${activeTotals.selectedCompetitions.reduce((sum, competition) => sum + getCompetitionExamPrice(examCatalog, competition.id, "HEAT", "Online", competitionFees, activeExamYear), 0).toLocaleString()}` : "เลือกวิชาก่อน"} <small>{activeTotals.selectedCompetitions.length ? `/ ${activeTotals.selectedCompetitions.length} รายการ` : ""}</small></b></label>
            </div></fieldset>
            {activeApplicant.format === "Paper-Based" ? <Field label="Exam Center / ศูนย์สอบ" required hint="เลือกจังหวัด/ศูนย์สอบที่สะดวก"><select value={activeApplicant.center} onChange={(event) => updateApplicant(activeApplicant.id, "center", event.target.value)}><option value="">เลือกศูนย์สอบ</option>{centers.map((center) => <option key={center}>{center}</option>)}</select></Field> : <div className="online-device-note"><Icon name="monitor" /><div><strong>อุปกรณ์สำหรับสอบออนไลน์</strong><span>ใช้คอมพิวเตอร์หรือแล็ปท็อปสำหรับทำข้อสอบ และใช้สมาร์ตโฟนหรือแท็บเล็ตสำหรับ Zoom/กล้อง</span></div></div>}
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

function AdminHomePage({ applications, examCatalog, resultWorkflows, navigate, resultPublished, syncFailed }) {
  const pendingApps = applications.filter((item) => item.status === "pending");
  const confirmedApps = applications.filter((item) => item.status === "confirmed");
  const heatApps = applications.filter((item) => item.kind === "Heat");
  const finalApps = applications.filter((item) => item.kind === "Final");
  const issueApps = applications.filter((item) => item.slipIssue);
  const resultIssueCount = Object.values(resultWorkflows || {}).reduce((count, workflow) => count + ((workflow.rows || []).filter((row) => row.matchStatus !== "matched").length || Number(workflow.hasConflict && !workflow.conflictResolved)), 0);
  const finalIdsWaiting = finalApps.filter((item) => !item.finalId).length;
  const openRounds = examCatalog.filter((item) => item.isOpen);
  const paperlessCount = applications.filter((item) => item.format === "Online Exam").length;
  const competitionCounts = applications.reduce((counts, item) => {
    (item.competitions || []).forEach((competition) => { counts[competition.short || competition.name] = (counts[competition.short || competition.name] || 0) + 1; });
    return counts;
  }, {});
  const tasks = [
    { id: "admin-review", icon: "file", tone: "amber", title: "คิวตรวจสลิป", detail: `${pendingApps.length} ใบสมัคร · เปิดคิวเพื่อตรวจและยืนยัน`, count: pendingApps.length },
    { id: "admin-results", icon: "info", tone: "violet", title: "รายการผลสอบที่ต้องตรวจ", detail: resultIssueCount ? `${resultIssueCount} รายการจากฉบับร่าง · กดเพื่อตรวจสอบก่อนประกาศ` : "ยังไม่มีรายการจากผลสอบที่ต้องตรวจ", count: resultIssueCount },
    { id: "admin-results", icon: "award", tone: "violet", title: resultPublished ? "ดูผลสอบที่ประกาศแล้ว" : "เตรียมผลสอบ", detail: resultPublished ? "ประกาศแล้ว · ข้อมูลผลสอบล็อก" : "เลือกรายการและรอบ นำเข้าฉบับร่างเพื่อตรวจสอบ", count: resultPublished ? 0 : 1 },
    { id: "admin-final-ids", icon: "users", tone: "blue", title: "นำเข้าเลขประจำตัว Final", detail: `${finalIdsWaiting} รายการยังไม่มีเลข`, count: finalIdsWaiting },
    { id: "admin-sheets", icon: "sync", tone: syncFailed ? "amber" : "blue", title: "รายการซิงก์ชีต", detail: syncFailed ? "มีรายการรอซิงก์ · ระบบกำลังลองใหม่" : "สถานะตัวอย่างปกติ · ไม่มีรายการค้าง", count: syncFailed ? 1 : 0 },
  ];
  const byYear = Object.values(examCatalog.reduce((groups, item) => {
    groups[item.year] ||= { year: item.year, total: 0, open: 0 };
    groups[item.year].total += 1;
    groups[item.year].open += item.isOpen ? 1 : 0;
    return groups;
  }, {}));
  const totalDue = pendingApps.reduce((sum, item) => sum + (item.totalPayment || 0), 0);

  return (
    <div className="page-stack admin-home-page">
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
            <button key={task.title} onClick={() => navigate(task.id, task.targetId)}><span className={`task-icon task-${task.tone}`}><Icon name={task.icon} /></span><span><strong>{task.title}</strong><small>{task.detail}</small></span><span className="task-count">{String(task.count).padStart(2, "0")}</span></button>
          ))}</div> : <div className="admin-clear-state"><span><Icon name="check" /></span><div><strong>ไม่มีงานค้าง</strong><small>คิวตรวจสอบและงานหลังสอบเรียบร้อยแล้ว</small></div></div>}
        </section>
        <section className="surface round-status-card">
          <div className="section-heading"><div><p className="eyebrow">รายการสอบ</p><h2>สถานะรับสมัคร</h2></div><span className={openRounds.length ? "schedule-open" : "closed-badge"}>{openRounds.length ? `เปิด ${openRounds.length} รายการ` : "ปิดรับสมัคร"}</span></div>
          <div className="admin-round-summary-list">{byYear.map((group) => <div className="admin-round-summary" key={group.year}><div><strong>รายการสอบปี {group.year}</strong><small>{group.open} รอบเปิดรับ · รวม {group.total} การ์ด</small></div><span>{group.open ? <i className="online-dot" /> : <i className="offline-dot" />}{group.open ? "เปิด" : "รอเปิด"}</span></div>)}</div>
          <div className="round-status-rows"><div><span><Icon name="users" />ใบสมัครออนไลน์</span><strong>{paperlessCount} รายการ</strong></div><div><span><Icon name="grid" />ผลสอบ Heat</span><strong>{resultPublished ? "ประกาศแล้ว" : "รอเตรียมฉบับร่าง"}</strong></div><div><span><Icon name="building" />ศูนย์สอบ</span><strong>{examCatalog.some((item) => item.isOpen) ? "ล็อกตามรอบที่เปิด" : "แก้ไขได้"}</strong></div></div>
          <Button variant="outline" className="button-full" onClick={() => navigate("admin-round")}>ตั้งค่ารอบสอบและศูนย์</Button>
        </section>
      </div>
      <section className="surface admin-exception-queue"><div className="section-heading"><div><p className="eyebrow">ต้องติดตามเป็นพิเศษ</p><h2>คิวปัญหาใบสมัคร</h2></div><span className="conflict-count">{issueApps.length} รายการ</span></div>{issueApps.length ? <div className="admin-exception-list">{issueApps.map((item) => <button type="button" className="admin-exception-row" key={item.id} onClick={() => navigate("admin-review", item.id)}><span className="task-icon task-amber"><Icon name="file" /></span><span><strong>{item.candidate}</strong><small>{item.exam} · {item.school}</small><em>{item.slipIssue}</em></span><span>เปิดใบสมัคร <Icon name="arrow" size={14} /></span></button>)}</div> : <div className="admin-clear-state"><span><Icon name="check" /></span><div><strong>ไม่มีใบสมัครที่มีปัญหา</strong><small>ความผิดปกติของชื่อโรงเรียนในไฟล์ผลสอบจะแสดงในหน้านำเข้าผลสอบ</small></div></div>}</section>
      <section className="surface admin-competition-summary"><div><p className="eyebrow">ภาพรวมตามรายการสอบ</p><h2>รายการที่ผู้สมัครเลือก</h2><p>นับรายการแข่งขันที่เลือกในใบสมัครตัวอย่าง</p></div><div className="admin-competition-chips">{Object.entries(competitionCounts).map(([name, count]) => <span key={name}><strong>{count}</strong>{name}</span>)}</div><span className="admin-data-note"><Icon name="info" size={14} />ข้อมูล mock · ใช้ทดลองหน้าจอเท่านั้น</span></section>
      <section className={`surface sync-banner ${syncFailed ? "sync-banner-failed" : ""}`}><span className="sync-banner-icon"><Icon name={syncFailed ? "clock" : "sync"} /></span><div><strong>{syncFailed ? "กำลังรอซิงก์ข้อมูล" : "สถานะซิงก์ตัวอย่าง: ปกติ"}</strong><p>{syncFailed ? "ระบบจะลองใหม่อัตโนมัติทุก 2–3 นาที · ดูสถานะรายการได้ในหน้าซิงก์" : `${confirmedApps.length} ใบสมัครที่อนุมัติแล้ว · เชื่อมต่อจริงยังไม่เปิดใช้งาน`}</p></div><Button variant="text" onClick={() => navigate("admin-sheets")}>ดูสถานะ</Button></section>
    </div>
  );
}

function AdminMockPapersPage({ applications, notify }) {
  const [tab, setTab] = useState("mock");
  const [search, setSearch] = useState("");
  const [examFilter, setExamFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [paperFilter, setPaperFilter] = useState("all");
  const fmtMoney = (value) => `฿${Number(value || 0).toLocaleString()}`;
  const examOptions = [...new Set(applications.map((item) => item.exam).filter(Boolean))];
  const years = [...new Set(applications.map((item) => item.year).filter(Boolean))].sort((a, b) => b.localeCompare(a));
  const schools = [...new Set(applications.map((item) => item.school).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const grades = [...new Set(applications.map((item) => item.grade).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const paperNames = [...new Set(applications.flatMap((item) => (item.pastPapers || []).map((paper) => paper.name)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const applicantRows = applications.filter((item) => {
    const query = search.trim().toLowerCase();
    const competitions = (item.competitions || []).map((competition) => `${competition.short || ""} ${competition.name || ""}`).join(" ");
    return (!query || [item.candidate, item.school, item.exam, item.grade, competitions].filter(Boolean).some((value) => value.toLowerCase().includes(query)))
      && (examFilter === "all" || item.exam === examFilter)
      && (yearFilter === "all" || item.year === yearFilter)
      && (schoolFilter === "all" || item.school === schoolFilter)
      && (gradeFilter === "all" || item.grade === gradeFilter);
  });
  const paperRows = applications.flatMap((application) => (application.pastPapers || []).map((paper) => ({ application, paper, quantity: 1 }))).filter(({ application, paper }) => {
    const query = search.trim().toLowerCase();
    return (!query || [application.candidate, application.school, application.exam, paper.name].filter(Boolean).some((value) => value.toLowerCase().includes(query)))
      && (examFilter === "all" || application.exam === examFilter)
      && (yearFilter === "all" || application.year === yearFilter)
      && (schoolFilter === "all" || application.school === schoolFilter)
      && (paperFilter === "all" || paper.name === paperFilter);
  });
  const totalPaperSets = paperRows.reduce((sum, row) => sum + row.quantity, 0);
  const breakdown = tab === "mock"
    ? Object.entries(applicantRows.reduce((counts, item) => { counts[item.exam] = (counts[item.exam] || 0) + 1; return counts; }, {}))
    : Object.entries(paperRows.reduce((counts, row) => { counts[row.paper.name] = (counts[row.paper.name] || 0) + row.quantity; return counts; }, {}));
  const paperGroupsByExamYear = Object.values(paperRows.reduce((groups, row) => {
    const key = `${row.application.exam}|${row.application.year}`;
    groups[key] ||= { exam: row.application.exam, year: row.application.year, sets: 0, total: 0 };
    groups[key].sets += row.quantity;
    groups[key].total += Number(row.paper.fee || 0);
    return groups;
  }, {}));
  const filterReset = () => { setSearch(""); setExamFilter("all"); setYearFilter("all"); setSchoolFilter("all"); setGradeFilter("all"); setPaperFilter("all"); };

  return (
    <div className="page-stack admin-mock-page">
      <PageHeading eyebrow="ข้อมูลจำลอง · ไม่มีการเชื่อมต่อภายนอก" title="Mock และข้อสอบเก่า" description="ดูรายชื่อผู้สมัครและรายการข้อสอบเก่าที่เลือกซื้อ เพื่อเตรียมข้อมูลก่อนส่ง Mock หรือจัดส่งเอกสาร" action={<Button icon="download" onClick={() => notify("ตัวอย่างส่งออก Excel · ไม่มีการสร้างหรือดาวน์โหลดไฟล์จริง")}>ส่งออก Excel</Button>} />
      <div className="admin-mock-stat-grid">
        <article className="admin-mock-stat"><span className="admin-mock-stat-icon mock-icon-violet"><Icon name="users" /></span><div><small>ผู้สมัครทั้งหมด</small><strong>{applications.length}</strong><span>รวม Heat และ Final</span></div></article>
        <article className="admin-mock-stat"><span className="admin-mock-stat-icon mock-icon-pink"><Icon name="building" /></span><div><small>สมัครผ่านโรงเรียน</small><strong>{applications.filter((item) => item.source === "school").length}</strong><span>ใบสมัครรายบุคคล</span></div></article>
        <article className="admin-mock-stat"><span className="admin-mock-stat-icon mock-icon-gold"><Icon name="book" /></span><div><small>ชุดข้อสอบเก่าที่เลือก</small><strong>{applications.reduce((sum, item) => sum + (item.pastPapers || []).length, 0)}</strong><span>นับเป็น 1 ชุดต่อรายการที่เลือก</span></div></article>
      </div>
      <section className="surface admin-mock-workspace">
        <div className="admin-mock-tabs" role="tablist" aria-label="ประเภทข้อมูล">
          <button type="button" role="tab" aria-selected={tab === "mock"} className={tab === "mock" ? "admin-mock-tab active" : "admin-mock-tab"} onClick={() => { setTab("mock"); filterReset(); }}><Icon name="users" size={17} />รายชื่อส่ง Mock <span>{applications.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === "papers"} className={tab === "papers" ? "admin-mock-tab active" : "admin-mock-tab"} onClick={() => { setTab("papers"); filterReset(); }}><Icon name="book" size={17} />รายการซื้อข้อสอบเก่า <span>{applications.reduce((sum, item) => sum + (item.pastPapers || []).length, 0)}</span></button>
        </div>
        <div className="admin-mock-toolbar"><div><p className="eyebrow">{tab === "mock" ? "รายชื่อผู้สมัคร" : "รายการจัดส่งข้อสอบเก่า"}</p><h2>{tab === "mock" ? `พบ ${applicantRows.length} ผู้สมัคร` : `พบ ${totalPaperSets} ชุด`}</h2><small>{tab === "mock" ? "ใช้ค้นหาและกรองข้อมูลเพื่อเตรียมรายชื่อส่ง Mock" : "แต่ละแถวคือข้อสอบเก่าหนึ่งชุดที่ผู้สมัครเลือกไว้"}</small></div><label className="admin-mock-search"><Icon name="search" size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={tab === "mock" ? "ค้นหาชื่อ โรงเรียน หรือรายการสอบ" : "ค้นหาชื่อ โรงเรียน หรือข้อสอบเก่า"} /></label></div>
        <div className="admin-mock-filters">
          <label><span>รายการสอบ</span><select value={examFilter} onChange={(event) => setExamFilter(event.target.value)}><option value="all">ทุกรายการสอบ</option>{examOptions.map((exam) => <option key={exam}>{exam}</option>)}</select></label>
          <label><span>ปีการศึกษา</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">ทุกปี</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
          <label><span>โรงเรียน</span><select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}><option value="all">ทุกโรงเรียน</option>{schools.map((school) => <option key={school}>{school}</option>)}</select></label>
          {tab === "mock" ? <label><span>ระดับชั้น</span><select value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}><option value="all">ทุกระดับชั้น</option>{grades.map((grade) => <option key={grade}>{grade}</option>)}</select></label> : <label><span>ชื่อข้อสอบเก่า</span><select value={paperFilter} onChange={(event) => setPaperFilter(event.target.value)}><option value="all">ทุกรายการ</option>{paperNames.map((paper) => <option key={paper}>{paper}</option>)}</select></label>}
          <button type="button" className="admin-mock-reset" onClick={filterReset}>ล้างตัวกรอง</button>
        </div>
        {breakdown.length ? <div className="admin-mock-breakdown"><span>{tab === "mock" ? "จำนวนผู้สมัครตามรายการสอบ" : "จำนวนชุดตามชื่อข้อสอบ"}</span><div>{breakdown.map(([name, count]) => <span className="admin-mock-breakdown-chip" key={name}><strong>{count}</strong>{name}</span>)}</div></div> : null}
        {tab === "papers" ? <div className="admin-mock-breakdown admin-mock-exam-year-breakdown"><span>สรุปข้อสอบเก่าตามรายการสอบและปี</span><div>{paperGroupsByExamYear.length ? paperGroupsByExamYear.map((group) => <span className="admin-mock-breakdown-chip" key={`${group.exam}-${group.year}`}><strong>{group.sets} ชุด</strong>{group.exam} · {group.year} · ฿{group.total.toLocaleString()}</span>) : <small>ไม่มีรายการซื้อข้อสอบเก่าตามตัวกรอง</small>}</div></div> : null}
        {tab === "mock" ? (
          <div className="admin-mock-table-wrap"><table className="admin-mock-table"><thead><tr><th>ผู้สมัคร</th><th>โรงเรียน</th><th>รายการสอบ</th><th>ระดับชั้น</th><th>รูปแบบสอบ</th><th>ปี</th><th>สถานะ</th></tr></thead><tbody>{applicantRows.map((item) => <tr key={item.id}><td><strong>{item.candidate}</strong><small>{item.contactEmail}</small></td><td>{item.school}</td><td><strong>{item.exam}</strong><small>{(item.competitions || []).map((competition) => competition.short || competition.name).join(" : ") || "ไม่ระบุ"}</small></td><td>{item.grade || "—"}</td><td>{item.format === "On-site" ? "Paper-Based" : item.format}</td><td>{item.year}</td><td><StatusBadge status={item.status} /></td></tr>)}{applicantRows.length === 0 ? <tr><td colSpan="7"><div className="admin-mock-empty"><Icon name="search" /><strong>ไม่พบรายชื่อที่ตรงกับตัวกรอง</strong><span>ลองเปลี่ยนคำค้นหรือกดล้างตัวกรอง</span></div></td></tr> : null}</tbody></table></div>
        ) : (
          <div className="admin-mock-table-wrap"><table className="admin-mock-table"><thead><tr><th>ผู้สมัคร</th><th>โรงเรียน</th><th>รายการสอบ</th><th>ข้อสอบเก่าที่เลือก</th><th>จำนวน</th><th>ราคา</th><th>ปี</th></tr></thead><tbody>{paperRows.map(({ application, paper }, index) => <tr key={`${application.id}-${paper.id}-${index}`}><td><strong>{application.candidate}</strong><small>{application.contactEmail}</small></td><td>{application.school}</td><td>{application.exam}</td><td><strong>{paper.name}</strong><small>{paper.detail || "ข้อสอบเก่าสำหรับผู้สมัคร"}</small></td><td><span className="admin-mock-quantity">1 ชุด</span></td><td>{fmtMoney(paper.fee)}</td><td>{application.year}</td></tr>)}{paperRows.length === 0 ? <tr><td colSpan="7"><div className="admin-mock-empty"><Icon name="book" /><strong>ไม่มีรายการข้อสอบเก่าที่ตรงกับตัวกรอง</strong><span>ลองเปลี่ยนคำค้นหรือกดล้างตัวกรอง</span></div></td></tr> : null}</tbody></table></div>
        )}
        <div className="admin-mock-footer"><span><Icon name="info" size={15} />ข้อมูล mock สำหรับต้นแบบเท่านั้น · ไม่มีการส่งหรือดาวน์โหลดไฟล์จริง</span><Button variant="outline" icon="download" onClick={() => notify("ตัวอย่างส่งออก Excel · ไม่มีการสร้างหรือดาวน์โหลดไฟล์จริง")}>ส่งออก Excel</Button></div>
      </section>
    </div>
  );
}

function getAdminReviewExamLabel(item) {
  const competitionNames = (item.competitions || []).map((competition) => competition.short || competition.name).filter(Boolean);
  const examName = competitionNames.join(" : ") || item.exam || "รายการสอบ";
  const kind = String(item.kind || "").trim().toUpperCase();
  const round = kind ? (kind.includes("ROUND") ? kind : `${kind} ROUND`) : "ไม่ระบุรอบ";
  const format = item.format === "On-site" || item.format === "Paper-Based"
    ? "Paper-Based"
    : item.format === "Online" || item.format === "Online Exam"
      ? "Online Exam"
      : item.format || "ไม่ระบุรูปแบบ";

  return `${examName} ${round} · ${format}`;
}

function AdminReviewPage({ applications, onApprove, onSlipIssue, notify, navigate, activeApplicationId }) {
  const pendingApps = applications.filter((item) => item.status === "pending");
  const [selectedId, setSelectedId] = useState(activeApplicationId || pendingApps[0]?.id || applications[0]?.id || "");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(activeApplicationId ? "all" : "pending");
  const [kindFilter, setKindFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [reviewView, setReviewView] = useState(activeApplicationId ? "all" : "school-groups");
  const [selectedGroupKey, setSelectedGroupKey] = useState("");
  const schoolApplications = applications.filter((item) => item.source === "school");
  const schoolGroups = Object.values(schoolApplications.reduce((groups, item) => {
    const key = `${item.year}|${item.exam}`;
    groups[key] ||= { key, year: item.year, exam: item.exam, applications: [] };
    groups[key].applications.push(item);
    return groups;
  }, {})).map((group) => ({ ...group, pending: group.applications.filter((item) => item.status === "pending").length }));
  const selectedGroup = schoolGroups.find((group) => group.key === selectedGroupKey);
  const reviewPool = reviewView === "school-groups"
    ? selectedGroup?.applications || []
    : applications;
  const filteredApplications = reviewPool.filter((item) => {
    const query = search.trim().toLowerCase();
    const applicationNumber = `OC-${item.year}-${String(item.id || "").toUpperCase()}`;
    const competitionTerms = (item.competitions || []).flatMap((competition) => [competition.short, competition.name, competition.subject]).filter(Boolean);
    const matchesSearch = !query || [item.candidate, item.id, applicationNumber, item.school, item.contactEmail, item.heatId, item.finalId, item.exam, item.year, ...competitionTerms].filter(Boolean).some((value) => String(value).toLowerCase().includes(query));
    return matchesSearch && (statusFilter === "all" || (statusFilter === "pending" ? item.status === "pending" : item.status === statusFilter)) && (kindFilter === "all" || item.kind === kindFilter) && (sourceFilter === "all" || (sourceFilter === "school" ? item.source === "school" : item.source !== "school"));
  });
  const selected = filteredApplications.find((item) => item.id === selectedId) || filteredApplications[0];
  const pendingCount = applications.filter((item) => item.status === "pending").length;
  const scopedStatusCount = (status) => reviewPool.filter((item) => status === "all" || item.status === status).length;
  const fmtMoney = (value) => `฿${Number(value || 0).toLocaleString()}`;
  return (
    <div className="page-stack">
      <PageHeading eyebrow="จัดการใบสมัคร · ข้อมูล mock" title="ตรวจใบสมัครและสลิป" description="เปิดดูข้อมูลแต่ละผู้สมัคร ตรวจรายการสอบและยอดชำระ ก่อนอนุมัติหรือแจ้งปัญหาสลิป" action={<span className="queue-indicator"><span />รอตรวจ {pendingCount} ใบ</span>} />
      <div className="review-layout">
        <section className="surface review-queue">
          <div className="admin-review-mode" role="tablist" aria-label="มุมมองคิวใบสมัคร">
            <button type="button" role="tab" aria-selected={reviewView === "school-groups"} className={reviewView === "school-groups" ? "active" : ""} onClick={() => { setReviewView("school-groups"); setSelectedGroupKey(""); setSearch(""); setSourceFilter("all"); setKindFilter("all"); }}>ส่งผ่านโรงเรียน <span>{schoolApplications.length}</span></button>
            <button type="button" role="tab" aria-selected={reviewView === "all"} className={reviewView === "all" ? "active" : ""} onClick={() => { setReviewView("all"); setSelectedGroupKey(""); setSearch(""); }}>ใบสมัครทั้งหมด <span>{applications.length}</span></button>
          </div>
          {reviewView === "school-groups" && !selectedGroup ? (
            <>
              <div className="review-queue-head"><div><h2>กลุ่มรายการสอบ</h2><p>เลือกกลุ่มเพื่อเปิดรายชื่อผู้สมัคร</p></div><span className="queue-pill">{schoolGroups.length}</span></div>
              <div className="review-group-list">{schoolGroups.map((group) => <button type="button" key={group.key} className="review-group-card" onClick={() => { setSelectedGroupKey(group.key); setSelectedId(""); setStatusFilter("pending"); setKindFilter("all"); }}><span className="review-group-mark"><Icon name={group.applications[0]?.kind === "Final" ? "award" : "file"} /></span><span className="review-group-copy"><small>ปีการศึกษา {group.year} · {group.applications[0]?.kind}</small><strong>{group.exam}</strong><em>{group.pending ? `${group.pending} ใบ รอตรวจ` : "ไม่มีงานค้าง"}</em></span><span className="review-group-count">{group.applications.length}<small>ใบสมัคร</small></span><Icon name="chevron" size={18} /></button>)}{schoolGroups.length === 0 ? <div className="review-empty-filter"><Icon name="building" /><strong>ยังไม่มีใบสมัครจากโรงเรียน</strong></div> : null}</div>
            </>
          ) : (
            <>
              <div className="review-queue-head"><div>{reviewView === "school-groups" ? <button type="button" className="review-back-groups" onClick={() => { setSelectedGroupKey(""); setSearch(""); }}><Icon name="arrow" size={15} />กลับไปกลุ่ม</button> : null}<h2>{selectedGroup?.exam || "ใบสมัคร"}</h2><p>{selectedGroup ? `ปีการศึกษา ${selectedGroup.year} · ${filteredApplications.length} จาก ${reviewPool.length} ใบ` : `${filteredApplications.length} จาก ${applications.length} รายการ`}</p></div><span className="queue-pill">{reviewPool.filter((item) => item.status === "pending").length}</span></div>
              <label className="input-with-icon review-search"><Icon name="search" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาชื่อ โรงเรียน หรือเลขสอบ" /></label>
              <div className="review-filter-row" role="group" aria-label="กรองสถานะใบสมัคร">{[{ id: "pending", label: "รอตรวจ" }, { id: "confirmed", label: "ยืนยันแล้ว" }, { id: "all", label: "ทั้งหมด" }].map((filter) => <button type="button" key={filter.id} className={statusFilter === filter.id ? "review-filter-active" : ""} aria-pressed={statusFilter === filter.id} onClick={() => setStatusFilter(filter.id)}>{filter.label}<span>{scopedStatusCount(filter.id)}</span></button>)}</div>
              <div className="review-filter-selects"><label><span>ประเภท</span><select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}><option value="all">Heat และ Final</option><option value="Heat">Heat</option><option value="Final">Final</option></select></label>{reviewView === "all" ? <label><span>ผู้สมัคร</span><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}><option value="all">ทุกช่องทาง</option><option value="school">ผ่านโรงเรียน</option><option value="self">สมัครด้วยตนเอง</option></select></label> : null}</div>
              <div className="review-list">
                {filteredApplications.map((item) => (
                  <button className={`review-list-item ${selected?.id === item.id ? "review-list-selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)}>
                    <span className={`review-status-avatar ${item.status === "confirmed" ? "review-status-avatar-confirmed" : item.slipIssue ? "review-status-avatar-issue" : "review-status-avatar-pending"}`} title={item.status === "confirmed" ? "ยืนยันใบสมัคร" : item.slipIssue ? `ต้องตรวจสอบ: ${item.slipIssue}` : "รออนุมัติ/ตรวจสอบสลิป"} aria-label={item.status === "confirmed" ? "ยืนยันใบสมัคร" : item.slipIssue ? `ต้องตรวจสอบ: ${item.slipIssue}` : "รออนุมัติ/ตรวจสอบสลิป"}>
                      <Icon name={item.status === "confirmed" ? "check" : item.slipIssue ? "info" : "clock"} size={16} />
                    </span>
                    <span className="review-list-copy"><strong>{item.candidate}</strong><small>{getAdminReviewExamLabel(item)}</small><small>{item.source === "school" ? "ส่งผ่านโรงเรียน" : "สมัครด้วยตนเอง"} · {(item.competitions || []).length} รายการ · {fmtMoney(item.totalPayment)}</small></span>
                  </button>
                ))}
                {!filteredApplications.length ? <div className="review-empty-filter"><Icon name="search" /><strong>ไม่พบใบสมัคร</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div> : null}
              </div>
            </>
          )}
        </section>
        {selected ? (
          <section className="surface review-detail">
            <div className="review-detail-head"><div><p className="eyebrow">{selected.kind} · {selected.source === "school" ? "ส่งผ่านโรงเรียน" : "สมัครด้วยตนเอง"}</p><h2>{selected.candidate}</h2><span>{selected.school}{selected.batchId ? ` · ชุด ${selected.batchId}` : ""}</span></div><div className="review-detail-actions"><StatusBadge status={selected.status} /><Button variant="outline" icon="edit" onClick={() => navigate("admin-application-edit", selected.id)}>แก้ไขใบสมัคร</Button></div></div>
            {selected.slipIssue ? <div className="notice notice-amber admin-record-issue"><Icon name="info" /><div><strong>สลิปมีปัญหา</strong><p>{selected.slipIssue}</p><Button variant="text" icon="edit" onClick={() => navigate("admin-application-edit", selected.id)}>เปิดข้อมูลเพื่อแก้ไข</Button></div></div> : null}
            <div className="review-detail-grid"><div><span>เลขที่ใบสมัคร</span><strong>OC-{selected.year}-{selected.id.toUpperCase()}</strong></div><div><span>อีเมลติดต่อผู้เข้าสอบ</span><strong>{selected.contactEmail}</strong></div><div><span>เบอร์โทรศัพท์ผู้เข้าสอบ</span><strong>{getApplicationPhone(selected)}</strong></div><div><span>รูปแบบสอบ · ศูนย์สอบ</span><strong>{selected.format === "On-site" ? "Paper-Based" : selected.format} · {selected.center}</strong></div><div><span>ส่งใบสมัคร</span><strong>{selected.submitted}</strong></div></div>
            <section className="review-data-section"><div className="review-data-heading"><div><strong>รายการสอบและระดับชั้น</strong><small>แยกตรวจตามข้อมูลของผู้สมัครแต่ละคน</small></div><span>{(selected.competitions || []).length} รายการ</span></div>{selected.competitions?.length ? <div className="review-competition-list">{selected.competitions.map((competition) => <div key={competition.id}><span><strong>{competition.short || competition.name}</strong><small>{competition.name}</small></span><span>{competition.grade}</span><b>{fmtMoney(competition.fee)}</b></div>)}</div> : <p className="review-no-data">ไม่มีรายละเอียดรายการสอบในข้อมูลตัวอย่าง</p>}</section>
            <section className="review-data-section"><div className="review-data-heading"><div><strong>ข้อสอบเก่าที่เลือก</strong><small>{selected.pastPapers?.length ? "จัดส่งข้อมูลเข้าใช้งานไปยังอีเมลผู้สมัคร" : "ไม่ได้เลือกซื้อข้อสอบเก่า"}</small></div><span>{selected.pastPapers?.length || 0} ชุด</span></div>{selected.pastPapers?.length ? <div className="review-paper-list">{selected.pastPapers.map((paper) => <div key={paper.id}><span>{paper.name}</span><b>{fmtMoney(paper.fee)}</b></div>)}</div> : null}</section>
            <div className="review-payment-grid"><div><span>ข้อสอบเก่า</span><strong>{fmtMoney(selected.pastPapersTotal)}</strong></div><div><span>ค่าสมัครสอบ</span><strong>{fmtMoney(selected.registrationFee)}</strong></div><div className="review-payment-total"><span>ยอดชำระรวม</span><strong>{fmtMoney(selected.totalPayment)}</strong></div></div>
            <div className="slip-preview">
              <div className="slip-preview-header"><span className="slip-file-icon"><Icon name="file" /></span><div><strong>{selected.slipFileName || `payment-slip-${selected.id}.pdf`}</strong><small>หลักฐานชำระเงิน · ยอดในใบสมัคร {fmtMoney(selected.totalPayment)}</small></div><Button variant="text" icon="download" onClick={() => notify("ไฟล์สลิปเป็นข้อมูลตัวอย่าง จึงไม่มีไฟล์จริงให้ดาวน์โหลด")}>ดูไฟล์</Button></div>
              <div className="slip-paper"><div className="slip-paper-logo">OCEC<span>PAYMENT</span></div><div className="slip-paper-title">PAYMENT CONFIRMATION · MOCK</div><div className="slip-paper-amount">{fmtMoney(selected.totalPayment)}</div><div className="slip-paper-lines"><i /><i /><i /><i /></div><span className={`slip-paper-status ${selected.slipIssue ? "slip-paper-status-issue" : ""}`}><Icon name={selected.slipIssue ? "info" : "check"} size={13} />{selected.slipIssue || "รอตรวจสอบสลิป"}</span></div>
            </div>
            {selected.slipIssue ? <div className="notice notice-amber"><Icon name="mail" /><div><strong>แจ้งปัญหาสลิปแล้ว</strong><p>เทมเพลต “{selected.slipIssue}” ส่งไปที่ {selected.contactEmail} · เมื่ออัปโหลดใหม่จะกลับเข้าคิวตรวจ</p><Button variant="text" icon="upload" onClick={() => navigate("slip-upload", selected.id)}>เปิดหน้าจำลองอัปโหลดใหม่</Button></div></div> : null}
            <section className="review-history-panel"><div className="review-history-heading"><span className="review-history-icon"><Icon name="clock" size={16} /></span><div><strong>ประวัติการแก้ไข</strong><small>บันทึกภายในของผู้ดูแลระบบ</small></div><span>{(selected.changeHistory || []).length} ครั้ง</span></div>{selected.changeHistory?.length ? <div className="review-history-list">{selected.changeHistory.map((entry) => <article className="review-history-entry" key={entry.id}><div className="review-history-meta"><strong>{entry.editor}</strong><time>{entry.at}</time></div><div className="review-history-changes">{entry.changes.map((change, index) => <div key={`${entry.id}-${index}`}><span>{change.label}</span><div><del>{change.oldValue || "—"}</del><Icon name="arrow" size={13} /><strong>{change.newValue || "—"}</strong></div></div>)}</div></article>)}</div> : <p className="review-history-empty">ยังไม่มีประวัติการแก้ไข · การแก้ไขครั้งถัดไปจะแสดงผู้แก้ เวลา และค่าก่อน–หลังไว้ที่นี่</p>}</section>
            <div className="review-actions">
              <div className="review-action-label"><strong>ผลการตรวจสอบ</strong><small>{selected.status === "confirmed" ? "ใบสมัครนี้อนุมัติแล้ว" : selected.slipIssue ? "รอสลิปใหม่ก่อนอนุมัติ" : "การอนุมัติจะยืนยันใบสมัครและเข้าคิวซิงก์ชีต"}</small></div>
              <div className="review-action-buttons">
                {selected.status !== "confirmed" && !selected.slipIssue ? <div className="template-menu"><span>ส่งเทมเพลตแจ้งปัญหาสลิป</span><div><Button variant="outline" icon="mail" onClick={() => onSlipIssue(selected.id, "สลิปไม่ถูกต้อง")}>สลิปไม่ถูกต้อง</Button><Button variant="outline" icon="mail" onClick={() => onSlipIssue(selected.id, "เปิดสลิปไม่ได้")}>เปิดสลิปไม่ได้</Button></div></div> : null}
                <Button icon="check" disabled={selected.status === "confirmed" || Boolean(selected.slipIssue)} onClick={() => onApprove(selected.id)}>{selected.status === "confirmed" ? "อนุมัติแล้ว" : "อนุมัติใบสมัครนี้"}</Button>
              </div>
            </div>
          </section>
        ) : reviewView === "school-groups" && !selectedGroup ? <section className="surface review-group-guide"><span><Icon name="grid" size={22} /></span><p className="eyebrow">ตรวจใบสมัครจากโรงเรียน</p><h2>เลือกกลุ่มรายการสอบ</h2><p>แต่ละกลุ่มรวมใบสมัครตามรายการสอบและปีการศึกษา เมื่อเลือกกลุ่มแล้วจะแสดงรายชื่อผู้สมัคร พร้อมตัวกรองสถานะและค้นหาชื่อ</p></section> : <div className="surface empty-state">เลือกใบสมัครเพื่อดูรายละเอียด</div>}
      </div>
    </div>
  );
}

const ADMIN_FINAL_COMPETITION = { id: "final", short: "Final", name: "OCEC Final", subject: "Final round", grades: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] };

function AdminApplicationEditPage({ application, onSave, navigate, competitionFees, examCatalog, centerCatalog }) {
  const editCompetitions = application.kind === "Final" ? [ADMIN_FINAL_COMPETITION] : getFormCompetitions(examCatalog, "HEAT", { year: application.year });
  const startingOnline = application.format === "Online Exam";
  const [profile, setProfile] = useState(() => getApplicantEditValues(application));
  const { firstName, lastName, school, email, phone } = profile;
  const nameParts = { firstName, lastName };
  const updateProfileField = (key, value) => setProfile((current) => ({ ...current, [key]: value }));
  const [format, setFormat] = useState(startingOnline ? "Online" : "Paper-Based");
  const [center, setCenter] = useState(application.center === "Online Exam" ? "" : application.center);
  const [selectedIds, setSelectedIds] = useState((application.competitions || []).map((item) => item.id));
  const [grades, setGrades] = useState(Object.fromEntries((application.competitions || []).map((item) => [item.id, item.grade || ""])));
  const [additionalSlip, setAdditionalSlip] = useState("");
  const [error, setError] = useState("");
  const competitions = editCompetitions.filter((item) => selectedIds.includes(item.id));
  const modeDeltaPerCompetition = 100;
  const roundType = application.kind === "Final" ? "FINAL" : "HEAT";
  const feeForFormat = (targetFormat) => {
    const previous = application.competitions?.[0];
    if (previous && startingOnline !== (targetFormat === "Online")) return Math.max(0, Number(previous.fee || 0) + (targetFormat === "Paper-Based" ? 100 : -100));
    return Number(previous?.fee || getCompetitionExamPrice(examCatalog, previous?.id || editCompetitions[0]?.id, roundType, targetFormat, competitionFees, application.year));
  };
  const feeForCompetition = (competition) => {
    const previous = (application.competitions || []).find((item) => item.id === competition.id);
    if (previous && startingOnline !== (format === "Online")) return Math.max(0, Number(previous.fee || 0) + (format === "Paper-Based" ? 100 : -100));
    return previous ? Number(previous.fee || getCompetitionExamPrice(examCatalog, competition.id, roundType, format, competitionFees, application.year)) : getCompetitionExamPrice(examCatalog, competition.id, roundType, format, competitionFees, application.year);
  };
  const nextRegistrationFee = competitions.reduce((sum, competition) => sum + feeForCompetition(competition), 0);
  const pastPapersTotal = Number(application.pastPapersTotal || 0);
  const nextTotal = nextRegistrationFee + pastPapersTotal;
  const paidTotal = Number(application.totalPayment || 0);
  const delta = nextTotal - paidTotal;
  const additionalDue = Math.max(0, delta);
  const switchedOnlineToOnsite = startingOnline && format === "Paper-Based";
  const switchedOnsiteToOnline = !startingOnline && format === "Online";

  function toggleCompetition(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }
  function submit(event) {
    event.preventDefault();
    if (!nameParts.firstName.trim() || !nameParts.lastName.trim()) { setError("กรอกชื่อจริงและนามสกุลภาษาอังกฤษ"); return; }
    if (!school.trim()) { setError("กรอกชื่อโรงเรียน"); return; }
    if (!email.trim()) { setError("กรอกอีเมลติดต่อผู้สมัคร"); return; }
    if (!phone.trim()) { setError("กรอกเบอร์โทรศัพท์ผู้สมัคร"); return; }
    if (!competitions.length) { setError("เลือกอย่างน้อย 1 รายการสอบ"); return; }
    if (competitions.some((item) => !grades[item.id])) { setError("เลือกระดับชั้นให้ครบทุกวิชาที่สมัคร"); return; }
    if (format === "Paper-Based" && !center) { setError("เลือกศูนย์สอบสำหรับการสอบแบบออนไซต์"); return; }
    if (additionalDue > 0 && !additionalSlip) { setError("แนบสลิปเพิ่มเติมเพื่อบันทึกยอดชำระที่เพิ่มขึ้น"); return; }
    const candidate = [nameParts.firstName, nameParts.lastName].map((part) => part.trim()).filter(Boolean).join(" ");
    const updatedCompetitions = competitions.map((item) => ({ ...item, grade: grades[item.id], fee: feeForCompetition(item) }));
    onSave(application.id, {
      candidate,
      nameParts,
      school: school.trim(),
      contactEmail: email.trim(),
      phone: phone.trim(),
      studentInformation: { ...application.studentInformation, ...profile, firstName: nameParts.firstName.trim(), lastName: nameParts.lastName.trim(), school: school.trim(), email: email.trim(), phone: phone.trim(), format: format === "Online" ? "Online Exam" : "Paper-Based", center: format === "Online" ? "Online Exam" : center },
      examIds: updatedCompetitions.map((item) => item.id),
      competitions: updatedCompetitions,
      grade: updatedCompetitions.map((item) => `${item.short}: ${item.grade}`).join(" · "),
      format: format === "Online" ? "Online Exam" : "On-site",
      center: format === "Online" ? "Online Exam" : center,
      registrationFee: nextRegistrationFee,
      totalPayment: Math.max(paidTotal, nextTotal),
      additionalFee: additionalDue,
      additionalSlipFileName: additionalSlip || application.additionalSlipFileName || "",
    });
  }

  return (
    <div className="page-stack admin-edit-application-page">
      <PageHeading eyebrow="งานแอดมิน · ข้อมูล mock" title="แก้ไขใบสมัคร" description={`${application.candidate} · ${application.exam} · ${application.school}`} action={<Button variant="outline" icon="arrow" onClick={() => navigate("admin-review", application.id)}>กลับไปตรวจใบสมัคร</Button>} />
      <form className="admin-edit-layout" onSubmit={submit}>
        <div className="admin-edit-main">
          <section className="surface admin-edit-section"><div className="admin-edit-section-heading"><span>01</span><div><h2>ข้อมูลผู้เข้าสอบ</h2><p>แก้ไขข้อมูลส่วนตัว ที่อยู่ และข้อมูลติดต่อจากใบสมัคร</p></div></div><ApplicantProfileFields values={profile} onChange={updateProfileField} /></section>
          <section className="surface admin-edit-section"><div className="admin-edit-section-heading"><span>02</span><div><h2>รายการสอบและระดับชั้น</h2><p>เลือกเพิ่มรายการสอบ และปรับระดับชั้นของผู้สมัคร</p></div></div>
            <div className="admin-edit-competition-list">{editCompetitions.map((competition) => { const active = selectedIds.includes(competition.id); return <article className={active ? "admin-edit-competition active" : "admin-edit-competition"} key={competition.id}><label><input type="checkbox" checked={active} onChange={() => toggleCompetition(competition.id)} /><span className="admin-edit-checkbox"><Icon name="check" size={13} /></span><span><strong>{competition.name}</strong><small>{competition.subject}</small></span><span className="admin-edit-fee">฿{feeForCompetition(competition).toLocaleString()}<small> / รายการ</small></span></label>{active ? <Field label={`ระดับชั้น ${competition.short}`} required><select value={grades[competition.id] || ""} onChange={(event) => setGrades((current) => ({ ...current, [competition.id]: event.target.value }))}><option value="">เลือกระดับชั้น</option>{grades[competition.id] && !competition.grades.includes(grades[competition.id]) ? <option value={grades[competition.id]}>{grades[competition.id]} (ปัจจุบัน)</option> : null}{competition.grades.map((grade) => <option key={grade}>{grade}</option>)}</select></Field> : null}</article>; })}</div>
          </section>
          <section className="surface admin-edit-section"><div className="admin-edit-section-heading"><span>03</span><div><h2>รูปแบบสอบและศูนย์สอบ</h2><p>ปรับประเภทการสอบแล้วตรวจดูผลต่างยอดเงินก่อนบันทึก</p></div></div>
            <div className="mode-options admin-edit-mode"><label className={format === "Paper-Based" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name="admin-format" checked={format === "Paper-Based"} onChange={() => setFormat("Paper-Based")} /><span><strong>Paper-Based</strong><small>สอบที่สนามสอบ</small></span><b>฿{feeForFormat("Paper-Based").toLocaleString()} <small>/ รายการ</small></b></label><label className={format === "Online" ? "mode-option mode-option-selected" : "mode-option"}><input type="radio" name="admin-format" checked={format === "Online"} onChange={() => setFormat("Online")} /><span><strong>Online Exam</strong><small>สอบออนไลน์</small></span><b>฿{feeForFormat("Online").toLocaleString()} <small>/ รายการ</small></b></label></div>
            {format === "Paper-Based" ? <Field label="ศูนย์สอบ" required><select value={center} onChange={(event) => setCenter(event.target.value)}><option value="">เลือกศูนย์สอบ</option>{center && !centerCatalog.some((item) => item.name === center) ? <option value={center}>{center} (ปัจจุบัน)</option> : null}{centerCatalog.map((item) => <option key={item.code}>{item.name}</option>)}{FORM_CENTERS.map((item) => <option key={`legacy-${item}`}>{item}</option>)}</select></Field> : <div className="online-device-note"><Icon name="monitor" /><div><strong>Online Exam</strong><span>ศูนย์สอบจะตั้งเป็น Online Exam โดยอัตโนมัติ</span></div></div>}
          </section>
          {switchedOnlineToOnsite || switchedOnsiteToOnline || additionalDue > 0 ? <section className={switchedOnsiteToOnline ? "notice notice-amber admin-edit-change-notice" : "notice notice-blue admin-edit-change-notice"}><Icon name={switchedOnsiteToOnline ? "info" : "check"} /><div><strong>{switchedOnlineToOnsite ? `เปลี่ยนจาก Online เป็นออนไซต์ · เพิ่ม ${fmtAdminMoney(modeDeltaPerCompetition)} × ${competitions.length} รายการ = ${fmtAdminMoney(competitions.length * modeDeltaPerCompetition)}` : switchedOnsiteToOnline ? `เปลี่ยนจากออนไซต์เป็น Online · ไม่มีการคืนเงินส่วนต่าง ${fmtAdminMoney(Math.max(0, -delta))}` : `ยอดสมัครเปลี่ยน ${delta > 0 ? "เพิ่ม" : "ลด"} ${fmtAdminMoney(Math.abs(delta))}`}</strong><p>{switchedOnsiteToOnline ? "ผู้สมัครชำระเงินตามยอดเดิมแล้ว ส่วนต่างจะไม่คืน หากมีรายการสอบเพิ่ม ระบบจะแจ้งยอดชำระเฉพาะรายการใหม่" : additionalDue > 0 ? "ยอดที่ต้องจ่ายเพิ่มคำนวณรวมจากรายการสอบและรูปแบบสอบใหม่ แนบสลิปเพิ่มเติมก่อนบันทึก" : "ยอดใหม่คำนวณจากรายการสอบ ระดับชั้น และรูปแบบสอบที่เลือก"}</p></div></section> : null}
          {additionalDue > 0 ? <label className="file-drop file-drop-inline admin-edit-slip"><input type="file" accept="image/*,.pdf" onChange={(event) => { setAdditionalSlip(event.target.files?.[0]?.name || ""); setError(""); }} /><span className="file-drop-icon"><Icon name="upload" /></span><span className="file-drop-copy"><strong>{additionalSlip || "แนบสลิปเพิ่มเติม"}</strong><small>หลักฐานยอดที่ชำระเพิ่ม · JPG, PNG หรือ PDF</small></span><span className="file-select-label">เลือกไฟล์</span></label> : null}
          {error ? <p className="inline-error" role="alert"><Icon name="info" size={16} />{error}</p> : null}
          <div className="admin-edit-footer"><span><Icon name="info" size={15} />บันทึกข้อมูลตัวอย่างในหน้าทดลองนี้เท่านั้น</span><Button variant="outline" onClick={() => navigate("admin-review", application.id)}>ยกเลิก</Button><Button type="submit" icon="check">บันทึกการแก้ไข</Button></div>
        </div>
        <aside className="surface admin-edit-summary"><span className="side-note-icon"><Icon name="settings" /></span><p className="eyebrow">ตรวจยอดก่อนบันทึก</p><h2>สรุปยอดเปลี่ยนแปลง</h2><div className="admin-edit-total-row"><span>ยอดเดิมในใบสมัคร</span><strong>{fmtAdminMoney(paidTotal)}</strong></div><div className="admin-edit-total-row"><span>ข้อสอบเก่า</span><strong>{fmtAdminMoney(pastPapersTotal)}</strong></div><div className="admin-edit-total-row"><span>ค่าสมัครใหม่ · {competitions.length} รายการ</span><strong>{fmtAdminMoney(nextRegistrationFee)}</strong></div><div className="admin-edit-total-row admin-edit-new-total"><span>ยอดรวมหลังแก้ไข</span><strong>{fmtAdminMoney(nextTotal)}</strong></div><div className={additionalDue > 0 ? "admin-edit-pay-now due" : "admin-edit-pay-now"}><small>ยอดที่ต้องชำระเพิ่ม</small><strong>{fmtAdminMoney(additionalDue)}</strong></div><p>การลดค่าสมัครเมื่อเปลี่ยนจากออนไซต์เป็นออนไลน์จะไม่คืนเงินส่วนต่าง</p></aside>
      </form>
    </div>
  );
}

function fmtAdminMoney(value) { return `฿${Number(value || 0).toLocaleString()}`; }

function AdminRoundPage({ examCatalog, onUpdateExam, onAddExam, onRemoveExam, centerLocked, registrationOpen, hasPublishedHeatResults, heatIdsGenerated, onGenerateHeatIds, centerCatalog, setCenterCatalog, pastPaperCatalog, setPastPaperCatalog, notify }) {
  const roundCarouselRefs = useRef({});
  const roundCarouselPositions = useRef({});
  const [centerFile, setCenterFile] = useState("");
  const [newCenterCode, setNewCenterCode] = useState("");
  const [newCenterName, setNewCenterName] = useState("");
  const [newPaperName, setNewPaperName] = useState("");
  const [newPaperPrice, setNewPaperPrice] = useState("250");
  const [newPaperGroup, setNewPaperGroup] = useState("Big Bay Bei Past Papers");
  const [showNewExamForm, setShowNewExamForm] = useState(false);
  const [newExamLogo, setNewExamLogo] = useState("");
  const [newExamError, setNewExamError] = useState("");
  const paperGroupOptions = [...new Set([
    ...FORM_PAST_PAPER_GROUPS.map((group) => group.title),
    ...pastPaperCatalog.map((paper) => paper.group),
    newPaperGroup,
  ].filter(Boolean))];
  const catalogYears = [...new Set(examCatalog.map((exam) => exam.year).filter(Boolean))].sort((left, right) => Number(right) - Number(left));
  const [yearFilter, setYearFilter] = useState(catalogYears[0] || "2569");
  const [newExam, setNewExam] = useState({ title: "", roundTypes: [], year: "2569", openDate: "", closeDate: "", examDate: "", editCloseDate: "", isOpen: false, accent: "violet", description: "ตรวจสอบกำหนดการและรายละเอียดการสมัคร", prices: { HEAT: { paperBased: 755, onlineExam: 655 }, FINAL: { paperBased: 1550, onlineExam: 1350 }, FINAL_X: { paperBased: 1550, onlineExam: 1350 } } });
  const heatRounds = examCatalog.filter((exam) => exam.year === "2569" && getExamRoundType(exam) === "HEAT");
  const canGenerateHeatIds = heatRounds.length > 0 && heatRounds.every((exam) => !exam.isOpen);
  const visibleExams = examCatalog.filter((exam) => yearFilter === "all" || exam.year === yearFilter);
  const examGroups = Object.values(visibleExams.reduce((groups, exam) => {
    const groupId = `${exam.competitionId || exam.title}-${exam.year}`;
    groups[groupId] ||= { id: groupId, title: exam.title, year: exam.year, rounds: [] };
    groups[groupId].rounds.push(exam);
    return groups;
  }, {})).sort((left, right) => Number(left.rounds.some((exam) => exam.competitionId === "bbb")) - Number(right.rounds.some((exam) => exam.competitionId === "bbb")));
  function scrollRoundCarousel(groupId, roundCount) {
    const viewport = roundCarouselRefs.current[groupId];
    if (!viewport) return;
    const cards = viewport.querySelectorAll(".admin-round-card");
    const visibleCount = window.matchMedia("(max-width: 700px)").matches ? 1 : 2;
    const maxStart = Math.max(0, roundCount - visibleCount);
    if (!maxStart) return;
    const current = Math.min(roundCarouselPositions.current[groupId] || 0, maxStart);
    const next = current >= maxStart ? 0 : current + 1;
    const styles = window.getComputedStyle(viewport);
    const gap = Number.parseFloat(styles.columnGap || styles.gap) || 8;
    const step = (cards[0]?.getBoundingClientRect().width || viewport.clientWidth) + gap;
    roundCarouselPositions.current[groupId] = next;
    viewport.scrollTo({ left: next * step, behavior: "smooth" });
  }
  const selectedRoundLabels = newExam.roundTypes.map((roundType) => EXAM_ROUND_LABELS[roundType]);
  function readLogoFile(file, onSuccess) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      notify("รองรับไฟล์โลโก้ PNG, JPG หรือ WEBP เท่านั้น");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 5 MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? onSuccess(reader.result) : notify("อ่านไฟล์โลโก้ไม่สำเร็จ");
    reader.onerror = () => notify("อ่านไฟล์โลโก้ไม่สำเร็จ ลองเลือกไฟล์อีกครั้ง");
    reader.readAsDataURL(file);
  }
  function updateNewExam(key, value) {
    setNewExam((current) => ({ ...current, [key]: value }));
    setNewExamError("");
  }
  function toggleNewExamRound(roundType) {
    updateNewExam("roundTypes", newExam.roundTypes.includes(roundType)
      ? newExam.roundTypes.filter((item) => item !== roundType)
      : [...newExam.roundTypes, roundType]);
  }
  function slugForCompetition(title) {
    const normalized = title.trim().toLowerCase();
    if (normalized.includes("big bay") || normalized === "bbb") return "bbb";
    if (normalized.includes("hkimo")) return "hkimo";
    if (normalized.includes("hkiso")) return "hkiso";
    if (normalized.includes("hkico")) return "hkico";
    return `custom-${normalized.replace(/[^a-z0-9ก-๙]+/g, "-").replace(/^-|-$/g, "") || Date.now()}`;
  }
  function addExam() {
    if (!newExam.title.trim() || !newExam.roundTypes.length || !newExam.year.trim()) {
      setNewExamError("กรอกชื่อรายการสอบ เลือกรอบสอบอย่างน้อยหนึ่งรอบ และระบุปีการศึกษา");
      return;
    }
    if (newExam.isOpen && (!newExam.openDate || !newExam.closeDate)) {
      setNewExamError("รายการที่เปิดรับสมัครต้องระบุวันเริ่มและวันปิดรับสมัคร");
      return;
    }
    const title = newExam.title.trim();
    const competitionId = slugForCompetition(title);
    const duplicates = newExam.roundTypes.filter((roundType) => examCatalog.some((exam) => exam.competitionId === competitionId && exam.year === newExam.year.trim() && getExamRoundType(exam) === roundType));
    if (duplicates.length) {
      setNewExamError(`${title} ปี ${newExam.year} มี ${duplicates.map((roundType) => EXAM_ROUND_LABELS[roundType]).join(", ")} อยู่แล้ว`);
      return;
    }
    const createdAt = Date.now();
    newExam.roundTypes.forEach((roundType, index) => onAddExam({
      id: `exam-${createdAt}-${index}`,
      competitionId,
      roundType,
      title,
      round: EXAM_ROUND_LABELS[roundType],
      year: newExam.year.trim(),
      openDate: newExam.openDate,
      closeDate: newExam.closeDate,
      examDate: newExam.examDate,
      editCloseDate: newExam.editCloseDate,
      finalConfirmCloseDate: roundType === "HEAT" ? "" : (newExam.closeDate || "2027-01-15"),
      isOpen: newExam.isOpen,
      accent: newExam.accent,
      description: newExam.description.trim(),
      logoDataUrl: newExamLogo,
      prices: { ...newExam.prices[roundType] },
      closes: formatThaiDate(newExam.closeDate),
    }));
    setYearFilter(newExam.year.trim());
    setNewExam({ title: "", roundTypes: [], year: "2569", openDate: "", closeDate: "", examDate: "", editCloseDate: "", isOpen: false, accent: "violet", description: "ตรวจสอบกำหนดการและรายละเอียดการสมัคร", prices: { HEAT: { paperBased: 755, onlineExam: 655 }, FINAL: { paperBased: 1550, onlineExam: 1350 }, FINAL_X: { paperBased: 1550, onlineExam: 1350 } } });
    setNewExamLogo("");
    setNewExamError("");
    setShowNewExamForm(false);
    notify(`เพิ่ม ${title} ${selectedRoundLabels.filter((_, index) => newExam.roundTypes[index]).join(" · ")} แล้ว · แต่ละรอบเป็นการ์ดแยกกัน`);
  }
  function updateCenter(index, key, value) { setCenterCatalog((current) => current.map((center, itemIndex) => itemIndex === index ? { ...center, [key]: value } : center)); }
  function addCenter() {
    if (!newCenterCode.trim() || !newCenterName.trim()) return;
    setCenterCatalog((current) => [...current, { code: newCenterCode.trim(), name: newCenterName.trim(), applicants: 0 }]);
    setNewCenterCode(""); setNewCenterName(""); notify("เพิ่มศูนย์สอบตัวอย่างแล้ว");
  }
  function addPastPaper() {
    if (!newPaperName.trim()) return;
    setPastPaperCatalog((current) => [...current, { id: `paper-${Date.now()}`, group: newPaperGroup, name: newPaperName.trim(), price: Number(newPaperPrice) || 0, active: true }]);
    setNewPaperName(""); notify("เพิ่มรายการข้อสอบเก่าตัวอย่างแล้ว");
  }
  function removePastPaper(paper) {
    setPastPaperCatalog((current) => current.filter((item) => item.id !== paper.id));
    notify(`ลบ ${paper.title || paper.name} ออกจากรายการข้อสอบเก่าตัวอย่างแล้ว`);
  }
  return (
    <div className="page-stack">
      <PageHeading eyebrow="จัดการรายการสอบ · ข้อมูล mock" title="รายการสอบและกำหนดการ" description="สถานะที่แก้ที่นี่จะแสดงบนหน้าแรกทันทีในตัวอย่างนี้" action={<span className={registrationOpen ? "schedule-open" : "closed-badge"}>{registrationOpen ? `เปิดรับ ${examCatalog.filter((exam) => exam.isOpen).length} รายการ` : "ปิดรับสมัครทั้งหมด"}</span>} />
      <section className="surface admin-round-catalog">
        <div className="section-heading"><div><p className="eyebrow">แสดงบนหน้าสมัคร</p><h2>จัดการรายการสอบทั้งหมด</h2></div><div className="admin-exam-heading-actions"><span className="admin-data-note"><Icon name="info" size={14} />สถานะเปิดรับเชื่อมกับหน้าแรก</span><Button icon="plus" onClick={() => { setShowNewExamForm((current) => !current); setNewExamError(""); }}>{showNewExamForm ? "ปิดฟอร์ม" : "เพิ่มรายการสอบ"}</Button></div></div>
        {showNewExamForm ? <form className="admin-exam-create-form" onSubmit={(event) => { event.preventDefault(); addExam(); }}>
          <div className="admin-exam-create-heading"><span className="admin-exam-create-icon"><Icon name="plus" size={17} /></span><div><strong>เพิ่มรายการสอบใหม่</strong><small>ข้อมูลจะปรากฏเป็นการ์ดในหน้าแรกทันที และอยู่ใน prototype นี้เท่านั้น</small></div></div>
          <div className="admin-exam-create-fields">
            <label><span>ชื่อรายการสอบ <b>*</b></span><input value={newExam.title} onChange={(event) => updateNewExam("title", event.target.value)} placeholder="เช่น HKIMO" required /></label>
            <fieldset className="admin-round-choice"><legend>รอบสอบ <b>*</b></legend><div>{Object.entries(EXAM_ROUND_LABELS).map(([roundType, label]) => <label key={roundType} className={newExam.roundTypes.includes(roundType) ? "admin-round-choice-selected" : ""}><input type="checkbox" checked={newExam.roundTypes.includes(roundType)} onChange={() => toggleNewExamRound(roundType)} /><span>{label}</span></label>)}</div><small>เลือกได้หลายรอบ ระบบจะแยกสร้างเป็นการ์ดคนละใบ</small></fieldset>
            {newExam.roundTypes.map((roundType) => <fieldset className="admin-round-price-set" key={roundType}><legend>ราคาสมัคร · {EXAM_ROUND_LABELS[roundType]}</legend><label><span>Paper-Based</span><div><input aria-label={`${EXAM_ROUND_LABELS[roundType]} ราคา Paper-Based`} type="number" min="0" value={newExam.prices[roundType].paperBased} onChange={(event) => updateNewExam("prices", { ...newExam.prices, [roundType]: { ...newExam.prices[roundType], paperBased: Math.max(0, Number(event.target.value) || 0) } })} /><b>บาท</b></div></label><label><span>Online Exam</span><div><input aria-label={`${EXAM_ROUND_LABELS[roundType]} ราคา Online Exam`} type="number" min="0" value={newExam.prices[roundType].onlineExam} onChange={(event) => updateNewExam("prices", { ...newExam.prices, [roundType]: { ...newExam.prices[roundType], onlineExam: Math.max(0, Number(event.target.value) || 0) } })} /><b>บาท</b></div></label></fieldset>)}
            <label><span>ปีการศึกษา <b>*</b></span><input inputMode="numeric" value={newExam.year} onChange={(event) => updateNewExam("year", event.target.value)} placeholder="2569" required /></label>
            <label><span>โทนสีการ์ด</span><select value={newExam.accent} onChange={(event) => updateNewExam("accent", event.target.value)}><option value="violet">ม่วง</option><option value="blue">น้ำเงิน</option><option value="coral">ชมพู</option><option value="yellow">เหลือง</option></select></label>
            <fieldset className="admin-exam-schedule-fields"><legend>กำหนดวันสำคัญ</legend><div className="admin-exam-schedule-grid">
              <label><span>เริ่มรับสมัคร</span><input type="date" value={newExam.openDate} onChange={(event) => updateNewExam("openDate", event.target.value)} /></label>
              <label><span>ปิดรับสมัคร</span><input type="date" value={newExam.closeDate} onChange={(event) => updateNewExam("closeDate", event.target.value)} /></label>
              <label><span>วันสอบ</span><input type="date" value={newExam.examDate} onChange={(event) => updateNewExam("examDate", event.target.value)} /></label>
              <label><span>ปิดแก้ไขข้อมูล</span><input type="date" value={newExam.editCloseDate} onChange={(event) => updateNewExam("editCloseDate", event.target.value)} /></label>
            </div></fieldset>
            <label className="admin-exam-description"><span>คำอธิบายบนการ์ด</span><input value={newExam.description} onChange={(event) => updateNewExam("description", event.target.value)} placeholder="รายละเอียดสั้นๆ ของรายการสอบ" /></label>
            <label className="admin-exam-open-toggle"><input type="checkbox" checked={newExam.isOpen} onChange={(event) => updateNewExam("isOpen", event.target.checked)} /><span><strong>เปิดรับสมัครทันที</strong><small>รายการที่เปิดรับจะแสดงปุ่มสมัครบนหน้าแรก</small></span></label>
            <div className="admin-exam-form-logo"><span className="admin-exam-field-label">โลโก้ประจำรายการ</span><div className="admin-exam-logo-control"><ExamLogo exam={{ ...newExam, logoDataUrl: newExamLogo }} iconSize={19} /><label className="admin-exam-logo-button"><Icon name="upload" size={15} />{newExamLogo ? "เปลี่ยนรูปโลโก้" : "เลือกรูปโลโก้"}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="เลือกรูปโลโก้รายการสอบใหม่" onChange={(event) => { readLogoFile(event.target.files?.[0], setNewExamLogo); event.target.value = ""; }} /></label><small>PNG, JPG หรือ WEBP · ไม่เกิน 5 MB</small>{newExamLogo ? <button type="button" className="admin-exam-remove-logo" onClick={() => setNewExamLogo("")}>เอารูปออก</button> : null}</div></div>
          </div>
          {newExamError ? <p className="admin-exam-error" role="alert"><Icon name="info" size={14} />{newExamError}</p> : null}
          <div className="admin-exam-form-footer"><span><Icon name="info" size={14} />เลือก {newExam.roundTypes.length || 0} รอบ · ระบบสร้างเป็นการ์ดแยกกัน โลโก้และข้อมูลอยู่ใน prototype นี้</span><div><Button type="button" variant="outline" onClick={() => { setShowNewExamForm(false); setNewExamError(""); }}>ยกเลิก</Button><Button type="submit" icon="check">เพิ่ม {newExam.roundTypes.length || "รายการ"} การ์ด</Button></div></div>
        </form> : null}
        <div className="admin-round-catalog-toolbar"><div><strong>{visibleExams.length} การ์ดรายการสอบ</strong><span>· {visibleExams.filter((exam) => exam.isOpen).length} รอบกำลังเปิดรับ</span></div><label>ปีการศึกษา<select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">ทุกปี</option>{catalogYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label></div>
        <div className="admin-round-groups">{examGroups.map((group) => <section className="admin-round-group" key={group.id}>
          <div className="admin-round-group-heading"><span className="admin-round-group-mark"><Icon name="award" size={17} /></span><div><strong>{group.title}</strong><small>ปีการศึกษา {group.year}</small></div><span className="admin-round-group-count">{group.rounds.length} รอบ</span></div>
          <div className={`admin-round-carousel ${group.rounds.length > 2 ? "admin-round-carousel-has-controls" : ""}`}>
          <div className={`admin-round-card-grid ${group.rounds.length > 2 ? "admin-round-card-grid-with-controls" : ""}`} ref={(node) => { roundCarouselRefs.current[group.id] = node; }} onScroll={(event) => { const viewport = event.currentTarget; const card = viewport.querySelector(".admin-round-card"); if (card) { const styles = window.getComputedStyle(viewport); const gap = Number.parseFloat(styles.columnGap || styles.gap) || 8; roundCarouselPositions.current[group.id] = Math.round(viewport.scrollLeft / (card.getBoundingClientRect().width + gap)); } }}>{group.rounds.map((exam) => {
          const prices = exam.prices || (getExamRoundType(exam) === "HEAT" ? { paperBased: 755, onlineExam: 655 } : { paperBased: 1550, onlineExam: 1350 });
          return <article className={`admin-round-card ${exam.isOpen ? "admin-round-card-open" : ""}`} key={exam.id}>
            <div className="admin-round-card-head"><ExamLogo exam={exam} className={`exam-type-mark exam-card-${exam.accent}`} iconSize={18} /><div><small>{exam.round || EXAM_ROUND_LABELS[getExamRoundType(exam)]} · ปี {exam.year}</small><div className="admin-round-card-title-row"><h3>{exam.title}</h3><span className={exam.isOpen ? "schedule-open" : "closed-badge"}>{exam.isOpen ? "เปิดรับ" : "ยังไม่เปิด"}</span></div></div></div>
            <div className="admin-round-price-summary"><span><small>Paper-Based</small><strong>฿{Number(prices.paperBased || 0).toLocaleString()}</strong></span><span><small>Online Exam</small><strong>฿{Number(prices.onlineExam || 0).toLocaleString()}</strong></span></div>
            <div className="admin-round-card-foot"><span>{exam.isOpen ? `ปิดรับ ${formatThaiDate(exam.closeDate)}` : `สอบ ${formatThaiDate(exam.examDate)}`}</span><div className="admin-round-card-actions"><Button variant={exam.isOpen ? "outline" : "primary"} icon={exam.isOpen ? "close" : "check"} onClick={() => { onUpdateExam(exam.id, { isOpen: !exam.isOpen }); notify(exam.isOpen ? `ปิดรับ ${exam.title} ${exam.round} แล้ว` : `เปิดรับ ${exam.title} ${exam.round} แล้ว · หน้าแรกอัปเดตแล้ว`); }}>{exam.isOpen ? "ปิดรับ" : "เปิดรับ"}</Button><Button variant="outline" className="admin-round-delete" icon="trash" ariaLabel={`ลบ ${exam.title} ${exam.round || ""} ปี ${exam.year}`} title="ลบการ์ดรายการสอบนี้" onClick={() => { onRemoveExam(exam.id); notify(`ลบการ์ด ${exam.title} ${exam.round} ปี ${exam.year} จากข้อมูลตัวอย่างแล้ว`); }}>ลบ</Button></div></div>
            {getExamRoundType(exam) === "FINAL" ? <label className="admin-final-confirm-inline"><span>ปิดยืนยันสิทธิ์</span><input type="date" aria-label={`วันปิดยืนยันสิทธิ์ ${exam.title} ${exam.year}`} value={exam.finalConfirmCloseDate || ""} onChange={(event) => onUpdateExam(exam.id, { finalConfirmCloseDate: event.target.value })} /></label> : null}
            <details className="admin-round-card-details"><summary><Icon name="settings" size={14} />แก้วันสอบ ราคา และโลโก้</summary>
              <div className="admin-round-fields">
                <label><span>เริ่มรับสมัคร</span><input type="date" value={exam.openDate || ""} onChange={(event) => onUpdateExam(exam.id, { openDate: event.target.value })} /></label>
                <label><span>ปิดรับสมัคร</span><input type="date" value={exam.closeDate || ""} onChange={(event) => onUpdateExam(exam.id, { closeDate: event.target.value, closes: formatThaiDate(event.target.value) })} /></label>
                <label><span>วันสอบ</span><input type="date" value={exam.examDate || ""} onChange={(event) => onUpdateExam(exam.id, { examDate: event.target.value })} /></label>
                <label><span>ปิดแก้ไขข้อมูล</span><input type="date" value={exam.editCloseDate || ""} onChange={(event) => onUpdateExam(exam.id, { editCloseDate: event.target.value })} /></label>
              </div>
              <div className="admin-round-price-edit"><label><span>Paper-Based</span><div><input type="number" min="0" value={prices.paperBased ?? 0} onChange={(event) => onUpdateExam(exam.id, { prices: { ...prices, paperBased: Math.max(0, Number(event.target.value) || 0) } })} /><b>บาท</b></div></label><label><span>Online Exam</span><div><input type="number" min="0" value={prices.onlineExam ?? 0} onChange={(event) => onUpdateExam(exam.id, { prices: { ...prices, onlineExam: Math.max(0, Number(event.target.value) || 0) } })} /><b>บาท</b></div></label></div>
              <div className="admin-round-logo-row"><span>โลโก้รายการ</span><label className="admin-exam-logo-button"><Icon name="upload" size={14} />{exam.logoDataUrl ? "เปลี่ยนรูป" : "อัปโหลดรูป"}<input type="file" accept="image/png,image/jpeg,image/webp" aria-label={`อัปโหลดโลโก้ ${exam.title} ${exam.round}`} onChange={(event) => { readLogoFile(event.target.files?.[0], (logoDataUrl) => onUpdateExam(exam.id, { logoDataUrl })); event.target.value = ""; }} /></label><small>PNG · JPG · WEBP ไม่เกิน 5 MB</small></div>
            </details>
          </article>;
          })}</div>
          {group.rounds.length > 2 ? <div className="admin-round-carousel-controls" aria-label={`เลื่อนรอบสอบ ${group.title}`}><Button type="button" variant="outline" icon="arrow" ariaLabel={`เลื่อนรอบสอบ ${group.title} ไปทางขวา`} onClick={() => scrollRoundCarousel(group.id, group.rounds.length)} /></div> : null}
          </div>
        </section>)}{!visibleExams.length ? <div className="empty-inline"><Icon name="calendar" /><span>ยังไม่มีรายการสอบในปีการศึกษานี้</span></div> : null}</div>
        <div className="form-footer admin-round-save"><span><Icon name="info" size={15} />กำหนดการ ราคา และสถานะเป็นข้อมูลตัวอย่างในหน้าทดลองนี้</span><Button variant="outline" onClick={() => notify("บันทึกกำหนดการและราคาตัวอย่างแล้ว")}>บันทึกกำหนดการ</Button></div>
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
          <div className="centers-table"><div className="center-row center-row-head"><span>รหัส</span><span>ชื่อศูนย์สอบ</span><span>ผู้สมัคร</span></div>{centerCatalog.map((center, index) => <div className="center-row center-row-editable" key={center.code}><input aria-label={`รหัสศูนย์สอบ ${center.name}`} value={center.code} disabled={centerLocked} onChange={(event) => updateCenter(index, "code", event.target.value)} /><input aria-label={`ชื่อศูนย์สอบ ${center.code}`} value={center.name} disabled={centerLocked} onChange={(event) => updateCenter(index, "name", event.target.value)} /><span className="center-status">{center.applicants}</span></div>)}</div>
          <div className="admin-add-center"><input aria-label="รหัสศูนย์สอบใหม่" placeholder="รหัสใหม่" value={newCenterCode} disabled={centerLocked} onChange={(event) => setNewCenterCode(event.target.value)} /><input aria-label="ชื่อศูนย์สอบใหม่" placeholder="ชื่อศูนย์สอบใหม่" value={newCenterName} disabled={centerLocked} onChange={(event) => setNewCenterName(event.target.value)} /><Button variant="outline" disabled={centerLocked || !newCenterCode.trim() || !newCenterName.trim()} onClick={addCenter}>เพิ่มศูนย์</Button></div>
          <div className="admin-fee-foot"><span>รายการศูนย์ที่แก้ไขได้จะปรากฏในฟอร์มหลังบ้าน · ข้อมูลจำนวนผู้สมัครเป็นตัวอย่าง</span><Button variant="outline" disabled={centerLocked} onClick={() => notify("บันทึกศูนย์สอบตัวอย่างแล้ว")}>บันทึกศูนย์สอบ</Button></div>
        </section>
        <section className="surface round-config-card">
          <div className="section-heading"><div><p className="eyebrow">การดำเนินงานหลังสมัคร</p><h2>เวลาปิดและเลขประจำตัว</h2></div></div>
          <div className="admin-auto-rule"><span className="admin-auto-rule-icon"><Icon name="edit" size={17} /></span><div><strong>สิทธิ์แก้ไขใบสมัครทำงานอัตโนมัติ</strong><small>เปิดหลังอนุมัติใบสมัคร และปิดตามวันปิดแก้ไขที่ตั้งไว้ในการ์ดของแต่ละรอบ</small></div><span className="auto-rule-badge">อัตโนมัติ</span></div>
          <div className="admin-auto-rule"><span className="admin-auto-rule-icon"><Icon name="award" size={17} /></span><div><strong>ยืนยันสิทธิ์ Final</strong><small>{hasPublishedHeatResults ? "ประกาศผล Heat แล้ว · เปิดให้ผู้ผ่านยืนยันสิทธิ์โดยอัตโนมัติ" : "ระบบจะเปิดให้ผู้ผ่านยืนยันสิทธิ์ทันทีหลังประกาศผล Heat"}</small></div><span className={hasPublishedHeatResults ? "schedule-open" : "draft-badge"}>{hasPublishedHeatResults ? "เปิดแล้ว" : "รอประกาศผล"}</span></div>
          <div className="admin-heat-id-summary"><span className="heat-id-icon"><Icon name="hash" /></span><div><strong>สร้างเลขประจำตัว Heat</strong><small>สร้างหลังปิดรอบปี 2569 · ทุกใบสมัคร แม้ยังรอตรวจ · เรียงศูนย์สอบ ระดับชั้น และชื่อ A–Z</small></div></div>
          <Button className="button-full" variant={heatIdsGenerated ? "success" : "outline"} disabled={!canGenerateHeatIds} icon={heatIdsGenerated ? "check" : "settings"} onClick={onGenerateHeatIds}>{heatIdsGenerated ? "สร้างเลข Heat แล้ว" : canGenerateHeatIds ? "สร้างเลข Heat" : "ปิดรอบปี 2569 ก่อนสร้างเลข"}</Button>
        </section>
      </div>
      <section className="surface admin-papers-catalog">
        <div className="section-heading"><div><p className="eyebrow">ข้อมูลตัวเลือกในฟอร์ม</p><h2>ข้อสอบเก่าและราคา</h2></div><span className="admin-data-note"><Icon name="book" size={14} />{pastPaperCatalog.length} รายการ</span></div>
        <div className="admin-paper-table-wrap"><table className="admin-paper-table"><thead><tr><th>กลุ่ม / รายการ</th><th>ราคา</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{pastPaperCatalog.length ? pastPaperCatalog.map((paper) => <tr key={paper.id}><td><small>{paper.group}</small><strong>{paper.name}</strong></td><td><label className="admin-paper-price"><span>฿</span><input aria-label={`ราคาของ ${paper.name}`} type="number" min="0" value={paper.price} onChange={(event) => setPastPaperCatalog((current) => current.map((item) => item.id === paper.id ? { ...item, price: Math.max(0, Number(event.target.value) || 0) } : item))} /></label></td><td><span className={paper.active ? "schedule-open" : "closed-badge"}>{paper.active ? "เปิดขาย" : "ปิดขาย"}</span></td><td><div className="admin-paper-actions"><Button variant="text" onClick={() => setPastPaperCatalog((current) => current.map((item) => item.id === paper.id ? { ...item, active: !item.active } : item))}>{paper.active ? "ปิดรายการ" : "เปิดรายการ"}</Button><button type="button" className="admin-paper-delete" aria-label={`ลบข้อสอบเก่า ${paper.title || paper.name}`} title={`ลบข้อสอบเก่า ${paper.title || paper.name}`} onClick={() => removePastPaper(paper)}><Icon name="close" size={15} /></button></div></td></tr>) : <tr><td className="admin-paper-empty" colSpan="4">ยังไม่มีรายการข้อสอบเก่า · เพิ่มรายการใหม่ได้ด้านล่าง</td></tr>}</tbody></table></div>
        <div className="admin-add-paper"><select aria-label="กลุ่มข้อสอบเก่า" value={newPaperGroup} onChange={(event) => setNewPaperGroup(event.target.value)}>{paperGroupOptions.map((group) => <option key={group}>{group}</option>)}</select><input aria-label="ชื่อรายการข้อสอบเก่าใหม่" placeholder="ชื่อข้อสอบเก่าใหม่" value={newPaperName} onChange={(event) => setNewPaperName(event.target.value)} /><label><span>ราคา</span><input type="number" min="0" value={newPaperPrice} onChange={(event) => setNewPaperPrice(event.target.value)} /></label><Button variant="outline" disabled={!newPaperName.trim()} onClick={addPastPaper}>เพิ่มข้อสอบเก่า</Button></div>
        <div className="admin-fee-foot"><span>รายการ ราคา และสถานะในส่วนนี้เป็นตัวอย่างสำหรับต้นแบบ</span><Button variant="outline" onClick={() => notify("บันทึกรายการข้อสอบเก่าตัวอย่างแล้ว")}>บันทึกรายการ</Button></div>
      </section>
    </div>
  );
}

function AdminResultsPage({ applications, examCatalog, resultWorkflows, onImportDraft, onResolveConflict, onPublishResult, notify, navigate }) {
  const [conflictsOpen, setConflictsOpen] = useState(false);
  const years = [...new Set(examCatalog.map((exam) => exam.year).filter(Boolean))].sort((left, right) => Number(right) - Number(left));
  const [selectedYear, setSelectedYear] = useState(years.includes("2569") ? "2569" : years[0] || "");
  const yearExams = examCatalog.filter((exam) => exam.year === selectedYear);
  const competitions = [...new Map(yearExams.map((exam) => [exam.competitionId, exam.title])).entries()];
  const [selectedCompetitionId, setSelectedCompetitionId] = useState(() => yearExams.find((exam) => exam.competitionId === "bbb")?.competitionId || yearExams[0]?.competitionId || "");
  const competitionExams = yearExams.filter((exam) => exam.competitionId === selectedCompetitionId);
  const [selectedRoundType, setSelectedRoundType] = useState(() => competitionExams.find((exam) => getExamRoundType(exam) === "HEAT") ? "HEAT" : getExamRoundType(competitionExams[0] || {}));
  const selectedTarget = competitionExams.find((exam) => getExamRoundType(exam) === selectedRoundType) || competitionExams[0];
  const workflow = selectedTarget ? resultWorkflows[selectedTarget.id] || {} : {};
  const targetApplications = selectedTarget ? getApplicationsForResultTarget(applications, selectedTarget) : [];
  const rows = workflow.rows || [];
  const finalEligibleRows = rows.filter((row) => isFinalEligibleAward(row.award));
  const issueRows = rows.filter((row) => row.matchStatus !== "matched");
  const hasConflict = issueRows.length > 0;
  const conflictCount = issueRows.length;
  const conflictApplication = applications.find((item) => item.id === issueRows[0]?.issueApplicationId) || targetApplications[0];
  const awardBreakdown = RESULT_AWARDS.map((award) => ({ award, count: rows.filter((row) => row.award === award).length }));
  const matchedRows = rows.filter((row) => row.matchStatus === "matched");
  const resultNumberLabel = selectedRoundType === "HEAT" ? "เลขประจำตัว Heat" : "เลขประจำตัว Final";
  const isPublished = Boolean(workflow.published);

  useEffect(() => {
    if (!conflictsOpen) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setConflictsOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [conflictsOpen]);

  return (
    <div className="page-stack">
      <PageHeading eyebrow="ผลการสอบ · ข้อมูล mock" title="นำเข้าและประกาศผลสอบ" description="เลือกสนามสอบและรอบก่อนนำเข้าผล ตรวจข้อมูลและรายการจับคู่ผิดปกติ แล้วจึงประกาศผล" action={<span className={isPublished ? "schedule-open" : workflow.draftImported ? "draft-badge" : "closed-badge"}>{isPublished ? "ประกาศแล้ว · ล็อกข้อมูล" : workflow.draftImported ? "ฉบับร่าง" : "รอเลือกไฟล์"}</span>} />
      <section className="surface results-target-toolbar results-admin-target-toolbar">
        <label><span>ปีการศึกษา</span><select value={selectedYear} onChange={(event) => { const nextYear = event.target.value; const nextExam = examCatalog.find((exam) => exam.year === nextYear); setSelectedYear(nextYear); if (nextExam) { setSelectedCompetitionId(nextExam.competitionId); setSelectedRoundType(getExamRoundType(nextExam)); } }}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>รายการสอบ</span><select value={selectedCompetitionId} onChange={(event) => { const nextCompetition = examCatalog.find((exam) => exam.year === selectedYear && exam.competitionId === event.target.value); setSelectedCompetitionId(event.target.value); if (nextCompetition) setSelectedRoundType(getExamRoundType(nextCompetition)); }}>{competitions.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
        <label><span>รอบสอบ</span><select value={selectedTarget ? getExamRoundType(selectedTarget) : selectedRoundType} onChange={(event) => setSelectedRoundType(event.target.value)}>{competitionExams.map((exam) => <option key={exam.id} value={getExamRoundType(exam)}>{EXAM_ROUND_LABELS[getExamRoundType(exam)] || exam.round}</option>)}</select></label>
        {selectedTarget ? <span className={isPublished ? "schedule-open" : "draft-badge"}>{isPublished ? "ประกาศผลแล้ว" : workflow.draftImported ? "มีฉบับร่าง" : "ยังไม่ได้นำเข้า"}</span> : null}
      </section>
      {!selectedTarget ? <section className="surface empty-inline"><Icon name="info" /><span>ไม่พบรอบสอบสำหรับรายการที่เลือก กรุณาตรวจสอบรายการสอบในเมนูรอบสอบ</span></section> : <>
        {isPublished ? <div className="notice notice-green"><Icon name="check" /><div><strong>ประกาศผล {resultTargetLabel(selectedTarget)} แล้ว</strong><p>ผลสอบแสดงในหน้าประกาศผลสาธารณะ และล็อกไม่ให้แก้ไข</p></div></div> : null}
        <div className="results-admin-grid">
          <section className="surface import-card">
            <div className="section-heading"><div><p className="eyebrow">{resultTargetLabel(selectedTarget)}</p><h2>นำเข้าผลสอบฉบับร่าง</h2></div><span className={isPublished ? "schedule-open" : "draft-badge"}>{isPublished ? "ประกาศแล้ว" : workflow.draftImported ? "ฉบับร่าง" : "รอไฟล์"}</span></div>
            <label className={`file-drop file-drop-inline ${isPublished ? "file-disabled" : ""}`}><input type="file" accept=".xlsx,.xls,.csv" disabled={isPublished} onChange={(event) => { const file = event.target.files?.[0]; if (file) onImportDraft(selectedTarget, file.name); event.target.value = ""; }} /><span className="file-drop-icon"><Icon name="upload" /></span><span className="file-drop-copy"><strong>{workflow.fileName || (workflow.draftImported ? `${selectedTarget.competitionId}-${selectedRoundType.toLowerCase()}-results-draft.xlsx` : "เลือกไฟล์ Excel ผลสอบ")}</strong><small>คอลัมน์ CANDIDATE NO, GRADE, SCHOOL NAME, CANDIDATE NAME และ AWARD · เลือกไฟล์ใหม่เพื่อแทนฉบับร่างได้ก่อนประกาศ</small></span><span className="file-select-label">{workflow.draftImported && !isPublished ? "เปลี่ยนไฟล์" : "เลือกไฟล์"}</span></label>
            <div className="results-import-actions"><span>หรือทดลองขั้นตอนด้วยข้อมูลตัวอย่าง</span><Button variant="outline" icon="grid" disabled={isPublished} onClick={() => onImportDraft(selectedTarget, "ข้อมูลตัวอย่างผลสอบ.xlsx")}>ใช้ข้อมูลตัวอย่าง</Button></div>
            {workflow.draftImported ? <div className="import-summary"><span className="summary-icon summary-green"><Icon name="check" /></span><div><strong>{isPublished ? "ประกาศผลแล้ว · ล็อกข้อมูล" : "เตรียมฉบับร่างสำเร็จ"}</strong><small>แสดงรายชื่อผู้เข้าสอบครบ {rows.length} รายการ</small></div><span className="summary-pill">มีสิทธิ์ Final {finalEligibleRows.length} ราย</span></div> : null}
            <div className="results-count-strip"><span><strong>{rows.length}</strong> ผู้เข้าสอบ</span><span><strong>{finalEligibleRows.length}</strong> มีสิทธิ์ไป Final</span><span><strong>{matchedRows.length}</strong> จับคู่ได้</span><button type="button" className={`results-count-review ${hasConflict ? "has-conflicts" : "all-clear"}`} disabled={!workflow.draftImported} aria-label={`${conflictCount} รายการที่ต้องตรวจ · กดเพื่อเปิดรายการ`} title="กดเพื่อเปิดรายการที่ต้องตรวจ" aria-haspopup="dialog" aria-expanded={conflictsOpen} onClick={() => setConflictsOpen(true)}><strong>{conflictCount}</strong><span className="results-review-action">รายการที่ต้องตรวจ</span><span className="results-review-indicator" aria-hidden="true"><Icon name="cursor" size={18} /></span></button></div>
            <div className="results-award-breakdown" aria-label="จำนวนผู้เข้าสอบตามรางวัล">{awardBreakdown.map(({ award, count }) => <div className={`results-award-count award-count-${award.toLowerCase().replaceAll(" ", "-")}`} key={award}><span>{award}</span><strong>{count}</strong></div>)}</div>
            <div className="result-preview-heading"><div><strong>รายชื่อผู้เข้าสอบทั้งหมด</strong><small>ตรวจ Candidate No, ระดับชั้น โรงเรียน ชื่อ และรางวัลก่อนประกาศ</small></div><span>{rows.length} ราย</span></div>
            {rows.length ? <div className="responsive-table admin-results-table-wrap"><table className="admin-results-table"><thead><tr><th>CANDIDATE NO</th><th>GRADE</th><th>SCHOOL NAME</th><th>CANDIDATE NAME</th><th>AWARD</th><th>จับคู่</th></tr></thead><tbody>{rows.map((row, index) => <tr className={row.matchStatus !== "matched" ? "admin-result-row-unmatched" : ""} key={`${row.applicationId}-${index}`}><td data-label="CANDIDATE NO"><strong className="mono-number">{row.candidateNo || row.examNumber}</strong></td><td data-label="GRADE">{row.grade}</td><td data-label="SCHOOL NAME">{row.schoolName || row.school}</td><td data-label="CANDIDATE NAME">{row.candidateName || row.candidate}</td><td data-label="AWARD"><span className={`award-badge award-${String(row.award || "").toLowerCase().replaceAll(" ", "-")}`}>{row.award}</span></td><td data-label="จับคู่">{row.matchStatus === "school-mismatch" ? <span className="match-status match-wait"><Icon name="info" size={13} />ชื่อโรงเรียนไม่ตรง</span> : row.matchStatus === "unmatched" ? <span className="match-status match-wait"><Icon name="info" size={13} />ไม่พบเลขสอบ</span> : <span className="match-status match-ok"><Icon name="check" size={13} />จับคู่แล้ว</span>}</td></tr>)}</tbody></table></div> : <div className="empty-inline"><Icon name="info" /><span>เลือกไฟล์เพื่อสร้างตัวอย่างผลสอบของรายการนี้</span></div>}
            <div className="publish-box"><div><strong>{isPublished ? "ประกาศผลแล้ว" : "ยืนยันประกาศผล"}</strong><small>{isPublished ? "ประกาศผลแล้วและล็อกข้อมูล" : hasConflict ? `ยังประกาศไม่ได้ · แก้รายการที่ต้องตรวจให้ครบก่อน (${conflictCount} รายการ)` : selectedRoundType === "HEAT" ? "เมื่อประกาศ Heat ระบบจะเปิดยืนยันสิทธิ์ Final ให้อัตโนมัติ" : "เมื่อประกาศแล้วจะแสดงผลสาธารณะและล็อกข้อมูล"}</small></div><Button icon="check" disabled={!workflow.draftImported || hasConflict || isPublished || !rows.length} onClick={() => onPublishResult(selectedTarget)}>{isPublished ? "ผลสอบถูกล็อก" : "ประกาศผล"}</Button></div>
          </section>
        </div>
        {conflictsOpen ? <div className="results-conflict-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConflictsOpen(false); }}>
          <section className="results-conflict-dialog" role="dialog" aria-modal="true" aria-labelledby="results-conflict-title">
            <div className="results-conflict-dialog-head"><div><p className="eyebrow">ตรวจสอบก่อนประกาศผล</p><h2 id="results-conflict-title">รายการที่ต้องตรวจ</h2><small>แก้ไขรายการที่จับคู่ไม่สำเร็จให้ครบก่อนประกาศผล</small></div><span className={hasConflict ? "conflict-count" : "conflict-count conflict-count-clear"}>{conflictCount} รายการ</span><button type="button" className="results-conflict-close" aria-label="ปิดหน้าต่าง" onClick={() => setConflictsOpen(false)}><Icon name="close" size={18} /></button></div>
            <div className="results-conflict-dialog-body">
              {!workflow.draftImported ? <div className="empty-inline"><Icon name="info" /><span>เลือกไฟล์ผลสอบของ {resultTargetLabel(selectedTarget)} เพื่อดูรายการที่จับคู่ไม่สำเร็จ</span></div> : !issueRows.length ? <div className="resolved-state"><span><Icon name="check" /></span><div><strong>ไม่พบรายการผิดปกติ</strong><p>ฉบับร่างพร้อมสำหรับตรวจสอบก่อนประกาศผล</p></div></div> : (
                <div className="conflict-list">{issueRows.map((row, index) => {
                  const linkedApplication = applications.find((item) => item.id === row.issueApplicationId || item.id === row.applicationId) || conflictApplication;
                  const schoolMismatch = row.matchStatus === "school-mismatch";
                  const issueKey = getResultIssueKey(row);
                  return <article className="conflict-item" key={issueKey}>
                    <div className="conflict-label"><span className="conflict-icon"><Icon name="info" /></span><div><strong>{schoolMismatch ? "ชื่อโรงเรียนในไฟล์ผลสอบไม่ตรงกับใบสมัคร" : "ไม่พบเลขประจำตัวสอบในใบสมัคร"}</strong><small>แถว {index + 1} · เลขสอบ {row.candidateNo || row.examNumber} · {row.candidateName || row.candidate}</small></div></div>
                    <p>{resultTargetLabel(selectedTarget)} · {row.grade}{schoolMismatch ? <><br />โรงเรียนในไฟล์ผลสอบ: {row.schoolName || row.school}<br />โรงเรียนในใบสมัคร: {linkedApplication?.school || row.applicationSchoolName || "ไม่พบข้อมูล"}</> : <><br />โรงเรียน: {row.schoolName || row.school}</>}</p>
                    <div className="conflict-actions">{schoolMismatch ? <><Button variant="outline" icon="check" onClick={() => { onResolveConflict(selectedTarget.id, "application", issueKey); notify("ใช้ชื่อโรงเรียนจากใบสมัครและจับคู่ข้อมูลตัวอย่างแล้ว"); }}>ใช้ชื่อโรงเรียนจากใบสมัคร</Button><Button variant="outline" icon="upload" onClick={() => { onResolveConflict(selectedTarget.id, "file", issueKey); notify("ใช้ชื่อโรงเรียนจากไฟล์ผลสอบ และอัปเดตใบสมัครตัวอย่างแล้ว"); }}>ใช้ข้อมูลจากไฟล์ผลสอบ</Button></> : <><Button variant="outline" icon="edit" onClick={() => { setConflictsOpen(false); linkedApplication ? navigate("admin-review", linkedApplication.id) : notify("ไม่มีใบสมัครตัวอย่างให้เปิด"); }}>เปิดใบสมัครที่เกี่ยวข้อง</Button><Button variant="text" icon="upload" onClick={() => { onResolveConflict(selectedTarget.id, "application", issueKey); notify("จำลองนำไฟล์ Excel เข้าซ้ำสำหรับรายการนี้แล้ว"); }}>จำลองนำไฟล์ Excel เข้าซ้ำ</Button></>}</div>
                  </article>;
                })}</div>
              )}
            </div>
          </section>
        </div> : null}
      </>}
      <div className="notice notice-amber results-mock-note"><Icon name="info" /><div><strong>โหมด mock</strong><p>เลือกไฟล์เพื่อจำลองสถานะนำเข้าเท่านั้น ไม่มีการอ่านข้อมูลหรือบันทึกไฟล์ผลสอบจริง</p></div></div>
    </div>
  );
}

function AdminFinalIdsPage({ applications, finalIdsImported, onImport, onManualMatch, notify, navigate }) {
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
            return <tr key={item.id}><td>{item.candidate}</td><td>{item.school}</td><td className="mono-number">{item.finalId || (finalIdsImported ? "รอตรวจจับคู่" : "รอนำเข้าเลขประจำตัว")}</td><td>{item.finalId ? <span className="match-status match-ok"><Icon name="check" size={13} />จับคู่แล้ว</span> : finalIdsImported ? <span className="match-status match-wait"><Icon name="info" size={13} />{issue}</span> : <span className="match-status match-wait"><Icon name="clock" size={13} />รอไฟล์นำเข้า</span>}</td><td><div className="final-id-row-actions"><Button variant="text" icon="file" onClick={() => navigate("admin-review", item.id)}>ดูใบสมัคร</Button>{!item.finalId && finalIdsImported ? <Button variant="outline" onClick={() => onManualMatch(item.id)}>จับคู่ด้วยมือ</Button> : null}</div></td></tr>;
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

function FinalAccessGate({ navigate }) {
  return <section className="surface registration-login-gate" aria-labelledby="final-access-title"><span className="registration-login-icon"><Icon name="award" size={22} /></span><p className="eyebrow">OCEC Final 2569</p><h1 id="final-access-title">ยืนยันสิทธิ์ก่อนสมัคร Final</h1><p>เริ่มจากตรวจสอบใบสมัคร Heat ที่ผ่านการคัดเลือก แล้วระบบจะนำข้อมูลเดิมมาเติมในฟอร์ม Final ให้</p><Button icon="arrow" onClick={() => navigate("final-confirm")}>ไปหน้ายืนยันสิทธิ์</Button></section>;
}

function App() {
  const [page, setPage] = useState(() => window.location.hash.slice(1) || "home");
  const [persona, setPersona] = useState(() => window.location.hash.slice(1).startsWith("admin-") ? "admin" : "coordinator");
  const [menuOpen, setMenuOpen] = useState(false);
  const [applications, setApplications] = useState(seedApplications);
  const [examCatalog, setExamCatalog] = useState(demoExamCatalog);
  const [competitionFees, setCompetitionFees] = useState({ heatOnline: 655, heatOnsite: 755, finalOnline: 1350, finalOnsite: 1550 });
  const [centerCatalog, setCenterCatalog] = useState(DEMO_CENTER_CATALOG);
  const [pastPaperCatalog, setPastPaperCatalog] = useState(DEMO_PAST_PAPERS);
  const [activeApplicationId, setActiveApplicationId] = useState("heat-01");
  const [toast, setToast] = useState("");
  const [authProfile, setAuthProfile] = useState(null);
  const [finalAccess, setFinalAccess] = useState(null);
  const [heatIdsGenerated, setHeatIdsGenerated] = useState(false);
  const [resultWorkflows, setResultWorkflows] = useState(() => ({ ...DEMO_PUBLISHED_RESULT_WORKFLOWS, ...DEMO_DRAFT_RESULT_WORKFLOWS }));
  const [finalIdsImported, setFinalIdsImported] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const publishedResultRows = Object.entries(resultWorkflows).flatMap(([targetId, workflow]) => {
    if (!workflow.published) return [];
    const target = examCatalog.find((exam) => exam.id === targetId);
    if (!target) return [];
    return (workflow.rows || []).map((row) => ({
      ...row,
      targetId,
      competitionId: target.competitionId,
      competitionTitle: target.title,
      roundType: getExamRoundType(target),
      round: target.round || EXAM_ROUND_LABELS[getExamRoundType(target)],
      publishedAt: workflow.publishedAt || "",
      year: target.year,
    }));
  });
  const publishedHeatResults = publishedResultRows.filter((row) => row.roundType === "HEAT");
  const resultPublished = publishedHeatResults.length > 0;
  const registrationOpen = examCatalog.some((exam) => exam.isOpen);
  const centerLocked = registrationOpen;
  const activeApplication = applications.find((item) => item.id === activeApplicationId) || applications[0];
  const visibleApplications = persona === "coordinator" || persona === "admin"
    ? applications
    : persona === "guest"
      ? applications.filter((item) => item.owner === "guest")
      : applications.filter((item) => item.owner === "candidate" || item.candidate === "Nicha Srisawat");
  const pageTitle = pageLabels[page] || pageLabels.home;
  const requiresRegistrationLogin = !authProfile && page === "apply-heat";

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

  function saveAdminApplication(id, updates) {
    const current = applications.find((item) => item.id === id);
    if (!current) return;
    const next = { ...current, ...updates };
    const displayCompetitions = (items = []) => items.map((item) => `${item.short || item.name} (${item.grade || "ไม่ระบุชั้น"})`).join(", ") || "ไม่มีรายการ";
    const displayAddress = (information = {}) => [information.address1, information.address2, information.city, information.province, information.postalCode].filter(Boolean).join(" ") || "—";
    const fields = [
      ["ชื่อภาษาอังกฤษ", current.candidate, next.candidate],
      ["โรงเรียน", current.school, next.school],
      ["อีเมลติดต่อ", current.contactEmail, next.contactEmail],
      ["เบอร์โทรศัพท์", getApplicationPhone(current), getApplicationPhone(next)],
      ["ที่อยู่", displayAddress(current.studentInformation), displayAddress(next.studentInformation)],
      ["รายการสอบและระดับชั้น", displayCompetitions(current.competitions), displayCompetitions(next.competitions)],
      ["รูปแบบสอบ", current.format === "On-site" ? "Paper-Based" : current.format, next.format === "On-site" ? "Paper-Based" : next.format],
      ["ศูนย์สอบ", current.center, next.center],
      ["ค่าสมัครสอบ", fmtAdminMoney(current.registrationFee), fmtAdminMoney(next.registrationFee)],
      ["ยอดชำระรวม", fmtAdminMoney(current.totalPayment), fmtAdminMoney(next.totalPayment)],
    ];
    const changes = fields.filter(([, oldValue, newValue]) => oldValue !== newValue).map(([label, oldValue, newValue]) => ({ label, oldValue: oldValue || "—", newValue: newValue || "—" }));
    if (updates.additionalSlipFileName && updates.additionalSlipFileName !== current.additionalSlipFileName) changes.push({ label: "สลิปค่าใช้จ่ายเพิ่มเติม", oldValue: current.additionalSlipFileName || "ไม่มีไฟล์", newValue: updates.additionalSlipFileName });
    if (!changes.length) { notify("ไม่มีข้อมูลเปลี่ยนแปลง"); return; }
    const at = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
    const entry = { id: `audit-${Date.now()}`, editor: "ผู้ดูแลระบบ · Aommy", at, changes };
    updateApplication(id, { ...updates, phoneLast4: (updates.phone || "").replace(/\D/g, "").slice(-4), changeHistory: [entry, ...(current.changeHistory || [])] });
    notify("บันทึกการแก้ไขตัวอย่างแล้ว · เพิ่มประวัติผู้แก้ เวลา และค่าก่อน–หลัง");
    navigate("admin-review", id);
  }

  function updateExam(id, updates) {
    setExamCatalog((current) => current.map((exam) => exam.id === id ? { ...exam, ...updates } : exam));
    if (updates.isOpen) setHeatIdsGenerated(false);
  }

  function addExam(exam) {
    setExamCatalog((current) => [...current, exam]);
    if (exam.isOpen) setHeatIdsGenerated(false);
  }

  function removeExam(id) {
    setExamCatalog((current) => current.filter((exam) => exam.id !== id));
    setHeatIdsGenerated(false);
  }

  function submitApplication(values) {
    const applicants = values.batchApplications?.length ? values.batchApplications : [values];
    const batchId = values.batchId || "";
    const records = applicants.map((applicant, index) => {
      const id = batchId ? `${batchId}-${index + 1}` : "new-" + Date.now().toString().slice(-5);
      const examListings = applicant.examListings || [];
      const examYear = applicant.examYear || examListings[0]?.year || "2569";
      const examLabel = applicant.kind === "Final"
        ? `OCEC Final ${examYear}`
        : examListings.length
          ? examListings.map((exam) => `${exam.name} · ${applicant.grades?.[exam.id] || ""}`).join(", ")
          : "OCEC Heat รอบที่ 1";
      return {
        id,
        batchId: batchId || undefined,
        owner: applicant.source === "school" ? "coordinator" : applicant.source === "guest" ? "guest" : "candidate",
        source: applicant.source || "self",
        kind: applicant.kind,
        exam: examLabel,
        examIds: examListings.map((exam) => exam.id),
        year: examYear,
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
        heatId: applicant.kind === "Final" ? (applications.find((item) => item.id === applicant.sourceHeatId)?.heatId || "") : "",
        finalId: "",
        sourceHeatId: applicant.sourceHeatId || "",
        result: "",
        canEdit: false,
        slipIssue: "",
      };
    });
    const id = records[0].id;
    setApplications((current) => [...records, ...current]);
    setActiveApplicationId(id);
    setPersona(values.source === "school" ? "coordinator" : values.source === "guest" ? "guest" : "candidate");
    notify(records.length > 1 ? `ส่งใบสมัคร ${records.length} คนสำเร็จ ระบบส่งอีเมลสรุปแยกไปยังผู้เข้าสอบแต่ละคน` : "ส่งใบสมัครสำเร็จ ระบบส่งอีเมลสรุปไปยัง " + applicants[0].contactEmail);
    navigate("application-detail", id);
  }

  function saveApplication(id, form) {
    updateApplication(id, { ...form, phoneLast4: form.phone.replace(/\D/g, "").slice(-4) });
    notify("บันทึกการแก้ไขแล้ว สถานะใบสมัครยังคงยืนยันใบสมัคร");
    navigate("application-detail", id);
  }

  function approveApplication(id) {
    const item = applications.find((entry) => entry.id === id);
    updateApplication(id, { status: "confirmed", canEdit: true });
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

  function importResultDraft(target, fileName) {
    const rows = makeMockResultRows(applications, target);
    const hasConflict = rows.some((row) => row.matchStatus !== "matched");
    setResultWorkflows((current) => ({
      ...current,
      [target.id]: { ...current[target.id], fileName, rows, draftImported: true, hasConflict, conflictResolved: false, published: false },
    }));
    notify(`อ่านไฟล์ ${fileName} สำหรับ ${resultTargetLabel(target)} ในโหมดตัวอย่างแล้ว`);
  }

  function resolveResultConflict(targetId, schoolSource = "application", issueKey = "") {
    const target = examCatalog.find((exam) => exam.id === targetId);
    if (!target) return;
    const workflow = resultWorkflows[targetId] || {};
    const schoolUpdates = new Map();
    const rows = (workflow.rows || []).map((row) => {
      if (row.matchStatus === "matched" || (issueKey && getResultIssueKey(row) !== issueKey)) return row;
      const application = applications.find((item) => item.id === row.issueApplicationId || item.id === row.applicationId);
      const candidateNo = getExamRoundType(target) === "HEAT" ? application?.heatId : application?.finalId;
      const useFileSchool = row.matchStatus === "school-mismatch" && schoolSource === "file";
      const schoolName = useFileSchool
        ? row.schoolName || row.school
        : application?.school || row.schoolName || row.school;
      if (useFileSchool && application && schoolName) schoolUpdates.set(application.id, schoolName);
      return {
        ...row,
        candidateNo: row.matchStatus === "unmatched" ? candidateNo || row.candidateNo : row.candidateNo,
        examNumber: row.matchStatus === "unmatched" ? candidateNo || row.examNumber : row.examNumber,
        schoolName,
        school: schoolName,
        applicationSchoolName: schoolName || row.applicationSchoolName,
        issueApplicationId: "",
        matchStatus: "matched",
      };
    });
    if (schoolUpdates.size) {
      const at = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date());
      setApplications((current) => current.map((application) => {
        const school = schoolUpdates.get(application.id);
        if (!school || school === application.school) return application;
        const change = { label: "โรงเรียน (อ้างอิงไฟล์ผลสอบ)", oldValue: application.school || "—", newValue: school };
        const entry = { id: `audit-result-school-${Date.now()}-${application.id}`, editor: "ผู้ดูแลระบบ · Aommy", at, changes: [change] };
        return {
          ...application,
          school,
          studentInformation: { ...application.studentInformation, school },
          changeHistory: [entry, ...(application.changeHistory || [])],
        };
      }));
    }
    const stillHasConflicts = rows.some((row) => row.matchStatus !== "matched");
    setResultWorkflows((current) => {
      const currentWorkflow = current[targetId] || workflow;
      return { ...current, [targetId]: { ...currentWorkflow, rows, hasConflict: stillHasConflicts, conflictResolved: !stillHasConflicts, fileName: stillHasConflicts ? currentWorkflow.fileName : "ผลสอบฉบับแก้ไข (ตัวอย่าง).xlsx" } };
    });
  }

  function publishResults(target) {
    const currentWorkflow = resultWorkflows[target.id] || {};
    const unresolvedCount = (currentWorkflow.rows || []).filter((row) => row.matchStatus !== "matched").length;
    if (!currentWorkflow.draftImported || !currentWorkflow.rows?.length || unresolvedCount) {
      notify(unresolvedCount ? `ยังประกาศผลไม่ได้ · กรุณาแก้รายการที่ต้องตรวจอีก ${unresolvedCount} รายการ` : "ยังประกาศผลไม่ได้ · กรุณานำเข้าผลสอบฉบับร่างก่อน");
      return;
    }
    setResultWorkflows((current) => ({ ...current, [target.id]: { ...current[target.id], published: true, publishedAt: new Date().toISOString() } }));
    notify(`ประกาศผล ${resultTargetLabel(target)} ในตัวอย่างแล้ว · ผลสอบถูกล็อก${getExamRoundType(target) === "HEAT" ? " และเปิดยืนยันสิทธิ์ Final อัตโนมัติ" : ""}`);
  }

  const content = (() => {
    switch (page) {
      case "apply-heat":
        return <ApplicationFormPage key={page} kind="Heat" onSubmit={submitApplication} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} centerCatalog={centerCatalog} pastPaperCatalog={pastPaperCatalog} />;
      case "apply-final":
        return finalAccess && finalAccess.heatId === activeApplicationId
          ? <ApplicationFormPage key={`${page}-${activeApplicationId}`} kind="Final" prefill={activeApplication} applicationMode={finalAccess.mode} allowedRoundIds={finalAccess.allowedRoundIds} onSubmit={submitApplication} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} centerCatalog={centerCatalog} pastPaperCatalog={pastPaperCatalog} />
          : <FinalAccessGate navigate={navigate} />;
      case "applications":
        return <ApplicationsPage applications={visibleApplications} navigate={navigate} />;
      case "application-detail":
        return <ApplicationDetailPage application={applications.find((item) => item.id === activeApplicationId)} navigate={navigate} resultRows={publishedResultRows} examCatalog={examCatalog} />;
      case "check-status":
        return <StatusLookupPage applications={applications} navigate={navigate} />;
      case "lookup-choice":
        return <LookupChoicePage navigate={navigate} />;
      case "edit-verify":
        return <EditVerifyPage applications={applications} onVerified={(id) => navigate("edit-application", id)} navigate={navigate} />;
      case "edit-application":
        return <EditApplicationPage key={activeApplicationId} application={activeApplication} onSave={saveApplication} navigate={navigate} examCatalog={examCatalog} />;
      case "slip-upload":
        return <SlipUploadPage application={activeApplication} onUploaded={(id, fileName) => updateApplication(id, { slipIssue: "", slipFileName: fileName })} onReturn={() => navigate("admin-review", activeApplication?.id)} notify={notify} />;
      case "final-confirm":
        return <FinalConfirmationPage key={activeApplicationId} applications={applications} applicationHint={activeApplication} onContinue={(selected, mode, profile, finalRounds = []) => { if (mode === "google") signInWithGoogleDemo(profile || demoGoogleProfile); setFinalAccess({ heatId: selected.id, mode, allowedRoundIds: finalRounds.map((round) => round.id) }); setPersona(mode === "guest" ? "guest" : "candidate"); navigate("apply-final", selected.id); }} navigate={navigate} publishedHeatResults={publishedHeatResults} examCatalog={examCatalog} authProfile={authProfile} onSignIn={signInWithGoogleDemo} />;
      case "results":
        return <PublicResultsPage resultRows={publishedResultRows} />;
      case "admin-home":
        return <AdminHomePage applications={applications} examCatalog={examCatalog} resultWorkflows={resultWorkflows} navigate={navigate} resultPublished={resultPublished} syncFailed={syncFailed} />;
      case "admin-review":
        return <AdminReviewPage applications={applications} onApprove={approveApplication} onSlipIssue={notifySlipIssue} notify={notify} navigate={navigate} activeApplicationId={activeApplicationId} />;
      case "admin-application-edit":
        return <AdminApplicationEditPage key={activeApplicationId} application={activeApplication} onSave={saveAdminApplication} navigate={navigate} competitionFees={competitionFees} examCatalog={examCatalog} centerCatalog={centerCatalog} />;
      case "admin-mock-papers":
        return <AdminMockPapersPage applications={applications} notify={notify} />;
      case "admin-round":
        return <AdminRoundPage examCatalog={examCatalog} onUpdateExam={updateExam} onAddExam={addExam} onRemoveExam={removeExam} centerLocked={centerLocked} registrationOpen={registrationOpen} hasPublishedHeatResults={publishedHeatResults.length > 0} heatIdsGenerated={heatIdsGenerated} onGenerateHeatIds={generateHeatIds} centerCatalog={centerCatalog} setCenterCatalog={setCenterCatalog} pastPaperCatalog={pastPaperCatalog} setPastPaperCatalog={setPastPaperCatalog} notify={notify} />;
      case "admin-results":
        return <AdminResultsPage applications={applications} examCatalog={examCatalog} resultWorkflows={resultWorkflows} onImportDraft={importResultDraft} onResolveConflict={resolveResultConflict} onPublishResult={publishResults} notify={notify} navigate={navigate} />;
      case "admin-final-ids":
        return <AdminFinalIdsPage applications={applications} finalIdsImported={finalIdsImported} onImport={importFinalIds} onManualMatch={matchFinalId} notify={notify} navigate={navigate} />;
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
    return <PublicPortalLayout page={page} navigate={navigate} setPersona={setPersona} authProfile={authProfile} onSignIn={signInWithGoogleDemo} onSignOut={signOut} toast={toast} setToast={setToast}>{requiresRegistrationLogin ? <RegistrationLoginGate kind="Heat" /> : content}</PublicPortalLayout>;
  }

  const shellPersona = page.startsWith("admin-") ? "admin" : persona;
  return (
    <div className={"app-shell " + (shellPersona === "admin" ? "admin-shell" : "")}>
      <a className="skip-link" href="#main-content">ข้ามไปยังเนื้อหาหลัก</a>
      <Sidebar page={page} persona={shellPersona} applications={applications} navigate={navigate} open={menuOpen} onClose={() => setMenuOpen(false)} notify={notify} />
      <main className="main-column" id="main-content" tabIndex="-1">
        <Topbar title={pageTitle} persona={shellPersona} setPersona={(next) => { setPersona(next); if (next === "admin") navigate("admin-home"); else if (page.startsWith("admin-")) navigate("home"); }} menuOpen={menuOpen} setMenuOpen={setMenuOpen} navigate={navigate} />
        <div className="content-wrap">
          <div className="prototype-banner"><Icon name="info" size={15} /><span>ต้นแบบสำหรับทดลองใช้งาน · ข้อมูลและการเชื่อมต่อภายนอกเป็นข้อมูลจำลอง</span><button onClick={(event) => event.currentTarget.parentElement.remove()} aria-label="ปิดข้อความ"><Icon name="close" size={14} /></button></div>
          {content}
          <footer className="page-footer"><span>© 2569 OCEC Portal</span><span>สำหรับการสอบถาม ติดต่อฝ่ายประสานงานโครงการ</span><a href="#help" onClick={(event) => { event.preventDefault(); notify("ศูนย์ช่วยเหลือเป็นตัวอย่างสำหรับ prototype"); }}>ศูนย์ช่วยเหลือ</a><a className="flaticon-attribution" href="https://www.flaticon.com/uicons" target="_blank" rel="noreferrer">UIcons by Flaticon</a></footer>
        </div>
      </main>
      {toast ? <div className="toast" role="status" aria-live="polite"><span><Icon name="check" size={16} /></span><p>{toast}</p><button aria-label="ปิดการแจ้งเตือน" onClick={() => setToast("")}><Icon name="close" size={16} /></button></div> : null}
    </div>
  );
}

export default App;
