/**
 * Level 2 Self-Healing Locator
 *
 * Strategy: try the primary selector first, then fall back through alternatives.
 * When healing occurs, a WARNING is logged and the event is written to
 * tests/healing-log.json so developers know the primary selector drifted.
 *
 * A healed test is NEVER a silent pass — the warning surfaces in the Playwright
 * output and in the JSON log.
 *
 * Pass { strict: true } to throw after logging — use this in CI to prevent
 * healed tests from accumulating unnoticed.
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
  /** Timeout in ms for each selector probe. Defaults to 500. */
  timeout?: number;
}

export interface HealingOptions {
  /**
   * When true, throw after logging a healing event instead of returning the
   * healed locator. Use in CI so broken selectors can't accumulate silently.
   */
  strict?: boolean;
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

export function appendHealingEvent(event: HealingEvent): void {
  let log: HealingEvent[] = [];
  if (fs.existsSync(LOG_PATH)) {
    try {
      log = JSON.parse(fs.readFileSync(LOG_PATH, "utf-8")) as HealingEvent[];
    } catch {
      log = [];
    }
  }

  // Deduplicate — don't append if same description+failedSelector+healedWith already logged
  const isDuplicate = log.some(
    e =>
      e.description === event.description &&
      e.failedSelector === event.failedSelector &&
      e.healedWith === event.healedWith
  );

  if (!isDuplicate) {
    log.push(event);
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  }
}

/**
 * Try locators in order: primary → fallbacks.
 * Returns the first Locator that finds at least one attached element.
 * Throws if all selectors fail (so the test always fails explicitly).
 *
 * When a fallback heals the test:
 *   - A ⚠️  warning is printed to the console
 *   - A HealingEvent is appended to tests/healing-log.json (deduplicated)
 *   - If options.strict is true, throws after logging so CI catches it
 */
export async function healingLocator(
  page: Page,
  selectors: SelectorSet,
  testFile = "unknown",
  options: HealingOptions = {}
): Promise<Locator> {
  const all = [selectors.primary, ...selectors.fallbacks];
  const timeout = selectors.timeout ?? 500;

  for (let i = 0; i < all.length; i++) {
    const selector = all[i];
    try {
      const loc = page.locator(selector);
      await loc.first().waitFor({ state: "attached", timeout });

      if (i === 0) {
        return loc;
      }

      // A fallback healed this — log and warn
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
          (options.strict
            ? `   ✖ strict mode — failing the test so this gets fixed.\n`
            : `   → Update the primary selector to prevent this.\n`)
      );

      appendHealingEvent(event);

      if (options.strict) {
        throw new Error(
          `[SELF-HEALING L2] strict mode: primary selector failed for "${selectors.description}". ` +
            `Healed with "${selector}" — update the primary selector.`
        );
      }

      return loc;
    } catch (err) {
      // In strict mode the throw above should propagate, not be swallowed
      if (
        options.strict &&
        err instanceof Error &&
        err.message.startsWith("[SELF-HEALING L2] strict mode")
      ) {
        throw err;
      }
      // Otherwise this selector failed — try the next one
    }
  }

  throw new Error(
    `[SELF-HEALING] All selectors failed for "${selectors.description}".\n` +
      `  Tried: ${all.join(", ")}`
  );
}
