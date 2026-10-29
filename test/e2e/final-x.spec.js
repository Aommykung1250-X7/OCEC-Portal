import { expect, test } from '@playwright/test';
import pg from 'pg';
import { closeFixtures, createSchoolFinalFixture, makeHeatSelfOwned } from './fixtures.js';

test.afterAll(closeFixtures);

test('BBB Final medal holder sees the Final X invitation and opens the correct prefilled registration form', async ({ page }) => {
  const fixture = await createSchoolFinalFixture();
  await page.goto('/api/auth/google/start?returnTo=/final/confirm&testPersona=candidate');
  const ownerId = await makeHeatSelfOwned(fixture.heatApplicationId);
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    const sourceRoundId = `${fixture.roundId}-source`;
    await db.query(`INSERT INTO exam_rounds(id,competition_id,title,year,round_type,open_date,close_date)
      VALUES($1,'bbb','BBB Final','2569','FINAL',current_date-20,current_date-10)`, [sourceRoundId]);
    await db.query('UPDATE application_items SET exam_round_id=$1 WHERE application_id=$2', [sourceRoundId, fixture.heatApplicationId]);
    await db.query("UPDATE exam_rounds SET round_type='FINAL_X' WHERE id=$1", [fixture.roundId]);
    await db.query("UPDATE results SET award='GOLD AWARD' WHERE application_item_id IN (SELECT id FROM application_items WHERE application_id=$1)", [fixture.heatApplicationId]);
    await db.query(`UPDATE applicants ap SET contact_email=u.email FROM applications a,users u
      WHERE a.id=$1 AND a.applicant_id=ap.id AND u.id=$2`, [fixture.heatApplicationId,ownerId]);
  } finally { await db.end(); }
  await page.goto('/applications');
  const card = page.locator('.application-card').filter({ hasText: fixture.name });
  await expect(card.getByText('ได้รับสิทธิ์สมัครรอบ Final X แล้ว')).toBeVisible();
  await card.getByRole('button', { name: 'ยืนยัน', exact: true }).click();
  await page.getByRole('tab', { name: /สมัครด้วยบัญชีตนเอง/ }).click();
  const choice = page.locator('.final-rights-match').filter({ hasText: fixture.name });
  await choice.getByRole('button', { name: 'สมัครรอบ Final X', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'สมัครสอบ Final X', exact: true })).toBeVisible();
  await expect(page.getByText(/ข้อมูลจากใบสมัครรอบ Final/)).toBeVisible();
  await expect(page.locator('.competition-card-selected')).toHaveCount(1);
  await expect(page.locator('.competition-card-selected .competition-grade select')).toHaveValue('Primary 1');
  await expect(page.getByLabel('English First Name')).toHaveValue(fixture.firstName);
});
