import { sanitize } from "../utils/sanitize.js";

export function stripHyperlinks(text) {
  return text
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, "$1") // markdown links: [text](url) → text
    .replace(/https?:\/\/\S+/g, "")                       // bare URLs
    .replace(/\s{2,}/g, " ")                              // collapse extra whitespace left behind
    .trim();
}

export async function evaluateJob(posting, systemPrompt) {
  const { cleanedText, rejected, flags } = sanitize(stripHyperlinks(posting));

  if (rejected.length > 0) {
    throw new Error(rejected[0].message);
  }

  const response = await fetch("/api/anthropic/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: `Evaluate this job posting for Arti:\n\n<job_posting>\n${cleanedText}\n</job_posting>` }]
    })
  });

  const data = await response.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();
  return { ...JSON.parse(clean), _flags: flags };
}
