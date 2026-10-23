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

test('homepage actions open the application and status routes', async ({ page }) => {
  await page.goto('/');
  await page.locator('.landing-gallery-primary').click();
  await expect(page).toHaveURL(/\/apply$/);
  await expect(page.getByRole('dialog', { name: 'เข้าสู่ระบบก่อนสมัคร' })).toBeVisible();

  await page.goto('/');
  await page.locator('.landing-gallery-secondary').click();
  await expect(page).toHaveURL(/\/lookup$/);
  await expect(page.getByRole('heading', { name: 'ค้นหาหรือแก้ไขใบสมัคร' })).toBeVisible();
});

test('public navigation shows the current page and keeps the exams link underline intentional', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const nav = page.getByRole('navigation', { name: 'เมนูหน้าเว็บ' });
  const exams = nav.getByRole('link', { name: 'รายการสอบ' });
  await expect(exams).toHaveAttribute('aria-current', 'page');
  expect(await exams.evaluate((element) => getComputedStyle(element).textDecorationLine)).toBe('none');

  await nav.getByRole('button', { name: 'ประกาศผล' }).click();
  const results = nav.getByRole('button', { name: 'ประกาศผล' });
  await expect(results).toHaveAttribute('aria-current', 'page');
  await expect(exams).not.toHaveAttribute('aria-current', 'page');
  await page.mouse.move(0, 0);
  await results.evaluate((element) => element.blur());
  expect(await results.evaluate((element) => getComputedStyle(element, '::after').left)).toBe('0px');

  await nav.getByRole('button', { name: 'ค้นหาสถานะ' }).click();
  const status = nav.getByRole('button', { name: 'ค้นหาสถานะ' });
  await expect(status).toHaveAttribute('aria-current', 'page');
  await expect(results).not.toHaveAttribute('aria-current', 'page');
});

test('homepage uses the pink accent and keeps the scroll arrow pointing down', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');

  const openStatusDot = page.locator('.landing-gallery-status.is-open i').first();
  await expect(openStatusDot).toBeVisible();
  expect(await openStatusDot.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(255, 45, 149)');

  const currentNavIndicator = page.locator('.landing-nav a[aria-current="page"]');
  expect(await currentNavIndicator.evaluate((element) => getComputedStyle(element, '::after').backgroundColor)).toBe('rgb(255, 45, 149)');

  const scrollArrow = page.locator('.landing-scene-next .ocec-icon');
  expect(await scrollArrow.evaluate((element) => getComputedStyle(element).rotate)).toBe('90deg');
  expect(await scrollArrow.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
});

test('homepage empty catalog shows the no-open-rounds state and keeps status lookup available', async ({ page }) => {
  await page.route('**/api/catalog', async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    await route.fulfill({ response, json: { ...catalog, exams: [] } });
  });

  await page.goto('/');
  await expect(page.locator('.landing-gallery-empty')).toBeVisible();
  await expect(page.locator('.landing-gallery-grid')).toHaveCount(0);
  await page.locator('.landing-gallery-empty-actions').getByRole('button', { name: 'ตรวจสอบสถานะ' }).click();
  await expect(page).toHaveURL(/\/lookup$/);
  await expect(page.getByRole('heading', { name: 'ค้นหาหรือแก้ไขใบสมัคร' })).toBeVisible();
});

