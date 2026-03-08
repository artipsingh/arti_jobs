import { describe, it, expect } from "vitest";
import { sanitize, hasSensitiveContent, SENSITIVE_RULES } from "./sanitize.js";

// ---------------------------------------------------------------------------
// Email redaction
// ---------------------------------------------------------------------------
describe("email redaction", () => {
  it("redacts a standard email address", () => {
    const { cleanedText } = sanitize("Contact us at recruiter@company.com for details.");
    expect(cleanedText).not.toContain("recruiter@company.com");
    expect(cleanedText).toContain("[email redacted]");
  });

  it("redacts email in resume format", () => {
    const { cleanedText } = sanitize("Arti Singh | arti.p.singh@gmail.com | Toronto");
    expect(cleanedText).not.toContain("arti.p.singh@gmail.com");
    expect(cleanedText).toContain("[email redacted]");
  });

  it("redacts multiple emails in one text", () => {
    const { cleanedText } = sanitize("Email hr@acme.com or cto@acme.com");
    expect(cleanedText).not.toContain("hr@acme.com");
    expect(cleanedText).not.toContain("cto@acme.com");
  });

  it("reports email in redacted list", () => {
    const { redacted } = sanitize("Send CV to jobs@company.com");
    expect(redacted.some(r => r.category === "email")).toBe(true);
  });

  it("leaves text without emails unchanged", () => {
    const { cleanedText } = sanitize("Senior QA Engineer at Acme Corp");
    expect(cleanedText).toBe("Senior QA Engineer at Acme Corp");
  });
});

