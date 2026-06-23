import { defineConfig, devices } from '@playwright/test';

// Override with E2E_PORT, e.g. `E2E_PORT=4000 pnpm test:e2e`.
const PORT = Number(process.env.E2E_PORT ?? 5174);
const BASE_URL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

// In CI, serve a production build via `vite preview` so the first PDF load
// doesn't pay the dev-server's on-demand pdf.js worker compile (it can exceed
// the test timeout on a cold runner). Locally, use the fast dev server.
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
