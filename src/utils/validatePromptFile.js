/**
 * Validation for prompt source files (resume.txt, experienceMapping.txt, etc.)
 * before they are injected into the system prompt.
 *
 * Unlike sanitize.js (which cleans user input), these are our own files.
 * Finding any of these patterns is a hard error — we reject, not strip.
 */

const MAX_PROMPT_FILE_LENGTH = 50_000;

const PROMPT_FILE_RULES = [
  {
    name: "hyperlink",
    pattern: /https?:\/\/\S+|ftp:\/\/\S+|\[[^\]]+\]\(https?:\/\/[^)]+\)/i,
    message: "contains a hyperlink",
  },
  {
    name: "embedded_image",
    pattern: /data:image\/[a-z]+;base64,/i,
    message: "contains an embedded image or QR code",
  },
  {
    name: "control_characters",
    // eslint-disable-next-line no-control-regex
    pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F]/,
    message: "contains control characters",
  },
  {
    name: "unicode_direction_override",
    pattern: /[\u202A-\u202E\u2066-\u2069]/,
    message: "contains Unicode direction override characters",
  },
  {
    name: "zero_width_characters",
    pattern: /[\u200B-\u200F\uFEFF]/,
    message: "contains zero-width or byte-order-mark characters",
  },
  {
    name: "url_encoding",
    pattern: /%[0-9A-Fa-f]{2}/,
    message: "contains URL-encoded characters (%xx)",
  },
  {
    name: "html_entities",
    pattern: /&(?:[a-z]{2,8}|#\d{1,6}|#x[0-9A-Fa-f]{1,5});/i,
    message: "contains HTML entities (&lt;, &#x27;, etc.)",
  },
  {
    name: "suspicious_token",
    pattern: /\S{30,}/,
    message: "contains a suspicious token (30+ characters without a space) — possible encoded payload",
  },
];

/**
 * Validate a prompt source file's content.
 * Throws an Error with a user-readable message if any rule is violated.
 *
 * @param {string} filename - human-readable name shown in the error (e.g. "resume.txt")
 * @param {string} content  - raw file content to validate
 */
export function validatePromptFile(filename, content) {
  // NFKC normalization — resolve unicode compatibility characters before checking
  const normalized = content.normalize("NFKC");

  if (normalized.length > MAX_PROMPT_FILE_LENGTH) {
    throw new Error(
      `File validation failed: ${filename} exceeds maximum length of ${MAX_PROMPT_FILE_LENGTH} characters (got ${normalized.length}). Trim the file and try again.`
    );
  }

  for (const rule of PROMPT_FILE_RULES) {
    if (rule.pattern.test(normalized)) {
      throw new Error(
        `File validation failed: ${filename} ${rule.message}. Remove it and try again.`
      );
    }
  }
}
