import { test, expect } from "@playwright/test";
import { mockClaude } from "../helpers/mockClaude.js";
import { MOCK_CLAUDE_RESPONSE, MOCK_RECOMMENDATION, SEED_JOBS } from "../fixtures/jobs.js";

// E2E tests cover the full evaluate flow: fetch → parse → render → add to tracker.
// Button state and textarea logic live in JobTracker.test.jsx (React unit tests).

const FAKE_POSTING = `
  Senior QA Engineer — Acme Corp (Remote, Canada)
  Build and maintain Cypress E2E suites, integrate with Jenkins CI/CD.
  5+ years QA/SDET experience. Salary: CA$ 90–190K
`;



test.describe("evaluate flow", () => {
  
  test("result card shows all fields after a successful API call", async ({ page }) => {
    await mockClaude(page, MOCK_CLAUDE_RESPONSE);

    await page.goto("/");
    await page.getByTestId("nav-evaluate").click();
    await page.getByTestId("job-posting-input").fill(FAKE_POSTING);
    await page.getByTestId("btn-evaluate").click();

    await expect(page.getByTestId("evaluation-result")).toBeVisible();
    await expect(page.getByTestId("result-company")).toHaveText("Acme Corp");
    await expect(page.getByTestId("result-role")).toHaveText("Senior QA Engineer");
    await expect(page.getByTestId("result-fit-score")).toHaveText("Strong");
    await expect(page.getByTestId("result-verdict")).not.toBeEmpty();
    await expect(page.getByTestId("result-strengths").getByTestId("strength-item").first()).toBeVisible();
    await expect(page.getByTestId("result-gaps").getByTestId("gap-item").first()).toBeVisible();
    await expect(page.getByTestId("result-recommendation")).not.toBeEmpty();
    await expect(page.getByTestId("btn-add-to-tracker")).toBeVisible();
  });

  test("adding result to tracker increments stat-total and shows card on dashboard", async ({ page }) => {
    
    await page.route("/api/jobs", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(SEED_JOBS) });
      } else {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      }
    });
    
    await mockClaude(page, MOCK_RECOMMENDATION);

    await page.goto("/");
    await page.waitForSelector('[data-testid="stat-total"]');

    await page.getByTestId("nav-evaluate").click();
    await page.getByTestId("job-posting-input").fill(FAKE_POSTING);
    await page.getByTestId("btn-evaluate").click();
    await expect(page.getByTestId("evaluation-result")).toBeVisible();
    await page.getByTestId("btn-add-to-tracker").click();

    await expect(page.getByTestId("job-list")).toBeVisible();
    await expect(page.getByTestId("stat-total")).toContainText("2");
    await expect(page.getByTestId("job-card").first().getByTestId("job-card-company")).toHaveText("Acme Corp");
  });

  test("error banner appears when the API call fails", async ({ page }) => {
    await page.route("/api/anthropic/v1/messages", async (route) => {
      await route.fulfill({ status: 500, body: "Internal Server Error" });
    });

    await page.goto("/");
    await page.getByTestId("nav-evaluate").click();
    await page.getByTestId("job-posting-input").fill(FAKE_POSTING);
    await page.getByTestId("btn-evaluate").click();

    await expect(page.getByTestId("evaluate-error")).toBeVisible();
  });
});
