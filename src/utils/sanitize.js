/**
 * Input sanitization for job postings and resume text before sending to Claude.
 *
 * Each rule defines:
 *   - category: named sensitive category
 *   - pattern: regex to detect
 *   - action: "redact" | "strip" | "flag" | "reject"
 *   - replacement: what to replace with (for redact/strip)
 *   - message: human-readable warning shown when flagged
 */

/**
 * Strip HTML tags and decode common HTML entities before sending to Claude.
 * Prevents invisible ink attacks (white text hidden in HTML markup).
 */
export function stripHtml(text) {
  return text
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*style\s*=\s*["'][^"']*color\s*:\s*(white|#fff|#ffffff|transparent)[^"']*["'][^>]*>[\s\S]*?<\/[^>]+>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Normalize unicode to ASCII equivalents before sanitization rules run.
 * NFKC resolves compatibility characters (e.g. fullwidth letters).
 * Zero-width chars are stripped as they can be used to break keyword detection.
 */
export function normalizeUnicode(text) {
  const normalized = text.normalize("NFKC");
  // eslint-disable-next-line no-irregular-whitespace
  return normalized.replace(/​|‌|‍|﻿/g, "");
}

export const SENSITIVE_RULES = [
  {
    category: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    action: "redact",
    replacement: "[email redacted]",
    message: "Email address detected and redacted before sending to Claude.",
  },
  {
    category: "phone",
    pattern: /(\+?1[\s-.]?)?\(?\d{3}\)?[\s-.]?\d{3}[\s-.]?\d{4}/g,
    action: "redact",
    replacement: "[phone redacted]",
    message: "Phone number detected and redacted before sending to Claude.",
  },
  {
    category: "internal_ref",
    pattern: /\b(req|job|ref|id|jr|ic)[-_]?\d{4,}\b/gi,
    action: "strip",
    replacement: "",
    message: "Internal job reference code stripped (not useful for evaluation).",
  },
  {
    category: "confidential",
    pattern: /\b(confidential|not for distribution|internal only|do not share|proprietary)\b/gi,
    action: "flag",
    replacement: null,
    message: "Posting contains a confidentiality marker -- verify you are permitted to evaluate this externally.",
  },
  {
    category: "discriminatory_age",
    pattern: /\b(must be (under|over|at least|no more than) \d+|age \d+[\s-]+\d+|young (professional|candidate|graduate)|recent graduate only|new grad only)\b/gi,
    action: "flag",
    replacement: null,
    message: "Posting may contain age-related language -- review before applying.",
  },
  {
    category: "discriminatory_gender",
    pattern: /\b(he must|she must|male (only|candidate|preferred)|female (only|candidate|preferred)|rockstar guys|ninja bros)\b/gi,
    action: "flag",
    replacement: null,
    message: "Posting may contain gender-biased language -- review before applying.",
  },
  {
    category: "suspicious_token",
    pattern: /\S{40,}/g,
    action: "reject",
    replacement: null,
    message: "Suspicious token detected (40+ characters without a space). Evaluation rejected -- this may be an encoded payload.",
  },
  {
    category: "special_token",
    pattern: /<\|[a-z_]+\|>/gi,
    action: "reject",
    replacement: null,
    message: "Model special token detected (e.g. <|endoftext|>). Evaluation rejected -- remove it and try again.",
  },
  {
    category: "non_latin_script",
    // Arabic U+0600-06FF, Devanagari U+0900-097F, CJK U+3000-9FFF, Hangul U+AC00-D7AF
    // eslint-disable-next-line no-misleading-character-class, no-irregular-whitespace
    pattern: /[؀-ۿऀ-ॿ　-鿿가-힯]/,
    action: "flag",
    replacement: null,
    message: "Posting contains non-Latin script (Chinese, Japanese, Arabic, etc.). Review before submitting -- injection instructions may be hidden in text you cannot read.",
  },
];

/**
 * Sanitize text against all sensitive rules.
 *
 * Returns:
 *   cleanedText  -- text with redactions and strips applied
 *   flags        -- array of { category, message } for flagged issues
 *   redacted     -- array of categories where content was replaced
 *   rejected     -- array of categories that caused hard rejection
 */
export function sanitize(text) {
  const flags = [];
  const redacted = [];
  const rejected = [];

  // Check for model special tokens before HTML stripping -- stripHtml would
  // remove angle brackets and make <|endoftext|> undetectable
  const specialTokenRule = SENSITIVE_RULES.find(r => r.category === "special_token");
  if (specialTokenRule && specialTokenRule.pattern.test(text)) {
    specialTokenRule.pattern.lastIndex = 0;
    rejected.push({ category: specialTokenRule.category, message: specialTokenRule.message });
    return { cleanedText: "", flags, redacted, rejected };
  }

  let cleaned = normalizeUnicode(stripHtml(text));

  for (const rule of SENSITIVE_RULES) {
    if (rule.category === "special_token") continue; // already handled above

    const hasMatch = rule.pattern.test(cleaned);
    rule.pattern.lastIndex = 0;

    if (!hasMatch) continue;

    if (rule.action === "reject") {
      rejected.push({ category: rule.category, message: rule.message });
    } else if (rule.action === "redact" || rule.action === "strip") {
      cleaned = cleaned.replace(rule.pattern, rule.replacement);
      rule.pattern.lastIndex = 0;
      redacted.push({ category: rule.category, message: rule.message });
    } else if (rule.action === "flag") {
      flags.push({ category: rule.category, message: rule.message });
    }
  }

  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return { cleanedText: cleaned, flags, redacted, rejected };
}

/**
 * Returns true if the text contains any sensitive content.
 */
export function hasSensitiveContent(text) {
  const { flags, redacted, rejected } = sanitize(text);
  return flags.length > 0 || redacted.length > 0 || rejected.length > 0;
}