// ---------------------------------------------------------------------------
// Phone number redaction
// ---------------------------------------------------------------------------
describe("phone number redaction", () => {
  it("redacts a standard North American phone number", () => {
    const { cleanedText } = sanitize("Call us at 416-555-1234 to apply.");
    expect(cleanedText).not.toContain("416-555-1234");
    expect(cleanedText).toContain("[phone redacted]");
  });

  it("redacts phone with country code", () => {
    const { cleanedText } = sanitize("Reach us at +1 (416) 555-9876");
    expect(cleanedText).not.toContain("416");
    expect(cleanedText).toContain("[phone redacted]");
  });

  it("redacts phone with dots as separators", () => {
    const { cleanedText } = sanitize("Phone: 416.555.0000");
    expect(cleanedText).toContain("[phone redacted]");
  });

  it("reports phone in redacted list", () => {
    const { redacted } = sanitize("Call 647-555-0000");
    expect(redacted.some(r => r.category === "phone")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Internal reference code stripping
// ---------------------------------------------------------------------------
describe("internal reference code stripping", () => {
  it("strips REQ- style job codes", () => {
    const { cleanedText } = sanitize("Job REQ-12345: Senior QA Engineer");
    expect(cleanedText).not.toContain("REQ-12345");
  });

  it("strips JR- style codes", () => {
    const { cleanedText } = sanitize("Apply for JR-98765 today");
    expect(cleanedText).not.toContain("JR-98765");
  });

  it("strips ID_ style codes", () => {
    const { cleanedText } = sanitize("Reference ID_20001 in your application");
    expect(cleanedText).not.toContain("ID_20001");
  });

  it("preserves the rest of the text after stripping", () => {
    const { cleanedText } = sanitize("Job REQ-12345: Senior QA Engineer at Acme");
    expect(cleanedText).toContain("Senior QA Engineer at Acme");
  });
});

// ---------------------------------------------------------------------------
// Confidential marker flagging
// ---------------------------------------------------------------------------
describe("confidential marker flagging", () => {
  it("flags text containing 'confidential'", () => {
    const { flags } = sanitize("Confidential — internal posting only.");
    expect(flags.some(f => f.category === "confidential")).toBe(true);
  });

  it("flags 'not for distribution'", () => {
    const { flags } = sanitize("This posting is not for distribution outside the company.");
    expect(flags.some(f => f.category === "confidential")).toBe(true);
  });

  it("flags 'internal only'", () => {
    const { flags } = sanitize("Internal only — please do not share.");
    expect(flags.some(f => f.category === "confidential")).toBe(true);
  });

  it("does NOT redact confidential text — only flags it", () => {
    const { cleanedText } = sanitize("Confidential job posting.");
    expect(cleanedText).toContain("Confidential");
  });

  it("includes a human-readable message with the flag", () => {
    const { flags } = sanitize("Confidential posting.");
    const flag = flags.find(f => f.category === "confidential");
    expect(flag.message).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Discriminatory language flagging
// ---------------------------------------------------------------------------
describe("discriminatory language flagging", () => {
  it("flags age-restrictive language", () => {
    const { flags } = sanitize("Must be under 35 to apply for this role.");
    expect(flags.some(f => f.category === "discriminatory_age")).toBe(true);
  });

  it("flags 'young professional' language", () => {
    const { flags } = sanitize("We're looking for a young professional to join our team.");
    expect(flags.some(f => f.category === "discriminatory_age")).toBe(true);
  });

  it("flags 'recent graduate only'", () => {
    const { flags } = sanitize("Recent graduate only — no senior candidates.");
    expect(flags.some(f => f.category === "discriminatory_age")).toBe(true);
  });

  it("flags gender-biased language", () => {
    const { flags } = sanitize("We want rockstar guys to join our eng team.");
    expect(flags.some(f => f.category === "discriminatory_gender")).toBe(true);
  });

  it("does NOT redact discriminatory text — only flags it for review", () => {
    const { cleanedText } = sanitize("Must be under 35 to apply.");
    expect(cleanedText).toContain("under 35");
  });
});

// ---------------------------------------------------------------------------
// Combined / integration behaviour
// ---------------------------------------------------------------------------
describe("combined sanitization", () => {
  it("applies all rules in a single pass", () => {
    const posting = `
      Confidential — REQ-99001
      Contact hr@acme.com or call 416-555-0001.
      Must be under 35. Young professionals preferred.
    `;
    const { cleanedText, flags, redacted } = sanitize(posting);

    expect(cleanedText).not.toContain("hr@acme.com");
    expect(cleanedText).not.toContain("REQ-99001");
    expect(cleanedText).toContain("[email redacted]");
    expect(flags.some(f => f.category === "confidential")).toBe(true);
    expect(flags.some(f => f.category === "discriminatory_age")).toBe(true);
    expect(redacted.some(r => r.category === "phone")).toBe(true);
  });

  it("returns empty flags and redacted for clean text", () => {
    const { flags, redacted } = sanitize("Senior QA Engineer. 5+ years Cypress required.");
    expect(flags).toHaveLength(0);
    expect(redacted).toHaveLength(0);
  });

  it("hasSensitiveContent returns true when issues are found", () => {
    expect(hasSensitiveContent("Email us at apply@jobs.com")).toBe(true);
  });

  it("hasSensitiveContent returns false for clean text", () => {
    expect(hasSensitiveContent("Senior QA Engineer, Cypress required")).toBe(false);
  });

  it("collapses extra whitespace left after stripping", () => {
    const { cleanedText } = sanitize("Job  REQ-12345   at Acme");
    expect(cleanedText).not.toMatch(/\s{2,}/);
  });
});

// ---------------------------------------------------------------------------
// Rule definitions
// ---------------------------------------------------------------------------
describe("SENSITIVE_RULES definitions", () => {
  it("every rule has required fields", () => {
    for (const rule of SENSITIVE_RULES) {
      expect(rule.category, "missing category").toBeTruthy();
      expect(rule.pattern, "missing pattern").toBeInstanceOf(RegExp);
      expect(["redact", "strip", "flag"], "invalid action").toContain(rule.action);
      expect(rule.message, "missing message").toBeTruthy();
    }
  });

  it("redact and strip rules have a replacement string", () => {
    for (const rule of SENSITIVE_RULES) {
      if (rule.action === "redact" || rule.action === "strip") {
        expect(typeof rule.replacement).toBe("string");
      }
    }
  });
});
