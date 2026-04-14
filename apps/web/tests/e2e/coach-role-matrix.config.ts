/**
 * Playwright config for the coach-role-matrix acceptance tests.
 *
 * Key differences from the main playwright.config.ts:
 *  - No browser launch (tests are DB-level via pg, no page fixture)
 *  - No webServer (no local Next.js dev server needed)
 *  - globalSetup opens an SSH tunnel to VPS postgres → localhost:15432
 *  - globalTeardown closes the tunnel
 *  - Single project "DB Matrix" using Desktop Chrome purely to satisfy
 *    Playwright's project requirement; tests never open a browser page.
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.join(__dirname),
  testMatch: '**/coach-role-matrix.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: path.join(__dirname, 'coach-role-matrix.setup.ts'),
  globalTeardown: path.join(__dirname, 'coach-role-matrix.teardown.ts'),
  use: {
    // No baseURL needed — tests call pg directly.
    // Browser is configured only because Playwright requires at least one project,
    // but no test in this spec touches `page`.
    trace: 'off',
    browserName: 'chromium',
    // Headless + no viewport = minimal resource usage
    headless: true,
    viewport: null,
    // Skip browser launch entirely for each test (no page fixture = no launch)
    // This is set at the project level below via `use: { browserName }` but we
    // also set launchOptions to exit immediately if somehow a browser does open.
  },
  projects: [
    {
      name: 'DB Matrix — VPS Postgres',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
      },
    },
  ],
});
