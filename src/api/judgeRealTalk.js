import { sanitize } from "../utils/sanitize.js";
import { stripHyperlinks } from "./evaluateJob.js";

const JUDGE_PROMPT = `You are a hallucination detector for AI-generated job posting analysis.

You will be given:
1. A job posting (inside <job_posting> tags)
2. An AI-generated "real talk" analysis of that posting (inside <real_talk> tags)

Your job is to check every claim in the real talk analysis and determine whether it is supported by actual text in the job posting.

RULES:
- A claim is SUPPORTED if you can point to specific words or phrases in the posting that justify it.
- A claim is UNSUPPORTED if it is invented, assumed, or inferred beyond what the posting actually says.
- Be strict. "Probably" and "might be" are not evidence.
- Recruiter/agency flags are SUPPORTED if the posting contains agency branding, "our client", social media recruiter handles, or no named employer.
- Culture flags are SUPPORTED only if the posting uses language like "fast-paced", "wear many hats", "startup", "hustle", or similar.

Respond with a single valid JSON object — no markdown, no explanation outside the JSON:

{
  "grounded": true | false,
  "flags": string[] — list of specific unsupported claims, empty array [] if all claims are grounded,
  "summary": string — one sentence: either "All claims are supported by the posting." or a plain description of what was flagged
}`;

export async function judgeRealTalk(posting, realTalk) {
  const { cleanedText } = sanitize(stripHyperlinks(posting));

  const response = await fetch("/api/anthropic/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: JUDGE_PROMPT,
      messages: [{
        role: "user",
        content: `<job_posting>\n${cleanedText}\n</job_posting>\n\n<real_talk>\n${realTalk}\n</real_talk>`
      }]
    })
  });

  const data = await response.json();
  const text = data.content?.find(b => b.type === "text")?.text || "";
  const clean = text.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(clean);

  // Validate expected shape so RealTalkCard never receives undefined props
  if (typeof parsed.grounded !== "boolean") throw new Error("Judge response missing 'grounded' field");
  return {
    grounded: parsed.grounded,
    flags: Array.isArray(parsed.flags) ? parsed.flags.filter(f => typeof f === "string") : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
}
