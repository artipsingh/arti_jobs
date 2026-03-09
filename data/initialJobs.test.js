import { describe, it, expect } from "vitest";

// Fixture data — initialJobs.js is gitignored (personal job search data).
// These fake entries exercise the same schema validation logic in CI.
const INITIAL_JOBS = [
  {
    id: 1,
    company: "Acme Corp",
    role: "Senior QA Engineer",
    fitScore: "Strong",
    recommendation: "Apply",
    status: "Applied ✅",
    strengths: ["Cypress automation", "CI/CD pipelines"],
    gaps: ["Kubernetes experience"],
    verdict: "Strong technical match with E2E automation depth.",
    dateAdded: "2026-01-01",
  },
  {
    id: 2,
    company: "Globex",
    role: "QA Lead",
    fitScore: "Moderate",
    recommendation: "Apply with caution",
    status: "On hold ⏸️",
    strengths: ["UAT facilitation", "Cross-browser testing"],
    gaps: ["Java required"],
    verdict: "Good process fit but Java requirement is a blocker.",
    dateAdded: "2026-01-05",
  },
  {
    id: 3,
    company: "Initech",
    role: "SDET",
    fitScore: "Skip",
    recommendation: "Skip",
    status: "Skipped ❌",
    strengths: ["Python automation"],
    gaps: ["Kubernetes is the core product"],
    verdict: "Kubernetes-first stack is an automatic skip condition.",
    dateAdded: "2026-01-10",
  },
];

const VALID_FIT_SCORES = ["Strong", "Moderate", "Stretch", "Skip"];
const VALID_RECOMMENDATIONS = ["Apply", "Apply with caution", "Skip", "Reach out to contact first"];
const VALID_STATUSES = ["Applied ✅", "Reaching out 📨", "Interview scheduled 🎯", "Offer received 🎉", "On hold ⏸️", "Skipped ❌", "Considering 🤔", "Finding contact 🔍"];

describe("INITIAL_JOBS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(INITIAL_JOBS)).toBe(true);
    expect(INITIAL_JOBS.length).toBeGreaterThan(0);
  });

  it("every job has a unique id", () => {
    const ids = INITIAL_JOBS.map(j => j.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(INITIAL_JOBS.length);
  });

  it("every job has a non-empty company name", () => {
    INITIAL_JOBS.forEach(job => {
      expect(job.company, `job id ${job.id}`).toBeTruthy();
    });
  });

  it("every job has a non-empty role", () => {
    INITIAL_JOBS.forEach(job => {
      expect(job.role, `job id ${job.id}`).toBeTruthy();
    });
  });

  it("every job has a valid fitScore", () => {
    INITIAL_JOBS.forEach(job => {
      expect(VALID_FIT_SCORES, `${job.company} fitScore: ${job.fitScore}`).toContain(job.fitScore);
    });
  });

  it("every job has a valid recommendation", () => {
    INITIAL_JOBS.forEach(job => {
      expect(VALID_RECOMMENDATIONS, `${job.company} recommendation: ${job.recommendation}`).toContain(job.recommendation);
    });
  });

  it("every job has a valid status", () => {
    INITIAL_JOBS.forEach(job => {
      expect(VALID_STATUSES, `${job.company} status: ${job.status}`).toContain(job.status);
    });
  });

  it("every job has strengths as a non-empty array", () => {
    INITIAL_JOBS.forEach(job => {
      expect(Array.isArray(job.strengths), `${job.company}`).toBe(true);
      expect(job.strengths.length, `${job.company} has no strengths`).toBeGreaterThan(0);
    });
  });

  it("every job has gaps as an array", () => {
    INITIAL_JOBS.forEach(job => {
      expect(Array.isArray(job.gaps), `${job.company}`).toBe(true);
    });
  });

  it("every job has a dateAdded in YYYY-MM-DD format", () => {
    INITIAL_JOBS.forEach(job => {
      expect(job.dateAdded, `${job.company}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it("Skip jobs have Skip recommendation", () => {
    const skipJobs = INITIAL_JOBS.filter(j => j.fitScore === "Skip");
    skipJobs.forEach(job => {
      expect(job.recommendation, `${job.company} is Skip but recommendation is ${job.recommendation}`).toBe("Skip");
    });
  });
});
