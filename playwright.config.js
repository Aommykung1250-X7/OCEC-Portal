import { defineConfig } from '@playwright/test';

const apiPort = Number(process.env.E2E_API_PORT || 3001);
const webPort = Number(process.env.E2E_WEB_PORT || 5173);

export default defineConfig({
  testDir: './test/e2e',
  testMatch: '**/*.spec.js',
  workers: 1,
  use: {
    baseURL: `http://127.0.0.1:${webPort}`,
    browserName: 'chromium',
    ...(process.env.E2E_BROWSER_CHANNEL ? { channel: process.env.E2E_BROWSER_CHANNEL } : {}),
  },
  webServer: [
    {
      command: 'node test/e2e/api-server.js',
      url: `http://127.0.0.1:${apiPort}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `node node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${webPort} --strictPort`,
      url: `http://127.0.0.1:${webPort}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
