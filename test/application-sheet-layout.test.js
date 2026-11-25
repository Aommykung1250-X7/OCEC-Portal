import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLICATION_HEADERS, APPLICATION_HEADERS_WITH_MIDDLE, LEGACY_APPLICATION_HEADERS, applicationValuesFromPrevious, APPLICATION_ITEM_METADATA_KEY, applicationValuesFromLegacy, clearApplicationSheetRowByItemId, ensureApplicationSheetLayout, writeApplicationSheetRow, readApplicationSheetRows } from '../server/applicationSheetLayout.js';

function columnLetter(count) {
  let value = count;
  let output = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    output = String.fromCharCode(65 + remainder) + output;
    value = Math.floor((value - 1) / 26);
  }
  return output;
}

function matchesDeveloperMetadata(meta, lookup = {}) {
  if (lookup.metadataId != null && meta.metadataId !== lookup.metadataId) return false;
  if (lookup.metadataKey && meta.metadataKey !== lookup.metadataKey) return false;
  if (lookup.metadataValue && meta.metadataValue !== lookup.metadataValue) return false;
  if (lookup.visibility && meta.visibility !== lookup.visibility) return false;
  const dim = meta.location?.dimensionRange;
  if (lookup.locationType === 'ROW' && dim?.dimension !== 'ROWS') return false;
  if (lookup.metadataLocation?.sheetId != null && Number(dim?.sheetId) !== Number(lookup.metadataLocation.sheetId)) return false;
  return true;
}

