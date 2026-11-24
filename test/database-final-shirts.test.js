import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import test from 'node:test';
import { app } from '../server/index.js';
import { getPool } from '../server/db.js';
import { seed } from '../server/seed.js';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  test('Final shirts database workflow requires a disposable database', { skip: 'Use npm run test:db' }, () => {});
} else {
  const target = new URL(testUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(target.hostname) || !target.pathname.includes('test') || process.env.DATABASE_URL !== testUrl) throw new Error('Use a disposable local test database');
  app.log.level = 'silent';
  const suffix = randomUUID();
  const applicantEmail = `shirt-child-${suffix}@example.test`;
  let owner, admin, stranger, child, applicationId, items, ownerCookie, adminCookie, strangerCookie, childCookie;
  const sizes = ['SS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];

  async function sessionFor(id) {
    const token = randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
    await getPool().query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')", [createHash('sha256').update(token).digest('hex'), id]);
    return `ocec_session=${token}`;
  }
  const save = (entries, cookie = ownerCookie) => app.inject({ method: 'PUT', url: `/api/applications/${applicationId}/shirt-sizes`, headers: { cookie }, payload: { items: entries } });
  const entry = (index, shirtSize) => ({ applicationItemId: items[index].id, shirtSize });
  async function stored() { return (await getPool().query('SELECT shirt_size FROM application_items WHERE application_id=$1 ORDER BY exam_round_id', [applicationId])).rows.map(row => row.shirt_size); }

  test.before(async () => {
    await seed();
    const users = await getPool().query(`INSERT INTO users(google_sub,email,display_name,is_admin) VALUES
      ($1,$2,'Shirt Coordinator',false),($3,$4,'Shirt Admin',true),($5,$6,'Stranger',false),($7,$8,'Shirt Child',false) RETURNING id`,
    [`shirt-owner-${suffix}`, `shirt-owner-${suffix}@example.test`, `shirt-admin-${suffix}`, `shirt-admin-${suffix}@example.test`, `shirt-stranger-${suffix}`, `shirt-stranger-${suffix}@example.test`, `shirt-child-${suffix}`, applicantEmail]);
    [owner, admin, stranger, child] = users.rows.map(row => row.id);
    process.env.ADMIN_EMAILS = `shirt-admin-${suffix}@example.test`;
    [ownerCookie, adminCookie, strangerCookie, childCookie] = await Promise.all([owner,admin,stranger,child].map(sessionFor));
    const applicant = await getPool().query(`INSERT INTO applicants(first_name_en,last_name_en,date_of_birth,school_name,contact_email,contact_phone)
      VALUES('Shirt','Student','2017-01-01','Shirt School',$1,'0812345678') RETURNING id`, [applicantEmail]);
    applicationId = (await getPool().query("INSERT INTO applications(applicant_id,owner_user_id,source,status,registration_total_satang) VALUES($1,$2,'self','approved',0) RETURNING id", [applicant.rows[0].id, owner])).rows[0].id;
    items = [];
    for (const [index, competition] of ['bbb','hkiso'].entries()) {
      const roundId = `shirt-${suffix}-${index}`;
      await getPool().query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date) VALUES($1,$2,'Shirt Final','2569','FINAL',current_date-10,current_date-1)`, [roundId,competition]);
      const item = await getPool().query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key,exam_number)
        VALUES($1,$2,'grade-1','paper','center-554',0,'{}',$3,$4) RETURNING id`, [applicationId,roundId,randomUUID(),`SHIRT${index}`]);
      items.push({ id: item.rows[0].id, roundId });
    }
  });
  test.after(async () => { await app.close(); await getPool().end(); });

  test('each fixed size persists per Final item without a photo or admin image', async () => {
    assert.deepEqual(await stored(), [null,null]);
    for (const size of sizes) {
      const response = await save([entry(0,size),entry(1,'SS')]);
      assert.equal(response.statusCode,200,response.body);
      assert.deepEqual(await stored(), [size,'SS']);
    }
    const response = await app.inject({ url: '/api/applications/mine', headers: { cookie: ownerCookie } });
    const application = response.json().applications.find(row => row.id === applicationId);
    assert.equal(application.competitions.find(row => row.applicationItemId === items[0].id).shirtSize,'5XL');
    assert.equal(application.certificatePhoto,null);
    assert.ok((await getPool().query("SELECT 1 FROM audit_logs WHERE entity_id=$1 AND action='update_shirt_sizes'", [applicationId])).rowCount);
  });

  test('strangers, unverified matching-email users, and Final-grant-only users are forbidden; owner and admin can save', async () => {
    assert.equal((await save([entry(0,'M')], strangerCookie)).statusCode,403);
    assert.equal((await save([entry(0,'M')], childCookie)).statusCode,403);
    // Even with a live bound final_verification_grants record, non-owner CANNOT edit shirt sizes on another owner's application (OCEC-12)
    const heatRoundId = `shirt-heat-${suffix}`;
    await getPool().query("INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date) VALUES($1,'bbb','Shirt Heat','2569','HEAT',current_date-30,current_date-20)", [heatRoundId]);
    const heatItemId = (await getPool().query(`INSERT INTO application_items(application_id,exam_round_id,grade_id,format,center_id,fee_satang,snapshot,duplicate_key)
      VALUES($1,$2,'grade-1','paper','center-554',0,'{}',$3) RETURNING id`, [applicationId, heatRoundId, randomUUID()])).rows[0].id;
    const invId = (await getPool().query('INSERT INTO final_invitations(heat_application_item_id,final_exam_round_id) VALUES($1,$2) RETURNING id', [heatItemId, items[0].roundId])).rows[0].id;
    await getPool().query(`INSERT INTO final_verification_grants(token_hash,final_invitation_id,heat_application_id,heat_application_item_id,verified_user_id,expires_at)
      VALUES($1,$2,$3,$4,$5,now()+interval '1 hour')`, [createHash('sha256').update(`grant-${suffix}`).digest('hex'), invId, applicationId, heatItemId, child]);
    assert.equal((await save([entry(0,'M')], childCookie)).statusCode,403);
    await getPool().query('DELETE FROM final_verification_grants WHERE heat_application_id=$1', [applicationId]);
    await getPool().query('DELETE FROM final_invitations WHERE id=$1', [invId]);
    await getPool().query('DELETE FROM application_items WHERE id=$1', [heatItemId]);
    assert.equal((await save([entry(0,'L')], adminCookie)).statusCode,200);
  });

  test('invalid sizes, duplicate items and foreign items fail atomically', async () => {
    const before = await stored();
    for (const entries of [[entry(0,'XXL')], [entry(0,'S'),entry(0,'M')], [entry(0,'SS'),{ applicationItemId: randomUUID(), shirtSize: 'M' }]]) {
      const response = await save(entries);
      assert.equal(response.statusCode,400,response.body);
      assert.deepEqual(await stored(),before);
    }
    await assert.rejects(getPool().query("UPDATE application_items SET shirt_size='XXL' WHERE id=$1", [items[0].id]), { code: '23514' });
  });

  test('submitted Final and Final X sizes open immediately, while HEAT and rejected/draft applications are blocked', async () => {
    for(const status of ['pending','slip_issue','approved']){
      await getPool().query('UPDATE applications SET status=$1 WHERE id=$2',[status,applicationId]);
      assert.equal((await save([entry(0,'S')])).statusCode,200);
    }
    for(const status of ['draft','rejected']){
      await getPool().query('UPDATE applications SET status=$1 WHERE id=$2',[status,applicationId]);
      assert.equal((await save([entry(0,'M')])).statusCode,409);
    }
    await getPool().query("UPDATE applications SET status='pending' WHERE id=$1",[applicationId]);
    await getPool().query('UPDATE exam_rounds SET close_date=current_date+1 WHERE id=$1',[items[1].roundId]);
    await getPool().query('UPDATE application_items SET exam_number=NULL WHERE application_id=$1',[applicationId]);
    await getPool().query("UPDATE exam_rounds SET round_type='FINAL_X' WHERE id=$1",[items[0].roundId]);
    assert.equal((await save([entry(0,'XL')])).statusCode,200);
    await getPool().query("UPDATE exam_rounds SET round_type='HEAT' WHERE id=$1",[items[0].roundId]);
    assert.equal((await save([entry(0,'M')])).statusCode,400);
    assert.equal((await stored())[0],'XL');
    await getPool().query("UPDATE exam_rounds SET round_type='FINAL' WHERE id=$1",[items[0].roundId]);
  });

  test('optional shirt images support admin-only upload, public serving, replacement validation and removal', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
    const payload = { mimeType: 'image/png', dataBase64: png.toString('base64') };
    for (const kind of ['chart','sample']) {
      const url = `/api/admin/final-shirt-images/${kind}`;
      assert.equal((await app.inject({ url: `/api/final-shirt-images/${kind}` })).statusCode,404);
      const forbidden = await app.inject({ method: 'PUT',url,headers: { cookie: ownerCookie },payload });
      assert.equal(forbidden.statusCode,403,forbidden.body);
      const uploaded = await app.inject({ method: 'PUT',url,headers: { cookie: adminCookie },payload });
      assert.equal(uploaded.statusCode,200,uploaded.body);
      assert.ok(uploaded.json().version);
      const catalog = (await app.inject({ url: '/api/catalog' })).json();
      assert.equal(catalog.finalShirtImages[kind],uploaded.json().version);
      const image = await app.inject({ url: `/api/final-shirt-images/${kind}` });
      assert.equal(image.headers['x-content-type-options'],'nosniff');
      assert.deepEqual(image.rawPayload,png);
      assert.equal((await app.inject({ url: `/api/final-shirt-images/${kind}`, headers: { 'if-none-match': image.headers.etag } })).statusCode,304);
      for (const invalid of [{ mimeType: 'image/png',dataBase64: 'AAAA' },{ mimeType: 'image/gif',dataBase64: payload.dataBase64 }, { mimeType: 'image/png',dataBase64: Buffer.alloc(5*1024*1024+1).toString('base64') }]) {
        assert.equal((await app.inject({ method: 'PUT',url,headers: { cookie: adminCookie },payload: invalid })).statusCode,400);
      }
      assert.deepEqual((await app.inject({ url: `/api/final-shirt-images/${kind}` })).rawPayload,png);
      assert.equal((await app.inject({ method: 'DELETE',url,headers: { cookie: ownerCookie } })).statusCode,403);
      assert.equal((await app.inject({ method: 'DELETE',url,headers: { cookie: adminCookie } })).statusCode,200);
      assert.equal((await app.inject({ url: `/api/final-shirt-images/${kind}` })).statusCode,404);
      assert.ok(!Object.hasOwn((await app.inject({ url: '/api/catalog' })).json().finalShirtImages,kind));
    }
  });
}
