import assert from 'node:assert/strict';
import { createHash,randomUUID } from 'node:crypto';
import test from 'node:test';
import { app } from '../server/index.js';
import { getPool } from '../server/db.js';
import { seed } from '../server/seed.js';
import { listMyApplications,submitIndividualApplication,uploadCertificatePhoto,removeCertificatePhoto,updateAdminApplication } from '../server/applications.js';
import { loadCatalog,updateExamRound } from '../server/catalog.js';
import { installMockGoogleWorkspace } from './e2e/google-workspace-mock.js';

const url=process.env.TEST_DATABASE_URL;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const photo={fileName:'ignored.png',mimeType:'image/png',dataBase64:png.toString('base64')};
const guest={firstNameEn:'Parent',lastNameEn:'Smith',shirtSize:'XL'};
if(!url) test('Final package database tests require a disposable database',{skip:true},()=>{});
else {
  const target=new URL(url);
  if(!['localhost','127.0.0.1','::1'].includes(target.hostname)||!target.pathname.includes('test')||process.env.DATABASE_URL!==url)throw new Error('Use disposable local test database');
  app.log.level='silent';
  let owner,admin,ownerCookie,adminCookie;
  test.before(async()=>{
    await seed();
    const users=await getPool().query(`INSERT INTO users(google_sub,email,display_name,is_admin) VALUES($1,$2,'Package Owner',false),($3,$4,'Package Admin',true) RETURNING id,email`,[randomUUID(),`${randomUUID()}@example.test`,randomUUID(),`${randomUUID()}@example.test`]);
    [owner,admin]=users.rows.map(row=>row.id);
    const token=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
    await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(token).digest('hex'),owner]);
    ownerCookie=`ocec_session=${token}`;
    process.env.ADMIN_EMAILS=users.rows[1].email;
    const adminToken=randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
    await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[createHash('sha256').update(adminToken).digest('hex'),admin]);
    adminCookie=`ocec_session=${adminToken}`;
    await installMockGoogleWorkspace();
  });
  test.after(async()=>{await getPool().query("DELETE FROM google_workspace_connection WHERE account_email='workspace@ocec.test'");await getPool().query("UPDATE exam_rounds SET active=false,final_manually_closed=true WHERE id LIKE 'pkg-%'");await app.close();await getPool().end();});
  async function fixture(competition='timo',type='FINAL',lastName='Smith'){
    const suffix=randomUUID();
    const targetId=`pkg-target-${suffix}`,sourceRound=`pkg-source-${suffix}`;
    await getPool().query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date) VALUES($1,$2,$2,'2569',$3,current_date-10,current_date-5),($4,$2,$2,'2569',$5,current_date-1,current_date+1)`,[sourceRound,competition,type==='FINAL_X'?'FINAL':'HEAT',targetId,type]);
    await getPool().query("INSERT INTO exam_round_grades(exam_round_id,grade_id) VALUES($1,'grade-1')",[targetId]);
    await getPool().query("INSERT INTO exam_round_centers(exam_round_id,center_id) VALUES($1,'center-554')",[targetId]);
    const applicant={firstNameEn:'Anna',lastNameEn:lastName,dateOfBirth:'2017-01-01',schoolName:'Package School',contactEmail:`${suffix}@example.test`,contactPhone:'0812345678'};
    const person=(await getPool().query("INSERT INTO applicants(first_name_en,last_name_en,date_of_birth,school_name,contact_email,contact_phone) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",Object.values(applicant))).rows[0].id;
    const source=(await getPool().query("INSERT INTO applications(applicant_id,owner_user_id,source,status,registration_total_satang) VALUES($1,$2,'self','approved',75500) RETURNING id",[person,owner])).rows[0].id;
    const sourceItem=(await getPool().query("INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key,exam_number) VALUES($1,$2,'grade-1','paper','center-554',75500,'{}',$3,'SOURCE123') RETURNING id",[source,sourceRound,suffix])).rows[0].id;
    const sourceAward=competition==='bbb'&&type==='FINAL'?'1ST AWARD':'GOLD AWARD';
    await getPool().query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,$2,true,now())",[sourceItem,sourceAward]);
    await getPool().query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2)',[sourceItem,targetId]);
    return {targetId,sourceRound,source,sourceItem,candidate:{applicant,items:[{roundId:targetId,gradeId:'grade-1',format:'paper',centerId:'center-554',packageCode:'onsite_ceremony',shirtSize:'SS',guests:[guest,guest]}],pastPaperIds:[],sourceHeatApplicationId:source,source:'final',slip:photo,certificatePhoto:photo}};
  }
  test('Final package totals, Guest roster and required photo are persisted before success',async()=>{
    const f=await fixture();
    await assert.rejects(submitIndividualApplication({...f.candidate,certificatePhoto:undefined},owner),{statusCode:400});
    const created=await submitIndividualApplication(f.candidate,owner);
    assert.equal(created.total,16900);
    const saved=(await listMyApplications(owner)).find(row=>row.id===created.id);
    assert.equal(saved.competitions[0].packageCode,'onsite_ceremony');
    assert.equal(saved.competitions[0].packageFee,7900);
    assert.equal(saved.competitions[0].guestsTotal,9000);
    assert.equal(saved.competitions[0].guests.length,2);
    assert.equal(saved.competitions[0].shirtSize,'SS');
    assert.equal(saved.certificatePhoto.name,'Anna_Smith.png');
    assert.equal((await getPool().query('SELECT expected_satang FROM payments WHERE application_id=$1',[created.id])).rows[0].expected_satang,1690000);
    await assert.rejects(removeCertificatePhoto(created.id,owner,f.candidate.applicant.contactEmail),{statusCode:409});
    await getPool().query("UPDATE application_items SET exam_number='FINAL999' WHERE application_id=$1",[created.id]);
    const replacement=await uploadCertificatePhoto(created.id,photo,owner,f.candidate.applicant.contactEmail);
    assert.equal(replacement.photo.name,'Anna_Smith.png');
  });
  test('Final and Final X onsite submissions and admin edits need no selected center',async()=>{
    for (const roundType of ['FINAL','FINAL_X']) {
      const f=await fixture('bbb',roundType);
      await getPool().query('DELETE FROM exam_round_centers WHERE exam_round_id=$1',[f.targetId]);
      const {centerId,...item}=f.candidate.items[0];
      const response=await app.inject({method:'POST',url:'/api/applications/submit',headers:{cookie:ownerCookie},payload:{...f.candidate,items:[item]}});
      assert.equal(response.statusCode,201,response.body);
      const created=response.json().application;
      const saved=(await listMyApplications(owner)).find(row=>row.id===created.id);
      assert.equal(saved.competitions[0].center,'Onsite');
      assert.equal(saved.competitions[0].centerId,'center-final-overseas');
      const updated=await app.inject({method:'PATCH',url:'/api/admin/applications/'+created.id,headers:{cookie:adminCookie},payload:{profile:{...f.candidate.applicant,contactPhone:'0899999999',address:{}},items:[{...item,applicationItemId:saved.competitions[0].applicationItemId}]}});
      assert.equal(updated.statusCode,200,updated.body);
    }
  });
  test('HEAT still requires an available domestic center',async()=>{
    const f=await fixture();
    const item={roundId:'bbb-heat-2569',gradeId:'grade-1',format:'paper'};
    for (const center of [undefined,'center-final-overseas']) {
      const response=await app.inject({method:'POST',url:'/api/applications/submit',headers:{cookie:ownerCookie},payload:{applicant:f.candidate.applicant,source:'self',slip:photo,items:[{...item,...(center?{centerId:center}:{})}]}});
      assert.equal(response.statusCode,400,response.body);
    }
  });
  test('package settings save by round and never reprice submitted snapshots or use format prices',async()=>{
    const f=await fixture();
    const patched=await app.inject({method:'PATCH',url:`/api/admin/exams/${f.targetId}`,headers:{cookie:adminCookie},payload:{packagePrices:{onsite:4800,onsite_ceremony:8300},guestPrice:4700,prices:{paperBased:1,onlineExam:2}}});
    assert.equal(patched.statusCode,200,patched.body);
    const catalog=await loadCatalog();
    assert.deepEqual(catalog.exams.find(r=>r.id===f.targetId).packagePrices,{onsite:4800,onsite_ceremony:8300});
    const created=await submitIndividualApplication(f.candidate,owner);
    assert.equal(created.total,17700);
    await updateExamRound(f.targetId,{packagePrices:{onsite:5000,onsite_ceremony:9000},guestPrice:5000},admin);
    assert.equal((await listMyApplications(owner)).find(row=>row.id===created.id).totalPayment,17700);
  });
  test('forbidden packages, missing sizes and invalid Guests do not consume eligibility',async()=>{
    const f=await fixture('bbb','FINAL_X');
    for(const change of [{shirtSize:''},{packageCode:'onsite'},{guests:Array(5).fill(guest)},{guests:[{...guest,lastNameEn:''}]},{packageCode:'online',format:'online',centerId:'center-500',examEmail:'anna@example.test',guests:[guest]}]){
      const candidate={...f.candidate,items:[{...f.candidate.items[0],...change}]};
      await assert.rejects(submitIndividualApplication(candidate,owner));
      assert.equal((await getPool().query('SELECT claimed_application_id FROM final_invitations WHERE final_exam_round_id=$1',[f.targetId])).rows[0].claimed_application_id,null);
    }
    const created=await submitIndividualApplication({...f.candidate,items:[{...f.candidate.items[0],guests:[]}]},owner);
    assert.equal(created.total,7900);
    assert.equal((await listMyApplications(owner)).find(row=>row.id===created.id).certificatePhoto.name,'Anna_Smith.png');
  });
  test('admin package edits preserve booked unit prices and existing non-refundable payment behavior',async()=>{
    const f=await fixture();
    const created=await submitIndividualApplication(f.candidate,owner);
    await updateExamRound(f.targetId,{packagePrices:{onsite:5000,onsite_ceremony:9000},guestPrice:5000},admin);
    const item=(await getPool().query('SELECT id FROM application_items WHERE application_id=$1',[created.id])).rows[0];
    const input={profile:{...f.candidate.applicant,address:{}},items:[{...f.candidate.items[0],applicationItemId:item.id}]};
    await updateAdminApplication(created.id,input,admin);
    let saved=(await listMyApplications(owner)).find(row=>row.id===created.id);
    assert.equal(saved.competitions[0].packageFee,7900);
    assert.equal(saved.totalPayment,16900);
    await updateAdminApplication(created.id,{...input,items:[{...input.items[0],guests:[],shirtSize:'L'}]},admin);
    saved=(await listMyApplications(owner)).find(row=>row.id===created.id);
    assert.equal(saved.competitions[0].guests.length,0);
    assert.equal(saved.competitions[0].fee,7900);
    assert.equal(saved.competitions[0].shirtSize,'L');
    assert.equal(saved.totalPayment,16900);
    assert.equal(saved.nonRefundableAdjustment,9000);
  });
  test('profile-only admin edit keeps a saved Guest roster after results are published',async()=>{
    const f=await fixture();
    const created=await submitIndividualApplication(f.candidate,owner);
    const item=(await getPool().query('SELECT id FROM application_items WHERE application_id=$1',[created.id])).rows[0];
    await getPool().query("INSERT INTO results(application_item_id,award,eligible_for_final,published_at) VALUES($1,'SILVER AWARD',false,now())",[item.id]);
    await updateAdminApplication(created.id,{profile:{...f.candidate.applicant,contactPhone:'0899999999',address:{}},items:[{...f.candidate.items[0],applicationItemId:item.id}]},admin);
    const saved=(await listMyApplications(owner)).find(row=>row.id===created.id);
    assert.equal(saved.studentInformation.phone,'0899999999');
    assert.equal(saved.competitions[0].guests.length,2);
  });
  test('failed initial photo upload rolls back application and invitations, then retry succeeds',async()=>{
    const f=await fixture();
    const originalFetch=globalThis.fetch;
    const removed=[];
    globalThis.fetch=async(url,options={})=>{
      if(String(url).includes('/upload/drive/v3/files')&&options.body?.includes(Buffer.from('Anna_Smith.png')))return new Response(JSON.stringify({error:{message:'Photo upload failed'}}),{status:503});
      if(options.method==='DELETE')removed.push(String(url));
      return originalFetch(url,options);
    };
    try{await assert.rejects(submitIndividualApplication(f.candidate,owner));}finally{globalThis.fetch=originalFetch;}
    assert.ok(removed.length>0,'payment slip uploaded before the failed photo is removed from Drive');
    assert.equal((await getPool().query('SELECT claimed_application_id FROM final_invitations WHERE final_exam_round_id=$1',[f.targetId])).rows[0].claimed_application_id,null);
    assert.equal((await getPool().query('SELECT id FROM applications WHERE source_heat_application_id=$1',[f.source])).rowCount,0);
    assert.ok((await submitIndividualApplication(f.candidate,owner)).id);
  });
  test('submission request can carry a near-limit photo and slip together',async()=>{
    const f=await fixture();
    const bytes=Buffer.alloc(10*1024*1024);png.subarray(0,8).copy(bytes);
    const large={...photo,dataBase64:bytes.toString('base64')};
    const response=await app.inject({method:'POST',url:'/api/applications/submit',headers:{cookie:ownerCookie},payload:{...f.candidate,slip:large,certificatePhoto:large}});
    assert.equal(response.statusCode,201,response.body);
  });
  test('Online Final has its package price, no Guests, and an isolated name-only photo',async()=>{
    const f=await fixture('hkiso');
    const created=await submitIndividualApplication({...f.candidate,items:[{...f.candidate.items[0],packageCode:'online',format:'online',centerId:'center-500',examEmail:'anna@example.test',guests:[]}]},owner);
    assert.equal(created.total,4500);
    const another=await fixture('hkiso');
    const next=await submitIndividualApplication({...another.candidate,items:[{...another.candidate.items[0],guests:[]}]},owner);
    const files=await getPool().query('SELECT cp.drive_file_id,cp.file_name FROM certificate_photos cp JOIN application_items ai ON ai.id=cp.application_item_id WHERE ai.application_id=ANY($1::uuid[])',[[created.id,next.id]]);
    assert.equal(new Set(files.rows.map(row=>row.drive_file_id)).size,2);
    assert.deepEqual(files.rows.map(row=>row.file_name),['Anna_Smith.png','Anna_Smith.png']);
  });
  test('one applicant selects packages and up to four Guests independently for two competitions',async()=>{
    const first=await fixture('timo'),second=await fixture('hkiso');
    await getPool().query('UPDATE application_items SET application_id=$1 WHERE id=$2',[first.source,second.sourceItem]);
    const created=await submitIndividualApplication({...first.candidate,items:[{...first.candidate.items[0],packageCode:'onsite',guests:[]},{...second.candidate.items[0],shirtSize:'5XL',guests:Array(4).fill(guest)}]},owner);
    assert.equal(created.total,30400);
    const saved=(await listMyApplications(owner)).find(row=>row.id===created.id);
    assert.equal(saved.competitions.find(row=>row.id==='timo').guests.length,0);
    assert.equal(saved.competitions.find(row=>row.id==='hkiso').guests.length,4);
    assert.equal(saved.competitions.find(row=>row.id==='hkiso').shirtSize,'5XL');
    assert.equal((await getPool().query('SELECT count(*)::int AS count FROM certificate_photos cp JOIN application_items ai ON ai.id=cp.application_item_id WHERE ai.application_id=$1',[created.id])).rows[0].count,2);
  });
}
