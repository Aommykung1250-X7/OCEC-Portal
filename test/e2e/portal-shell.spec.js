import { expect, test } from '@playwright/test';
import { closeFixtures, withExamDates, withHeatYear } from './fixtures.js';

test.afterAll(closeFixtures);

test('header and footer help open the configured LINE OA safely', async ({ page }) => {
  await page.goto('/');
  const links = page.getByRole('link', { name: /ศูนย์ช่วยเหลือ/ });
  await expect(links).toHaveCount(1);
  await expect(links.first()).toHaveAttribute('href', 'https://lin.ee/3hzFg1z');
  await expect(links.first()).toHaveAttribute('target', '_blank');
  await expect(links.first()).toHaveAttribute('rel', 'noopener noreferrer');
  await page.goto('/status');
  await expect(page.getByRole('link', { name: /ศูนย์ช่วยเหลือ/ })).toHaveAttribute('href', 'https://lin.ee/3hzFg1z');
});

test('exam schedule reflects catalog date and year after reload', async ({ page }) => {
  await withExamDates({ all: '2027-01-23' }, async () => {
    await page.goto('/');
    await expect(page.locator('#open-exams .landing-gallery-card').first()).toContainText('23 มกราคม 2570');
    await page.reload();
    await expect(page.locator('#open-exams .landing-gallery-card').first()).toContainText('23 มกราคม 2570');
  });
});

test('schedule with no exam date shows an honest unscheduled state', async ({ page }) => {
  await withExamDates({ all: null }, async () => {
    await page.goto('/');
    const cards = page.locator('#open-exams .landing-gallery-card');
    await expect(cards.first()).toContainText('ยังไม่กำหนด');
    await expect(cards.first()).not.toContainText('13 ธันวาคม 2569');
    await expect(page.getByRole('link', { name: 'รายการสอบ' })).toHaveAttribute('href', '#open-exams');
  });
});

test('admin round labels follow the catalog academic year', async ({ page }) => {
  await withHeatYear('2570', async () => {
    await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/dashboard')}&testPersona=admin`);
    await expect(page.locator('.topbar-round')).toContainText('2570');
    await expect(page.locator('.round-switch')).toContainText('2570');
  });
});
