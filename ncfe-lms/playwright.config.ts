import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import './tests/env';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const HEADED = process.env.HEADED === '1';
const FAST = process.env.FAST === '1'; // skip cross-browser smoke

export default defineConfig({
  testDir: path.join(__dirname, 'tests'),
  testMatch: ['**/*.spec.ts'],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1, // sequential — tests share a live DB; avoid race conditions
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'tests/playwright-results.json' }],
  ],
  globalSetup: require.resolve('./tests/preflight.ts'),
  globalTeardown: require.resolve('./tests/postflight.ts'),
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    headless: !HEADED,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  expect: {
    timeout: 10_000,
  },
  projects: [
    // Sets up storage state for each role. Runs once.
    {
      name: 'auth-setup',
      testMatch: /fixtures\/auth\.setup\.ts/,
    },
    // Smoke specs — no auth needed.
    {
      name: 'smoke',
      testMatch: /smoke\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    // Unit-style specs — pure-Node, no auth, no browser interaction.
    {
      name: 'unit',
      testMatch: /unit\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'assessor',
      testMatch: /assessor\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/assessor.json',
      },
      dependencies: ['auth-setup'],
    },
    {
      name: 'student',
      testMatch: /student\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/student.json',
      },
      dependencies: ['auth-setup'],
    },
    {
      name: 'iqa',
      testMatch: /iqa\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/iqa.json',
      },
      dependencies: ['auth-setup'],
    },
    {
      name: 'admin',
      testMatch: /admin\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/admin.json',
      },
      dependencies: ['auth-setup'],
    },
    {
      name: 'cross',
      testMatch: /cross\/.*\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['auth-setup'],
    },
    ...(FAST
      ? []
      : [
          {
            name: 'smoke-firefox',
            testMatch: /smoke\/auth\.spec\.ts/,
            use: { ...devices['Desktop Firefox'] },
          },
          {
            name: 'smoke-webkit',
            testMatch: /smoke\/auth\.spec\.ts/,
            use: { ...devices['Desktop Safari'] },
          },
        ]),
  ],
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
