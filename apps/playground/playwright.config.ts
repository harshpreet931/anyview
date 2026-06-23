import { defineConfig, devices } from '@playwright/test';

// Override with E2E_PORT, e.g. `E2E_PORT=4000 pnpm test:e2e`.
const PORT = Number(process.env.E2E_PORT ?? 5174);
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `node_modules/.bin/vite --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 180_000,
    env: { BROWSER: 'none' },
  },
});
