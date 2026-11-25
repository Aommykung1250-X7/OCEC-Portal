import test from 'node:test';
import assert from 'node:assert/strict';
import { APPLICATION_HEADERS, APPLICATION_HEADERS_WITH_MIDDLE, LEGACY_APPLICATION_HEADERS, applicationValuesFromPrevious, APPLICATION_ITEM_METADATA_KEY, applicationValuesFromLegacy, clearApplicationSheetRowByItemId, ensureApplicationSheetLayout, verifyApplicationSheetClearTarget, writeApplicationSheetRow, readApplicationSheetRows } from '../server/applicationSheetLayout.js';

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

function mockSheet(headers=LEGACY_APPLICATION_HEADERS, { spreadsheetId='workbook', sheetId=7, title='BBB - Heat 2026' } = {}) {
  const state={
    spreadsheetId,
    sheetId,
    title,
    headers:[...headers],
    rows:[Array.from({length:headers.length},(_,i)=>`value-${i}`)],
    metadata:[],
    batches:[],
    nextMetadataId:100,
    writeRequests:[],
    onAfterMetadataSearch:null,
  };
  if(headers===LEGACY_APPLICATION_HEADERS) state.rows[0][0]='item-1';
  const request=async(url,options={})=>{
    const path=decodeURIComponent(url);
    const body=options.body?JSON.parse(options.body):{};
    if(path.includes('?fields=') && path.includes('sheets.properties')) {
      return {
        spreadsheetId:state.spreadsheetId,
        sheets:[{properties:{sheetId:state.sheetId,title:state.title,gridProperties:{rowCount:2,columnCount:state.headers.length}}}],
      };
    }
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
    if(path.endsWith('/values:batchGetByDataFilter')) {
      const valueRanges=[];
      for(const filter of body.dataFilters||[]) {
        const lookup=filter.developerMetadataLookup||{};
        for(const meta of state.metadata) {
          if(!matchesDeveloperMetadata(meta,lookup)) continue;
          const dim=meta.location.dimensionRange;
          if(dim.sheetId!==state.sheetId) continue;
          const row=state.rows[dim.startIndex-1];
          if(!row) continue;
          const rowNumber=dim.startIndex+1;
          valueRanges.push({
            dataFilters:[filter],
            valueRange:{
              range:`'${state.title}'!A${rowNumber}:${columnLetter(row.length)}${rowNumber}`,
              majorDimension:'ROWS',
              values:[structuredClone(row)],
            },
          });
        }
      }
      return {spreadsheetId:state.spreadsheetId,valueRanges};
    }
    if(path.includes('!A1:AK1')) return {values:[state.headers]};
    if(path.endsWith('!A2:AK')) return {values:state.rows};
    if(path.endsWith('!A2:Z')) return {values:state.rows};
    if(path.endsWith('!A2:A')) return {values:state.rows.map(row=>[row[0]])};
    if(path.endsWith('!A:Z')) return {values:[state.headers,...state.rows]};
    if(options.method==='PUT') {
      state.writeRequests.push({method:'PUT',path,body:structuredClone(body)});
      const row=Number(path.match(/!A(\d+):/)[1])-2;
      state.rows[row]=body.values[0]; return {};
    }
    if(path.endsWith('/values:batchUpdateByDataFilter') || path.endsWith('/values:batchClearByDataFilter')) {
      state.writeRequests.push({method:options.method||'POST',path,body:structuredClone(body)});
      throw new Error(`Unexpected write request during fail-closed clear: ${path}`);
    }
    if(path.endsWith(':batchUpdate')) {
      state.writeRequests.push({method:'POST',path,body:structuredClone(body)});
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
          const {rowIndex}=req.updateCells.start;
          const values=req.updateCells.rows[0].values.map(c=>c.userEnteredValue.stringValue??c.userEnteredValue.numberValue);
          if(rowIndex===0) state.headers=values;
          else { const row=state.rows[rowIndex-1] ||= []; row.splice(req.updateCells.start.columnIndex,values.length,...values); }
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

test('verifyApplicationSheetClearTarget and clearApplicationSheetRowByItemId are strictly read-only on target checks, reject same-name/different-sheetId, legacy headers, and Sort-range swapped rows without sending any write, and are idempotent',async()=>{
  // 1) Same tab title but different sheetId (even with legacy 37-col headers!) -> MANUAL_REVIEW_REQUIRED with ZERO writes!
  {
    const {state,request}=mockSheet(LEGACY_APPLICATION_HEADERS,{sheetId:99,title:'BBB - Heat 2026'});
    await assert.rejects(
      clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7}),
      (err)=>err.manualReviewRequired===true && /expected sheetId 7, found 99/.test(err.message),
    );
    assert.equal(state.writeRequests.length,0,'same-name/different-sheetId must send ZERO write requests');
    assert.deepEqual(state.headers,LEGACY_APPLICATION_HEADERS,'legacy headers must NOT be migrated during clear');
  }

  // 2) Legacy 37-column headers -> MANUAL_REVIEW_REQUIRED with ZERO writes!
  {
    const {state,request}=mockSheet(LEGACY_APPLICATION_HEADERS,{sheetId:7,title:'BBB - Heat 2026'});
    await assert.rejects(
      verifyApplicationSheetClearTarget(request,'workbook','BBB - Heat 2026',{expectedSheetId:7}),
      (err)=>err.manualReviewRequired===true && /Legacy 37-column/.test(err.message),
    );
    await assert.rejects(
      clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7}),
      (err)=>err.manualReviewRequired===true && /Legacy 37-column/.test(err.message),
    );
    assert.equal(state.writeRequests.length,0,'legacy 37-col sheet must never be mutated by clear');
    assert.deepEqual(state.headers,LEGACY_APPLICATION_HEADERS);
  }

  // 3) Legacy 27-column headers (with middle name) -> MANUAL_REVIEW_REQUIRED with ZERO writes!
  {
    const {state,request}=mockSheet(APPLICATION_HEADERS_WITH_MIDDLE,{sheetId:7,title:'BBB - Heat 2026'});
    await assert.rejects(
      clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7}),
      (err)=>err.manualReviewRequired===true && /Legacy 27-column/.test(err.message),
    );
    assert.equal(state.writeRequests.length,0,'legacy 27-col sheet must never be mutated by clear');
    assert.deepEqual(state.headers,APPLICATION_HEADERS_WITH_MIDDLE);
  }

  // 4) Spreadsheet ID mismatch -> MANUAL_REVIEW_REQUIRED with ZERO writes!
  {
    const {state,request}=mockSheet(APPLICATION_HEADERS,{spreadsheetId:'other-workbook',sheetId:7,title:'BBB - Heat 2026'});
    await assert.rejects(
      clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7}),
      (err)=>err.manualReviewRequired===true && /spreadsheet ID mismatch/.test(err.message),
    );
    assert.equal(state.writeRequests.length,0);
  }

  // Setup normal 26-column sheet with staff columns AA:AB and two applicants A (row 2) and B (row 3)
  const {state,request}=mockSheet();
  const rowA=APPLICATION_HEADERS.map((_,i)=>i===3?'BBB':i===7?'Primary 1':i===11?'Alice':i===12?'Alpha':i===17?'alice@example.test':i===18?'0811111111':`A-${i}`);
  const rowB=APPLICATION_HEADERS.map((_,i)=>i===3?'BBB':i===7?'Primary 1':i===11?'Bob':i===12?'Bravo':i===17?'bob@example.test':i===18?'0822222222':`B-${i}`);
  await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-1',rowA);
  await writeApplicationSheetRow(request,'workbook','BBB - Heat 2026','item-2',rowB);
  state.headers.push('Staff Note','Checked By');
  state.rows[0].push('Keep note A','Officer A');
  state.rows[1].push('Keep note B','Officer B');
  state.writeRequests.length=0; // Reset write counter after initial setup

  const identityA={competition:'BBB',grade:'Primary 1',firstNameEn:'Alice',lastNameEn:'Alpha',contactEmail:'alice@example.test',contactPhone:'0811111111'};

  // 5) Sort range swaps row data (B moves into row 2, A moves into row 3) while DeveloperMetadata stays on row 2 ->
  //    read-only identity check detects Sort range swap BEFORE any write, ZERO writes sent, B + A + AA:AB stay 100% intact!
  state.onAfterMetadataSearch=()=>{
    // Swap cell values in-place WITHOUT moving metadata (simulates in-place Sort range!)
    const tmp=state.rows[0];
    state.rows[0]=state.rows[1];
    state.rows[1]=tmp;
  };
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7,expectedRowIdentity:identityA}),
    (err)=>err.manualReviewRequired===true && /possible Sort range row swap/.test(err.message),
  );
  assert.equal(state.writeRequests.length,0,'Sort range row swap must send ZERO write requests');
  assert.deepEqual(state.rows[0].slice(0,26),rowB,'Applicant B data must stay 100% intact');
  assert.deepEqual(state.rows[0].slice(26),['Keep note B','Officer B']);
  assert.deepEqual(state.rows[1].slice(0,26),rowA,'Applicant A data must stay untouched');
  assert.deepEqual(state.rows[1].slice(26),['Keep note A','Officer A']);

  // Restore row order so A is back on row 2, B on row 3
  [state.rows[0],state.rows[1]]=[state.rows[1],state.rows[0]];

  // 6) Even when row insertion + sort moves metadata after search, fail-closed stops BEFORE any write -> MANUAL_REVIEW_REQUIRED, ZERO writes!
  state.onAfterMetadataSearch=()=>{
    state.rows.unshift([...APPLICATION_HEADERS.map(()=> 'Inserted row'), 'Inserted staff col', 'Officer Z']);
    for(const metadata of state.metadata) {
      metadata.location.dimensionRange.startIndex+=1;
      metadata.location.dimensionRange.endIndex+=1;
    }
  };
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7,expectedRowIdentity:identityA}),
    (err)=>err.manualReviewRequired===true && /no write was sent to Google/.test(err.message),
  );
  assert.equal(state.writeRequests.length,0,'fail-closed clear must never send unguaranteed writes');
  assert.deepEqual(state.rows[2].slice(0,26),rowB);
  assert.deepEqual(state.rows[2].slice(26),['Keep note B','Officer B']);
  assert.deepEqual(state.rows[1].slice(26),['Keep note A','Officer A']);
  assert.equal(state.rows[0][0],'Inserted row');

  // 7) Cross-tab & same-tab duplicate metadata -> MANUAL_REVIEW_REQUIRED, ZERO writes!
  const meta2=state.metadata.find(m=>m.metadataValue==='item-2');
  state.metadata.push({...structuredClone(meta2),metadataId:9001,location:{dimensionRange:{...meta2.location.dimensionRange,sheetId:88}}});
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-2',{expectedSheetId:7}),
    (err)=>err.manualReviewRequired===true && /Duplicate application row metadata/.test(err.message),
  );
  assert.equal(state.writeRequests.length,0);
  state.metadata.pop();
  state.metadata.push({...structuredClone(meta2),metadataId:9002});
  await assert.rejects(
    clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-2',{expectedSheetId:7}),
    (err)=>err.manualReviewRequired===true && /Duplicate application row metadata/.test(err.message),
  );
  assert.equal(state.writeRequests.length,0);
  state.metadata.pop();

  // 8) Idempotent re-run: when staff has cleared A:Z on row A (preserving staff cols AA:AB), re-run succeeds as no-op with ZERO writes!
  for(let c=0;c<26;c+=1) state.rows[1][c]='';
  const alreadyBlank=await clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7,expectedRowIdentity:identityA});
  assert.deepEqual(alreadyBlank,{cleared:false,alreadyCleared:true,itemId:'item-1',sheetId:7,rowNumber:3});
  assert.equal(state.writeRequests.length,0);
  assert.deepEqual(state.rows[1].slice(26),['Keep note A','Officer A']);
  assert.deepEqual(state.rows[2].slice(0,26),rowB);

  // 9) Idempotent re-run when metadata is already deleted -> alreadyCleared: true, ZERO writes!
  state.metadata=state.metadata.filter(m=>m.metadataValue!=='item-1');
  const alreadyGone=await clearApplicationSheetRowByItemId(request,'workbook','BBB - Heat 2026','item-1',{expectedSheetId:7,expectedRowIdentity:identityA});
  assert.deepEqual(alreadyGone,{cleared:false,alreadyCleared:true,itemId:'item-1',sheetId:7});
  assert.equal(state.writeRequests.length,0);
});
