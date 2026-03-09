import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach } from "vitest";
import JobTracker from "./JobTracker.jsx";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

// data/initialJobs.js is gitignored — provide a stable fixture for tests
vi.mock("../data/initialJobs.js", () => ({
  default: [
    {
      id: 1,
      company: "Acme Corp",
      role: "Senior QA Engineer",
      fitScore: "Strong",
      recommendation: "Apply",
      status: "Applied ✅",
      verdict: "Strong match with Cypress and CI/CD depth.",
      strengths: ["Cypress automation", "Jenkins CI/CD"],
      gaps: ["No Kubernetes"],
      salary: "CA$130K",
      dateAdded: "2026-01-01",
    },
    {
      id: 2,
      company: "Globex",
      role: "QA Lead",
      fitScore: "Skip",
      recommendation: "Skip",
      status: "Skipped ❌",
      verdict: "Java is a hard requirement.",
      strengths: ["UAT experience"],
      gaps: ["Java required"],
      salary: "CA$120K",
      dateAdded: "2026-01-05",
    },
  ],
}));

// systemPrompt.js imports resume.txt?raw which Vitest can't handle
vi.mock("./prompts/systemPrompt.js", () => ({
  SYSTEM_PROMPT: "mock system prompt",
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mockFetchJobs(jobs = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url, opts) => {
      if (url === "/api/jobs") {
        if (!opts || opts.method !== "POST") {
          return Promise.resolve({ json: () => Promise.resolve(jobs) });
        }
        return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    })
  );
}

// Render the app and wait for the async /api/jobs load to settle
async function renderApp() {
  mockFetchJobs([]); // return empty so INITIAL_JOBS fixture drives the state
  render(<JobTracker />);
  // Wait for jobsLoaded to flip (the /api/jobs fetch resolves)
  await waitFor(() => expect(screen.getByTestId("job-list")).toBeInTheDocument());
}

// ---------------------------------------------------------------------------
// Dashboard — rendering
// ---------------------------------------------------------------------------
describe("dashboard rendering", () => {
  beforeEach(async () => {
    await renderApp();
  });

  it("renders the app title", () => {
    expect(screen.getByText("arti")).toBeInTheDocument();
    expect(screen.getByText(".jobs")).toBeInTheDocument();
  });

  it("renders nav buttons", () => {
    expect(screen.getByTestId("nav-dashboard")).toBeInTheDocument();
    expect(screen.getByTestId("nav-evaluate")).toBeInTheDocument();
  });

  it("renders export and import csv buttons", () => {
    expect(screen.getByTestId("btn-export-csv")).toBeInTheDocument();
    expect(screen.getByTestId("btn-import-csv")).toBeInTheDocument();
  });

  it("renders all four stat cards", () => {
    expect(screen.getByTestId("stat-total")).toBeInTheDocument();
    expect(screen.getByTestId("stat-strong")).toBeInTheDocument();
    expect(screen.getByTestId("stat-applied")).toBeInTheDocument();
    expect(screen.getByTestId("stat-skipped")).toBeInTheDocument();
  });

  it("stat-total reflects the number of jobs", () => {
    // fixture has 2 jobs
    expect(screen.getByTestId("stat-total")).toHaveTextContent("2");
  });

  it("stat-strong counts only Strong fit jobs", () => {
    // fixture has 1 Strong job
    expect(screen.getByTestId("stat-strong")).toHaveTextContent("1");
  });

  it("stat-skipped counts only Skip fit jobs", () => {
    // fixture has 1 Skip job
    expect(screen.getByTestId("stat-skipped")).toHaveTextContent("1");
  });

  it("renders a job card for each job", () => {
    expect(screen.getAllByTestId("job-card")).toHaveLength(2);
  });

  it("each job card shows company name", () => {
    const companies = screen.getAllByTestId("job-card-company").map(el => el.textContent);
    expect(companies).toContain("Acme Corp");
    expect(companies).toContain("Globex");
  });
});

// ---------------------------------------------------------------------------
// Evaluate view — state logic
// ---------------------------------------------------------------------------
describe("evaluate view state", () => {
  beforeEach(async () => {
    await renderApp();
    await userEvent.click(screen.getByTestId("nav-evaluate"));
  });

  it("shows the posting textarea when evaluate nav is clicked", () => {
    expect(screen.getByTestId("job-posting-input")).toBeInTheDocument();
  });

  it("evaluate button is disabled when textarea is empty", () => {
    expect(screen.getByTestId("btn-evaluate")).toBeDisabled();
  });

  it("evaluate button enables when text is typed", async () => {
    await userEvent.type(screen.getByTestId("job-posting-input"), "some job posting");
    expect(screen.getByTestId("btn-evaluate")).toBeEnabled();
  });

  it("clear button appears after typing", async () => {
    await userEvent.type(screen.getByTestId("job-posting-input"), "some text");
    expect(screen.getByTestId("btn-clear")).toBeInTheDocument();
  });

  it("clear button empties the textarea", async () => {
    await userEvent.type(screen.getByTestId("job-posting-input"), "some text");
    await userEvent.click(screen.getByTestId("btn-clear"));
    expect(screen.getByTestId("job-posting-input")).toHaveValue("");
  });

  it("evaluate button is disabled again after clearing", async () => {
    await userEvent.type(screen.getByTestId("job-posting-input"), "some text");
    await userEvent.click(screen.getByTestId("btn-clear"));
    expect(screen.getByTestId("btn-evaluate")).toBeDisabled();
  });

  it("clicking dashboard nav returns to job list", async () => {
    await userEvent.click(screen.getByTestId("nav-dashboard"));
    expect(screen.getByTestId("job-list")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Job detail — navigation and state
// ---------------------------------------------------------------------------
describe("job detail navigation", () => {
  beforeEach(async () => {
    await renderApp();
  });

  it("clicking a job card opens the detail panel", async () => {
    await userEvent.click(screen.getAllByTestId("job-card")[0]);
    expect(screen.getByTestId("job-detail")).toBeInTheDocument();
  });

  it("detail panel shows the correct company", async () => {
    await userEvent.click(screen.getAllByTestId("job-card")[0]);
    expect(screen.getByTestId("job-detail-company")).toHaveTextContent("Acme Corp");
  });

  it("back button returns to dashboard", async () => {
    await userEvent.click(screen.getAllByTestId("job-card")[0]);
    await userEvent.click(screen.getByTestId("btn-back"));
    expect(screen.getByTestId("job-list")).toBeInTheDocument();
    expect(screen.queryByTestId("job-detail")).not.toBeInTheDocument();
  });

  it("deleting a job removes it from the list and decrements stat-total", async () => {
    await userEvent.click(screen.getAllByTestId("job-card")[0]);
    await userEvent.click(screen.getByTestId("btn-delete"));
    expect(screen.getAllByTestId("job-card")).toHaveLength(1);
    expect(screen.getByTestId("stat-total")).toHaveTextContent("1");
  });
});
