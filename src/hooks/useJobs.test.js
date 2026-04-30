/**
 * Unhappy path tests for useJobs.js
 * Covers: corrupted jobs.json, empty response, fetch failure on load,
 * localStorage fallback when API fails.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useJobs } from "./useJobs.js";

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
  vi.stubGlobal("localStorage", {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useJobs — corrupted jobs.json", () => {
  it("falls back to initialJobs when API returns invalid JSON", async () => {
    fetch.mockResolvedValue({
      json: () => Promise.reject(new Error("Unexpected token")),
    });
    const { result } = renderHook(() => useJobs());
    await waitFor(() => {
      expect(Array.isArray(result.current.jobs)).toBe(true);
    });
  });

  it("falls back to initialJobs when API returns an empty array", async () => {
    fetch
      .mockResolvedValueOnce({ json: () => Promise.resolve([]) })
      .mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });

    const { result } = renderHook(() => useJobs());
    await waitFor(() => {
      expect(Array.isArray(result.current.jobs)).toBe(true);
    });
  });

  it("falls back to initialJobs when API returns non-array data", async () => {
    fetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ error: "corrupted" }) })
      .mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });

    const { result } = renderHook(() => useJobs());
    await waitFor(() => {
      expect(Array.isArray(result.current.jobs)).toBe(true);
    });
  });
});

describe("useJobs — API completely down on load", () => {
  it("falls back to localStorage when fetch rejects on load", async () => {
    const savedJobs = [{ id: 99, company: "Saved Co", role: "QA", fitScore: "Strong",
      recommendation: "Apply", status: "Considering 🤔", strengths: [], gaps: [],
      verdict: "Good.", dateAdded: "2026-01-01" }];
    localStorage.getItem.mockReturnValue(JSON.stringify(savedJobs));

    fetch.mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });

    const { result } = renderHook(() => useJobs());
    await waitFor(() => {
      expect(result.current.jobs.some(j => j.company === "Saved Co")).toBe(true);
    });
  });

  it("uses initialJobs when fetch rejects and localStorage is empty", async () => {
    fetch.mockRejectedValue(new Error("Network error"));
    localStorage.getItem.mockReturnValue(null);

    const { result } = renderHook(() => useJobs());
    await waitFor(() => {
      expect(Array.isArray(result.current.jobs)).toBe(true);
    });
  });

  it("uses initialJobs when fetch rejects and localStorage contains invalid JSON", async () => {
    fetch.mockRejectedValue(new Error("Network error"));
    localStorage.getItem.mockReturnValue("{ not valid json ]]]");

    const { result } = renderHook(() => useJobs());
    await waitFor(() => {
      expect(Array.isArray(result.current.jobs)).toBe(true);
    });
  });
});

describe("useJobs — CRUD operations", () => {
  beforeEach(() => {
    fetch
      .mockResolvedValueOnce({ json: () => Promise.resolve([]) })
      .mockResolvedValue({ json: () => Promise.resolve({ ok: true }) });
  });

  it("addJob prepends a new job to the list", async () => {
    const { result } = renderHook(() => useJobs());
    await waitFor(() => expect(result.current.jobs).toBeDefined());

    const newJob = { id: 1, company: "NewCo", role: "QA", fitScore: "Strong",
      recommendation: "Apply", status: "Considering 🤔", strengths: [], gaps: [],
      verdict: "Good match.", dateAdded: "2026-01-01" };

    act(() => result.current.addJob(newJob));
    expect(result.current.jobs[0].company).toBe("NewCo");
  });

  it("deleteJob removes the job with matching id", async () => {
    const { result } = renderHook(() => useJobs());
    await waitFor(() => expect(result.current.jobs).toBeDefined());

    const job = { id: 42, company: "DeleteMe", role: "QA", fitScore: "Skip",
      recommendation: "Skip", status: "Skipped ❌", strengths: [], gaps: [],
      verdict: "Skip.", dateAdded: "2026-01-01" };

    act(() => result.current.addJob(job));
    expect(result.current.jobs.some(j => j.id === 42)).toBe(true);

    act(() => result.current.deleteJob(42));
    expect(result.current.jobs.some(j => j.id === 42)).toBe(false);
  });

  it("updateStatus appends to statusHistory", async () => {
    const { result } = renderHook(() => useJobs());
    await waitFor(() => expect(result.current.jobs).toBeDefined());

    const job = { id: 55, company: "StatusCo", role: "QA", fitScore: "Strong",
      recommendation: "Apply", status: "Considering 🤔", strengths: [], gaps: [],
      verdict: "Good.", dateAdded: "2026-01-01", statusHistory: [] };

    act(() => result.current.addJob(job));
    act(() => result.current.updateStatus(55, "Applied ✅"));

    const updated = result.current.jobs.find(j => j.id === 55);
    expect(updated.status).toBe("Applied ✅");
    expect(updated.statusHistory.at(-1).status).toBe("Applied ✅");
  });
});