function mockSheet(headers=LEGACY_APPLICATION_HEADERS) {
  const state={
    headers:[...headers],
    rows:[Array.from({length:headers.length},(_,i)=>`value-${i}`)],
    metadata:[],
    batches:[],
    nextMetadataId:100,
    dataFilterUpdates:[],
    staticClearUpdateCells:[],
    onAfterMetadataSearch:null,
  };
  if(headers===LEGACY_APPLICATION_HEADERS) state.rows[0][0]='item-1';
  const request=async(url,options={})=>{
    const path=decodeURIComponent(url);
    const body=options.body?JSON.parse(options.body):{};
    if(path.includes('?fields=sheets.properties')) return {sheets:[{properties:{sheetId:7,title:'BBB - Heat 2026',gridProperties:{rowCount:2,columnCount:state.headers.length}}}]};
    if(path.includes('/developerMetadata:search')) {
      const lookup=body.dataFilters?.[0]?.developerMetadataLookup||{};
      const matched=state.metadata.filter(m=>matchesDeveloperMetadata(m,lookup)).map(developerMetadata=>({developerMetadata:structuredClone(developerMetadata)}));
      if(state.onAfterMetadataSearch) {
        const hook=state.onAfterMetadataSearch;
        state.onAfterMetadataSearch=null;
        hook({lookup,matched});
      }
      return {matchedDeveloperMetadata:matched};
    }
    if(path.includes('!A1:AK1')) return {values:[state.headers]};
    if(path.endsWith('!A2:AK')) return {values:state.rows};
    if(path.endsWith('!A2:Z')) return {values:state.rows};
    if(path.endsWith('!A2:A')) return {values:state.rows.map(row=>[row[0]])};
    if(path.endsWith('!A:Z')) return {values:[state.headers,...state.rows]};
    if(options.method==='PUT') {
      const row=Number(path.match(/!A(\d+):/)[1])-2;
      state.rows[row]=body.values[0]; return {};
    }
    if(path.endsWith('/values:batchUpdateByDataFilter')) {
      state.dataFilterUpdates.push(structuredClone(body));
      const responses=[];
      let totalUpdatedRows=0;
      let totalUpdatedColumns=0;
      let totalUpdatedCells=0;
      for(const entry of body.data||[]) {
        const lookup=entry.dataFilter?.developerMetadataLookup||{};
        const rowValues=entry.values?.[0]||[];
        for(const meta of state.metadata) {
          if(!matchesDeveloperMetadata(meta,lookup)) continue;
          const dim=meta.location.dimensionRange;
          if(dim.sheetId!==7) continue;
          const rowIdx=dim.startIndex-1;
          const row=state.rows[rowIdx];
          if(!row) continue;
          if(rowValues.length>row.length) throw new Error('Values exceed matched range');
          for(let c=0;c<rowValues.length;c+=1) row[c]=rowValues[c];
          const rowNumber=dim.startIndex+1;
          totalUpdatedRows+=1;
          totalUpdatedColumns=Math.max(totalUpdatedColumns,rowValues.length);
          totalUpdatedCells+=rowValues.length;
          responses.push({
            spreadsheetId:'workbook',
            updatedRange:`'BBB - Heat 2026'!A${rowNumber}:${columnLetter(rowValues.length)}${rowNumber}`,
            updatedRows:1,
            updatedColumns:rowValues.length,
            updatedCells:rowValues.length,
            dataFilter:entry.dataFilter,
          });
        }
      }
      return {
        spreadsheetId:'workbook',
        totalUpdatedRows,
        totalUpdatedColumns,
        totalUpdatedCells,
        totalUpdatedSheets:responses.length?1:0,
        responses,
      };
    }
    if(path.endsWith(':batchUpdate')) {
      state.batches.push(body.requests);
      for(const req of body.requests) {
        if(req.deleteDimension) {
          const {startIndex,endIndex}=req.deleteDimension.range;
          state.headers.splice(startIndex,endIndex-startIndex);
          state.rows.forEach(row=>row.splice(startIndex,endIndex-startIndex));
        }
        if(req.createDeveloperMetadata) {
          state.metadata.push({
            metadataId:state.nextMetadataId++,
            ...req.createDeveloperMetadata.developerMetadata,
          });
        }
        if(req.deleteDeveloperMetadata) {
          const lookup=req.deleteDeveloperMetadata.dataFilter?.developerMetadataLookup||{};
          state.metadata=state.metadata.filter(m=>!matchesDeveloperMetadata(m,lookup));
        }
        if(req.updateCells) {
          if (req.updateCells.range && !req.updateCells.rows) {
            state.staticClearUpdateCells.push(req.updateCells);
            const { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex } = req.updateCells.range;
            if (sheetId === 7) {
              for (let r = startRowIndex; r < endRowIndex; r += 1) {
                const row = state.rows[r - 1];
                if (!row) continue;
                for (let c = startColumnIndex; c < Math.min(endColumnIndex, row.length); c += 1) row[c] = '';
              }
            }
          } else {
            const {rowIndex}=req.updateCells.start;
            const values=req.updateCells.rows[0].values.map(c=>c.userEnteredValue.stringValue??c.userEnteredValue.numberValue);
            if(rowIndex===0) state.headers=values;
            else { const row=state.rows[rowIndex-1] ||= []; row.splice(req.updateCells.start.columnIndex,values.length,...values); }
          }
        }
      }
      return {};
    }
    throw new Error(`Unexpected request ${path}`);
  };
  return {state,request};
}

test('removes exactly original A:C, AD and AF:AK; preserves remaining data and row identity',async()=>{
  const {state,request}=mockSheet();
  const oldRow=[...state.rows[0]];
  await ensureApplicationSheetLayout(request,'workbook','BBB - Heat 2026');
  assert.equal(APPLICATION_HEADERS.length,26);
  assert.deepEqual(state.rows[0],applicationValuesFromLegacy(oldRow));
  assert.deepEqual(state.rows[0],[...oldRow.slice(3,15),...oldRow.slice(16,29),oldRow[30]]);
  assert.deepEqual(state.headers,APPLICATION_HEADERS);
  assert.equal(state.metadata[0].metadataValue,'item-1');
  assert.equal(state.metadata[0].metadataKey,APPLICATION_ITEM_METADATA_KEY);
  assert.equal(state.metadata[0].location.dimensionRange.startIndex,1);
  const batches=state.batches.length;
  await ensureApplicationSheetLayout(request,'workbook','BBB - Heat 2026');
  assert.equal(state.batches.length,batches,'repeated migration must not delete additional columns');
});

