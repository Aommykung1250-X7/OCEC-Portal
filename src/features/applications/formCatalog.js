export const FORM_COMPETITIONS = [
  { id: "bbb", short: "BBB", name: "Big Bay Bei (BBB)", subject: "Mathematics", grades: ["Primary 1", "Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
  { id: "hkiso", short: "HKISO", name: "HKISO", subject: "Science", grades: ["Primary 2", "Primary 3", "Primary 4", "Primary 5", "Primary 6", "Secondary 1", "Secondary 2", "Secondary 3", "Senior Secondary"] },
  { id: "hkico", short: "HKICO", name: "HKICO", subject: "Computer", grades: ["Primary 2 — Scratch", "Primary 3 — Scratch", "Primary 4 — Scratch", "Primary 5 — Blockly", "Primary 6 — Blockly", "Secondary 1 — Blockly", "Secondary 2 — Python", "Secondary 3 — Python", "Senior Secondary — Python"] },
];

export const DEFAULT_GRADE_CATALOG = [...new Set(FORM_COMPETITIONS.flatMap((competition) => competition.grades))];

export const FORM_PAST_PAPER_GROUPS = [
  { id: "timo", title: "TIMO Past Papers", items: [] },
  { id: "hkimo", title: "HKIMO Past Papers", items: [] },
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

export const DEMO_PAST_PAPERS = FORM_PAST_PAPER_GROUPS.flatMap((group) => group.items.map((item) => ({ id: item.id, group: group.title, title: item.title, detail: item.detail, name: `${item.title} — ${item.detail}`, price: item.price, active: true })));

export const FORM_SCHOOLS = ["Other", "AIT International School", "Aiyasiri School", "Amnuay Silpa School", "Bangkok Christian College", "Bangkok Patana School", "Chulalongkorn University Demonstration School", "Kasetsart University Laboratory School", "Satit Prasarnmit Demonstration School", "Triam Udom Suksa School"];
