import { fork, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync, existsSync } from "node:fs";
import { eq } from "drizzle-orm";
import {
  verificationRuns,
  artifacts,
  scenarios,
} from "@stranger/db";
import type {
  RunConfig,
  IpcStartMessage,
  IpcWorkerMessage,
} from "@stranger/db/types";
import { getDb } from "./db";
import { newId } from "./ids";
import { broadcastToRun } from "./event-bus";
export { subscribeToRun, broadcastToRun, type SseEvent } from "./event-bus";

const DATA_DIR = join(homedir(), ".stranger", "data");

interface ActiveRun {
  runId: string;
  child: ChildProcess;
}

const activeRuns = new Map<string, ActiveRun>();

// ── Worker management ────────────────────────────────────────────────────────

function getWorkerPath(): string {
  // Resolve relative to monorepo root (packages/web is 2 levels deep)
  const monorepoRoot = join(process.cwd(), "..", "..");
  const distPath = join(monorepoRoot, "packages", "agent", "dist", "worker.js");
  if (existsSync(distPath)) return distPath;
  return join(monorepoRoot, "packages", "agent", "src", "worker.ts");
}

export function startVerification(opts: {
  scenarioId: string;
  profileId: string;
  baseUrl: string;
  browser: string;
  viewport?: string;
  scenarioTitle: string;
  scenarioDescription: string;
  startPath?: string | null;
  notes?: string;
  apiKey?: string;
  llmProvider?: string;
  llmModel?: string;
}): string {
  const db = getDb();
  const runId = newId("run");
  const now = new Date().toISOString();

  // Create the run record
  db.insert(verificationRuns)
    .values({
      id: runId,
      scenarioId: opts.scenarioId,
      profileId: opts.profileId,
      verdict: "running",
      notes: opts.notes || null,
      startedAt: now,
    })
    .run();

  // Update scenario status
  db.update(scenarios)
    .set({ status: "running", updatedAt: now })
    .where(eq(scenarios.id, opts.scenarioId))
    .run();

  // Prepare artifacts directory
  const artifactsDir = join(DATA_DIR, "artifacts", runId);
  mkdirSync(artifactsDir, { recursive: true });

  // Parse viewport
  let viewport: { width: number; height: number } | undefined;
  if (opts.viewport) {
    const [w, h] = opts.viewport.split("x").map(Number);
    if (w && h) viewport = { width: w, height: h };
  }

  const config: RunConfig = {
    runId,
    browser: opts.browser,
    baseUrl: opts.baseUrl,
    viewport,
    artifactsDir,
    apiKey: opts.apiKey,
    llmProvider: opts.llmProvider || (opts.apiKey ? "anthropic" : undefined),
    llmModel: opts.llmModel,
    scenario: {
      id: opts.scenarioId,
      title: opts.scenarioTitle,
      description: opts.scenarioDescription,
      startPath: opts.startPath || undefined,
    },
  };

  // Fork the worker
  const workerPath = getWorkerPath();
  const child = fork(workerPath, [], {
    stdio: ["pipe", "pipe", "pipe", "ipc"],
    execArgv: workerPath.endsWith(".ts") ? ["--import", "tsx"] : [],
  });

  activeRuns.set(runId, { runId, child });

  // Handle IPC messages from worker
  child.on("message", (msg: IpcWorkerMessage) => {
    const db = getDb();

    if (msg.type === "step") {
      // Save artifact
      if (msg.screenshot) {
        const artId = newId("art");
        db.insert(artifacts)
          .values({
            id: artId,
            runId,
            kind: "screenshot",
            filename: msg.screenshot.filename,
            stepIndex: msg.stepIndex,
            caption: msg.screenshot.caption,
            mimeType: "image/png",
            sizeBytes: msg.screenshot.sizeBytes,
            createdAt: new Date().toISOString(),
          })
          .run();

        // Broadcast to SSE subscribers
        broadcastToRun(runId, {
          type: "step",
          stepIndex: msg.stepIndex,
          action: msg.action,
          detail: msg.detail,
          screenshotUrl: `/api/artifacts/${artId}/file`,
        });
      } else {
        broadcastToRun(runId, {
          type: "step",
          stepIndex: msg.stepIndex,
          action: msg.action,
          detail: msg.detail,
        });
      }
    } else if (msg.type === "think") {
      broadcastToRun(runId, {
        type: "think",
        stepIndex: msg.stepIndex,
        observation: msg.observation,
        reasoning: msg.reasoning,
        action: msg.action,
      });
    } else if (msg.type === "verdict") {
      const finishedAt = new Date().toISOString();

      // Update run
      db.update(verificationRuns)
        .set({
          verdict: msg.verdict,
          summary: msg.summary,
          reasoning: msg.reasoning || null,
          durationMs: msg.durationMs,
          finishedAt,
        })
        .where(eq(verificationRuns.id, runId))
        .run();

      // Update scenario status
      db.update(scenarios)
        .set({
          status: msg.verdict === "passed" ? "passed" : msg.verdict === "error" ? "error" : "failed",
          updatedAt: finishedAt,
        })
        .where(eq(scenarios.id, opts.scenarioId))
        .run();

      // Broadcast to SSE subscribers
      broadcastToRun(runId, {
        type: "verdict",
        verdict: msg.verdict,
        summary: msg.summary,
        reasoning: msg.reasoning,
        durationMs: msg.durationMs,
      });

      activeRuns.delete(runId);
    } else if (msg.type === "error") {
      db.update(verificationRuns)
        .set({ errorMsg: msg.error })
        .where(eq(verificationRuns.id, runId))
        .run();

      broadcastToRun(runId, { type: "error", error: msg.error });
    }
  });

  // Handle worker crash
  child.on("exit", (code) => {
    if (activeRuns.has(runId)) {
      // Worker exited without sending verdict
      const db = getDb();
      const finishedAt = new Date().toISOString();
      db.update(verificationRuns)
        .set({
          verdict: "error",
          summary: `Worker exited unexpectedly with code ${code}`,
          finishedAt,
        })
        .where(eq(verificationRuns.id, runId))
        .run();

      db.update(scenarios)
        .set({ status: "error", updatedAt: finishedAt })
        .where(eq(scenarios.id, opts.scenarioId))
        .run();

      broadcastToRun(runId, {
        type: "error",
        error: `Worker exited unexpectedly with code ${code}`,
      });

      activeRuns.delete(runId);
    }
  });

  // Send start message to worker
  const startMsg: IpcStartMessage = { type: "start", config };
  child.send(startMsg);

  return runId;
}

export function isRunActive(runId: string): boolean {
  return activeRuns.has(runId);
}