test('updates migrated rows through metadata and inserts values and identity atomically',async()=>{
  const {state,request}=mockSheet();
  const values=APPLICATION_HEADERS.map((_,i)=>i===22?100:`new-${i}`);
  const first=await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-1',values);
  assert.deepEqual(first,{outcome:'updated',rowNumber:2});
  const second=await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-2',values);
  assert.deepEqual(second,{outcome:'inserted',rowNumber:3});
  const last=state.batches.at(-1);
  assert.ok(last.some(r=>r.appendDimension?.dimension==='ROWS'));
  assert.ok(last.some(r=>r.updateCells));
  assert.ok(last.some(r=>r.createDeveloperMetadata));
  const retry=await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-2',values);
  assert.equal(retry.outcome,'updated');
  assert.equal(state.rows.length,2);
});

test('unknown layouts stop before destructive changes',async()=>{
  const {state,request}=mockSheet(['Custom header']);
  await assert.rejects(ensureApplicationSheetLayout(request,'workbook','BBB - Heat 2026'),/Unexpected application headers/);
  assert.equal(state.batches.length,0);
});

test('migrates the existing 27-column sheet and splits past papers into separate lines',async()=>{
  const {state,request}=mockSheet(APPLICATION_HEADERS_WITH_MIDDLE);
  state.rows[0][21]='Paper 2024 — Level 1 | Paper 2025 — Level 1';
  const before=[...state.rows[0]];
  await ensureApplicationSheetLayout(request,'workbook','BBB - Heat 2026');
  assert.deepEqual(state.headers,APPLICATION_HEADERS);
  assert.deepEqual(state.rows[0],applicationValuesFromPrevious(before));
  assert.equal(state.rows[0][20],'Paper 2024 — Level 1\nPaper 2025 — Level 1');
  assert.equal(state.metadata.length,0,'existing row identities are preserved');
  assert.ok(state.batches[0].some(r=>r.autoResizeDimensions));
});

test('Mock source reads and application updates follow row metadata after sorting',async()=>{
  const {state,request}=mockSheet();
  const first=APPLICATION_HEADERS.map(()=> 'First applicant');
  const second=APPLICATION_HEADERS.map(()=> 'Second applicant');
  await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-1',first);
  await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-2',second);
  state.rows.reverse();
  for(const metadata of state.metadata) {
    const location=metadata.location.dimensionRange;
    location.startIndex=location.startIndex===1?2:1;
    location.endIndex=location.startIndex+1;
  }
  const source=await readApplicationSheetRows(request,'workbook','BBB - Heat 2026');
  assert.deepEqual(source.get('item-1'),first);
  assert.deepEqual(source.get('item-2'),second);
  const updated=await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-1',first);
  assert.equal(updated.rowNumber,3);
  assert.deepEqual(state.rows[0],second);
});

