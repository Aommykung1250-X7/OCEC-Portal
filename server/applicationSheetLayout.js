export const LEGACY_APPLICATION_HEADERS = [
  'Application Item ID', 'Application ID', 'School Batch ID', 'Submitted At', 'Application Status', 'Source',
  'Competition', 'Exam Round', 'Academic Year', 'Exam Date', 'Grade', 'Exam Mode', 'Exam Center', 'Online Exam Email',
  'First Name (EN)', 'Middle Name (EN)', 'Last Name (EN)', 'First Name (TH)', 'Last Name (TH)', 'Date of Birth',
  'School', 'Contact Email', 'Contact Phone', 'Address', 'Past Papers', 'Registration Fee (THB)', 'Past Papers Total (THB)',
  'Invoice Total (THB)', 'Payment Status', 'Payment Account ID', 'Expected Amount (THB)', 'Confirmed Amount (THB)',
  'Transfer Time', 'Confirmed Account Number', 'Slip Drive File ID', 'Exam Number', 'Certificate Photo Drive File ID',
];
export const APPLICATION_HEADERS_WITH_MIDDLE = [
  'วันที่และเวลาส่งใบสมัคร', 'สถานะใบสมัคร', 'ช่องทางสมัคร', 'รายการสอบ', 'รอบสอบ', 'ปีการสอบ',
  'วันที่สอบ', 'ระดับชั้น', 'รูปแบบการสอบ', 'ศูนย์สอบ', 'อีเมลสำหรับสอบออนไลน์',
  'ชื่อ (ภาษาอังกฤษ)', 'ชื่อกลาง (ภาษาอังกฤษ)', 'นามสกุล (ภาษาอังกฤษ)', 'ชื่อ (ภาษาไทย)', 'นามสกุล (ภาษาไทย)',
  'วันเดือนปีเกิด', 'โรงเรียน', 'อีเมลติดต่อ', 'เบอร์โทรศัพท์ติดต่อ', 'ที่อยู่', 'ข้อสอบเก่าที่สั่งซื้อ',
  'ค่าสมัครสอบรายการนี้ (บาท)', 'ค่าข้อสอบเก่ารวมต่อใบสมัคร (บาท)', 'ยอดรวมทั้งใบสมัคร (บาท)', 'สถานะการชำระเงิน', 'ยอดที่ต้องชำระตามรายการชำระเงิน (บาท)',
];
export const APPLICATION_HEADERS = APPLICATION_HEADERS_WITH_MIDDLE.filter(header => header !== 'ชื่อกลาง (ภาษาอังกฤษ)');
export const APPLICATION_ITEM_METADATA_KEY = 'ocecApplicationItemId';
const widths = [200,160,160,120,250,110,140,130,160,300,300,190,220,180,220,150,340,300,190,440,380,210,240,230,190,280];
const same = (a,b) => a.length === b.length && a.every((v,i)=>v===b[i]);
const range = (title,cells) => encodeURIComponent(`'${title.replaceAll("'", "''")}'!${cells}`);
const base = id => `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(id)}`;
const post = body => ({method:'POST', body:JSON.stringify(body)});

export function applicationValuesFromLegacy(values) {
  return applicationValuesFromPrevious([...values.slice(3,29), values[30]]);
}

export function applicationValuesFromPrevious(values) {
  const result = [...values.slice(0,12), ...values.slice(13,27)];
  result[20] = String(result[20] ?? '').split(' | ').join('\n');
  return result;
}

export function applicationRowMetadata(sheetId,rowIndex,itemId) {
  return {createDeveloperMetadata:{developerMetadata:{metadataKey:APPLICATION_ITEM_METADATA_KEY, metadataValue:itemId,
    visibility:'DOCUMENT', location:{dimensionRange:{sheetId,dimension:'ROWS',startIndex:rowIndex,endIndex:rowIndex+1}}}}};
}

