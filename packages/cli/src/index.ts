#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig, saveConfig } from "./config.js";
import { RangerClient } from "./client.js";

const program = new Command();

program
  .name("ranger")
  .description("Self-hosted UI feature review automation")
  .version("0.0.1");

// ── Setup ───────────────────────────────────────────────────────────────────
program
  .command("setup")
  .description("Initialize Ranger config and verify server connection")
  .option("--server-url <url>", "Server URL", "http://localhost:4800")
  .action(async (opts: { serverUrl: string }) => {
    saveConfig({ serverUrl: opts.serverUrl });
    console.log(`Config saved. Server URL: ${opts.serverUrl}`);

    try {
      const client = new RangerClient(opts.serverUrl);
      const status = await client.status();
      console.log(`Server connected: v${status.version}`);
    } catch (err) {
      console.error(`Warning: Could not connect to server at ${opts.serverUrl}`);
      console.error(`  ${err instanceof Error ? err.message : err}`);
      console.error("  Make sure the server is running (pnpm dev)");
    }
  });

// ── Profile ─────────────────────────────────────────────────────────────────
const profileCmd = program
  .command("profile")
  .description("Manage browser profiles");

profileCmd
  .command("add")
  .description("Add a new profile")
  .argument("<name>", "Profile name")
  .requiredOption("--base-url <url>", "Base URL for the profile")
  .option("--browser <browser>", "Browser (chromium, firefox, webkit)", "chromium")
  .option("--viewport <size>", "Viewport size (e.g., 1280x720)")
  .option("--default", "Set as default profile")
  .action(async (name: string, opts: { baseUrl: string; browser: string; viewport?: string; default?: boolean }) => {
    try {
      const client = new RangerClient();
      await client.createProfile({
        name,
        baseUrl: opts.baseUrl,
        browser: opts.browser,
        viewport: opts.viewport,
        isDefault: opts.default,
      });
      console.log(`Profile "${name}" created.`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

profileCmd
  .command("list")
  .description("List all profiles")
  .action(async () => {
    try {
      const client = new RangerClient();
      const profiles = await client.listProfiles() as Array<Record<string, unknown>>;
      if (profiles.length === 0) {
        console.log("No profiles found. Use `ranger profile add` to create one.");
        return;
      }
      for (const p of profiles) {
        const def = p.isDefault ? " (default)" : "";
        console.log(`  ${p.name}${def} — ${p.baseUrl} [${p.browser}]`);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ── Create ──────────────────────────────────────────────────────────────────
program
  .command("create")
  .description("Create a new feature review")
  .requiredOption("--title <title>", "Review title")
  .option("--description <text>", "Review description")
  .option("--branch <branch>", "Git branch")
  .option("--profile <id>", "Profile ID to use")
  .action(async (opts: { title: string; description?: string; branch?: string; profile?: string }) => {
    try {
      const client = new RangerClient();
      const review = await client.createReview({
        title: opts.title,
        description: opts.description,
        branch: opts.branch,
        profileId: opts.profile,
      });
      console.log(`Review created: ${review.id}`);
      console.log(`  Title: ${review.title}`);
      if (review.branch) console.log(`  Branch: ${review.branch}`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ── List ────────────────────────────────────────────────────────────────────
program
  .command("list")
  .description("List feature reviews")
  .option("--status <status>", "Filter by status")
  .action(async (opts: { status?: string }) => {
    try {
      const client = new RangerClient();
      const reviews = await client.listReviews(opts.status) as Array<Record<string, unknown>>;
      if (reviews.length === 0) {
        console.log("No reviews found.");
        return;
      }
      console.log(`Found ${reviews.length} review(s):\n`);
      for (const r of reviews) {
        const status = String(r.status).toUpperCase().padEnd(12);
        console.log(`  [${status}] ${r.id}`);
        console.log(`             ${r.title}`);
        if (r.branch) console.log(`             branch: ${r.branch}`);
        console.log();
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ── Show ────────────────────────────────────────────────────────────────────
program
  .command("show")
  .description("Show feature review details")
  .argument("<id>", "Review ID")
  .action(async (id: string) => {
    try {
      const client = new RangerClient();
      const review = await client.getReview(id);
      console.log(`Review: ${review.title}`);
      console.log(`  ID:     ${review.id}`);
      console.log(`  Status: ${review.status}`);
      if (review.branch) console.log(`  Branch: ${review.branch}`);
      if (review.description) console.log(`  Desc:   ${review.description}`);

      const scenarios = review.scenarios as Array<Record<string, unknown>> | undefined;
      if (scenarios && scenarios.length > 0) {
        console.log(`\n  Scenarios (${scenarios.length}):`);
        for (const sc of scenarios) {
          const runs = sc.runs as Array<Record<string, unknown>> | undefined;
          const lastRun = runs && runs.length > 0 ? runs[runs.length - 1] : null;
          const verdict = lastRun ? ` [${String(lastRun.verdict).toUpperCase()}]` : "";
          console.log(`    ${sc.ordinal}. ${sc.title}${verdict}`);
        }
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ── Go (verify) ─────────────────────────────────────────────────────────────
program
  .command("go")
  .description("Run verification on a feature review")
  .argument("<id>", "Review ID")
  .option("--profile <id>", "Profile ID to use")
  .option("--scenario <ids...>", "Specific scenario IDs")
  .option("--notes <text>", "Notes for the verification run")
  .option("--api-key <key>", "LLM API key (or set ANTHROPIC_API_KEY / OPENAI_API_KEY env var)")
  .option("--llm-provider <name>", "LLM provider: anthropic or openai", "anthropic")
  .option("--llm-model <model>", "LLM model override")
  .action(async (id: string, opts: {
    profile?: string;
    scenario?: string[];
    notes?: string;
    apiKey?: string;
    llmProvider?: string;
    llmModel?: string;
  }) => {
    try {
      const client = new RangerClient();
      const provider = opts.llmProvider || "anthropic";
      const apiKey = opts.apiKey
        || (provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY);

      console.log("Triggering verification...");
      if (apiKey) {
        console.log(`  LLM: ${provider}${opts.llmModel ? ` (${opts.llmModel})` : ""}`);
      } else {
        console.log("  Mode: screenshot-only (no API key provided)");
      }

      const result = await client.triggerVerify({
        reviewId: id,
        profileId: opts.profile,
        scenarioIds: opts.scenario,
        notes: opts.notes,
        apiKey,
        llmProvider: apiKey ? provider : undefined,
        llmModel: apiKey ? opts.llmModel : undefined,
      });

      console.log(`Started ${result.scenarioCount} run(s). Streaming live...\n`);

      // Stream each run via SSE
      for (const runId of result.runIds) {
        try {
          await client.streamRun(runId, (event) => {
            if (event.type === "keepalive") return;

            if (event.type === "think") {
              console.log(`  [Think] Step ${event.stepIndex}`);
              console.log(`    See:  ${event.observation}`);
              console.log(`    Why:  ${event.reasoning}`);
              console.log(`    Do:   ${event.action}`);
              console.log();
            } else if (event.type === "step") {
              const detail = event.detail ? ` — ${event.detail}` : "";
              console.log(`  [Step ${event.stepIndex}] ${event.action}${detail}`);
            } else if (event.type === "verdict") {
              const verdict = String(event.verdict).toUpperCase();
              const duration = ((event.durationMs as number) / 1000).toFixed(1);
              console.log();
              console.log(`  [${verdict}] ${event.summary} (${duration}s)`);
              if (event.reasoning) {
                console.log(`    ${event.reasoning}`);
              }
              console.log();
            } else if (event.type === "error") {
              console.error(`  [ERROR] ${event.error}`);
            }
          });
        } catch {
          // SSE failed — fall back to polling
          console.log("  SSE unavailable, falling back to polling...");
          let done = false;
          while (!done) {
            await sleep(2000);
            const run = await client.pollRun(runId);
            if (run.done) {
              done = true;
              const verdict = String(run.verdict).toUpperCase();
              console.log(`  [${verdict}] ${run.summary || ""}`);
              console.log();
            }
          }
        }
      }

      // Summary
      console.log("All runs complete.");
      console.log(`View results: ${loadConfig().serverUrl}/reviews/${id}`);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

// ── Hook ────────────────────────────────────────────────────────────────────
const hookCmd = program
  .command("hook")
  .description("Handle Claude Code hook events");

hookCmd
  .command("notify")
  .description("Log a hook event (reads PostToolUse JSON from stdin)")
  .action(async () => {
    try {
      const input = await readStdin();
      const parsed = JSON.parse(input);
      const filePath = parsed?.tool_input?.file_path;

      const client = new RangerClient();
      await client.hookNotify({
        hookType: "PostToolUse",
        filePath: filePath || undefined,
        sessionId: parsed?.session_id || undefined,
      });
    } catch {
      // Never fail — this is an async hook
    }
  });

hookCmd
  .command("suggest")
  .description("Check for active review on current branch (reads Stop JSON from stdin)")
  .action(async () => {
    try {
      // Read stdin (Stop hook input) but we only need the branch
      await readStdin();

      const { execSync } = await import("node:child_process");
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();

      if (!branch || branch === "HEAD") {
        process.exit(0);
      }

      const client = new RangerClient();
      const result = await client.hookSuggest({ branch });

      if (result.shouldVerify && result.review) {
        const output = {
          systemMessage: result.message,
        };
        process.stdout.write(JSON.stringify(output));
      }
    } catch {
      // Never fail — graceful exit
    }
  });

// ── Clean ───────────────────────────────────────────────────────────────────
program
  .command("clean")
  .description("Remove old artifacts and purge deleted reviews")
  .option("--days <n>", "Delete artifacts older than N days", "30")
  .action(() => {
    console.log("TODO: ranger clean");
  });

// ── Login ───────────────────────────────────────────────────────────────────
program
  .command("login")
  .description("Authenticate a profile via browser")
  .option("--profile <name>", "Profile to authenticate")
  .action(() => {
    console.log("TODO: ranger login");
  });

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => { data += chunk; });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
    // If stdin is a TTY (no pipe), resolve immediately with empty string
    if (process.stdin.isTTY) resolve("");
  });
}

program.parse();
