/**
 * Level 3 AI-Powered Healer
 *
 * When Level 2 (fallback selectors) is exhausted, this module:
 *  1. Captures the current DOM snapshot from Playwright
 *  2. Sends it to Claude with a description of the element we need
 *  3. Parses the suggested CSS/data-testid selector from the response
 *  4. Retries the Playwright action with that selector
 *  5. Logs the suggestion to tests/healing-log.json for developer review
 *
 * Requires VITE_ANTHROPIC_API_KEY in the environment (or .env file).
 *
 * A healed test WARNS — it does NOT silently pass.
 */

import { type Page, type Locator } from "@playwright/test";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { type HealingEvent, type SelectorSet } from "./selfHealingLocator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_PATH = path.resolve(__dirname, "../../tests/healing-log.json");

function appendHealingEvent(event: HealingEvent): void {
  let log: HealingEvent[] = [];
  if (fs.existsSync(LOG_PATH)) {
    try {
      log = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as HealingEvent[];
    } catch {
      log = [];
    }
  }
  log.push(event);
  fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
}

/**
 * Extract a selector string from Claude's response.
 * Claude is prompted to return exactly one selector on a line starting with
 * "SELECTOR:" so we can parse it reliably.
 */
function extractSelector(claudeText: string): string | null {
  const match = claudeText.match(/^SELECTOR:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

/**
 * Trim the DOM to avoid blowing Claude's context window.
 * We strip script/style content and limit total length.
 */
function trimDom(html: string, maxChars = 12_000): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "<script>…</script>")
    .replace(/<style[\s\S]*?<\/style>/gi, "<style>…</style>")
    .slice(0, maxChars);
}

/**
 * Use Claude to suggest a working selector for an element that couldn't be
 * found via any known locator.
 *
 * Returns a Locator if Claude's suggestion works, otherwise throws.
 */
export async function aiHeal(
  page: Page,
  selectors: SelectorSet,
  testFile = "unknown"
): Promise<Locator> {
  const apiKey = process.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "[AI-HEALER] VITE_ANTHROPIC_API_KEY is not set. " +
        "Cannot invoke AI healer without an API key."
    );
  }

  console.warn(
    `\n🤖 [SELF-HEALING L3] All fallback selectors failed for "${selectors.description}". ` +
      `Invoking Claude AI healer…\n`
  );

  // 1. Capture DOM
  const rawHtml = await page.content();
  const domSnapshot = trimDom(rawHtml);

  // 2. Build prompt
  const prompt = `You are a Playwright test automation expert helping to repair a broken test selector.

The test is looking for an element described as: "${selectors.description}"

These selectors were tried and ALL failed:
${[selectors.primary, ...selectors.fallbacks].map((s) => `  - ${s}`).join("\n")}

Here is the current page DOM (truncated):
\`\`\`html
${domSnapshot}
\`\`\`

Your task:
1. Analyse the DOM and find an element that best matches the description.
2. Return a single Playwright-compatible CSS selector (e.g. [data-testid="foo"], button.submit, etc.).
3. Respond with ONLY this one line — no explanation:
SELECTOR: <your selector here>

If you cannot find a suitable element, respond with:
SELECTOR: null`;

  // 3. Call Claude
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 256,
    messages: [{ role: "user", content: prompt }],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  console.log(`[AI-HEALER] Claude response: ${responseText.trim()}`);

  const suggested = extractSelector(responseText);

  if (!suggested || suggested === "null") {
    throw new Error(
      `[AI-HEALER] Claude could not suggest a selector for "${selectors.description}". ` +
        `Manual fix required.`
    );
  }

  // 4. Try the suggested selector
  const loc = page.locator(suggested);
  try {
    await loc.first().waitFor({ state: "attached", timeout: 2000 });
  } catch {
    throw new Error(
      `[AI-HEALER] Claude suggested "${suggested}" for "${selectors.description}" ` +
        `but it also did not match any element. Manual fix required.`
    );
  }

  // 5. Log and warn
  const event: HealingEvent = {
    timestamp: new Date().toISOString(),
    testFile,
    description: selectors.description,
    failedSelector: selectors.primary,
    healedWith: suggested,
    level: "L3-ai",
    aiSuggestion: suggested,
  };

  console.warn(
    `\n⚠️  [SELF-HEALING L3] Claude AI suggested a working selector.\n` +
      `   Description : ${selectors.description}\n` +
      `   Failed      : ${selectors.primary}\n` +
      `   AI suggested: ${suggested}\n` +
      `   → Add this as a fallback in your SelectorSet, then update the primary.\n`
  );

  appendHealingEvent(event);
  return loc;
}

/**
 * Full self-healing pipeline: Level 2 fallbacks → Level 3 AI.
 *
 * Usage in tests:
 *   import { healWithAI } from "../helpers/aiHealer.js";
 *   const locator = await healWithAI(page, {
 *     description: "Export CSV button",
 *     primary: '[data-testid="btn-export-csv"]',
 *     fallbacks: ['button:has-text("export csv")', 'button[download]'],
 *   }, import.meta.url);
 */
export async function healWithAI(
  page: Page,
  selectors: SelectorSet,
  testFile = "unknown"
): Promise<Locator> {
  const all = [selectors.primary, ...selectors.fallbacks];

  // Level 2: try each selector
  for (let i = 0; i < all.length; i++) {
    const selector = all[i];
    try {
      const loc = page.locator(selector);
      await loc.first().waitFor({ state: "attached", timeout: 500 });

      if (i > 0) {
        // Healing occurred at L2
        const event: HealingEvent = {
          timestamp: new Date().toISOString(),
          testFile,
          description: selectors.description,
          failedSelector: selectors.primary,
          healedWith: selector,
          level: "L2-fallback",
        };
        console.warn(
          `\n⚠️  [SELF-HEALING L2] Fallback selector worked for "${selectors.description}".\n` +
            `   Failed   : ${selectors.primary}\n` +
            `   Healed   : ${selector}\n` +
            `   → Update the primary selector.\n`
        );
        appendHealingEvent(event);
      }

      return loc;
    } catch {
      // try next
    }
  }

  // Level 3: ask Claude
  return aiHeal(page, selectors, testFile);
}
