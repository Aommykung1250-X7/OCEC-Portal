export const ONLINE_CENTER_CODE = "500";
export const ONLINE_CENTER_ID = "center-500";

const centerRows = [
  ["500", "Online : Home Base"],
  ["551", "Onsite : Amnat Charoen"],
  ["552", "Onsite : Anglo Singapore (Campus 31)"],
  ["553", "Onsite : Anglo Singapore (Campus 64)"],
  ["554", "Onsite : Bangkok"],
  ["555", "Onsite : Buriram"],
  ["556", "Onsite : Chaiyaphum"],
  ["557", "Onsite : Chiang Mai"],
  ["558", "Onsite : Chiang Rai"],
  ["559", "Onsite : Chonburi"],
  ["560", "Onsite : Chumphon"],
  ["561", "Onsite : Hat Yai"],
  ["562", "Onsite : Khon Kaen"],
  ["563", "Onsite : Korat"],
  ["564", "Onsite : Krabi"],
  ["565", "Onsite : Lampang"],
  ["566", "Onsite : Mukdahan"],
  ["567", "Onsite : Nakhon Sawan"],
  ["568", "Onsite : Nonthaburi"],
  ["569", "Onsite : PANYARAT"],
  ["570", "Onsite : Pathumthani"],
  ["571", "Onsite : Phatthalung"],
  ["572", "Onsite : Phetchaburi"],
  ["573", "Onsite : Phuket"],
  ["574", "Onsite : Ratchaburi"],
  ["575", "Onsite : Rayong"],
  ["576", "Onsite : Roi Et"],
  ["577", "Onsite : Sakon Nakhon"],
  ["578", "Onsite : Samui"],
  ["579", "Onsite : Samut Prakan"],
  ["580", "Onsite : Saraburi"],
  ["581", "Onsite : Surat Thani"],
  ["582", "Onsite : TECHAWIT"],
  ["583", "Onsite : The Newton Junior"],
  ["584", "Onsite : TheKnowledge"],
  ["585", "Onsite : Trang"],
  ["586", "Onsite : Ubon Ratchathani"],
  ["587", "Onsite : Udon Thani"],
  ["588", "Onsite : Anglo Singapore Korat"],
];

export const DEFAULT_CENTER_CATALOG = centerRows.map(([code, name]) => ({
  id: `center-${code}`,
  code,
  name,
  active: true,
}));

function normalizeCode(value) {
  return String(value ?? "").trim();
}

function normalizeName(value) {
  return String(value ?? "").trim();
}

export function isOnlineCenter(center) {
  if (center && typeof center === "object") {
    return normalizeCode(center.code) === ONLINE_CENTER_CODE
      || normalizeName(center.id) === ONLINE_CENTER_ID
      || isOnlineCenter(center.name);
  }
  const name = normalizeName(center).toLowerCase();
  return name === "online : home base" || name === "online exam";
}

export function parseCenterRows(rows, existingCenters = []) {
  const centers = [];
  const issues = [];
  const seenCodes = new Set();
  const existingByCode = new Map((existingCenters || []).map((center) => [normalizeCode(center.code), center]));

  (rows || []).slice(1).forEach((row, index) => {
    const excelRow = index + 2;
    const name = normalizeName(row?.[0]);
    const code = normalizeCode(row?.[1]);
    if (!name || !code) {
      issues.push({ row: excelRow, code, name, message: "ต้องมีชื่อศูนย์สอบและรหัสศูนย์สอบ" });
      return;
    }
    if (!/^\d{3}$/.test(code)) {
      issues.push({ row: excelRow, code, name, message: "รหัสศูนย์สอบต้องเป็นตัวเลข 3 หลักเพื่อใช้สร้างเลขประจำตัวสอบ" });
      return;
    }
    if (code === "000") {
      issues.push({ row: excelRow, code, name, message: "รหัส 000 เป็นรายการที่ยังไม่สมบูรณ์" });
      return;
    }
    if (seenCodes.has(code)) {
      issues.push({ row: excelRow, code, name, message: `รหัสศูนย์สอบ ${code} ซ้ำในไฟล์` });
      return;
    }
    seenCodes.add(code);
    const existing = existingByCode.get(code);
    centers.push(code === ONLINE_CENTER_CODE
      ? { ...DEFAULT_CENTER_CATALOG[0], id: existing?.id || DEFAULT_CENTER_CATALOG[0].id }
      : { id: existing?.id || `center-${code}`, code, name, active: true });
  });

  if (!centers.some((center) => center.code === ONLINE_CENTER_CODE)) {
    centers.unshift({ ...DEFAULT_CENTER_CATALOG[0] });
  }
  return { centers, issues };
}

