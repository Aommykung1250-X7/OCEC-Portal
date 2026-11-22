import { expect,test } from '@playwright/test';
import pg from 'pg';
import { closeFixtures,createSchoolFinalFixture,makeHeatSelfOwned } from './fixtures.js';

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
test.afterAll(closeFixtures);
async function openForm(page,competition='bbb'){
  const fixture=await createSchoolFinalFixture();
  await page.goto('/api/auth/google/start?returnTo=/final/confirm&testPersona=candidate');
  await makeHeatSelfOwned(fixture.heatApplicationId);
  if(competition==='timo'){
    const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
    try{
      const source=`${fixture.roundId}-heat`;
      await db.query("INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date) VALUES($1,'timo','TIMO','2569','HEAT',current_date-20,current_date-10)",[source]);
      await db.query('UPDATE application_items SET exam_round_id=$1 WHERE application_id=$2',[source,fixture.heatApplicationId]);
      await db.query("UPDATE exam_rounds SET competition_id='timo',title='TIMO' WHERE id=$1",[fixture.roundId]);
    }finally{await db.end();}
  }
  await page.reload();
  await page.getByRole('tab',{name:'สมัครด้วยบัญชีตนเอง'}).click();
  const choice=page.locator('.final-rights-match').filter({hasText:fixture.name});
  await choice.getByRole('button',{name:'สมัครรอบ Final',exact:true}).click();
  await expect(page.getByRole('heading',{name:'สมัครสอบ Final',exact:true})).toBeVisible();
  return fixture;
}
async function profile(page){
  await page.getByLabel('ชื่อ (ภาษาไทย)').fill('แอนนา');
  await page.getByLabel('นามสกุล (ภาษาไทย)').fill('ทดสอบ');
  await page.locator('input[name="gender"][value="Female"]').check();
  await page.getByLabel('Address Line 1 / ที่อยู่').fill('123 Test Road');
  await page.getByLabel('District / City / เขตหรืออำเภอ').fill('Bangkok');
  await page.getByLabel('Province / จังหวัด').fill('Bangkok');
  await page.getByLabel('Postal Code / รหัสไปรษณีย์').fill('10110');
}
test('Final packages calculate Guests, require photo/size, and submit a complete pending registration',async({page})=>{
  const fixture=await openForm(page);
  const fields=page.locator('.final-package-fields');
  await expect(fields).toBeVisible();
  await expect(page.locator('.competition-format-picker')).toHaveCount(0);
  await fields.getByRole('radio',{name:/Onsite \+ เข้าร่วมรับรางวัล/}).check();
  await fields.getByLabel('ไซซ์เสื้อผู้สมัคร BBB',{exact:true}).selectOption('M');
  for(let i=1;i<=4;i++)await fields.getByRole('button',{name:'เพิ่ม Guest',exact:true}).click();
  await expect(fields.getByRole('button',{name:'เพิ่ม Guest',exact:true})).toBeDisabled();
  await fields.getByRole('radio',{name:/Online/}).check();
  await expect(fields.locator('.final-guest-row')).toHaveCount(0);
  await expect(page.locator('.payment-total-grand strong')).toHaveText('฿4,500');
  await fields.getByRole('radio',{name:/Onsite \+ เข้าร่วมรับรางวัล/}).check();
  for(let i=1;i<=2;i++){
    await fields.getByRole('button',{name:'เพิ่ม Guest',exact:true}).click();
    await fields.getByLabel(`ชื่อภาษาอังกฤษ Guest ${i}`,{exact:true}).fill(`Parent${i}`);
    await fields.getByLabel(`นามสกุลภาษาอังกฤษ Guest ${i}`,{exact:true}).fill('Smith');
    await fields.getByLabel(`ไซซ์เสื้อ Guest ${i}`,{exact:true}).selectOption('XL');
  }
  await expect(page.locator('.payment-total-grand strong')).toHaveText('฿16,900');
  await profile(page);
  await expect(page.locator('.competition-center-field')).toHaveCount(0);
  await expect(page.locator('.center-poster-preview')).toHaveCount(0);
  await page.getByLabel('แนบหลักฐานการชำระเงิน',{exact:true}).setInputFiles({name:'slip.png',mimeType:'image/png',buffer:png});
  await page.locator('.confirm-check input').first().check();
  await page.getByRole('button',{name:'ส่งใบสมัคร',exact:true}).click();
  const photo=page.getByLabel('รูปสำหรับเกียรติบัตร',{exact:true});
  await expect(photo).toBeVisible();
  expect(await photo.evaluate(input=>input.validity.valueMissing)).toBe(true);
  await photo.setInputFiles({name:'certificate.png',mimeType:'image/png',buffer:png});
  await page.getByRole('button',{name:'ส่งใบสมัคร',exact:true}).click();
  await expect(page.getByRole('heading',{name:'รายละเอียดใบสมัคร',exact:true})).toBeVisible();
  await expect(page.locator('.final-booking-summary')).toContainText('Parent1 Smith');
  await expect(page.locator('.final-booking-summary')).toContainText('Parent2 Smith');
  await expect(page.locator('.certificate-photo-preview')).toContainText(`${fixture.firstName}_Student.png`);
  await expect(page.locator('.certificate-photo-remove')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.final-booking-summary')).toContainText('16,900');
  const applicationId=new URL(page.url()).pathname.split('/').at(-1);
  const db=new pg.Client({connectionString:process.env.DATABASE_URL});await db.connect();
  try{await db.query('UPDATE exam_rounds SET active=false WHERE id=$1',[fixture.roundId]);}finally{await db.end();}
  await page.goto(`/api/auth/google/start?returnTo=/portal-admin/applications/${applicationId}/edit&testPersona=admin`);
  const editor=page.locator('.admin-edit-competition-options .final-package-fields');
  await expect(editor.getByLabel('ไซซ์เสื้อผู้สมัคร BBB',{exact:true})).toHaveValue('M');
  await page.getByLabel('หมายเลขโทรศัพท์').fill('0899999999');
  await page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();
  await expect(page.locator('.final-booking-summary')).toContainText('Guest 2 คน');
  await page.goto(`/portal-admin/applications/${applicationId}/edit`);
  await editor.getByRole('button',{name:'ลบ Guest 1',exact:true}).click();
  await editor.getByRole('button',{name:'ลบ Guest 1',exact:true}).click();
  await page.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();
  await expect(page.locator('.final-booking-summary')).toContainText('Guest 0 คน');
  await expect(page.locator('.final-booking-summary')).toContainText('7,900');
});
test('TIMO offers only its two onsite packages and the new form stays within mobile bounds',async({page})=>{
  await openForm(page,'timo');
  const fields=page.locator('.final-package-fields');
  await expect(fields.getByRole('radio')).toHaveCount(2);
  await expect(fields.getByRole('radio',{name:/Online/})).toHaveCount(0);
  await fields.getByRole('radio',{name:/^Onsite ฿4,500/}).check();
  await expect(fields.getByRole('button',{name:'เพิ่ม Guest',exact:true})).toHaveCount(0);
  await expect(page.locator('.payment-total-grand strong')).toHaveText('฿4,500');
  for(const width of [320,768,1024,1440]){
    await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.fonts.ready);
    const bounds=await fields.evaluate(element=>({right:element.getBoundingClientRect().right,scroll:element.scrollWidth,client:element.clientWidth}));
    expect(bounds.right).toBeLessThanOrEqual(width);expect(bounds.scroll).toBeLessThanOrEqual(bounds.client);
    if(width===320||width===1440)await fields.screenshot({path:`outputs/final-packages/form-${width}.png`});
  }
});
test('admin edits round-specific package and Guest prices instead of format prices',async({page})=>{
  const fixture=await createSchoolFinalFixture();
  await page.goto('/api/auth/google/start?returnTo=/portal-admin/exams&testPersona=admin');
  const round=page.locator(`[id="admin-exam-${fixture.roundId}"]`);
  await round.locator('summary').click();
  const fields=round.locator('.final-package-price-fields');
  await expect(fields).toBeVisible();
  await expect(fields.getByRole('spinbutton')).toHaveCount(3);
  await expect(round.locator('.admin-round-price-edit')).toHaveCount(0);
  await fields.getByLabel('ราคาแพ็กเกจ Onsite + เข้าร่วมรับรางวัล',{exact:true}).fill('8900');
  await fields.getByLabel('ราคา Guest ต่อคน',{exact:true}).fill('4700');
  const saved=page.waitForResponse(response=>response.url().endsWith(`/api/admin/exams/${fixture.roundId}`)&&response.request().method()==='PATCH'&&response.ok());
  await round.getByRole('button',{name:'บันทึกรอบนี้',exact:true}).click();await saved;
  await page.reload();await round.locator('summary').click();
  await expect(fields.getByLabel('ราคาแพ็กเกจ Onsite + เข้าร่วมรับรางวัล',{exact:true})).toHaveValue('8900');
  await expect(fields.getByLabel('ราคา Guest ต่อคน',{exact:true})).toHaveValue('4700');
});
