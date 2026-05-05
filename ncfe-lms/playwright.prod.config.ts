import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import './tests/env';

const BASE_URL = 'https://ncfe-lms.onrender.com';
const HEADED = process.env.HEADED === '1';

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: ['**/prod/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'tests/playwright-results-prod.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: !HEADED,
    actionTimeout: 60_000,
    navigationTimeout: 90_000,
  },
  expect: {
    timeout: 30_000,
  },
  projects: [
    {
      name: 'prod-auth-setup',
      testMatch: /prod\/auth\.setup\.ts/,
    },
    {
      name: 'prod',
      testMatch: /prod\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/prod-admin.json',
      },
      dependencies: ['prod-auth-setup'],
    },
  ],
  // No webServer — production is already running.
});