export function applicationLayoutRequests(sheetId) {
  const cols=APPLICATION_HEADERS.length;
  return [
    {updateCells:{start:{sheetId,rowIndex:0,columnIndex:0}, rows:[{values:APPLICATION_HEADERS.map(header=>({userEnteredValue:{stringValue:header}}))}],fields:'userEnteredValue'}},
    {updateSheetProperties:{properties:{sheetId,gridProperties:{frozenRowCount:1}},fields:'gridProperties.frozenRowCount'}},
    {repeatCell:{range:{sheetId,startColumnIndex:0,endColumnIndex:cols},cell:{userEnteredFormat:{wrapStrategy:'WRAP',verticalAlignment:'TOP',textFormat:{fontFamily:'Arial',fontSize:11}}},fields:'userEnteredFormat'}},
    {repeatCell:{range:{sheetId,startRowIndex:0,endRowIndex:1,startColumnIndex:0,endColumnIndex:cols},cell:{userEnteredFormat:{backgroundColor:{red:0.03,green:0.16,blue:0.34},textFormat:{bold:true,foregroundColor:{red:1,green:1,blue:1}},verticalAlignment:'MIDDLE'}},fields:'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.bold,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.verticalAlignment'}},
    {updateDimensionProperties:{range:{sheetId,dimension:'ROWS',startIndex:0,endIndex:1},properties:{pixelSize:64},fields:'pixelSize'}},
    ...widths.map((pixelSize,index)=>({updateDimensionProperties:{range:{sheetId,dimension:'COLUMNS',startIndex:index,endIndex:index+1},properties:{pixelSize},fields:'pixelSize'}})),
    ...[[21,24],[25,26]].map(([startColumnIndex,endColumnIndex])=>({repeatCell:{range:{sheetId,startRowIndex:1,startColumnIndex,endColumnIndex},cell:{userEnteredFormat:{numberFormat:{type:'NUMBER',pattern:'#,##0.00'}}},fields:'userEnteredFormat.numberFormat'}})),
    {setBasicFilter:{filter:{range:{sheetId,startRowIndex:0,startColumnIndex:0,endColumnIndex:cols}}}},
  ];
}

// Keep row identities outside visible cells, including when admins sort or insert rows.
export async function ensureApplicationSheetLayout(request,spreadsheetId,title) {
  const url=base(spreadsheetId);
  const metadata=await request(`${url}?fields=sheets.properties`);
  const sheet=metadata.sheets?.find(s=>s.properties.title===title)?.properties;
  if (!sheet) throw new Error(`Application worksheet not found: ${title}`);
  const head=await request(`${url}/values/${range(title,'A1:AK1')}`);
  const headers=head.values?.[0]||[];
  if (headers.length >= APPLICATION_HEADERS.length && same(headers.slice(0, APPLICATION_HEADERS.length), APPLICATION_HEADERS)) return sheet;
  const requests=[];
  if (headers.length) {
    const legacy = same(headers,LEGACY_APPLICATION_HEADERS);
    if (!legacy && !same(headers,APPLICATION_HEADERS_WITH_MIDDLE)) throw new Error(`Unexpected application headers in ${title}; no columns changed`);
    const existing = await request(`${url}/values/${range(title,'A2:AK')}`);
    if (legacy) {
      const ids=await request(`${url}/values/${range(title,'A2:A')}`);
      (ids.values||[]).forEach((row,index)=>{if(row[0]) requests.push(applicationRowMetadata(sheet.sheetId,index+1,row[0]));});
      for (const [startIndex,endIndex] of [[31,37],[29,30],[0,3]]) requests.push({deleteDimension:{range:{sheetId:sheet.sheetId,dimension:'COLUMNS',startIndex,endIndex}}});
    }
    requests.push({deleteDimension:{range:{sheetId:sheet.sheetId,dimension:'COLUMNS',startIndex:12,endIndex:13}}});
    for (const [index,values] of (existing.values||[]).entries()) {
      const papers = legacy ? applicationValuesFromLegacy(values)[20] : applicationValuesFromPrevious(values)[20];
      requests.push({updateCells:{start:{sheetId:sheet.sheetId,rowIndex:index+1,columnIndex:20},rows:[{values:[{userEnteredValue:{stringValue:String(papers??'')}}]}],fields:'userEnteredValue'}});
    }
    if(existing.values?.length) requests.push({autoResizeDimensions:{dimensions:{sheetId:sheet.sheetId,dimension:'ROWS',startIndex:1,endIndex:existing.values.length+1}}});
  } else if (sheet.gridProperties.columnCount < APPLICATION_HEADERS.length) {
    requests.push({appendDimension:{sheetId:sheet.sheetId,dimension:'COLUMNS',length:APPLICATION_HEADERS.length-sheet.gridProperties.columnCount}});
  }
  requests.push(...applicationLayoutRequests(sheet.sheetId));
  await request(`${url}:batchUpdate`,post({requests}));
  return sheet;
}

