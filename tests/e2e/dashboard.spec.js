import { test, expect } from "@playwright/test";

// Dashboard E2E tests cover full-app behaviour that needs a real browser:
// stat/card count consistency (async /api/jobs load), and CSV export triggering
// a file download. Rendering and state logic live in JobTracker.test.jsx.

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("stat-total matches the number of rendered job cards", async ({ page }) => {
    const countText = await page.getByTestId("stat-total").locator("div").first().textContent();
    const cardCount = await page.getByTestId("job-card").count();
    expect(cardCount).toBe(Number(countText));
  });

  test("export csv triggers a file download", async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("btn-export-csv").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
