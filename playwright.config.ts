import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests run against the real production build and server, with no
 * Gemini key: AI routes answer 503 so the built-in fallbacks are exercised,
 * and tests that need an AI reply intercept `/api/*` in the browser.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node dist/server.mjs',
    url: 'http://localhost:4173/api/health',
    env: { PORT: '4173', GEMINI_API_KEY: '' },
    reuseExistingServer: !process.env.CI,
  },
});
