import { defineConfig, devices } from '@playwright/test';

// G0-6 smoke. Owner: WP-00 until G0, then WP-10. Builds and previews both apps.
const reuse = !process.env.CI;

export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  fullyParallel: true,
  forbidOnly: !reuse,
  retries: 0,
  reporter: [['list']],
  use: { colorScheme: 'light' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  ],
  webServer: [
    {
      command: 'pnpm --filter @ibasho/web build && pnpm --filter @ibasho/web preview',
      url: 'http://localhost:4173/app/',
      reuseExistingServer: reuse,
      timeout: 180_000,
    },
    {
      command: 'pnpm --filter @ibasho/landing build && pnpm --filter @ibasho/landing preview',
      url: 'http://localhost:4174/',
      reuseExistingServer: reuse,
      timeout: 180_000,
    },
  ],
});
