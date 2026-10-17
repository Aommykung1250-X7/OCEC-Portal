import readXlsxFile from "read-excel-file/browser";
import writeXlsxFile from "write-excel-file/browser";

const workbookRowsCache = new WeakMap();
const MAX_SPREADSHEET_BYTES = 25 * 1024 * 1024;

function normalizeCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return value;
}

function csvDelimiter(text) {
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const counts = [",", ";", "\t"].map((delimiter) => {
    let count = 0;
    let quoted = false;
    for (let index = 0; index < firstLine.length; index += 1) {
      if (firstLine[index] === '"') {
        if (quoted && firstLine[index + 1] === '"') index += 1;
        else quoted = !quoted;
      } else if (!quoted && firstLine[index] === delimiter) count += 1;
    }
    return count;
  });
  const bestIndex = counts.indexOf(Math.max(...counts));
  return counts[bestIndex] ? [",", ";", "\t"][bestIndex] : ",";
}

function parseCsv(text) {
  const input = String(text || "").replace(/^\uFEFF/, "");
  const delimiter = csvDelimiter(input);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"' && cell === "") quoted = true;
    else if (character === delimiter) {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (cell || row.length || (input && !/[\r\n]$/.test(input))) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((values) => values.map(normalizeCell));
}

function sheetName(value, usedNames) {
  const base = String(value || "Sheet").replace(/[\\/?*:[\]]/g, " ").trim().slice(0, 31) || "Sheet";
  let name = base;
  let suffix = 2;
  while (usedNames.has(name.toLocaleLowerCase())) {
    const tail = ` (${suffix})`;
    name = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }
  usedNames.add(name.toLocaleLowerCase());
  return name;
}

export async function readWorkbook(file) {
  if (!file || typeof file.arrayBuffer !== "function") throw new Error("กรุณาเลือกไฟล์ Excel หรือ CSV");
  if (file.size > MAX_SPREADSHEET_BYTES) throw new Error("ไฟล์มีขนาดใหญ่เกิน 25 MB");

  const isCsv = String(file.name || "").toLowerCase().endsWith(".csv") || file.type === "text/csv";
  const worksheets = new Map();
  let sheetNames;
  if (isCsv) {
    const name = String(file.name || "CSV").replace(/\.csv$/i, "").slice(0, 31) || "CSV";
    worksheets.set(name, parseCsv(await file.text()));
    sheetNames = [name];
  } else {
    if (!String(file.name || "").toLowerCase().endsWith(".xlsx")) {
      throw new Error("รองรับไฟล์ Excel .xlsx และไฟล์ .csv กรุณาบันทึกไฟล์ .xls เป็น .xlsx ก่อนอัปโหลด");
    }
    const parsedSheets = await readXlsxFile(file);
    parsedSheets.forEach(({ sheet, data }) => {
      worksheets.set(sheet, (data || []).map((row) => (row || []).map(normalizeCell)));
    });
    sheetNames = parsedSheets.map(({ sheet }) => sheet);
  }
  if (!sheetNames.length) throw new Error("ไม่พบชีตในไฟล์ที่เลือก");

  const workbook = { SheetNames: sheetNames, Sheets: Object.fromEntries(sheetNames.map((name) => [name, true])) };
  workbookRowsCache.set(workbook, worksheets);
  return workbook;
}

export function worksheetRows(workbook, sheetName) {
  return workbookRowsCache.get(workbook)?.get(sheetName) || [];
}

export async function downloadWorkbook(sheets, filename) {
  if (!sheets?.length) return;
  const usedNames = new Set();
  const preparedSheets = sheets.map(({ name, rows }) => ({
    sheet: sheetName(name, usedNames),
    data: (rows || []).map((row) => (row || []).map(normalizeCell)),
  }));
  const workbook = await writeXlsxFile(preparedSheets);
  const outputName = String(filename || "export.xlsx").endsWith(".xlsx") ? filename : `${filename || "export"}.xlsx`;
  await workbook.toFile(outputName);
}