export async function writeApplicationSheetRow(request,spreadsheetId,title,itemId,values) {
  const sheet=await ensureApplicationSheetLayout(request,spreadsheetId,title);
  const url=base(spreadsheetId);
  const found=await request(`${url}/developerMetadata:search`,post({dataFilters:[{developerMetadataLookup:{metadataKey:APPLICATION_ITEM_METADATA_KEY,metadataValue:itemId,locationType:'ROW',visibility:'DOCUMENT'}}]}));
  const matches=(found.matchedDeveloperMetadata||[]).map(m=>m.developerMetadata.location.dimensionRange).filter(r=>r.sheetId===sheet.sheetId);
  if(matches.length>1) throw new Error('Duplicate application row metadata; sync stopped');
  if(matches.length) {
    const rowNumber=matches[0].startIndex+1;
    await request(`${url}/values/${range(title,`A${rowNumber}:Z${rowNumber}`)}?valueInputOption=RAW`,{method:'PUT',body:JSON.stringify({values:[values]})});
    await request(`${url}:batchUpdate`,post({requests:[{autoResizeDimensions:{dimensions:{sheetId:sheet.sheetId,dimension:'ROWS',startIndex:rowNumber-1,endIndex:rowNumber}}}]}));
    return {outcome:'updated',rowNumber};
  }
  const existing=await request(`${url}/values/${range(title,'A:Z')}`);
  const rowIndex=Math.max(1,existing.values?.length||0);
  const requests=[];
  if(rowIndex>=sheet.gridProperties.rowCount) requests.push({appendDimension:{sheetId:sheet.sheetId,dimension:'ROWS',length:rowIndex-sheet.gridProperties.rowCount+1}});
  requests.push({updateCells:{start:{sheetId:sheet.sheetId,rowIndex,columnIndex:0},rows:[{values:values.map(value=>({userEnteredValue:typeof value==='number'?{numberValue:value}:{stringValue:String(value??'')}}))}],fields:'userEnteredValue'}},applicationRowMetadata(sheet.sheetId,rowIndex,itemId));
  requests.push({autoResizeDimensions:{dimensions:{sheetId:sheet.sheetId,dimension:'ROWS',startIndex:rowIndex,endIndex:rowIndex+1}}});
  await request(`${url}:batchUpdate`,post({requests}));
  return {outcome:'inserted',rowNumber:rowIndex+1};
}

export async function readApplicationSheetRows(request,spreadsheetId,title) {
  const sheet=await ensureApplicationSheetLayout(request,spreadsheetId,title);
  const url=base(spreadsheetId);
  const result=await request(`${url}/developerMetadata:search`,post({dataFilters:[{developerMetadataLookup:{metadataKey:APPLICATION_ITEM_METADATA_KEY,locationType:'ROW',visibility:'DOCUMENT'}}]}));
  const rows=await request(`${url}/values/${range(title,'A2:Z')}`);
  const values=new Map();
  for(const {developerMetadata:metadata} of result.matchedDeveloperMetadata||[]) {
    const location=metadata.location.dimensionRange;
    if(location.sheetId===sheet.sheetId && rows.values?.[location.startIndex-1]) values.set(metadata.metadataValue,rows.values[location.startIndex-1]);
  }
  return values;
}

function manualReviewError(message) {
  const error = new Error(message);
  error.manualReviewRequired = true;
  return error;
}

