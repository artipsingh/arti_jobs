import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  // Run all tests in parallel.
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,

  // Retry on CI only.
  retries: process.env.CI ? 1 : 0,

  // Opt out of parallel tests on CI.
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
 

  reporter: [
    [process.env.CI ? 'dot' : 'line'],
    ['json', { outputFile: 'test-results.json' }],
    ['html', { open: 'never', outputFile: 'htmlResults.html' }],
  ],

  use: {
    baseURL: "http://localhost:5173",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    env: {
      TEST_JOBS_FILE: "data/jobs.test.json",
    },
  },
});