test('clearApplicationSheetRowByItemId binds clear to Application Item ID at write time even if sorted/inserted after search, preserves staff columns, stops for manual review when unsafe, and is idempotent',async()=>{
  const {state,request}=mockSheet();
  const first=APPLICATION_HEADERS.map(()=> 'Applicant A');
  const second=APPLICATION_HEADERS.map(()=> 'Applicant B');
  await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-1',first);
  await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-2',second);
  // Staff adds extra custom columns (AA, AB) to header and rows
  state.headers.push('Staff Note', 'Checked By');
  state.rows[0].push('Keep note A', 'Officer A');
  state.rows[1].push('Keep note B', 'Officer B');

  // Target mismatch stops before any write
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:99}),
    (err)=>err.manualReviewRequired===true && /target mismatch/.test(err.message),
  );
  assert.equal(state.dataFilterUpdates.length,0);

  // Simulate staff sorting AND inserting a row AFTER developerMetadata:search finds item-1 at row 2
  // and BEFORE the clear write executes: row 2 becomes Inserted, row 3 becomes Applicant B, row 4 becomes Applicant A!
  let searchSawRow2=false;
  state.onAfterMetadataSearch=({matched})=>{
    searchSawRow2=matched.length===1 && matched[0].developerMetadata.location.dimensionRange.startIndex===1;
    state.rows.reverse();
    for(const metadata of state.metadata) {
      const location=metadata.location.dimensionRange;
      location.startIndex=location.startIndex===1?2:1;
      location.endIndex=location.startIndex+1;
    }
    state.rows.unshift([...APPLICATION_HEADERS.map(()=> 'Inserted row'), 'Inserted staff col', 'Officer Z']);
    for(const metadata of state.metadata) {
      metadata.location.dimensionRange.startIndex+=1;
      metadata.location.dimensionRange.endIndex+=1;
    }
  };

  const cleared=await clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7});
  assert.equal(searchSawRow2,true,'search originally located item-1 at row 2 before mid-flight sort/insert');
  assert.equal(state.staticClearUpdateCells.length,0,'must never clear via static numeric row index');
  assert.equal(state.dataFilterUpdates.length,1,'must clear via values:batchUpdateByDataFilter');
  assert.equal(state.dataFilterUpdates[0].valueInputOption,'RAW');
  assert.equal(state.dataFilterUpdates[0].data[0].dataFilter.developerMetadataLookup.metadataValue,'item-1');
  assert.equal(state.dataFilterUpdates[0].data[0].values[0].length,APPLICATION_HEADERS.length);
  assert.deepEqual(cleared,{
    cleared:true,
    alreadyCleared:false,
    itemId:'item-1',
    sheetId:7,
    rowNumber:4,
    clearedColumnCount:26,
    updatedRange:"'BBB - Heat 2026'!A4:Z4",
  });
  // Applicant A's moved row (row 4 = index 2) has ONLY Portal columns A:Z cleared; staff columns AA:AB preserved!
  assert.ok(state.rows[2].slice(0,26).every(cell=>cell===''));
  assert.deepEqual(state.rows[2].slice(26),['Keep note A','Officer A']);
  // Applicant B (now row 3 = index 1) and inserted row (row 2 = index 0) are 100% intact!
  assert.deepEqual(state.rows[1].slice(0,26),second);
  assert.deepEqual(state.rows[1].slice(26),['Keep note B','Officer B']);
  assert.equal(state.rows[0][0],'Inserted row');
  assert.deepEqual(state.rows[0].slice(26),['Inserted staff col','Officer Z']);

  // Re-run is an idempotent no-op
  const repeat=await clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7});
  assert.deepEqual(repeat,{cleared:false,alreadyCleared:true,itemId:'item-1',sheetId:7});
  assert.equal(state.dataFilterUpdates.length,1);
  assert.deepEqual(state.rows[1].slice(0,26),second);
  assert.deepEqual(state.rows[2].slice(26),['Keep note A','Officer A']);

  // Mid-flight unsafe relocation after search (metadata moves to another tab before write) -> manualReviewRequired, B untouched!
  state.onAfterMetadataSearch=()=>{
    const liveMeta=state.metadata.find(m=>m.metadataValue==='item-2');
    liveMeta.location.dimensionRange.sheetId=88;
  };
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-2',{expectedSheetId:7}),
    (err)=>err.manualReviewRequired===true && /could not safely match target row/.test(err.message),
  );
  assert.deepEqual(state.rows[1].slice(0,26),second,'Applicant B must stay intact when clear cannot match target safely');
  assert.deepEqual(state.rows[1].slice(26),['Keep note B','Officer B']);
  // Restore sheetId=7 for duplicate tests
  state.metadata.find(m=>m.metadataValue==='item-2').location.dimensionRange.sheetId=7;

  // Cross-tab duplicate metadata (same item-2 on sheetId 7 AND sheetId 88) stops before clearing!
  const meta2=state.metadata.find(m=>m.metadataValue==='item-2');
  state.metadata.push({
    ...structuredClone(meta2),
    metadataId:9001,
    location:{dimensionRange:{...meta2.location.dimensionRange,sheetId:88}},
  });
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-2',{expectedSheetId:7}),
    (err)=>err.manualReviewRequired===true && /Duplicate application row metadata/.test(err.message),
  );
  assert.deepEqual(state.rows[1].slice(0,26),second);

  // Same-tab duplicate metadata also stops before clearing
  state.metadata.pop();
  state.metadata.push({...structuredClone(meta2),metadataId:9002});
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-2',{expectedSheetId:7}),
    (err)=>err.manualReviewRequired===true && /Duplicate application row metadata/.test(err.message),
  );
  assert.deepEqual(state.rows[1].slice(0,26),second);
});
