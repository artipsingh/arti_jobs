/**
 * Level 2 Self-Healing Locator
 *
 * Strategy: try the primary selector first, then fall back through alternatives.
 * When healing occurs, a WARNING is logged and the event is written to
 * tests/healing-log.json so developers know the primary selector drifted.
 *
 * A healed test is NEVER a silent pass — the warning surfaces in the Playwright
 * output and in the JSON log.
 */

import { type Page, type Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface SelectorSet {
  /** Human-readable label for what we're looking for (used in logs) */
  description: string;
  /** The preferred selector — usually `data-testid` */
  primary: string;
  /** Ordered fallbacks tried if primary fails */
  fallbacks: string[];
}

export interface HealingEvent {
  timestamp: string;
  testFile: string;
  description: string;
  failedSelector: string;
  healedWith: string;
  level: "L2-fallback" | "L3-ai";
  aiSuggestion?: string;
}

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
 * Try locators in order: primary → fallbacks.
 * Returns the first Locator that finds at least one visible element.
 * Throws if all selectors fail (so the test still fails explicitly).
 */
export async function healingLocator(
  page: Page,
  selectors: SelectorSet,
  testFile = "unknown"
): Promise<Locator> {
  const all = [selectors.primary, ...selectors.fallbacks];

  for (let i = 0; i < all.length; i++) {
    const selector = all[i];
    try {
      const loc = page.locator(selector);
      // A quick, non-throwing visibility probe (500 ms is enough for DOM elements)
      await loc.first().waitFor({ state: "attached", timeout: 500 });

      if (i === 0) {
        // Primary worked — no healing needed
        return loc;
      }

      // A fallback healed this — emit a warning
      const event: HealingEvent = {
        timestamp: new Date().toISOString(),
        testFile,
        description: selectors.description,
        failedSelector: selectors.primary,
        healedWith: selector,
        level: "L2-fallback",
      };

      console.warn(
        `\n⚠️  [SELF-HEALING L2] Element found via fallback selector.\n` +
          `   Description : ${selectors.description}\n` +
          `   Failed      : ${selectors.primary}\n` +
          `   Healed with : ${selector}\n` +
          `   → Update the primary selector to prevent this.\n`
      );

      appendHealingEvent(event);
      return loc;
    } catch {
      // This selector failed — try the next one
    }
  }

  throw new Error(
    `[SELF-HEALING] All selectors failed for "${selectors.description}".\n` +
      `  Tried: ${all.join(", ")}`
  );
}
