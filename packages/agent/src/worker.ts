/**
 * Agent worker process — spawned by the AgentManager in the web server.
 * Communicates with the parent process via Node.js IPC (JSON messages).
 *
 * Phase 1: Screenshot-only worker.
 * Launches a Playwright browser, navigates to the target page, captures
 * screenshots at various scroll positions, and reports a "passed" verdict.
 */

import { chromium, firefox, webkit, type Browser, type Page } from "playwright";
import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import type {
  IpcStartMessage,
  IpcStepMessage,
  IpcVerdictMessage,
  IpcErrorMessage,
} from "@ranger/db/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendIpc(msg: IpcStepMessage | IpcVerdictMessage | IpcErrorMessage): void {
  process.send!(msg);
}

function launcherForBrowser(name: string) {
  switch (name.toLowerCase()) {
    case "firefox":
      return firefox;
    case "webkit":
      return webkit;
    case "chromium":
    default:
      return chromium;
  }
}

// ── Step definitions ─────────────────────────────────────────────────────────

interface StepDef {
  action: string;
  caption: string;
  /** Scroll action to perform before taking the screenshot. */
  scroll: (page: Page) => Promise<void>;
}

const STEPS: StepDef[] = [
  {
    action: "initial-load",
    caption: "Initial page load",
    scroll: async () => {
      /* no scroll needed */
    },
  },
  {
    action: "scroll-30",
    caption: "Scrolled down 30%",
    scroll: async (page) => {
      await page.evaluate(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: maxScroll * 0.3, behavior: "instant" });
      });
    },
  },
  {
    action: "scroll-60",
    caption: "Scrolled down 60%",
    scroll: async (page) => {
      await page.evaluate(() => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: maxScroll * 0.6, behavior: "instant" });
      });
    },
  },
  {
    action: "scroll-bottom",
    caption: "Scrolled to bottom",
    scroll: async (page) => {
      await page.evaluate(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
      });
    },
  },
  {
    action: "scroll-top",
    caption: "Scrolled back to top",
    scroll: async (page) => {
      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
      });
    },
  },
];

// ── Main message handler ─────────────────────────────────────────────────────

process.on("message", async (msg: IpcStartMessage) => {
  if (msg.type !== "start") return;

  const { config } = msg;
  const startTime = Date.now();
  let browser: Browser | undefined;

  try {
    // Ensure artifacts directory exists
    await mkdir(config.artifactsDir, { recursive: true });

    // Launch browser
    const launcher = launcherForBrowser(config.browser);
    browser = await launcher.launch({ headless: true });

    const viewport = config.viewport ?? { width: 1280, height: 720 };
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();

    // Navigate to target URL
    const targetUrl = `${config.baseUrl}${config.scenario.startPath || "/"}`;
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // Wait a bit extra for any late resources
    await page.waitForLoadState("networkidle").catch(() => {
      // networkidle can time out on long-polling pages; ignore and continue
    });

    // Execute each step
    const summaryParts: string[] = [];

    for (let i = 0; i < STEPS.length; i++) {
      const step = STEPS[i];
      const paddedIndex = String(i).padStart(3, "0");
      const filename = `step-${paddedIndex}-${step.action}.png`;
      const filepath = join(config.artifactsDir, filename);

      // Perform scroll action
      await step.scroll(page);

      // Small pause to let rendering settle after scroll
      await page.waitForTimeout(300);

      // Capture screenshot
      await page.screenshot({ path: filepath, fullPage: false });

      // Get file size
      const fileStat = await stat(filepath);

      // Send step message to parent
      const stepMsg: IpcStepMessage = {
        type: "step",
        stepIndex: i,
        action: step.action,
        screenshot: {
          filename,
          caption: step.caption,
          sizeBytes: fileStat.size,
        },
      };
      sendIpc(stepMsg);

      summaryParts.push(`Step ${i}: ${step.caption}`);
    }

    // All steps completed — send verdict
    const durationMs = Date.now() - startTime;
    const verdictMsg: IpcVerdictMessage = {
      type: "verdict",
      verdict: "passed",
      summary: `Captured ${STEPS.length} screenshots of "${config.scenario.title}" at ${targetUrl}. ${summaryParts.join("; ")}.`,
      reasoning: "Phase 1 screenshot-only verification completed. All scroll positions were captured successfully.",
      durationMs,
    };
    sendIpc(verdictMsg);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Send error message
    const errorMsg: IpcErrorMessage = {
      type: "error",
      error: errorMessage,
    };
    sendIpc(errorMsg);

    // Send verdict with error status
    const durationMs = Date.now() - startTime;
    const verdictMsg: IpcVerdictMessage = {
      type: "verdict",
      verdict: "error",
      summary: `Worker failed: ${errorMessage}`,
      durationMs,
    };
    sendIpc(verdictMsg);
  } finally {
    // Always close the browser and exit
    if (browser) {
      await browser.close().catch(() => {});
    }
    process.exit(0);
  }
});