export function getCommonCenters(competitionIds, examCatalog, centerCatalog, options = {}) {
  const selectedIds = [...new Set(competitionIds || [])];
  if (!selectedIds.length) return [];
  const activeCenters = (centerCatalog || []).filter((center) => center.active !== false && center.code !== ONLINE_CENTER_CODE);
  const selectedCards = selectedIds.map((competitionId) => (examCatalog || []).find((exam) =>
    (exam.competitionId || exam.id) === competitionId
    && (!options.year || exam.year === options.year)
    && (!options.roundType || (exam.roundType || exam.round) === options.roundType)
    && (!options.roundId || exam.id === options.roundId)));
  if (selectedCards.some((card) => !card)) return [];

  let allowedIds = null;
  selectedCards.forEach((card) => {
    const cardIds = new Set(card.centerIds || activeCenters.map((center) => center.id));
    allowedIds = allowedIds === null ? cardIds : new Set([...allowedIds].filter((id) => cardIds.has(id)));
  });
  return activeCenters.filter((center) => allowedIds?.has(center.id));
}

export function getCenterByApplication(application, centerCatalog = [], competitionId = "") {
  const competition = (application?.competitions || []).find((item) => item.id === competitionId);
  const competitionSnapshot = competition?.centerSnapshot;
  if (competitionSnapshot?.name) return competitionSnapshot;
  const competitionCenterId = competition?.centerId;
  const competitionCenter = competition?.center;
  const snapshot = competition ? null : application?.centerSnapshot;
  if (snapshot?.name) return snapshot;
  const centerId = competitionCenterId || application?.centerId;
  const centerName = competitionCenter || application?.center;
  const byId = centerCatalog.find((center) => center.id === centerId);
  if (byId) return { id: byId.id, code: byId.code, name: byId.name };
  const byName = centerCatalog.find((center) => center.name === centerName);
  if (byName) return { id: byName.id, code: byName.code, name: byName.name };
  const format = competition?.format || application?.format;
  if (["Online Exam", "Online"].includes(format)) {
    const online = centerCatalog.find((center) => center.code === ONLINE_CENTER_CODE) || DEFAULT_CENTER_CATALOG[0];
    return { id: online.id, code: online.code, name: online.name };
  }
  return { id: centerId || "", code: competition?.centerCode || application?.centerCode || "", name: centerName || "" };
}

export function buildCenterSummaryRows(applications, exam, centerCatalog = []) {
  const counts = new Map();
  const roundType = exam.roundType || (String(exam.round || "").toUpperCase().includes("FINAL") ? "FINAL" : "HEAT");
  const kind = roundType === "HEAT" ? "Heat" : "Final";

  (applications || []).forEach((application) => {
    if (application.year !== exam.year || application.kind !== kind) return;
    const selectedCompetition = (application.competitions || []).find((competition) => competition.id === exam.competitionId);
    const selected = (application.examIds || []).includes(exam.competitionId) || Boolean(selectedCompetition);
    if (!selected) return;
    const grade = selectedCompetition?.grade || application.grade || "ไม่ระบุระดับชั้น";
    const center = getCenterByApplication(application, centerCatalog, exam.competitionId);
    const key = `${center.code}::${grade}`;
    const current = counts.get(key) || { centerId: center.id, centerCode: center.code, centerName: center.name, grade, count: 0 };
    current.count += 1;
    counts.set(key, current);
  });

  return [...counts.values()].sort((left, right) =>
    left.centerCode.localeCompare(right.centerCode, undefined, { numeric: true })
    || left.grade.localeCompare(right.grade, "en", { numeric: true }));
}
