import { getCommonCenters, ONLINE_CENTER_CODE } from "./centers.js";
import { worksheetRows } from "./excel.js";

const TEMPLATE_DATA_ROWS = 100;
const FIRST_DATA_ROW = 4;
const LOOKUP_DATA_START_ROW = FIRST_DATA_ROW + TEMPLATE_DATA_ROWS + 2;
const DEFAULT_SCHOOLS = [
  "AIT International School", "Aiyasiri School", "Amnuay Silpa School", "Bangkok Christian College",
  "Bangkok Patana School", "Chulalongkorn University Demonstration School",
  "Kasetsart University Laboratory School", "Satit Prasarnmit Demonstration School",
  "Triam Udom Suksa School", "Other",
];
const FIXED_COLUMNS = [
  ["ENGLISH FIRST NAME", "firstName", true],
  ["ENGLISH LAST NAME", "lastName", true],
  ["THAI FIRST NAME", "thaiFirstName", true],
  ["THAI LAST NAME", "thaiLastName", true],
  ["GENDER", "gender", true],
  ["DATE OF BIRTH (YYYY-MM-DD)", "dateOfBirth", true],
  ["SCHOOL NAME", "school", true],
  ["SCHOOL NAME IN ENGLISH (IF OTHER)", "certificateSchoolName", false],
  ["EMAIL", "email", true],
  ["EXAM EMAIL", "examEmail", false],
  ["PHONE", "phone", true],
  ["ADDRESS LINE 1", "address1", true],
  ["ADDRESS LINE 2", "address2", false],
  ["DISTRICT / CITY", "city", true],
  ["PROVINCE", "province", true],
  ["POSTAL CODE", "postalCode", true],
  // Kept in the parser as optional legacy columns. New templates set these per competition.
  ["EXAM FORMAT", "format", false],
  ["CENTER CODE · PAPER-BASED", "centerCode", false],
];

const LISTS = {
  gender: ["Male", "Female", "Prefer not to say"],
  format: ["Paper-Based", "Online Exam"],
  apply: ["สมัคร", "ไม่สมัคร"],
  pastPaper: ["ซื้อ", "ไม่ซื้อ"],
};

function text(value) {
  return String(value ?? "").trim();
}

