import { expect, test } from '@playwright/test';

test('loads the portal shell and completes a mock Google login', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toContainText('OCEC');
  await page.goto('/api/auth/google/start?returnTo=/&testPersona=candidate');
  await expect.poll(async () => (await page.request.get('/api/auth/me')).json())
    .toMatchObject({ user: { email: 'candidate@ocec.test' } });
});
