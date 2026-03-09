import { test, expect } from "@playwright/test";

// E2E tests cover cross-component flows: clicking a card navigates to detail,
// status changes persist across the detail/dashboard boundary.
// Field rendering and back-button state logic live in JobTracker.test.jsx.

test.describe("job detail flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.getByTestId("job-card").first().click();
  });

  test("clicking a job card opens the detail panel", async ({ page }) => {
    await expect(page.getByTestId("job-detail")).toBeVisible();
  });

  test("detail panel shows company, role, fit score and verdict", async ({ page }) => {
    await expect(page.getByTestId("job-detail-company")).not.toBeEmpty();
    await expect(page.getByTestId("job-detail-role")).not.toBeEmpty();
    await expect(page.getByTestId("job-detail-fit-score")).not.toBeEmpty();
    await expect(page.getByTestId("job-detail-verdict")).not.toBeEmpty();
  });

  test("status change in detail is reflected in the dropdown", async ({ page }) => {
    const select = page.getByTestId("job-detail-status");
    await select.selectOption("Interview scheduled 🎯");
    await expect(select).toHaveValue("Interview scheduled 🎯");
  });

  test("status change in detail is visible on the dashboard card after going back", async ({ page }) => {
    await page.getByTestId("job-detail-status").selectOption("Applied ✅");
    await page.getByTestId("btn-back").click();
    await expect(page.getByTestId("job-card").first().getByTestId("job-card-status")).toHaveValue("Applied ✅");
  });
});
