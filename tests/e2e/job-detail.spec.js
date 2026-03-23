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
    await page.waitForLoadState("networkidle");
    await page.getByTestId("job-card").first().click();
  });

  test("clicking a job card opens the detail panel", async ({ page }) => {
    await expect(page.getByTestId("job-detail")).toBeVisible();
  });

  test("detail panel shows company, role, fit score and verdict", async ({ page }) => {
    const testIDs = ["job-detail-company","job-detail-role","job-detail-fit-score", "job-detail-verdict"]
    testIDs.forEach(async id=>{
      await expect(page.getByTestId(id)).not.toBeEmpty();
    })
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

  test("The count of the skipped jobs is displayed correctly", async ({ page }) => {
    const skippedJobs = TEST_JOBS.filter((job) => job.status === "Skipped ❌");
    const appliedJobs = TEST_JOBS.filter((job) => job.status === "Applied ✅");
    const strongJobs = TEST_JOBS.filter((job) => job.fitScore === "Strong");
  
    await expect(page.getByTestId("stat-skipped")).toContainText(String(skippedJobs.length));
    await expect(page.getByTestId("stat-applied")).toContainText(String(appliedJobs.length));
    await expect(page.getByTestId("stat-strong")).toContainText(String(strongJobs.length));
    await expect(page.getByTestId("stat-total")).toContainText(String(TEST_JOBS.length));
  });


});