test('homepage populated and empty layouts fit mobile and desktop viewports', async ({ page }) => {
  const viewports = [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ];

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.landing-gallery-hero')).toBeVisible();
    await expect(page.locator('.landing-gallery-card').first()).toBeVisible();
    await expect(page.locator('#how-to-apply')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await page.locator('.landing-gallery-primary').evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  }

  await page.route('**/api/catalog', async (route) => {
    const response = await route.fetch();
    const catalog = await response.json();
    await route.fulfill({ response, json: { ...catalog, exams: [] } });
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.landing-gallery-empty')).toBeVisible();
    await expect(page.locator('#how-to-apply')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('admin round labels follow the catalog academic year', async ({ page }) => {
  await withHeatYear('2570', async () => {
    await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/dashboard')}&testPersona=admin`);
    await expect(page.locator('.topbar-round')).toContainText('2570');
    await expect(page.locator('.round-switch')).toHaveCount(0);
  });
});

test('admin dashboard fits 320, 390, and 1280 pixel viewports', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/dashboard')}&testPersona=admin`);
    await expect(page.locator('.admin-home-page')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});

test('desktop admin navigation expands on hover and keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/dashboard')}&testPersona=admin`);
  const sidebar = page.locator('.sidebar');
  const dashboardLink = sidebar.locator('a[href="#admin-home"]');
  const dashboardLabel = dashboardLink.locator('span').first();

  await page.mouse.move(900, 20);
  await expect.poll(() => sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(82);
  await expect(dashboardLabel).toBeHidden();

  await dashboardLink.hover();
  await expect.poll(() => sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(260);
  await expect(dashboardLabel).toBeVisible();

  await page.mouse.move(900, 20);
  await dashboardLink.focus();
  await expect.poll(() => sidebar.evaluate((element) => Math.round(element.getBoundingClientRect().width))).toBe(260);
  await expect(dashboardLabel).toBeVisible();
});

test('mobile admin navigation opens as a drawer and closes from the scrim', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/api/auth/google/start?returnTo=${encodeURIComponent('/portal-admin/dashboard')}&testPersona=admin`);

  const sidebar = page.locator('.sidebar');
  const scrim = page.locator('.sidebar-scrim');
  await expect(sidebar.locator('.round-switch')).toHaveCount(0);
  await expect(scrim).toBeHidden();
  await page.getByRole('button', { name: 'เปิดเมนู' }).click();
  await expect(scrim).toBeVisible();
  await expect(sidebar).toBeInViewport();

  await scrim.click({ position: { x: 380, y: 400 } });
  await expect(scrim).toBeHidden();
});

test('login dialog opens, supports Escape, and restores focus to its trigger', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'เข้าสู่ระบบ' });
  await trigger.click();

  const dialog = page.getByRole('dialog', { name: 'เข้าสู่ระบบ OCEC Portal' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'ดำเนินการด้วย Google' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('authenticated account menu opens and closes on outside press', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
  await page.getByRole('button', { name: 'ดำเนินการด้วย Google' }).click();

  const trigger = page.locator('.account-menu-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const menu = page.locator('.account-menu-panel');
  await expect(menu).toBeVisible();

  await page.locator('#landing-main').click({ position: { x: 12, y: 12 } });
  await expect(menu).toHaveCount(0);
});

test('mobile header gradually hides on downward scroll and reveals on upward scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const header = page.locator('.landing-header');
  const hiddenOffset = () => header.evaluate((element) => Number.parseFloat(getComputedStyle(element).getPropertyValue('--header-hide-offset')) || 0);

  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }));
  await expect.poll(hiddenOffset).toBeGreaterThan(0);
  const offsetAfterScrollingDown = await hiddenOffset();

  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  await expect.poll(hiddenOffset).toBeLessThan(offsetAfterScrollingDown);
  await expect.poll(hiddenOffset).toBeGreaterThan(0);
});

test('public header and login dialog fit 320, 390, and 1280 pixel viewports', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.locator('.landing-header')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click();
    const dialog = page.getByRole('dialog', { name: 'เข้าสู่ระบบ OCEC Portal' });
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.top >= 0 && rect.left >= 0 && rect.bottom <= window.innerHeight && rect.right <= window.innerWidth;
    })).toBe(true);
  }
});

test('public footer fits 320, 390, and 1280 pixel viewports', async ({ page }) => {
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    const footer = page.locator('.landing-footer');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toBeVisible();
    await expect(footer.getByRole('link', { name: 'UIcons by Flaticon' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});
