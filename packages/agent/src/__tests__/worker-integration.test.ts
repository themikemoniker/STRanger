import { describe, it, expect, afterAll } from "vitest";
import { fork } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import type {
  IpcStartMessage,
  IpcWorkerMessage,
  RunConfig,
} from "@ranger/db/types";

// Use the compiled JS worker — run `pnpm --filter @ranger/agent build` before tests
const AGENT_ROOT = join(import.meta.dirname, "..", "..");
const WORKER_PATH = join(AGENT_ROOT, "dist", "worker.js");

// Each test run gets a unique temp dir to avoid collisions
function uniqueArtifactsDir(): string {
  const dir = join(tmpdir(), `ranger-test-${randomBytes(6).toString("hex")}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// Simple HTTP server that serves a basic HTML page
function startTestServer(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Hello Ranger</h1>
            <p>This is a test page for screenshot verification.</p>
            <div style="height: 2000px; background: linear-gradient(to bottom, white, blue);">
              Tall content for scroll testing
            </div>
          </body>
        </html>
      `);
    });

    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

function runWorker(config: RunConfig): Promise<IpcWorkerMessage[]> {
  return new Promise((resolve, reject) => {
    const messages: IpcWorkerMessage[] = [];

    const child = fork(WORKER_PATH, [], {
      stdio: ["pipe", "pipe", "pipe", "ipc"],
    });

    child.on("message", (msg: IpcWorkerMessage) => {
      messages.push(msg);
    });

    child.on("exit", (code) => {
      if (code === 0 || code === null) {
        resolve(messages);
      } else {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });

    child.on("error", reject);

    const startMsg: IpcStartMessage = { type: "start", config };
    child.send(startMsg);
  });
}

// Track all servers and dirs for cleanup
const servers: Server[] = [];
const dirs: string[] = [];

afterAll(() => {
  for (const s of servers) s.close();
  for (const d of dirs) {
    if (existsSync(d)) rmSync(d, { recursive: true, force: true });
  }
});

describe("worker integration (screenshot-only fallback)", () => {
  it("captures 5 screenshots and returns passed verdict", async () => {
    const { server, port } = await startTestServer();
    servers.push(server);
    const artifactsDir = uniqueArtifactsDir();
    dirs.push(artifactsDir);

    const config: RunConfig = {
      runId: "run_test_1",
      browser: "chromium",
      baseUrl: `http://localhost:${port}`,
      artifactsDir,
      scenario: {
        id: "sc_test_1",
        title: "Test screenshot capture",
        description: "Verify basic page loads correctly",
        startPath: "/",
      },
    };

    const messages = await runWorker(config);

    const steps = messages.filter((m) => m.type === "step");
    const verdicts = messages.filter((m) => m.type === "verdict");
    const errors = messages.filter((m) => m.type === "error");

    expect(errors).toHaveLength(0);
    expect(steps).toHaveLength(5);
    expect(verdicts).toHaveLength(1);

    // Verify step structure
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.type === "step") {
        expect(step.stepIndex).toBe(i);
        expect(step.screenshot).toBeDefined();
        expect(step.screenshot!.filename).toMatch(/^step-\d{3}/);
        expect(step.screenshot!.sizeBytes).toBeGreaterThan(0);
      }
    }

    // Verify verdict
    const verdict = verdicts[0];
    if (verdict.type === "verdict") {
      expect(verdict.verdict).toBe("passed");
      expect(verdict.durationMs).toBeGreaterThan(0);
      expect(verdict.summary).toContain("5 screenshots");
      expect(verdict.reasoning).toContain("Screenshot-only");
    }

    // Verify screenshot files exist on disk
    for (const step of steps) {
      if (step.type === "step" && step.screenshot) {
        const filepath = join(artifactsDir, step.screenshot.filename);
        expect(existsSync(filepath)).toBe(true);
      }
    }
  }, 30_000);

  it("reports error for unreachable server", async () => {
    const artifactsDir = uniqueArtifactsDir();
    dirs.push(artifactsDir);

    const config: RunConfig = {
      runId: "run_test_err",
      browser: "chromium",
      baseUrl: "http://localhost:19999",
      artifactsDir,
      scenario: {
        id: "sc_test_err",
        title: "Test error handling",
        description: "This should fail",
        startPath: "/",
      },
    };

    const messages = await runWorker(config);

    const errors = messages.filter((m) => m.type === "error");
    const verdicts = messages.filter((m) => m.type === "verdict");

    expect(errors.length).toBeGreaterThan(0);
    expect(verdicts).toHaveLength(1);

    if (verdicts[0].type === "verdict") {
      expect(verdicts[0].verdict).toBe("error");
      expect(verdicts[0].summary).toContain("Worker failed");
    }
  }, 30_000);

  it("uses correct viewport when specified", async () => {
    const { server, port } = await startTestServer();
    servers.push(server);
    const artifactsDir = uniqueArtifactsDir();
    dirs.push(artifactsDir);

    const config: RunConfig = {
      runId: "run_test_vp",
      browser: "chromium",
      baseUrl: `http://localhost:${port}`,
      viewport: { width: 800, height: 600 },
      artifactsDir,
      scenario: {
        id: "sc_test_vp",
        title: "Test custom viewport",
        description: "Verify custom viewport",
        startPath: "/",
      },
    };

    const messages = await runWorker(config);

    const steps = messages.filter((m) => m.type === "step");
    const verdicts = messages.filter((m) => m.type === "verdict");

    expect(steps).toHaveLength(5);
    expect(verdicts).toHaveLength(1);
    if (verdicts[0].type === "verdict") {
      expect(verdicts[0].verdict).toBe("passed");
    }

    // All screenshots should exist
    for (const step of steps) {
      if (step.type === "step" && step.screenshot) {
        const filepath = join(artifactsDir, step.screenshot.filename);
        expect(existsSync(filepath)).toBe(true);
      }
    }
  }, 30_000);
});

describe("worker IPC message types", () => {
  it("IpcThinkMessage is included in IpcWorkerMessage union", () => {
    const thinkMsg: IpcWorkerMessage = {
      type: "think",
      stepIndex: 0,
      observation: "test",
      reasoning: "test",
      action: "click",
    };
    expect(thinkMsg.type).toBe("think");
  });

  it("IpcStepMessage supports detail field", () => {
    const stepMsg: IpcWorkerMessage = {
      type: "step",
      stepIndex: 0,
      action: "click",
      detail: "Clicked button 'Submit'",
    };
    expect(stepMsg.type).toBe("step");
    if (stepMsg.type === "step") {
      expect(stepMsg.detail).toBe("Clicked button 'Submit'");
    }
  });
});
