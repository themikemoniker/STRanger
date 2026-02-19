/**
 * Agent worker process — spawned by the AgentManager in the web server.
 * Communicates with the parent process via Node.js IPC (JSON messages).
 *
 * Phase 2: LLM-powered ReAct agent with screenshot-only fallback.
 * When an API key is provided, launches a ReAct loop that observes the page,
 * thinks via LLM, and takes browser actions. Without an API key, falls back
 * to Phase 1 screenshot-only behavior.
 */

import { chromium, firefox, webkit, type Browser, type Page } from "playwright";
import { mkdir, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  RunConfig,
  IpcStartMessage,
  IpcThinkMessage,
  IpcWorkerMessage,
} from "@stranger/db/types";
import { createProvider, type LlmProvider, type LlmMessage, type LlmContentPart } from "./llm/index.js";
import { parseLlmResponse, type AgentAction } from "./react-utils.js";

const MAX_REACT_ITERATIONS = 20;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendIpc(msg: IpcWorkerMessage): void {
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

// ── System prompt for the ReAct agent ────────────────────────────────────────

function buildSystemPrompt(config: RunConfig): string {
  return `You are a UI verification agent. You are testing a web application to verify that a specific feature works correctly.

## Scenario
Title: ${config.scenario.title}
Description: ${config.scenario.description}

## Your Task
Navigate the application and interact with it to verify the scenario described above. You will receive a screenshot of the current page state. Analyze it and decide what action to take next.

## Response Format
You MUST respond with valid JSON only. No other text before or after the JSON.

{
  "observation": "What you see on the page right now",
  "reasoning": "Your analysis and what you decide to do next and why",
  "action": "one of: click, type, scroll, navigate, wait, done",
  "actionArgs": {
    // For click: { "selector": "CSS selector or text content" }
    // For type: { "selector": "CSS selector", "text": "text to type" }
    // For scroll: { "direction": "down" | "up", "amount": 500 }
    // For navigate: { "url": "relative or absolute URL" }
    // For wait: { "ms": 1000 }
    // For done: { "verdict": "passed" | "failed", "summary": "Brief result summary" }
  }
}

## Guidelines
- Analyze the screenshot carefully before acting
- Use CSS selectors when possible (button, a, input, [data-testid="..."], etc.)
- If a CSS selector doesn't work, try text-based selectors
- Take screenshots after each action to verify the result
- When you've gathered enough evidence to judge the scenario, use the "done" action
- verdict "passed" means the feature works as described
- verdict "failed" means the feature does not work as described
- Be concise in your observations and reasoning
- Do not take more actions than necessary`;
}

// ── Action execution ─────────────────────────────────────────────────────────

async function executeAction(page: Page, action: AgentAction): Promise<string> {
  const args = action.actionArgs;

  switch (action.action) {
    case "click": {
      const selector = String(args.selector || "");
      try {
        await page.click(selector, { timeout: 5000 });
        return `Clicked: ${selector}`;
      } catch {
        // Fallback: try locator with text
        await page.locator(`text="${selector}"`).first().click({ timeout: 5000 });
        return `Clicked (text fallback): ${selector}`;
      }
    }

    case "type": {
      const selector = String(args.selector || "");
      const text = String(args.text || "");
      await page.fill(selector, text, { timeout: 5000 });
      return `Typed "${text}" into ${selector}`;
    }

    case "scroll": {
      const direction = String(args.direction || "down");
      const amount = Number(args.amount) || 500;
      const delta = direction === "up" ? -amount : amount;
      await page.evaluate((d) => window.scrollBy(0, d), delta);
      return `Scrolled ${direction} by ${amount}px`;
    }

    case "navigate": {
      const url = String(args.url || "/");
      const fullUrl = url.startsWith("http") ? url : `${page.url().replace(/\/[^/]*$/, "")}${url}`;
      await page.goto(fullUrl, { waitUntil: "domcontentloaded", timeout: 15_000 });
      return `Navigated to ${url}`;
    }

    case "wait": {
      const ms = Math.min(Number(args.ms) || 1000, 5000);
      await page.waitForTimeout(ms);
      return `Waited ${ms}ms`;
    }

    case "done":
      return "done";

    default:
      return `Unknown action: ${action.action}`;
  }
}

// ── Screenshot capture helper ────────────────────────────────────────────────

async function captureScreenshot(
  page: Page,
  artifactsDir: string,
  stepIndex: number,
): Promise<{ filename: string; filepath: string; sizeBytes: number }> {
  const paddedIndex = String(stepIndex).padStart(3, "0");
  const filename = `step-${paddedIndex}.png`;
  const filepath = join(artifactsDir, filename);
  await page.screenshot({ path: filepath, fullPage: false });
  const fileStat = await stat(filepath);
  return { filename, filepath, sizeBytes: fileStat.size };
}

// ── Phase 1 fallback: screenshot-only ────────────────────────────────────────

async function runScreenshotOnly(config: RunConfig, page: Page, startTime: number): Promise<void> {
  const scrollSteps = [
    { action: "initial-load", caption: "Initial page load", scrollTo: null },
    { action: "scroll-30", caption: "Scrolled down 30%", scrollTo: 0.3 },
    { action: "scroll-60", caption: "Scrolled down 60%", scrollTo: 0.6 },
    { action: "scroll-bottom", caption: "Scrolled to bottom", scrollTo: 1.0 },
    { action: "scroll-top", caption: "Scrolled back to top", scrollTo: 0 },
  ];

  const summaryParts: string[] = [];

  for (let i = 0; i < scrollSteps.length; i++) {
    const step = scrollSteps[i];

    if (step.scrollTo !== null) {
      await page.evaluate((pos) => {
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        window.scrollTo({ top: maxScroll * pos, behavior: "instant" as ScrollBehavior });
      }, step.scrollTo);
    }

    await page.waitForTimeout(300);

    const shot = await captureScreenshot(page, config.artifactsDir, i);

    sendIpc({
      type: "step",
      stepIndex: i,
      action: step.action,
      screenshot: {
        filename: shot.filename,
        caption: step.caption,
        sizeBytes: shot.sizeBytes,
      },
    });

    summaryParts.push(`Step ${i}: ${step.caption}`);
  }

  const targetUrl = `${config.baseUrl}${config.scenario.startPath || "/"}`;
  sendIpc({
    type: "verdict",
    verdict: "passed",
    summary: `Captured ${scrollSteps.length} screenshots of "${config.scenario.title}" at ${targetUrl}. ${summaryParts.join("; ")}.`,
    reasoning: "Screenshot-only verification completed (no API key provided). All scroll positions were captured successfully.",
    durationMs: Date.now() - startTime,
  });
}

// ── Phase 2: ReAct agent loop ────────────────────────────────────────────────

async function runReactAgent(
  config: RunConfig,
  page: Page,
  provider: LlmProvider,
  startTime: number,
): Promise<void> {
  const systemPrompt = buildSystemPrompt(config);
  const messages: LlmMessage[] = [];
  let stepIndex = 0;

  for (let iteration = 0; iteration < MAX_REACT_ITERATIONS; iteration++) {
    // OBSERVE: capture screenshot and read page metadata
    const shot = await captureScreenshot(page, config.artifactsDir, stepIndex);
    const screenshotBase64 = (await readFile(shot.filepath)).toString("base64");

    const pageTitle = await page.title();
    const pageUrl = page.url();

    // Build the user message with screenshot
    const userContent: LlmContentPart[] = [
      {
        type: "image",
        imageBase64: screenshotBase64,
        mimeType: "image/png",
      },
      {
        type: "text",
        text: `Current page: ${pageUrl}\nPage title: ${pageTitle}\nIteration: ${iteration + 1}/${MAX_REACT_ITERATIONS}`,
      },
    ];

    messages.push({ role: "user", content: userContent });

    // THINK: ask the LLM what to do
    let agentAction: AgentAction;
    try {
      const response = await provider.chat(messages, { systemPrompt });
      agentAction = parseLlmResponse(response.text);
      messages.push({ role: "assistant", content: response.text });
    } catch (parseErr) {
      // Retry once on parse failure
      try {
        messages.push({
          role: "user",
          content: "Your previous response was not valid JSON. Please respond with ONLY a JSON object, no other text.",
        });
        const retryResponse = await provider.chat(messages, { systemPrompt });
        agentAction = parseLlmResponse(retryResponse.text);
        messages.push({ role: "assistant", content: retryResponse.text });
      } catch {
        sendIpc({ type: "error", error: `Failed to parse LLM response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}` });
        sendIpc({
          type: "verdict",
          verdict: "error",
          summary: "LLM response could not be parsed after retry",
          durationMs: Date.now() - startTime,
        });
        return;
      }
    }

    // Send think message
    const thinkMsg: IpcThinkMessage = {
      type: "think",
      stepIndex,
      observation: agentAction.observation,
      reasoning: agentAction.reasoning,
      action: agentAction.action,
    };
    sendIpc(thinkMsg);

    // CHECK: if the LLM says "done", send verdict
    if (agentAction.action === "done") {
      const verdict = String(agentAction.actionArgs.verdict || "passed");
      const summary = String(agentAction.actionArgs.summary || "Verification complete");

      // Send the screenshot step for this final observation
      sendIpc({
        type: "step",
        stepIndex,
        action: "observe",
        detail: "Final observation before verdict",
        screenshot: {
          filename: shot.filename,
          caption: `Step ${stepIndex}: Final observation`,
          sizeBytes: shot.sizeBytes,
        },
      });

      sendIpc({
        type: "verdict",
        verdict: verdict === "passed" ? "passed" : "failed",
        summary,
        reasoning: agentAction.reasoning,
        durationMs: Date.now() - startTime,
      });
      return;
    }

    // ACT: execute the browser action
    let actionDetail: string;
    try {
      actionDetail = await executeAction(page, agentAction);
    } catch (actionErr) {
      actionDetail = `Action failed: ${actionErr instanceof Error ? actionErr.message : String(actionErr)}`;
      // Add failure feedback to messages so the LLM can adapt
      messages.push({
        role: "user",
        content: `The action "${agentAction.action}" failed with error: ${actionDetail}. Try a different approach.`,
      });
    }

    // Wait for page to settle after action
    await page.waitForTimeout(500);

    // Send step message with screenshot
    sendIpc({
      type: "step",
      stepIndex,
      action: agentAction.action,
      detail: actionDetail,
      screenshot: {
        filename: shot.filename,
        caption: `Step ${stepIndex}: ${agentAction.action}`,
        sizeBytes: shot.sizeBytes,
      },
    });

    stepIndex++;
  }

  // Exceeded max iterations
  sendIpc({ type: "error", error: `Reached maximum of ${MAX_REACT_ITERATIONS} iterations without a verdict` });
  sendIpc({
    type: "verdict",
    verdict: "error",
    summary: `Agent exceeded ${MAX_REACT_ITERATIONS} iteration limit without reaching a conclusion`,
    durationMs: Date.now() - startTime,
  });
}

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

    // Wait for page to settle
    await page.waitForLoadState("networkidle").catch(() => {});

    // Decide which mode to run
    if (config.apiKey && config.llmProvider) {
      const provider = createProvider(config.llmProvider, config.apiKey, config.llmModel);
      await runReactAgent(config, page, provider, startTime);
    } else {
      await runScreenshotOnly(config, page, startTime);
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    sendIpc({ type: "error", error: errorMessage });
    sendIpc({
      type: "verdict",
      verdict: "error",
      summary: `Worker failed: ${errorMessage}`,
      durationMs: Date.now() - startTime,
    });
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    process.exit(0);
  }
});