function xml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function columnName(index) {
  let value = index + 1;
  let result = "";
  while (value) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function createTemplateDefinition({ centerCatalog = [], competitions = [], pastPaperCatalog = [], schools = [] } = {}) {
  const columns = FIXED_COLUMNS.filter(([, key]) => !["format", "centerCode"].includes(key)).map(([header, key, required]) => ({ header, key, required, kind: "field" }));
  competitions.forEach((competition) => {
    const short = competition.short || competition.name || competition.id;
    columns.push({ header: `สมัคร ${short} [${competition.id}]`, kind: "competition", id: competition.id, role: "apply" });
    columns.push({ header: `ระดับชั้น ${short} [${competition.id}]`, kind: "competition", id: competition.id, role: "grade" });
    columns.push({ header: `รูปแบบสอบ ${short} [${competition.id}]`, kind: "competition", id: competition.id, role: "format" });
    columns.push({ header: `อีเมลเข้าสอบ ${short} [${competition.id}]`, kind: "competition", id: competition.id, role: "examEmail" });
    columns.push({ header: `ศูนย์สอบ ${short} [${competition.id}]`, kind: "competition", id: competition.id, role: "center" });
  });
  pastPaperCatalog.filter((paper) => paper.active !== false).forEach((paper) => {
    columns.push({ header: `ข้อสอบเก่า ${paper.title || paper.name} [${paper.id}]`, kind: "pastPaper", id: paper.id });
  });

  const activeCenters = centerCatalog.filter((center) => center.active !== false && center.code !== ONLINE_CENTER_CODE);
  const sources = [
    { key: "gender", header: "GENDER OPTIONS", values: LISTS.gender },
    { key: "school", header: "SCHOOL OPTIONS", values: [...new Set([...(schools.length ? schools : DEFAULT_SCHOOLS), "Other"])] },
    ...competitions.flatMap((competition) => [
      { key: `apply:${competition.id}`, header: `APPLY ${competition.id}`, values: LISTS.apply },
      { key: `grade:${competition.id}`, header: `GRADE ${competition.id}`, values: competition.grades || [] },
      { key: `format:${competition.id}`, header: `FORMAT ${competition.id}`, values: LISTS.format },
      { key: `center:${competition.id}`, header: `CENTER ${competition.id}`, values: activeCenters.filter((center) => !competition.centerIds?.length || competition.centerIds.includes(center.id)).map((center) => `${center.code} — ${center.name}`) },
    ]),
    ...pastPaperCatalog.filter((paper) => paper.active !== false).map((paper) => ({ key: `pastPaper:${paper.id}`, header: `PAST PAPER ${paper.id}`, values: LISTS.pastPaper })),
  ];
  const sourceColumns = new Map();
  sources.forEach((source) => {
    sourceColumns.set(source.key, { ...source, index: columns.length + sourceColumns.size });
  });

  const validations = [];
  columns.forEach((column, index) => {
    const sourceKey = column.kind === "field"
      ? ({ gender: "gender", school: "school" }[column.key])
      : column.kind === "competition"
        ? `${column.role}:${column.id}`
        : `pastPaper:${column.id}`;
    if (!sourceKey) return;
    const source = sourceColumns.get(sourceKey);
    if (source?.values.length) validations.push({ columnIndex: index, source });
  });

  return { columns, sourceColumns, validations };
}

function cellXml(reference, value, style = 0) {
  if (value === "" || value == null) return "";
  return `<c r="${reference}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}

function sheetXml(definition) {
  const { columns, sourceColumns, validations } = definition;
  const lastVisibleColumn = columns.length - 1;
  const lastColumn = Math.max(lastVisibleColumn, ...[...sourceColumns.values()].map((source) => source.index));
  const visibleEnd = columnName(lastVisibleColumn);
  const lastInputRow = TEMPLATE_DATA_ROWS + FIRST_DATA_ROW - 1;
  const lastLookupRow = LOOKUP_DATA_START_ROW + Math.max(0, ...[...sourceColumns.values()].map((source) => source.values.length - 1));
  const dimensionEnd = `${columnName(lastColumn)}${Math.max(lastInputRow, lastLookupRow)}`;
  const worksheetRows = [];
  worksheetRows.push(`<row r="1" ht="32" customHeight="1">${cellXml("A1", "OCEC · แบบฟอร์มสมัครสอบสำหรับโรงเรียน", 1)}</row>`);
  worksheetRows.push(`<row r="2" ht="38" customHeight="1">${cellXml("A2", "1 แถวต่อผู้เข้าสอบ · เลือกรายการ ระดับชั้น รูปแบบสอบ และศูนย์สอบแยกตามวิชา · EXAM EMAIL ใช้ร่วมกันได้ หรือกรอกอีเมลเข้าสอบในคอลัมน์ของรายการเพื่อระบุแยก · เว้นข้อสอบเก่าหากไม่ซื้อ", 2)}</row>`);
  worksheetRows.push(`<row r="3">${columns.map((column, index) => cellXml(`${columnName(index)}3`, `${column.header}${column.required ? " *" : ""}`, 3)).join("")}</row>`);
  for (let row = FIRST_DATA_ROW; row < FIRST_DATA_ROW + TEMPLATE_DATA_ROWS; row += 1) worksheetRows.push(`<row r="${row}"/>`);

  const lookupRows = new Map();
  sourceColumns.forEach((source) => {
    const values = [source.header, ...source.values];
    values.forEach((value, index) => {
      const rowNumber = LOOKUP_DATA_START_ROW + index;
      const column = columnName(source.index);
      const existing = lookupRows.get(rowNumber) || [];
      existing.push(cellXml(`${column}${rowNumber}`, value, index === 0 ? 3 : 0));
      lookupRows.set(rowNumber, existing);
    });
  });
  const lookupXml = [...lookupRows.entries()].map(([rowNumber, cells]) => {
    const existing = worksheetRows[rowNumber - 1] || "";
    if (existing) {
      const closingIndex = existing.lastIndexOf("</row>");
      worksheetRows[rowNumber - 1] = `${existing.slice(0, closingIndex)}${cells.join("")}</row>`;
      return "";
    }
    return `<row r="${rowNumber}">${cells.join("")}</row>`;
  }).filter(Boolean);

  const hiddenColumns = [...sourceColumns.values()].map((source) => `<col min="${source.index + 1}" max="${source.index + 1}" width="0" hidden="1" customWidth="1"/>`).join("");
  const columnWidths = columns.map((column, index) => {
    let width = 18;
    if (["ENGLISH FIRST NAME", "ENGLISH LAST NAME", "SCHOOL NAME IN ENGLISH (IF OTHER)", "EMAIL", "EXAM EMAIL", "ADDRESS LINE 1", "ADDRESS LINE 2", "DISTRICT / CITY"].includes(column.header)) width = 28;
    if (column.kind === "competition" || column.kind === "pastPaper") width = 23;
    if (column.header.startsWith("อีเมลเข้าสอบ ")) width = 28;
    if (column.header.startsWith("สมัคร ")) width = 21;
    return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
  }).join("");
  const validationXml = validations.length
    ? `<dataValidations count="${validations.length}">${validations.map(({ columnIndex, source }) => {
      const sourceColumn = columnName(source.index);
      const start = LOOKUP_DATA_START_ROW + 1;
      const end = LOOKUP_DATA_START_ROW + source.values.length;
      return `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="stop" promptTitle="เลือกจากรายการ" prompt="คลิกลูกศรเพื่อเลือกค่า" errorTitle="เลือกค่าในรายการ" error="กรุณาเลือกค่าจากตัวเลือกที่กำหนด" sqref="${columnName(columnIndex)}${FIRST_DATA_ROW}:${columnName(columnIndex)}${FIRST_DATA_ROW + TEMPLATE_DATA_ROWS - 1}"><formula1>$${sourceColumn}$${start}:$${sourceColumn}$${end}</formula1></dataValidation>`;
    }).join("")}</dataValidations>`
    : "";
  const merges = `<mergeCells count="2"><mergeCell ref="A1:${visibleEnd}1"/><mergeCell ref="A2:${visibleEnd}2"/></mergeCells>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${dimensionEnd}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A4" sqref="A4"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="22"/><cols>${columnWidths}${hiddenColumns}</cols><sheetData>${worksheetRows.join("")}${lookupXml.join("")}</sheetData><autoFilter ref="A3:${visibleEnd}${FIRST_DATA_ROW + TEMPLATE_DATA_ROWS - 1}"/>${merges}${validationXml}<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/></worksheet>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Aptos"/></font><font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Aptos"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF353183"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF2F1FB"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left/><right/><top/><bottom style="thin"><color rgb="FFE3E5EF"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center"/></xf><xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const write16 = (view, index, value) => view.setUint16(index, value, true);
  const write32 = (view, index, value) => view.setUint32(index, value >>> 0, true);
  entries.forEach(({ name, content }) => {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(localHeader.buffer);
    write32(localView, 0, 0x04034b50); write16(localView, 4, 20); write16(localView, 6, 0); write16(localView, 8, 0);
    write16(localView, 10, 0); write16(localView, 12, 0); write32(localView, 14, crc); write32(localView, 18, data.length); write32(localView, 22, data.length); write16(localView, 26, nameBytes.length); write16(localView, 28, 0);
    localHeader.set(nameBytes, 30);
    localParts.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    write32(centralView, 0, 0x02014b50); write16(centralView, 4, 20); write16(centralView, 6, 20); write16(centralView, 8, 0); write16(centralView, 10, 0);
    write16(centralView, 12, 0); write16(centralView, 14, 0); write32(centralView, 16, crc); write32(centralView, 20, data.length); write32(centralView, 24, data.length); write16(centralView, 28, nameBytes.length); write16(centralView, 30, 0); write16(centralView, 32, 0); write16(centralView, 34, 0); write16(centralView, 36, 0); write32(centralView, 38, 0); write32(centralView, 42, offset);
    centralHeader.set(nameBytes, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + data.length;
  });
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054b50); write16(endView, 4, 0); write16(endView, 6, 0); write16(endView, 8, entries.length); write16(endView, 10, entries.length); write32(endView, 12, centralSize); write32(endView, 16, offset); write16(endView, 20, 0);
  const totalSize = localParts.reduce((sum, part) => sum + part.length, 0) + centralSize + end.length;
  const result = new Uint8Array(totalSize);
  let cursor = 0;
  [...localParts, ...centralParts, end].forEach((part) => { result.set(part, cursor); cursor += part.length; });
  return result;
}

function createTemplateBytes(definition) {
  const entries = [
    { name: "[Content_Types].xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>` },
    { name: "_rels/.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>` },
    { name: "xl/workbook.xml", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="18000" windowHeight="10000" activeTab="0"/></bookViews><sheets><sheet name="Registration" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029"/></workbook>` },
    { name: "xl/_rels/workbook.xml.rels", content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>` },
    { name: "xl/styles.xml", content: stylesXml() },
    { name: "xl/worksheets/sheet1.xml", content: sheetXml(definition) },
  ];
  return zipStore(entries);
}

export function downloadSchoolTemplate({ centerCatalog = [], competitions = [], pastPaperCatalog = [], schools = [] } = {}, filename = "ocec-school-registration.xlsx") {
  const definition = createTemplateDefinition({ centerCatalog, competitions, pastPaperCatalog, schools });
  const bytes = createTemplateBytes(definition);
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function normalizeChoice(value) {
  const normalized = text(value).toLowerCase();
  if (["ซื้อ", "สมัคร", "yes", "y", "true", "1", "checked", "✓", "☑", "☒"].includes(normalized)) return true;
  if (["ไม่สมัคร", "ไม่ซื้อ", "no", "n", "false", "0", "unchecked", "☐"].includes(normalized)) return false;
  return null;
}

function idFromHeader(header) {
  return text(header).match(/\[([^\]]+)\]\s*$/)?.[1] || "";
}

function parseCenterCode(value, centerCatalog) {
  const raw = text(value);
  if (!raw) return "";
  const matched = centerCatalog.find((center) => raw === center.code || raw === center.name || raw.startsWith(`${center.code} — `));
  return matched?.code || raw;
}

function recordsFromSingleSheet(rows) {
  const canonicalHeader = (cell) => text(cell).replace(/\s*\*$/, "").toUpperCase();
  const headerIndex = rows.findIndex((row) => row?.some((cell) => canonicalHeader(cell) === "ENGLISH FIRST NAME") && row?.some((cell) => canonicalHeader(cell).startsWith("EXAM FORMAT") || canonicalHeader(cell).startsWith("สมัคร ")));
  if (headerIndex < 0) return { headers: [], records: [], headerIndex, issues: [{ sheet: "Registration", row: 1, field: "", message: "ไม่พบหัวตารางเทมเพลตสมัครโรงเรียน" }] };
  // Lookup lists for dropdowns live in hidden columns without headers. Ignore those
  // columns so their values cannot be mistaken for extra applicant rows.
  const headerColumns = rows[headerIndex]
    .map((cell, column) => ({ header: text(cell).replace(/\s*\*$/, ""), column }))
    .filter(({ header }) => header);
  const headers = headerColumns.map(({ header }) => header);
  const records = rows.slice(headerIndex + 1).map((cells, index) => ({
    rowNumber: headerIndex + index + 2,
    values: Object.fromEntries(headerColumns.map(({ header, column }) => [header, cells?.[column] ?? ""])),
  }));
  return { headers, records, headerIndex, issues: [] };
}

function parseSingleSheetWorkbook(rows, catalogs) {
  const issues = [];
  const sheet = recordsFromSingleSheet(rows);
  issues.push(...sheet.issues);
  if (sheet.issues.length) return { applicants: [], consent: false, issues };

  const competitionsById = new Map((catalogs.competitions || []).map((competition) => [competition.id, competition]));
  const papersById = new Map((catalogs.pastPaperCatalog || []).filter((paper) => paper.active !== false).map((paper) => [paper.id, paper]));
  const fields = Object.fromEntries(FIXED_COLUMNS.map(([header, key]) => [key, header]));
  const applicantRows = sheet.records.filter(({ values }) => sheet.headers.some((header) => text(values[header])));
  const applicants = applicantRows.map(({ values, rowNumber }) => {
    const get = (key) => text(values[fields[key]]);
    const selected = [];
    sheet.headers.filter((header) => header.startsWith("สมัคร ")).forEach((header) => {
      const competitionId = idFromHeader(header);
      const selectionValue = text(values[header]);
      if (selectionValue && !competitionsById.has(competitionId) && normalizeChoice(selectionValue)) {
        issues.push({ sheet: "Registration", row: rowNumber, field: header, message: `ไม่พบรายการสอบ ${competitionId} ในรอบที่เปิดรับปัจจุบัน` });
      }
    });
    (catalogs.competitions || []).forEach((competition) => {
      const selectionHeader = sheet.headers.find((header) => header.startsWith("สมัคร ") && idFromHeader(header) === competition.id);
      const gradeHeader = sheet.headers.find((header) => header.startsWith("ระดับชั้น ") && idFromHeader(header) === competition.id);
      const formatHeader = sheet.headers.find((header) => header.startsWith("รูปแบบสอบ ") && idFromHeader(header) === competition.id);
      const examEmailHeader = sheet.headers.find((header) => header.startsWith("อีเมลเข้าสอบ ") && idFromHeader(header) === competition.id);
      const centerHeader = sheet.headers.find((header) => header.startsWith("ศูนย์สอบ ") && idFromHeader(header) === competition.id);
      if (!selectionHeader || !gradeHeader) return;
      const selectionValue = text(values[selectionHeader]);
      const grade = text(values[gradeHeader]);
      const applies = normalizeChoice(selectionValue);
      if (selectionValue && applies == null) issues.push({ sheet: "Registration", row: rowNumber, field: selectionHeader, message: "เลือก สมัคร หรือ ไม่สมัคร จากรายการ" });
      if (applies && !grade) issues.push({ sheet: "Registration", row: rowNumber, field: gradeHeader, message: "เลือกระดับชั้นของรายการสอบที่สมัคร" });
      if (!applies && grade) issues.push({ sheet: "Registration", row: rowNumber, field: gradeHeader, message: "เลือกรายการนี้เป็น สมัคร ก่อนเลือกระดับชั้น" });
      if (applies && grade && !(competition.grades || []).includes(grade)) issues.push({ sheet: "Registration", row: rowNumber, field: gradeHeader, message: `ระดับชั้น ${grade} ใช้กับ ${competition.name || competition.short} ไม่ได้` });
      if (applies && grade && (competition.grades || []).includes(grade)) {
        const rawFormat = formatHeader ? text(values[formatHeader]) : (get("format") || "Paper-Based");
        const format = /online/i.test(rawFormat) ? "Online" : /paper|onsite|on-site/i.test(rawFormat) ? "Paper-Based" : "";
        if (!format) issues.push({ sheet: "Registration", row: rowNumber, field: formatHeader || fields.format, message: "เลือก Paper-Based หรือ Online Exam สำหรับรายการนี้" });
        const centerRaw = centerHeader ? text(values[centerHeader]) : get("centerCode");
        const centerCode = format === "Online" ? ONLINE_CENTER_CODE : parseCenterCode(centerRaw, catalogs.centerCatalog || []);
        const center = (catalogs.centerCatalog || []).find((item) => item.code === centerCode && item.active !== false);
        const examEmail = format === "Online" ? (examEmailHeader ? text(values[examEmailHeader]) : "") || get("examEmail") : "";
        if (format === "Paper-Based") {
          if (!center) issues.push({ sheet: "Registration", row: rowNumber, field: centerHeader || fields.centerCode, message: `ไม่พบศูนย์สอบรหัส ${centerCode || "ว่าง"} สำหรับ ${competition.short || competition.name}` });
          else {
            const commonCenters = getCommonCenters([competition.id], catalogs.examCatalog, catalogs.centerCatalog, { year: catalogs.year, roundType: "HEAT" });
            if (!commonCenters.some((item) => item.id === center.id)) issues.push({ sheet: "Registration", row: rowNumber, field: centerHeader || fields.centerCode, message: `ศูนย์สอบนี้ไม่ได้เปิดสำหรับ ${competition.short || competition.name}` });
          }
        }
        selected.push({ competition, grade, format: format || "Paper-Based", examEmail, examEmailHeader, center: center?.name || "", centerId: center?.id || "" });
      }
    });

    const pastPapers = [];
    sheet.headers.filter((header) => header.startsWith("ข้อสอบเก่า ")).forEach((header) => {
      const paperId = idFromHeader(header);
      const value = text(values[header]);
      const shouldBuy = normalizeChoice(value);
      if (!value || shouldBuy === false) return;
      const paper = papersById.get(paperId);
      if (shouldBuy == null) issues.push({ sheet: "Registration", row: rowNumber, field: header, message: "เลือก ซื้อ หรือ ไม่ซื้อ จากรายการ" });
      else if (!paper) issues.push({ sheet: "Registration", row: rowNumber, field: header, message: `ไม่พบข้อสอบเก่า ${paperId}` });
      else pastPapers.push(paper);
    });

    const requiredKeys = FIXED_COLUMNS.filter(([, , required]) => required).map(([, key]) => key);
    requiredKeys.forEach((key) => {
      if (!get(key)) issues.push({ sheet: "Registration", row: rowNumber, field: fields[key], message: "จำเป็นต้องกรอกข้อมูล" });
    });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(get("email"))) issues.push({ sheet: "Registration", row: rowNumber, field: fields.email, message: "รูปแบบอีเมลไม่ถูกต้อง" });
    if (get("phone").replace(/\D/g, "").length < 7) issues.push({ sheet: "Registration", row: rowNumber, field: fields.phone, message: "เบอร์โทรศัพท์ไม่ถูกต้อง" });
    if (get("dateOfBirth") && !/^\d{4}-\d{2}-\d{2}$/.test(get("dateOfBirth"))) issues.push({ sheet: "Registration", row: rowNumber, field: fields.dateOfBirth, message: "ใช้รูปแบบ YYYY-MM-DD" });
    if (!selected.length) issues.push({ sheet: "Registration", row: rowNumber, field: "รายการสอบ", message: "เลือกรายการสอบอย่างน้อย 1 รายการ" });

    const hasOnline = selected.some((item) => item.format === "Online");
    selected.filter((item) => item.format === "Online").forEach((item) => {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.examEmail)) issues.push({ sheet: "Registration", row: rowNumber, field: item.examEmailHeader || fields.examEmail, message: item.examEmail ? "รูปแบบอีเมลสำหรับเข้าสอบไม่ถูกต้อง" : "จำเป็นต้องกรอกเมื่อเลือก Online Exam" });
    });

    const schoolValue = get("school");
    const schoolCatalog = catalogs.schools?.length ? catalogs.schools : DEFAULT_SCHOOLS;
    const schoolName = schoolCatalog.includes(schoolValue) ? schoolValue : "Other";
    const certificateSchoolName = get("certificateSchoolName") || (schoolName === "Other" ? schoolValue : "");
    if (schoolName === "Other" && !certificateSchoolName) issues.push({ sheet: "Registration", row: rowNumber, field: fields.certificateSchoolName, message: "กรอกชื่อโรงเรียนภาษาอังกฤษเมื่อเลือก Other" });

    return {
      id: `excel-applicant-row-${rowNumber}`,
      rowId: `row-${rowNumber}`,
      firstName: get("firstName"), lastName: get("lastName"), thaiFirstName: get("thaiFirstName"), thaiLastName: get("thaiLastName"),
      gender: get("gender"), dateOfBirth: get("dateOfBirth"), schoolName, certificateSchoolName,
      email: get("email"), examEmail: get("examEmail"), examEmailsByCompetition: Object.fromEntries(selected.filter((item) => item.format === "Online").map((item) => [item.competition.id, item.examEmail])), phone: get("phone"),
      address1: get("address1"), address2: get("address2"), city: get("city"), province: get("province"), postalCode: get("postalCode"),
      formats: Object.fromEntries(selected.map((item) => [item.competition.id, item.format])),
      centersByCompetition: Object.fromEntries(selected.map((item) => [item.competition.id, item.format === "Online" ? "" : item.center])),
      format: new Set(selected.map((item) => item.format)).size > 1 ? "Mixed" : hasOnline ? "Online" : "Paper-Based",
      center: [...new Set(selected.map((item) => item.center).filter(Boolean))].join(" · "),
      centerId: selected.length === 1 ? selected[0].centerId : "",
      competitionIds: selected.map((item) => item.competition.id),
      grades: Object.fromEntries(selected.map((item) => [item.competition.id, item.grade])),
      pastPaperIds: pastPapers.map((paper) => paper.id),
    };
  });

  return { applicants, consent: false, issues };
}

function legacyRowsToRecords(rows, sheetName, requiredHeaders) {
  if (!rows?.length) return { records: [], issues: [{ sheet: sheetName, row: 1, field: "", message: "ไม่พบข้อมูลในชีต" }] };
  const headers = rows[0].map((cell) => text(cell).toUpperCase());
  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length) return { records: [], issues: missingHeaders.map((field) => ({ sheet: sheetName, row: 1, field, message: `ไม่พบคอลัมน์ ${field}` })) };
  return { records: rows.slice(1).map((cells) => Object.fromEntries(headers.map((header, column) => [header, cells?.[column] ?? ""]))), issues: [] };
}

function legacyConsent(workbook) {
  const rows = worksheetRows(workbook, "Batch Info");
  if (rows.length < 2) return false;
  const index = rows[0].map((cell) => text(cell).toUpperCase()).indexOf("MARKETING CONSENT (TRUE/FALSE)");
  const value = index >= 0 ? text(rows[1][index]).toLowerCase() : "false";
  return ["true", "yes", "1", "ยินยอม"].includes(value);
}

function parseLegacyWorkbook(workbook, catalogs) {
  const applicantHeaders = [
    "ENGLISH FIRST NAME", "ENGLISH LAST NAME", "THAI FIRST NAME", "THAI LAST NAME", "GENDER",
    "DATE OF BIRTH (YYYY-MM-DD)", "SCHOOL NAME", "CERTIFICATE SCHOOL NAME", "EMAIL", "EXAM EMAIL", "PHONE",
    "ADDRESS LINE 1", "ADDRESS LINE 2", "DISTRICT / CITY", "PROVINCE", "POSTAL CODE", "EXAM FORMAT", "CENTER CODE",
  ];
  const selectionRows = worksheetRows(workbook, "Exam Selections");
  const paperRows = worksheetRows(workbook, "Past Papers");
  const applicantRows = worksheetRows(workbook, "Applicants");
  const applicantsResult = legacyRowsToRecords(applicantRows, "Applicants", ["APPLICANT ROW ID", ...applicantHeaders.filter((header) => !["EXAM EMAIL", "EXAM FORMAT", "CENTER CODE"].includes(header))]);
  const selectionResult = legacyRowsToRecords(selectionRows, "Exam Selections", ["APPLICANT ROW ID", "COMPETITION ID", "GRADE"]);
  const issues = [...applicantsResult.issues, ...selectionResult.issues];
  const paperResult = legacyRowsToRecords(paperRows, "Past Papers", ["APPLICANT ROW ID", "PAST PAPER ID"]);
  if (paperRows.length) issues.push(...paperResult.issues);
  const competitionById = new Map((catalogs.competitions || []).map((item) => [item.id, item]));
  const papersById = new Map((catalogs.pastPaperCatalog || []).filter((item) => item.active !== false).map((item) => [item.id, item]));
  const selectionsByApplicant = new Map();
  selectionResult.records.forEach((row, index) => {
    const applicantId = text(row["APPLICANT ROW ID"]);
    const competition = competitionById.get(text(row["COMPETITION ID"]));
    const grade = text(row.GRADE);
    if (!competition || !(competition.grades || []).includes(grade)) {
      issues.push({ sheet: "Exam Selections", row: index + 2, field: "GRADE", message: "ไม่พบรายการสอบหรือระดับชั้นไม่ตรงกับรายการ" });
      return;
    }
    const applicantRow = applicantsResult.records.find((item) => text(item["APPLICANT ROW ID"]) === applicantId) || {};
    const formatValue = text(row["EXAM FORMAT"]) || text(applicantRow["EXAM FORMAT"]) || "Paper-Based";
    const format = /online/i.test(formatValue) ? "Online" : "Paper-Based";
    const centerCode = format === "Online" ? ONLINE_CENTER_CODE : text(row["CENTER CODE · PAPER-BASED"] || row["CENTER CODE"]) || text(applicantRow["CENTER CODE · PAPER-BASED"] || applicantRow["CENTER CODE"]);
    const center = (catalogs.centerCatalog || []).find((item) => item.code === centerCode && item.active !== false);
    if (format === "Paper-Based" && !center) issues.push({ sheet: "Exam Selections", row: index + 2, field: "CENTER CODE", message: `ไม่พบศูนย์สอบรหัส ${centerCode || "ว่าง"}` });
    selectionsByApplicant.set(applicantId, [...(selectionsByApplicant.get(applicantId) || []), { competition, grade, format, center }]);
  });
  const papersByApplicant = new Map();
  paperResult.records.forEach((row, index) => {
    const applicantId = text(row["APPLICANT ROW ID"]);
    const paperId = text(row["PAST PAPER ID"]);
    if (!paperId) return;
    const paper = papersById.get(paperId);
    if (!paper) issues.push({ sheet: "Past Papers", row: index + 2, field: "PAST PAPER ID", message: `ไม่พบข้อสอบเก่า ${paperId}` });
    else papersByApplicant.set(applicantId, [...(papersByApplicant.get(applicantId) || []), paper]);
  });
  const applicants = applicantsResult.records.filter((row) => text(row["APPLICANT ROW ID"])).map((row, index) => {
    const applicantId = text(row["APPLICANT ROW ID"]);
    const selected = selectionsByApplicant.get(applicantId) || [];
    const schoolValue = text(row["SCHOOL NAME"]);
    const listedSchools = catalogs.schools?.length ? catalogs.schools : DEFAULT_SCHOOLS;
    const school = listedSchools.includes(schoolValue) ? schoolValue : "Other";
    const selectedFormats = new Set(selected.map((item) => item.format));
    const format = selectedFormats.size > 1 ? "Mixed" : selectedFormats.has("Online") ? "Online" : "Paper-Based";
    return {
      id: `excel-applicant-${applicantId.replace(/[^a-z0-9_-]/gi, "-")}`, rowId: applicantId,
      firstName: text(row["ENGLISH FIRST NAME"]), lastName: text(row["ENGLISH LAST NAME"]), thaiFirstName: text(row["THAI FIRST NAME"]), thaiLastName: text(row["THAI LAST NAME"]),
      gender: text(row.GENDER), dateOfBirth: text(row["DATE OF BIRTH (YYYY-MM-DD)"]), schoolName: school, certificateSchoolName: text(row["CERTIFICATE SCHOOL NAME"] || (school === "Other" ? schoolValue : "")),
      email: text(row.EMAIL), examEmail: text(row["EXAM EMAIL"]), phone: text(row.PHONE), address1: text(row["ADDRESS LINE 1"]), address2: text(row["ADDRESS LINE 2"]), city: text(row["DISTRICT / CITY"]), province: text(row.PROVINCE), postalCode: text(row["POSTAL CODE"]),
      format, center: [...new Set(selected.map((item) => item.center?.name).filter(Boolean))].join(" · "),
      competitionIds: selected.map((item) => item.competition.id), formats: Object.fromEntries(selected.map((item) => [item.competition.id, item.format])), centersByCompetition: Object.fromEntries(selected.map((item) => [item.competition.id, item.center?.name || ""])), grades: Object.fromEntries(selected.map((item) => [item.competition.id, item.grade])), pastPaperIds: (papersByApplicant.get(applicantId) || []).map((item) => item.id),
    };
  });
  return { applicants, consent: legacyConsent(workbook), issues };
}

export function parseSchoolWorkbook(workbook, catalogs) {
  if (workbook?.SheetNames?.includes("Registration")) return parseSingleSheetWorkbook(worksheetRows(workbook, "Registration"), catalogs);
  if (workbook?.SheetNames?.includes("Applicants") && workbook?.SheetNames?.includes("Exam Selections")) return parseLegacyWorkbook(workbook, catalogs);
  const singleSheetName = workbook?.SheetNames?.[0];
  return parseSingleSheetWorkbook(worksheetRows(workbook, singleSheetName), catalogs);
}
