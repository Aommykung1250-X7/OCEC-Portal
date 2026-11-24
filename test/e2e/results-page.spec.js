import { expect, test } from '@playwright/test';
import { closeFixtures, createSchoolFinalFixture } from './fixtures.js';

test.afterAll(closeFixtures);

test('public results page explains that results are pending when none are published', async ({ page }) => {
  await page.route('**/api/results*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ results: [], total: 0, filters: { targets: [], competitions: [], years: [], rounds: [], grades: [] } }),
  }));
  await page.goto('/results');
  await expect(page.getByRole('heading', { name: 'รอประกาศผลอย่างเป็นทางการ' })).toBeVisible();
});

test('public results page shows a published result and its round', async ({ page }) => {
  const fixture = await createSchoolFinalFixture();
  await page.goto('/results');
  await page.getByLabel('รอบสอบ').selectOption('HEAT');
  await expect(page.locator('.pc-results-section-head')).toContainText('BBB');
  await expect(page.getByRole('table')).toContainText(fixture.name);
  await expect(page.getByRole('table')).toContainText('1ST AWARD');
});

test('published results show an empty state for a query with no matches and can be reset', async ({ page }) => {
  const fixture = await createSchoolFinalFixture();
  await page.goto('/results');
  await page.getByLabel('รอบสอบ').selectOption('HEAT');
  const search = page.getByLabel('ชื่อภาษาอังกฤษ หรือเลขประจำตัวสอบ');
  await search.fill('Nobody Matches This Name');
  await expect(page.locator('.results-empty-state')).toBeVisible();
  await page.getByRole('button', { name: 'ล้างคำค้นหาและตัวกรอง' }).click();
  await expect(page.getByRole('table')).toContainText(fixture.name);
});

test('published results and Final confirmation fit mobile and desktop viewports', async ({ page }) => {
  await createSchoolFinalFixture();
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/results');
    await expect(page.locator('.pc-results-header')).toBeVisible();
    const resultsBounds = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      hero: document.querySelector('.pc-results-header').getBoundingClientRect().right,
    }));
    expect(resultsBounds.document, `results document overflows at ${width}px`).toBeLessThanOrEqual(resultsBounds.viewport);
    expect(resultsBounds.hero, `results hero overflows at ${width}px`).toBeLessThanOrEqual(resultsBounds.viewport);

    await page.goto('/final/confirm');
    const finalBounds = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      layout: document.querySelector('.final-rights-layout').getBoundingClientRect(),
    }));
    expect(finalBounds.document, `Final document overflows at ${width}px`).toBeLessThanOrEqual(finalBounds.viewport);
    expect(finalBounds.layout.right, `Final layout overflows at ${width}px`).toBeLessThanOrEqual(finalBounds.viewport);
    if (width <= 390) {
      expect(await page.locator('.final-rights-layout').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(1);
    } else {
      expect(await page.locator('.final-rights-layout').evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' ').length)).toBe(2);
    }
  }
});
