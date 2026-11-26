import { defineConfig } from '@playwright/test';

const TEST_PORT = Number(process.env.QA_PORT || 4199);
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/playwright-report.json' }],
  ],
  outputDir: 'test-results/artifacts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 12_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
      },
    },
    {
      name: 'msedge',
      use: {
        browserName: 'chromium',
        channel: 'msedge',
      },
    },
  ],
  webServer: {
    command: 'node tests/start-test-server.mjs',
    url: `${BASE_URL}/api/fx`,
    reuseExistingServer: false,
    timeout: 25_000,
    env: {
      QA_PORT: String(TEST_PORT),
    },
  },
});
