import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 5174);
const BASE_URL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

const command = isCI
  ? `node_modules/.bin/vite build && node_modules/.bin/vite preview --port ${PORT} --strictPort`
  : `node_modules/.bin/vite --port ${PORT} --strictPort`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: isCI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 240_000,
    env: { BROWSER: 'none' },
  },
});
