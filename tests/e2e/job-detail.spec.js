import { test, expect } from "@playwright/test";
import { TEST_JOBS } from "../fixtures/jobs.js";

// E2E tests cover cross-component flows: clicking a card navigates to detail,
// status changes persist across the detail/dashboard boundary.
// Field rendering and back-button state logic live in JobTracker.test.jsx.

test.describe("job detail flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("/api/jobs", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(TEST_JOBS),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true }),
        });
      }
    });

    await page.goto("/");
    await page.waitForSelector('[data-testid="stat-total"]');
    await page.getByTestId("job-card").first().click();
  });

  test("clicking a job card opens the detail panel", async ({ page }) => {
    await expect(page.getByTestId("job-detail")).toBeVisible();
  });

  test("detail panel shows company, role, fit score and verdict", async ({ page }) => {
    const testIDs = ["job-detail-company", "job-detail-role", "job-detail-fit-score", "job-detail-verdict"];
    for (const id of testIDs) {
      await expect(page.getByTestId(id)).not.toBeEmpty();
    }
  });

  test("status change in detail is visible on the dashboard card after going back", async ({ page }) => {
    await page.getByTestId("job-detail-status").selectOption("Applied ✅");
    await page.getByTestId("btn-back").click();
    await expect(page.getByTestId("job-card").first().getByTestId("job-card-status")).toHaveValue("Applied ✅");
  });
});
