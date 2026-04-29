/**
 * Input sanitization for job postings and resume text before sending to Claude.
 *
 * Each rule defines:
 *   - category: named sensitive category
 *   - pattern: regex to detect
 *   - action: "redact" | "strip" | "flag"
 *   - replacement: what to replace with (for redact/strip)
 *   - message: human-readable warning shown when flagged
 */

/**
 * Normalize unicode homoglyphs to their ASCII equivalents.
 *
 * Attackers can substitute visually identical unicode characters (e.g. Cyrillic
 * І for Latin I) to bypass keyword-based injection detection. NFKC normalization
 * resolves compatibility equivalents, and the replace pass catches remaining
 * common homoglyphs that NFKC does not collapse.
 */
export function normalizeUnicode(text) {
  // NFKC normalization resolves many compatibility characters to ASCII equivalents
  const normalized = text.normalize("NFKC");

  // Remaining high-frequency homoglyphs not caught by NFKC
  return normalized
    .replace(/[Ѐ-ӿ]/g, c => CYRILLIC_MAP[c] ?? c) // Cyrillic → Latin
    .replace(/​|‌|‍|﻿/g, "");            // strip zero-width chars
}

const CYRILLIC_MAP = {
  "А": "A", "а": "a", // А а
  "В": "B", "в": "b", // В в (looks like B/b)
  "Е": "E", "е": "e", // Е е
  "З": "3",                 // З (looks like 3)
  "И": "N", "и": "n", // И и (looks like N/n mirrored — close enough)
  "К": "K", "к": "k", // К к
  "М": "M", "м": "m", // М м
  "Н": "H", "н": "h", // Н н (looks like H)
  "О": "O", "о": "o", // О о
  "Р": "P", "р": "p", // Р р (looks like P/p)
  "С": "C", "с": "c", // С с
  "Т": "T", "т": "t", // Т т
  "У": "Y", "у": "y", // У у (looks like Y/y)
  "Х": "X", "х": "x", // Х х
  "І": "I", "і": "i", // І і (Ukrainian — the classic homoglyph)
};


export const SENSITIVE_RULES = [
  {
    category: "email",
    pattern: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g,
    action: "redact",
    replacement: "[email redacted]",
    message: "Email address detected and redacted before sending to Claude.",
  },
  {
    category: "phone",
    pattern: /(\+?1[\s\-.]?)?\(?\d{3}\)?[\s\-.]?\d{3}[\s\-.]?\d{4}/g,
    action: "redact",
    replacement: "[phone redacted]",
    message: "Phone number detected and redacted before sending to Claude.",
  },
  {
    category: "internal_ref",
    pattern: /\b(req|job|ref|id|jr|ic)[\-_]?\d{4,}\b/gi,
    action: "strip",
    replacement: "",
    message: "Internal job reference code stripped (not useful for evaluation).",
  },
  {
    category: "confidential",
    pattern: /\b(confidential|not for distribution|internal only|do not share|proprietary)\b/gi,
    action: "flag",
    replacement: null,
    message: "Posting contains a confidentiality marker — verify you are permitted to evaluate this externally.",
  },
  {
    category: "discriminatory_age",
    pattern: /\b(must be (under|over|at least|no more than) \d+|age \d+[\s\-]+\d+|young (professional|candidate|graduate)|recent graduate only|new grad only)\b/gi,
    action: "flag",
    replacement: null,
    message: "Posting may contain age-related language — review before applying.",
  },
  {
    category: "discriminatory_gender",
    pattern: /\b(he must|she must|male (only|candidate|preferred)|female (only|candidate|preferred)|rockstar guys|ninja bros)\b/gi,
    action: "flag",
    replacement: null,
    message: "Posting may contain gender-biased language — review before applying.",
  },
  {
    category: "encoded_payload",
    pattern: /[A-Za-z0-9+/]{40,}={0,2}/g,
    action: "reject",
    replacement: null,
    message: "Possible base64 encoded payload detected. Evaluation rejected — remove encoded content and try again.",
  },
];

/**
 * Sanitize text against all sensitive rules.
 *
 * Returns:
 *   cleanedText  — text with redactions and strips applied
 *   flags        — array of { category, message } for flagged issues
 *   redacted     — array of categories where content was replaced
 */
export function sanitize(text) {
  let cleaned = normalizeUnicode(text);
  const flags = [];
  const redacted = [];
  const rejected = [];

  for (const rule of SENSITIVE_RULES) {
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

  // Collapse extra whitespace left by strips
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  return { cleanedText: cleaned, flags, redacted, rejected };
}

/**
 * Returns true if the text contains any sensitive content.
 * Useful for showing a warning before submitting.
 */
export function hasSensitiveContent(text) {
  const { flags, redacted, rejected } = sanitize(text);
  return flags.length > 0 || redacted.length > 0 || rejected.length > 0;
}
