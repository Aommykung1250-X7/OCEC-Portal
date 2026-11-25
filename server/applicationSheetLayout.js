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

function parsePortalRowRange(updatedRange) {
  const raw = String(updatedRange || '');
  const bang = raw.lastIndexOf('!');
  const a1 = bang >= 0 ? raw.slice(bang + 1) : raw;
  const match = a1.match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/i);
  if (!match) return null;
  const startCol = columnIndexFromA1(match[1]);
  const startRow = Number(match[2]);
  const endCol = match[3] ? columnIndexFromA1(match[3]) : startCol;
  const endRow = match[4] ? Number(match[4]) : startRow;
  if (startRow !== endRow || startCol !== 1 || endCol < 1 || endCol > APPLICATION_HEADERS.length) return null;
  return { rowNumber: startRow, startCol, endCol };
}

/**
 * Clear ONLY the Portal-managed columns (`0..APPLICATION_HEADERS.length`, A:Z)
 * on the single verified target row identified by developer metadata
 * (`ocecApplicationItemId`), preserving any staff-added columns (`AA+`).
 *
 * Uses `spreadsheets.values.batchUpdateByDataFilter` with `developerMetadataLookup`
 * (never a static numeric row index) and a 26-cell empty row payload so Google
 * resolves the target row by Application Item ID at write time and leaves columns
 * beyond A:Z untouched per the Google Sheets API v4 `DataFilterValueRange.values`
 * contract. Stops with `manualReviewRequired = true` on any duplicate metadata
 * (same-tab or cross-tab), target/header mismatch, missing metadataId, or
 * unexpected write response.
 */
export async function clearApplicationSheetRowByItemId(request, spreadsheetId, title, itemId, { expectedSheetId = null } = {}) {
  const normalizedItemId = String(itemId || '').trim();
  if (!normalizedItemId) throw manualReviewError('Application Item ID is required to clear a Google Sheets row');

  let sheet;
  try {
    sheet = await ensureApplicationSheetLayout(request, spreadsheetId, title);
  } catch (error) {
    if (error?.manualReviewRequired) throw error;
    if (/Application worksheet not found|Unexpected application headers/.test(String(error?.message || ''))) {
      throw manualReviewError(error.message);
    }
    throw error;
  }
  if (expectedSheetId != null && Number(sheet.sheetId) !== Number(expectedSheetId)) {
    throw manualReviewError(`Google Sheets target mismatch for item ${normalizedItemId}: expected sheetId ${expectedSheetId}, found ${sheet.sheetId} (${title})`);
  }

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
    throw manualReviewError(`Duplicate application row metadata for ${normalizedItemId} found in ${matched.length} locations (sheetIds: ${sheetIds.join(', ')}); clear stopped`);
  }
  if (!matched.length) {
    return { cleared: false, alreadyCleared: true, itemId: normalizedItemId, sheetId: sheet.sheetId };
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
    throw manualReviewError(`Unsafe metadata range for item ${normalizedItemId}; clear stopped`);
  }
  if (Number(dimRange.sheetId) !== Number(sheet.sheetId)) {
    throw manualReviewError(`Application item ${normalizedItemId} metadata found on unexpected sheetId ${dimRange.sheetId} instead of ${sheet.sheetId}; clear stopped`);
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
    const recheck = await request(`${url}/developerMetadata:search`, post({ dataFilters: [{ developerMetadataLookup: searchLookup }] }));
    const remaining = (recheck.matchedDeveloperMetadata || []).map((entry) => entry.developerMetadata).filter(Boolean);
    if (!remaining.length) {
      return { cleared: false, alreadyCleared: true, itemId: normalizedItemId, sheetId: sheet.sheetId };
    }
    throw manualReviewError(`Google Sheets clear for item ${normalizedItemId} could not safely match target row on sheetId ${sheet.sheetId} at write time; manual inspection required`);
  }

  const updatedRange = String(responses[0]?.updatedRange || '');
  const parsedRange = updatedRange ? parsePortalRowRange(updatedRange) : null;
  if (updatedRange && !parsedRange) {
    throw manualReviewError(`Google Sheets clear for item ${normalizedItemId} returned unexpected updatedRange (${updatedRange}); manual inspection required`);
  }
  if (parsedRange && parsedRange.rowNumber < 2) {
    throw manualReviewError(`Google Sheets clear for item ${normalizedItemId} resolved to protected header row ${parsedRange.rowNumber}; manual inspection required`);
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
    rowNumber: parsedRange?.rowNumber ?? (dimRange.startIndex + 1),
    clearedColumnCount: APPLICATION_HEADERS.length,
    ...(updatedRange ? { updatedRange } : {}),
  };
}
