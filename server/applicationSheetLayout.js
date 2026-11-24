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
  if (same(headers,APPLICATION_HEADERS)) return sheet;
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

/**
 * Clear a single application item row by its developer metadata (`ocecApplicationItemId`),
 * using Google Sheets `values:batchClearByDataFilter` directly and deleting the row's
 * developer metadata afterward so repeated executions are safe no-ops.
 */
export async function clearApplicationSheetRowByItemId(request, spreadsheetId, title, itemId, { expectedSheetId = null } = {}) {
  const normalizedItemId = String(itemId || '').trim();
  if (!normalizedItemId) throw new Error('Application Item ID is required to clear a Google Sheets row');
  const sheet = await ensureApplicationSheetLayout(request, spreadsheetId, title);
  if (expectedSheetId != null && Number(sheet.sheetId) !== Number(expectedSheetId)) {
    throw new Error(`Google Sheets target mismatch for item ${normalizedItemId}: expected sheetId ${expectedSheetId}, found ${sheet.sheetId} (${title})`);
  }
  const url = base(spreadsheetId);
  const lookup = {
    metadataKey: APPLICATION_ITEM_METADATA_KEY,
    metadataValue: normalizedItemId,
    locationType: 'ROW',
    visibility: 'DOCUMENT',
  };
  const found = await request(`${url}/developerMetadata:search`, post({ dataFilters: [{ developerMetadataLookup: lookup }] }));
  const matched = (found.matchedDeveloperMetadata || []).map((entry) => entry.developerMetadata).filter((meta) => meta?.location?.dimensionRange);
  const sameSheet = matched.filter((meta) => meta.location.dimensionRange.sheetId === sheet.sheetId);
  const otherSheet = matched.filter((meta) => meta.location.dimensionRange.sheetId !== sheet.sheetId);

  if (sameSheet.length > 1) {
    throw new Error(`Duplicate application row metadata for ${normalizedItemId}; clear stopped`);
  }
  if (!sameSheet.length && otherSheet.length) {
    throw new Error(`Application item ${normalizedItemId} metadata found on unexpected sheetId ${otherSheet[0].location.dimensionRange.sheetId} instead of ${sheet.sheetId}; clear stopped`);
  }
  if (!sameSheet.length) {
    return { cleared: false, alreadyCleared: true, itemId: normalizedItemId, sheetId: sheet.sheetId };
  }

  const target = sameSheet[0];
  const rowNumber = target.location.dimensionRange.startIndex + 1;
  await request(`${url}/values:batchClearByDataFilter`, post({
    dataFilters: [{ developerMetadataLookup: lookup }],
  }));
  await request(`${url}:batchUpdate`, post({
    requests: [{
      deleteDeveloperMetadata: {
        dataFilter: {
          developerMetadataLookup: {
            ...lookup,
            ...(target.metadataId != null ? { metadataId: target.metadataId } : {}),
          },
        },
      },
    }],
  }));
  return { cleared: true, alreadyCleared: false, itemId: normalizedItemId, sheetId: sheet.sheetId, rowNumber };
}

/**
 * Inspect a specific row index for legacy `sheets.clear_row` jobs that predate
 * storing `applicationItemId` in the outbox payload.
 */
export async function inspectSheetRowForLegacyClear(request, spreadsheetId, title, rowNumber) {
  const sheet = await ensureApplicationSheetLayout(request, spreadsheetId, title);
  const url = base(spreadsheetId);
  const found = await request(`${url}/developerMetadata:search`, post({
    dataFilters: [{ developerMetadataLookup: { metadataKey: APPLICATION_ITEM_METADATA_KEY, locationType: 'ROW', visibility: 'DOCUMENT' } }],
  }));
  const rowIndex = Number(rowNumber) - 1;
  const metadataValues = (found.matchedDeveloperMetadata || [])
    .map((entry) => entry.developerMetadata)
    .filter((meta) => meta?.location?.dimensionRange?.sheetId === sheet.sheetId && meta.location.dimensionRange.startIndex === rowIndex)
    .map((meta) => String(meta.metadataValue || '').trim())
    .filter(Boolean);
  const valuesResult = await request(`${url}/values/${range(title, `A${rowNumber}:Z${rowNumber}`)}`);
  const cells = valuesResult.values?.[0] || [];
  const hasNonEmptyValues = cells.some((cell) => String(cell ?? '').trim() !== '');
  return { sheet, metadataValues, hasNonEmptyValues };
}
