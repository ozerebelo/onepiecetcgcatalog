import { defineConfig, devices } from '@playwright/test';

import { BASE_URL } from './env';

/**
 * Browser tests for the exported web app. They need a local Supabase with the catalog imported and a
 * web build pointing at it — see README.md. CI does all of that in .github/workflows/ci.yml.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './global-setup.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Chromium for both: the phone project emulates an iPhone's screen, touch and user agent.
    { name: 'phone', use: { ...devices['iPhone 14'], browserName: 'chromium' }, testIgnore: /desktop\.spec/ },
    { name: 'desktop', use: { viewport: { width: 1280, height: 860 } }, testMatch: /desktop\.spec/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: 'node serve.mjs ../app/dist 8099', url: BASE_URL, reuseExistingServer: !process.env.CI },
});
