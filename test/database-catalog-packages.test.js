import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {getPool} from '../server/db.js';
import {seed} from '../server/seed.js';
import {loadCatalog,saveCatalogSnapshot} from '../server/catalog.js';

const url=process.env.TEST_DATABASE_URL;
if(!url)test('package catalog database tests require a disposable database',{skip:true},()=>{});
else {
  const target=new URL(url);if(!['localhost','127.0.0.1','::1'].includes(target.hostname)||!target.pathname.includes('test')||process.env.DATABASE_URL!==url)throw new Error('Use a disposable local test database');
  test('full catalog saves persist independent package and Guest prices',async()=>{
    await seed();
    const id=`catalog-package-${randomUUID()}`;
    const actor=(await getPool().query("INSERT INTO users(google_sub,email,display_name,is_admin) VALUES($1,$2,'Catalog package admin',true) RETURNING id",[randomUUID(),`${randomUUID()}@example.test`])).rows[0].id;
    await getPool().query("INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date) VALUES($1,'timo','TIMO','2569','FINAL',current_date-2,current_date-1)",[id]);
    const catalog=await loadCatalog();
    const updated={...catalog,exams:catalog.exams.map(round=>round.id===id?{...round,packagePrices:{onsite:4800,onsite_ceremony:8300},guestPrice:4700}:round)};
    try{
      const saved=await saveCatalogSnapshot(updated,actor);
      const round=saved.exams.find(round=>round.id===id);
      assert.deepEqual(round.packagePrices,{onsite:4800,onsite_ceremony:8300});assert.equal(round.guestPrice,4700);
      const repeated=await saveCatalogSnapshot(saved,actor);
      assert.deepEqual(repeated.exams.find(round=>round.id===id).packagePrices,round.packagePrices);
    }finally{await getPool().query('UPDATE exam_rounds SET active=false,final_manually_closed=true WHERE id=$1',[id]);}
  });
  test.after(async()=>{await getPool().end();});
}
