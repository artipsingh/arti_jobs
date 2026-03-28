import { test, expect } from "@playwright/test";
import { healingLocator } from "../helpers/selfHealingLocator.js";

// Dashboard E2E tests cover full-app behaviour that needs a real browser:
// stat/card count consistency (async /api/jobs load), and CSV export triggering
// a file download. Rendering and state logic live in JobTracker.test.jsx.
//
// Self-healing demo: the export-csv button uses `healingLocator` with a
// data-testid primary + two text/role fallbacks. If the testid is ever renamed
// in the JSX, the test self-heals, logs a WARNING, and writes to
// tests/healing-log.json instead of silently passing or immediately crashing.

test.describe("dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("stat-total matches the number of rendered job cards", async ({
    page,
  }) => {
    // Primary selector only — no healing needed here; this is the stable path.
    const countText = await page
      .getByTestId("stat-total")
      .locator("div")
      .first()
      .textContent();
    const cardCount = await page.getByTestId("job-card").count();
    expect(cardCount).toBe(Number(countText));
  });

  test("export csv triggers a file download [self-healing demo]", async ({
    page,
  }) => {
    // --- Self-Healing Level 2 proof of concept ---
    //
    // Primary: data-testid (what exists today in JobTracker.jsx)
    // Fallback 1: visible text content match
    // Fallback 2: role + name (ARIA-based)
    //
    // When the primary works the test behaves identically to before.
    // When the primary fails (e.g. testid renamed), the test heals via the
    // first working fallback, prints a ⚠️  warning, and appends an entry to
    // tests/healing-log.json so the team knows to fix the selector.
    const exportBtn = await healingLocator(
      page,
      {
        description: "Export CSV button",
        primary: '[data-testid="btn-export-csv"]',
        fallbacks: [
          'button:has-text("export csv")',
          'button[aria-label="export csv"]',
        ],
      },
      import.meta.url
    );

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
