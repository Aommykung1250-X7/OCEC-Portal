const workbookRowsCache = new WeakMap();

export async function readWorkbook(file) {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const worksheets = new Map(Object.entries(workbook.Sheets || {}).map(([name, sheet]) => [
    name,
    XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false }),
  ]));
  workbookRowsCache.set(workbook, worksheets);
  return workbook;
}

export function worksheetRows(workbook, sheetName) {
  return workbookRowsCache.get(workbook)?.get(sheetName) || [];
}

export async function downloadWorkbook(sheets, filename) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  (sheets || []).forEach(({ name, rows }) => {
    const worksheet = XLSX.utils.aoa_to_sheet(rows || []);
    XLSX.utils.book_append_sheet(workbook, worksheet, String(name || "Sheet").slice(0, 31));
  });
  if (!workbook.SheetNames.length) return;
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`, { compression: true });
}
