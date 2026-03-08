import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { evaluateJob, stripHyperlinks } from "./evaluateJob.js";

describe("stripHyperlinks", () => {
  it("removes bare https URLs", () => {
    expect(stripHyperlinks("Apply at https://jobs.example.com/apply now"))
      .toBe("Apply at now");
  });

  it("removes bare http URLs", () => {
    expect(stripHyperlinks("Visit http://example.com for details"))
      .toBe("Visit for details");
  });

  it("replaces markdown links with their display text", () => {
    expect(stripHyperlinks("See [our careers page](https://example.com/careers) for details"))
      .toBe("See our careers page for details");
  });

  it("handles a posting with multiple mixed hyperlinks", () => {
    const posting = "Join [Acme](https://acme.com). Apply at https://acme.com/jobs. Learn more at http://acme.com/about";
    const result = stripHyperlinks(posting);
    expect(result).toContain("Join Acme");
    expect(result).not.toContain("https://");
    expect(result).not.toContain("http://");
  });

  it("leaves plain text unchanged", () => {
    expect(stripHyperlinks("Senior QA Engineer at Acme Corp")).toBe("Senior QA Engineer at Acme Corp");
  });

  it("strips hyperlinks from posting before sending to Claude", async () => {
    vi.stubGlobal("fetch", vi.fn());
    fetch.mockResolvedValue({
      status: 200,
      json: () => Promise.resolve({ content: [{ type: "text", text: JSON.stringify(mockResult) }] }),
    });

    await evaluateJob("Apply at https://jobs.example.com — Senior QA role", "prompt");
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).not.toContain("https://");
    expect(body.messages[0].content).toContain("Senior QA role");
    vi.unstubAllGlobals();
  });
});

const mockResult = {
  company: "Vandelay",
  role: "SaaS Delivery Quality Manager",
  salary: "Not listed",
  fitScore: "Strong",
  verdict: "Best natural fit.",
  gaps: ["Fintech domain experience"],
  strengths: ["Client UAT", "Cypress", "CI/CD"],
  recommendation: "Apply",
};

function mockFetchResponse(text, status = 200) {
  return {
    status,
    json: () => Promise.resolve({
      content: [{ type: "text", text }],
    }),
  };
}

describe("evaluateJob", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed JSON from a clean Claude response", async () => {
    fetch.mockResolvedValue(mockFetchResponse(JSON.stringify(mockResult)));
    const result = await evaluateJob("some job posting", "system prompt");
    expect(result.company).toBe("Vandelay");
    expect(result.fitScore).toBe("Strong");
    expect(result.recommendation).toBe("Apply");
  });

  it("strips markdown code fences before parsing", async () => {
    const wrapped = "```json\n" + JSON.stringify(mockResult) + "\n```";
    fetch.mockResolvedValue(mockFetchResponse(wrapped));
    const result = await evaluateJob("some posting", "system prompt");
    expect(result.company).toBe("Vandelay");
  });

  it("strips code fences without language tag", async () => {
    const wrapped = "```\n" + JSON.stringify(mockResult) + "\n```";
    fetch.mockResolvedValue(mockFetchResponse(wrapped));
    const result = await evaluateJob("some posting", "system prompt");
    expect(result.company).toBe("Vandelay");
  });

  it("throws when Claude returns invalid JSON", async () => {
    fetch.mockResolvedValue(mockFetchResponse("this is not json"));
    await expect(evaluateJob("posting", "prompt")).rejects.toThrow();
  });

  it("throws on network failure", async () => {
    fetch.mockRejectedValue(new Error("Network error"));
    await expect(evaluateJob("posting", "prompt")).rejects.toThrow("Network error");
  });

  it("calls the correct proxy endpoint", async () => {
    fetch.mockResolvedValue(mockFetchResponse(JSON.stringify(mockResult)));
    await evaluateJob("posting", "prompt");
    expect(fetch).toHaveBeenCalledWith(
      "/api/anthropic/v1/messages",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("includes the system prompt in the request body", async () => {
    fetch.mockResolvedValue(mockFetchResponse(JSON.stringify(mockResult)));
    await evaluateJob("posting", "my system prompt");
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.system).toBe("my system prompt");
  });

  it("includes the posting text in the user message", async () => {
    fetch.mockResolvedValue(mockFetchResponse(JSON.stringify(mockResult)));
    await evaluateJob("Senior QA role at Acme", "prompt");
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.messages[0].content).toContain("Senior QA role at Acme");
  });
});
