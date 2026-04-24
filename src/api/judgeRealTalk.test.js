import { describe, it, expect, vi, beforeEach } from "vitest";
import { judgeRealTalk } from "./judgeRealTalk.js";

const VALID_POSTING = "Senior QA Engineer at Acme Corp. Requires Cypress and CI/CD experience.";
const VALID_REAL_TALK = "Straightforward automation role. No red flags.";

function mockFetch(text) {
  global.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ content: [{ type: "text", text }] }),
  });
}

function judgeJson(overrides) {
  return JSON.stringify({ grounded: true, flags: [], summary: "All good.", ...overrides });
}

function call() {
  return judgeRealTalk(VALID_POSTING, VALID_REAL_TALK);
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("judgeRealTalk", () => {

  it("returns grounded result when judge says all claims are supported", async () => {
    mockFetch(judgeJson({ summary: "All claims are supported by the posting." }));
    const result = await call();
    expect(result.grounded).toBe(true);
    expect(result.flags).toEqual([]);
    expect(result.summary).toBe("All claims are supported by the posting.");
  });

  it("returns ungrounded result with flags when judge finds unsupported claims", async () => {
    mockFetch(judgeJson({ grounded: false, flags: ["Claim about toxic culture is not in the posting"], summary: "One unsupported claim found." }));
    const result = await call();
    expect(result.grounded).toBe(false);
    expect(result.flags).toHaveLength(1);
    expect(result.flags[0]).toContain("toxic culture");
  });

  it("strips non-string values from flags array", async () => {
    mockFetch(judgeJson({ grounded: false, flags: ["valid flag", 42, null, "another flag"] }));
    const result = await call();
    expect(result.flags).toEqual(["valid flag", "another flag"]);
  });

  it("returns empty flags array when flags is not an array", async () => {
    mockFetch(judgeJson({ flags: null }));
    const result = await call();
    expect(result.flags).toEqual([]);
  });

  it("returns empty summary string when summary is not a string", async () => {
    mockFetch(judgeJson({ summary: 42 }));
    const result = await call();
    expect(result.summary).toBe("");
  });

  it("throws when grounded field is missing from response", async () => {
    mockFetch(JSON.stringify({ flags: [], summary: "Missing grounded." }));
    await expect(call()).rejects.toThrow("missing 'grounded' field");
  });

  it("throws when response is not valid JSON", async () => {
    mockFetch("not json at all");
    await expect(call()).rejects.toThrow();
  });

  it("handles json wrapped in code fences", async () => {
    mockFetch("```json\n" + judgeJson({}) + "\n```");
    const result = await call();
    expect(result.grounded).toBe(true);
  });

  it("sends request to the anthropic proxy endpoint", async () => {
    mockFetch(judgeJson({}));
    await call();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/anthropic/v1/messages",
      expect.objectContaining({ method: "POST" })
    );
  });
});
