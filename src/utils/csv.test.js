import { describe, it, expect } from "vitest";
import { jobsToCSV, csvToJobs } from "./csv.js";

const sampleJob = {
  id: 1,
  company: "Acme Corp",
  role: "Senior QA Engineer",
  salary: "CA$5K–$9K",
  fitScore: "Strong",
  verdict: "Great fit for this role.",
  strengths: ["Cypress", "CI/CD", "API testing"],
  gaps: ["Kubernetes"],
  recommendation: "Apply",
  status: "Applied ✅",
  dateAdded: "2026-03-08",
};

describe("jobsToCSV", () => {
  it("produces a header row and one data row for a single job", () => {
    const lines = jobsToCSV([sampleJob]).split("\n");
    expect(lines).toHaveLength(2);
  });

  it("header row matches expected columns", () => {
    const header = jobsToCSV([sampleJob]).split("\n")[0];
    expect(header).toBe(
      "id,company,role,salary,fitScore,verdict,strengths,gaps,recommendation,status,dateAdded"
    );
  });

  it("joins strengths array with semicolons", () => {
    const csv = jobsToCSV([sampleJob]);
    expect(csv).toContain("Cypress; CI/CD; API testing");
  });

  it("joins gaps array with semicolons", () => {
    const csv = jobsToCSV([sampleJob]);
    expect(csv).toContain("Kubernetes");
  });

  it("wraps all cell values in double quotes", () => {
    const dataRow = jobsToCSV([sampleJob]).split("\n")[1];
    const cells = dataRow.split('","');
    expect(cells.length).toBeGreaterThan(1);
    expect(dataRow.startsWith('"')).toBe(true);
    expect(dataRow.endsWith('"')).toBe(true);
  });

  it("escapes double quotes inside cell values", () => {
    const job = { ...sampleJob, verdict: 'A "perfect" fit' };
    const csv = jobsToCSV([job]);
    expect(csv).toContain('"A ""perfect"" fit"');
  });

  it("handles empty strengths and gaps arrays", () => {
    const job = { ...sampleJob, strengths: [], gaps: [] };
    const csv = jobsToCSV([job]);
    expect(csv).toBeDefined();
  });

  it("produces correct row count for multiple jobs", () => {
    const lines = jobsToCSV([sampleJob, sampleJob, sampleJob]).split("\n");
    expect(lines).toHaveLength(4); // 1 header + 3 data rows
  });
});

describe("csvToJobs", () => {
  it("parses a single job back from CSV", () => {
    const jobs = csvToJobs(jobsToCSV([sampleJob]));
    expect(jobs).toHaveLength(1);
  });

  it("restores scalar fields correctly", () => {
    const [job] = csvToJobs(jobsToCSV([sampleJob]));
    expect(job.company).toBe("Acme Corp");
    expect(job.role).toBe("Senior QA Engineer");
    expect(job.fitScore).toBe("Strong");
    expect(job.recommendation).toBe("Apply");
    expect(job.dateAdded).toBe("2026-03-08");
  });

  it("restores strengths as an array", () => {
    const [job] = csvToJobs(jobsToCSV([sampleJob]));
    expect(Array.isArray(job.strengths)).toBe(true);
    expect(job.strengths).toEqual(["Cypress", "CI/CD", "API testing"]);
  });

  it("restores gaps as an array", () => {
    const [job] = csvToJobs(jobsToCSV([sampleJob]));
    expect(Array.isArray(job.gaps)).toBe(true);
    expect(job.gaps).toEqual(["Kubernetes"]);
  });

  it("returns empty arrays for empty strengths and gaps", () => {
    const job = { ...sampleJob, strengths: [], gaps: [] };
    const [result] = csvToJobs(jobsToCSV([job]));
    expect(result.strengths).toEqual([]);
    expect(result.gaps).toEqual([]);
  });
});

describe("round-trip (export → import)", () => {
  it("preserves all scalar fields", () => {
    const [result] = csvToJobs(jobsToCSV([sampleJob]));
    expect(result.company).toBe(sampleJob.company);
    expect(result.role).toBe(sampleJob.role);
    expect(result.salary).toBe(sampleJob.salary);
    expect(result.fitScore).toBe(sampleJob.fitScore);
    expect(result.verdict).toBe(sampleJob.verdict);
    expect(result.recommendation).toBe(sampleJob.recommendation);
    expect(result.status).toBe(sampleJob.status);
    expect(result.dateAdded).toBe(sampleJob.dateAdded);
  });

  it("preserves strengths and gaps arrays", () => {
    const [result] = csvToJobs(jobsToCSV([sampleJob]));
    expect(result.strengths).toEqual(sampleJob.strengths);
    expect(result.gaps).toEqual(sampleJob.gaps);
  });

  it("preserves all jobs when multiple rows are exported", () => {
    const jobs = [
      { ...sampleJob, id: 1, company: "Acme" },
      { ...sampleJob, id: 2, company: "Globex" },
    ];
    const result = csvToJobs(jobsToCSV(jobs));
    expect(result).toHaveLength(2);
    expect(result[0].company).toBe("Acme");
    expect(result[1].company).toBe("Globex");
  });

  it("survives a value that contains a comma", () => {
    const job = { ...sampleJob, salary: "CA$120K, negotiable" };
    const [result] = csvToJobs(jobsToCSV([job]));
    expect(result.salary).toBe("CA$120K, negotiable");
  });
});