function columnIndexFromA1(letters) {
  let index = 0;
  for (const ch of String(letters || '').toUpperCase()) {
    if (ch < 'A' || ch > 'Z') return -1;
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
  return index;
}

function unquoteSheetTitle(rawTitle) {
  const value = String(rawTitle || '');
  if (!value) return '';
  if (value.startsWith("'") && value.endsWith("'") && value.length >= 2) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

function parseTargetRowValueRange(a1Notation, expectedTitle) {
  const raw = String(a1Notation || '').trim();
  const bang = raw.lastIndexOf('!');
  if (bang <= 0) return null;
  const sheetTitle = unquoteSheetTitle(raw.slice(0, bang));
  if (sheetTitle !== expectedTitle) return null;
  const a1 = raw.slice(bang + 1);
  const match = a1.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const startCol = columnIndexFromA1(match[1]);
  const startRow = Number(match[2]);
  const endCol = columnIndexFromA1(match[3]);
  const endRow = Number(match[4]);
  if (
    !Number.isInteger(startRow)
    || startRow < 2
    || startRow !== endRow
    || startCol !== 1
    || endCol < APPLICATION_HEADERS.length
  ) {
    return null;
  }
  return { sheetTitle, rowNumber: startRow, startCol, endCol, range: raw };
}

function parsePortalClearRange(a1Notation, expectedTitle) {
  const raw = String(a1Notation || '').trim();
  const bang = raw.lastIndexOf('!');
  if (bang <= 0) return null;
  const sheetTitle = unquoteSheetTitle(raw.slice(0, bang));
  if (sheetTitle !== expectedTitle) return null;
  const a1 = raw.slice(bang + 1);
  const match = a1.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) return null;
  const startCol = columnIndexFromA1(match[1]);
  const startRow = Number(match[2]);
  const endCol = columnIndexFromA1(match[3]);
  const endRow = Number(match[4]);
  if (
    !Number.isInteger(startRow)
    || startRow < 2
    || startRow !== endRow
    || startCol !== 1
    || endCol < 1
    || endCol > APPLICATION_HEADERS.length
  ) {
    return null;
  }
  return { sheetTitle, rowNumber: startRow, startCol, endCol, range: raw };
}

function matchesClearDataFilter(matchedRange, expectedLookup) {
  const filters = matchedRange?.dataFilters;
  if (!Array.isArray(filters) || !filters.length) return false;
  return filters.some((filter) => {
    const lookup = filter?.developerMetadataLookup;
    if (!lookup) return false;
    return (
      Number(lookup.metadataId) === Number(expectedLookup.metadataId)
      && lookup.metadataKey === expectedLookup.metadataKey
      && lookup.metadataValue === expectedLookup.metadataValue
      && lookup.locationType === expectedLookup.locationType
      && Number(lookup.metadataLocation?.sheetId) === Number(expectedLookup.metadataLocation.sheetId)
    );
  });
}

function normalizeCellCompare(value) {
  return String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

const IDENTITY_COLUMN_CHECKS = [
  ['competition', 3],
  ['grade', 7],
  ['firstNameEn', 11],
  ['lastNameEn', 12],
  ['contactEmail', 17],
  ['contactPhone', 18],
];

/**
 * Pure read-only target verification for Google Sheets clear jobs.
 * Never creates, migrates, formats, or mutates any worksheet or headers.
 * Verifies spreadsheet ID, worksheet title & sheetId, and current 26-column
 * Portal headers (A1:Z1, preserving staff-added columns AA+).
 */
export async function verifyApplicationSheetClearTarget(request, spreadsheetId, title, { expectedSheetId = null } = {}) {
  const normalizedSpreadsheetId = String(spreadsheetId || '').trim();
  const normalizedTitle = String(title || '').trim();
  if (!normalizedSpreadsheetId || !normalizedTitle) {
    throw manualReviewError('Spreadsheet ID and worksheet title are required to verify Google Sheets clear target');
  }
  const url = base(normalizedSpreadsheetId);
  const metadata = await request(`${url}?fields=spreadsheetId,sheets.properties`);
  if (metadata?.spreadsheetId && String(metadata.spreadsheetId) !== normalizedSpreadsheetId) {
    throw manualReviewError(`Google Sheets spreadsheet ID mismatch: expected ${normalizedSpreadsheetId}, found ${metadata.spreadsheetId}`);
  }
  const sheet = metadata?.sheets?.find((s) => s.properties?.title === normalizedTitle)?.properties;
  if (!sheet) {
    throw manualReviewError(`Application worksheet not found: ${normalizedTitle}`);
  }
  if (expectedSheetId != null && Number(sheet.sheetId) !== Number(expectedSheetId)) {
    throw manualReviewError(`Google Sheets target mismatch for "${normalizedTitle}": expected sheetId ${expectedSheetId}, found ${sheet.sheetId}`);
  }

  const head = await request(`${url}/values/${range(normalizedTitle, 'A1:AK1')}`);
  const headers = head?.values?.[0] || [];
  if (headers.length >= APPLICATION_HEADERS.length && same(headers.slice(0, APPLICATION_HEADERS.length), APPLICATION_HEADERS)) {
    return sheet;
  }
  if (same(headers, LEGACY_APPLICATION_HEADERS)) {
    throw manualReviewError(`Legacy 37-column application headers detected in "${normalizedTitle}" (sheetId ${sheet.sheetId}); clear stopped without modifying the sheet`);
  }
  if (same(headers, APPLICATION_HEADERS_WITH_MIDDLE)) {
    throw manualReviewError(`Legacy 27-column application headers detected in "${normalizedTitle}" (sheetId ${sheet.sheetId}); clear stopped without modifying the sheet`);
  }
  throw manualReviewError(`Unexpected or missing application headers in "${normalizedTitle}" (sheetId ${sheet.sheetId}); clear stopped without modifying the sheet`);
}

/**
 * Automatically clear ONLY the Portal-managed columns (`0..APPLICATION_HEADERS.length`, A:Z)
 * on the single verified target row identified by developer metadata (`ocecApplicationItemId`),
 * preserving the header row, cell formatting, other applicants' rows, and any staff-added
 * columns outside A:Z (`AA+`).
 *
 * 1. Verifies target spreadsheet ID, tab sheetId, and current A1:Z1 headers strictly
 *    read-only (never calls `ensureApplicationSheetLayout` or mutates layout).
 * 2. Searches workbook-wide developer metadata (`ocecApplicationItemId`):
 *    - 0 matches -> idempotent no-op ONLY if `hasVerifiedClearEvidence` confirms a prior
 *      verified clear for this exact `(applicationItemId, spreadsheetId, sheetId)`;
 *      otherwise `manualReviewRequired` (0 writes).
 *    - >1 matches (same-tab or cross-tab) -> `manualReviewRequired` (0 writes).
 *    - Validates single data ROW on expected `sheetId` with valid `metadataId`.
 * 3. Reads current row values via `values:batchGetByDataFilter` (bound to `clearLookup`):
 *    - Stops BEFORE writing (`manualReviewRequired`, 0 writes) if metadata vanished mid-read,
 *      `valueRange` is missing/ambiguous, A:Z is already blank without prior clear evidence
 *      (possible Sort-range row move leaving stale metadata on an empty row), or row content
 *      mismatches `expectedRowIdentity` (possible Sort-range row swap).
 * 4. Executes the write via `spreadsheets.values.batchUpdateByDataFilter` bound to
 *    `clearLookup` (`Application Item ID` + `metadataId` + `sheetId`, NEVER a static row index)
 *    with a 26-cell empty row payload so Google resolves the row at write time and leaves
 *    columns beyond A:Z and cell formatting intact per the Google Sheets API v4 contract.
 * 5. Deletes ONLY that item's developer metadata via `deleteDeveloperMetadata` (`clearLookup`).
 */
export async function clearApplicationSheetRowByItemId(
  request,
  spreadsheetId,
  title,
  itemId,
  { expectedSheetId = null, expectedRowIdentity = null, hasVerifiedClearEvidence = false } = {},
) {
  const normalizedItemId = String(itemId || '').trim();
  if (!normalizedItemId) throw manualReviewError('Application Item ID is required to clear a Google Sheets row');

  const sheet = await verifyApplicationSheetClearTarget(request, spreadsheetId, title, { expectedSheetId });

  const url = base(spreadsheetId);
  const searchLookup = {
    metadataKey: APPLICATION_ITEM_METADATA_KEY,
    metadataValue: normalizedItemId,
    visibility: 'DOCUMENT',
  };
  const found = await request(`${url}/developerMetadata:search`, post({ dataFilters: [{ developerMetadataLookup: searchLookup }] }));
  const matched = (found.matchedDeveloperMetadata || []).map((entry) => entry.developerMetadata).filter(Boolean);

  if (matched.length > 1) {
    const sheetIds = matched.map((meta) => meta?.location?.dimensionRange?.sheetId ?? 'unknown');
    throw manualReviewError(`Duplicate application row metadata for ${normalizedItemId} found in ${matched.length} locations (sheetIds: ${sheetIds.join(', ')}); clear stopped without modifying the sheet`);
  }
  if (!matched.length) {
    if (hasVerifiedClearEvidence) {
      return {
        cleared: false,
        alreadyCleared: true,
        itemId: normalizedItemId,
        sheetId: sheet.sheetId,
      };
    }
    throw manualReviewError(
      `Application item ${normalizedItemId} metadata was not found on "${title}" (sheetId ${sheet.sheetId}) and no prior clear record exists; manual inspection required without modifying the sheet`,
    );
  }

  const target = matched[0];
  const dimRange = target?.location?.dimensionRange;
  if (
    !dimRange
    || dimRange.dimension !== 'ROWS'
    || !Number.isInteger(dimRange.startIndex)
    || dimRange.startIndex < 1
    || dimRange.endIndex !== dimRange.startIndex + 1
  ) {
    throw manualReviewError(`Unsafe metadata range for item ${normalizedItemId}; clear stopped without modifying the sheet`);
  }
  if (Number(dimRange.sheetId) !== Number(sheet.sheetId)) {
    throw manualReviewError(`Application item ${normalizedItemId} metadata found on unexpected sheetId ${dimRange.sheetId} instead of ${sheet.sheetId}; clear stopped without modifying the sheet`);
  }
  if (!Number.isInteger(target.metadataId) || target.metadataId <= 0) {
    throw manualReviewError(`Application item ${normalizedItemId} metadata is missing a valid metadataId; manual inspection required`);
  }

  const clearLookup = {
    metadataId: target.metadataId,
    metadataKey: APPLICATION_ITEM_METADATA_KEY,
    metadataValue: normalizedItemId,
    visibility: 'DOCUMENT',
    locationType: 'ROW',
    metadataLocation: { sheetId: sheet.sheetId },
    locationMatchingStrategy: 'INTERSECTING_LOCATION',
  };

  const readResult = await request(`${url}/values:batchGetByDataFilter`, post({
    dataFilters: [{ developerMetadataLookup: clearLookup }],
    majorDimension: 'ROWS',
    valueRenderOption: 'UNFORMATTED_VALUE',
  }));
  const valueRanges = Array.isArray(readResult?.valueRanges) ? readResult.valueRanges : [];
  if (valueRanges.length > 1) {
    throw manualReviewError(`Google Sheets read for item ${normalizedItemId} matched ${valueRanges.length} rows; manual inspection required without modifying the sheet`);
  }
  if (valueRanges.length === 0) {
    throw manualReviewError(
      `Application item ${normalizedItemId} metadata disappeared or could not be read between search and row verification on "${title}" (sheetId ${sheet.sheetId}); manual inspection required without modifying the sheet`,
    );
  }

  const matchedRange = valueRanges[0];
  if (!matchesClearDataFilter(matchedRange, clearLookup)) {
    throw manualReviewError(
      `Google Sheets read for item ${normalizedItemId} did not confirm matching developerMetadata filter on "${title}" (sheetId ${sheet.sheetId}); manual inspection required without modifying the sheet`,
    );
  }
  const valueRange = matchedRange?.valueRange;
  if (!valueRange || typeof valueRange !== 'object') {
    throw manualReviewError(
      `Google Sheets read for item ${normalizedItemId} is missing valueRange on "${title}" (sheetId ${sheet.sheetId}); manual inspection required without modifying the sheet`,
    );
  }
  if (valueRange.majorDimension != null && valueRange.majorDimension !== 'ROWS') {
    throw manualReviewError(
      `Google Sheets read for item ${normalizedItemId} returned unexpected majorDimension "${valueRange.majorDimension}" on "${title}" (sheetId ${sheet.sheetId}); manual inspection required without modifying the sheet`,
    );
  }
  const parsedRange = parseTargetRowValueRange(valueRange.range, title);
  if (!parsedRange) {
    throw manualReviewError(
      `Google Sheets read for item ${normalizedItemId} returned ambiguous or incomplete range "${valueRange.range || ''}" (must be a single data row covering A:Z on "${title}"); manual inspection required without modifying the sheet`,
    );
  }
  const observedRowNumber = parsedRange.rowNumber;
  if (valueRange.values != null) {
    if (!Array.isArray(valueRange.values) || valueRange.values.length > 1) {
      throw manualReviewError(
        `Google Sheets read for item ${normalizedItemId} returned unexpected row count (${Array.isArray(valueRange.values) ? valueRange.values.length : 'non-array'}) for "${parsedRange.range}"; manual inspection required without modifying the sheet`,
      );
    }
    if (valueRange.values.length === 1 && !Array.isArray(valueRange.values[0])) {
      throw manualReviewError(
        `Google Sheets read for item ${normalizedItemId} returned malformed row payload for "${parsedRange.range}"; manual inspection required without modifying the sheet`,
      );
    }
  }

  const rowCells = valueRange.values?.[0] || [];
  const portalCells = Array.from({ length: APPLICATION_HEADERS.length }, (_, idx) => String(rowCells[idx] ?? '').trim());
  if (portalCells.every((cell) => cell === '')) {
    if (hasVerifiedClearEvidence) {
      return {
        cleared: false,
        alreadyCleared: true,
        itemId: normalizedItemId,
        sheetId: sheet.sheetId,
        rowNumber: observedRowNumber,
      };
    }
    throw manualReviewError(
      `Metadata row "${parsedRange.range}" (sheetId ${sheet.sheetId}) for item ${normalizedItemId} is already empty in A:Z without a prior clear record (applicant data may have moved via Sort range); clear stopped without modifying the sheet`,
    );
  }

  if (expectedRowIdentity && typeof expectedRowIdentity === 'object') {
    const mismatches = [];
    for (const [field, colIndex] of IDENTITY_COLUMN_CHECKS) {
      const expected = normalizeCellCompare(expectedRowIdentity[field]);
      if (!expected) continue;
      const actual = normalizeCellCompare(portalCells[colIndex]);
      if (actual !== expected) mismatches.push(field);
    }
    if (mismatches.length) {
      throw manualReviewError(
        `Row content on "${title}" (sheetId ${sheet.sheetId}) row ${observedRowNumber} does not match expected applicant identity for item ${normalizedItemId} (mismatched fields: ${mismatches.join(', ')}; possible Sort range row swap while metadata stayed in place); clear stopped without modifying the sheet`,
      );
    }
  }

  // Bind the clear command directly to Application Item ID metadata at Google write time
  // and send exactly APPLICATION_HEADERS.length (26, A:Z) empty strings so header, formatting,
  // other rows, and staff-added columns (AA+) remain intact.
  const updateResult = await request(`${url}/values:batchUpdateByDataFilter`, post({
    valueInputOption: 'RAW',
    data: [
      {
        dataFilter: { developerMetadataLookup: clearLookup },
        majorDimension: 'ROWS',
        values: [Array(APPLICATION_HEADERS.length).fill('')],
      },
    ],
  }));

  const responses = Array.isArray(updateResult?.responses) ? updateResult.responses : [];
  const totalUpdatedRows = Number(updateResult?.totalUpdatedRows ?? responses.reduce((sum, entry) => sum + Number(entry?.updatedRows || 0), 0));
  const totalUpdatedColumns = Number(updateResult?.totalUpdatedColumns ?? responses.reduce((max, entry) => Math.max(max, Number(entry?.updatedColumns || 0)), 0));

  if (responses.length > 1 || totalUpdatedRows > 1) {
    throw manualReviewError(`Google Sheets clear for item ${normalizedItemId} matched ${Math.max(responses.length, totalUpdatedRows)} rows; manual inspection required`);
  }
  if (totalUpdatedColumns > APPLICATION_HEADERS.length) {
    throw manualReviewError(`Google Sheets clear for item ${normalizedItemId} exceeded Portal columns (${totalUpdatedColumns} > ${APPLICATION_HEADERS.length}); manual inspection required`);
  }
  if (responses.length === 0 || totalUpdatedRows === 0) {
    throw manualReviewError(`Google Sheets clear for item ${normalizedItemId} did not match target row on "${title}" (sheetId ${sheet.sheetId}) at write time; manual inspection required`);
  }

  const updatedRange = String(responses[0]?.updatedRange || '');
  const parsedUpdated = updatedRange ? parsePortalClearRange(updatedRange, title) : null;
  if (updatedRange && !parsedUpdated) {
    throw manualReviewError(`Google Sheets clear for item ${normalizedItemId} returned unexpected updatedRange (${updatedRange}); manual inspection required`);
  }

  await request(`${url}:batchUpdate`, post({
    requests: [
      {
        deleteDeveloperMetadata: {
          dataFilter: { developerMetadataLookup: clearLookup },
        },
      },
    ],
  }));

  return {
    cleared: true,
    alreadyCleared: false,
    itemId: normalizedItemId,
    sheetId: sheet.sheetId,
    rowNumber: parsedUpdated?.rowNumber ?? observedRowNumber,
    clearedColumnCount: APPLICATION_HEADERS.length,
    metadataId: target.metadataId,
    ...(updatedRange ? { updatedRange } : {}),
  };
}
