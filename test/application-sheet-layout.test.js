import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLICATION_HEADERS, APPLICATION_HEADERS_WITH_MIDDLE, LEGACY_APPLICATION_HEADERS, applicationValuesFromPrevious, APPLICATION_ITEM_METADATA_KEY, applicationValuesFromLegacy, clearApplicationSheetRowByItemId, ensureApplicationSheetLayout, writeApplicationSheetRow, readApplicationSheetRows } from '../server/applicationSheetLayout.js';

function mockSheet(headers=LEGACY_APPLICATION_HEADERS) {
  const state={headers:[...headers],rows:[Array.from({length:headers.length},(_,i)=>`value-${i}`)],metadata:[],batches:[]};
  if(headers===LEGACY_APPLICATION_HEADERS) state.rows[0][0]='item-1';
  const request=async(url,options={})=>{
    const path=decodeURIComponent(url);
    const body=options.body?JSON.parse(options.body):{};
    if(path.includes('?fields=sheets.properties')) return {sheets:[{properties:{sheetId:7,title:'BBB - Heat 2026',gridProperties:{rowCount:2,columnCount:state.headers.length}}}]};
    if(path.includes('/developerMetadata:search')) return {matchedDeveloperMetadata:state.metadata.filter(m=>!body.dataFilters[0].developerMetadataLookup.metadataValue || m.metadataValue===body.dataFilters[0].developerMetadataLookup.metadataValue).map(developerMetadata=>({developerMetadata}))};
    if(path.includes('!A1:AK1')) return {values:[state.headers]};
    if(path.endsWith('!A2:AK')) return {values:state.rows};
    if(path.endsWith('!A2:Z')) return {values:state.rows};
    if(path.endsWith('!A2:A')) return {values:state.rows.map(row=>[row[0]])};
    if(path.endsWith('!A:Z')) return {values:[state.headers,...state.rows]};
    if(options.method==='PUT') {
      const row=Number(path.match(/!A(\d+):/)[1])-2;
      state.rows[row]=body.values[0]; return {};
    }
    if(path.endsWith('/values:batchClearByDataFilter')) {
      for(const filter of body.dataFilters||[]) {
        const lookup=filter.developerMetadataLookup||{};
        for(const meta of state.metadata) {
          if(meta.metadataKey===lookup.metadataKey && meta.metadataValue===lookup.metadataValue && meta.location.dimensionRange.sheetId===7) {
            state.rows[meta.location.dimensionRange.startIndex-1]=Array(APPLICATION_HEADERS.length).fill('');
          }
        }
      }
      return {};
    }
    if(path.endsWith(':batchUpdate')) {
      state.batches.push(body.requests);
      for(const req of body.requests) {
        if(req.deleteDimension) {
          const {startIndex,endIndex}=req.deleteDimension.range;
          state.headers.splice(startIndex,endIndex-startIndex);
          state.rows.forEach(row=>row.splice(startIndex,endIndex-startIndex));
        }
        if(req.createDeveloperMetadata) state.metadata.push(req.createDeveloperMetadata.developerMetadata);
        if(req.deleteDeveloperMetadata) {
          const lookup=req.deleteDeveloperMetadata.dataFilter?.developerMetadataLookup||{};
          state.metadata=state.metadata.filter(m=>!(m.metadataKey===lookup.metadataKey && m.metadataValue===lookup.metadataValue));
        }
        if(req.updateCells) {
          if (req.updateCells.range && !req.updateCells.rows) {
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

test('clearApplicationSheetRowByItemId clears only Portal columns on the moved target row, preserves staff columns, stops on same-tab or cross-tab duplicates, and is idempotent',async()=>{
  const {state,request}=mockSheet();
  const first=APPLICATION_HEADERS.map(()=> 'First applicant');
  const second=APPLICATION_HEADERS.map(()=> 'Second applicant');
  await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-1',first);
  await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-2',second);
  // Staff adds extra custom columns (AA, AB) to header and rows
  state.headers.push('Staff Note', 'Checked By');
  state.rows[0].push('Keep note 1', 'Officer A');
  state.rows[1].push('Keep note 2', 'Officer B');
  // Sort and insert a row above so item-1 moves from row 2 to row 4
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
  await assert.rejects(clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:99}),/target mismatch/);
  const cleared=await clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7});
  assert.deepEqual(cleared,{cleared:true,alreadyCleared:false,itemId:'item-1',sheetId:7,rowNumber:4,clearedColumnCount:26});
  // Portal columns A:Z cleared, staff columns AA:AB preserved!
  assert.ok(state.rows[2].slice(0,26).every(cell=>cell===''));
  assert.deepEqual(state.rows[2].slice(26),['Keep note 1','Officer A']);
  assert.deepEqual(state.rows[1].slice(0,26),second);
  assert.deepEqual(state.rows[1].slice(26),['Keep note 2','Officer B']);
  assert.equal(state.rows[0][0],'Inserted row');
  // Re-run is an idempotent no-op
  const repeat=await clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7});
  assert.deepEqual(repeat,{cleared:false,alreadyCleared:true,itemId:'item-1',sheetId:7});
  assert.deepEqual(state.rows[1].slice(0,26),second);
  assert.deepEqual(state.rows[2].slice(26),['Keep note 1','Officer A']);
  // Cross-tab duplicate metadata (same item-2 on sheetId 7 AND sheetId 88) stops before clearing!
  const meta2=state.metadata.find(m=>m.metadataValue==='item-2');
  state.metadata.push({
    ...meta2,
    location:{dimensionRange:{...meta2.location.dimensionRange,sheetId:88}},
  });
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-2',{expectedSheetId:7}),
    (err)=>err.manualReviewRequired===true && /Duplicate application row metadata/.test(err.message),
  );
  assert.deepEqual(state.rows[1].slice(0,26),second);
  // Same-tab duplicate metadata also stops before clearing
  state.metadata.pop();
  state.metadata.push({...meta2});
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-2',{expectedSheetId:7}),
    (err)=>err.manualReviewRequired===true && /Duplicate application row metadata/.test(err.message),
  );
  assert.deepEqual(state.rows[1].slice(0,26),second);
});
