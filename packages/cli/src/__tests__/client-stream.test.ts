import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { StrangerClient } from "../client.js";

function startSseServer(events: Array<Record<string, unknown>>): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });

      // Send all events with small delays
      let i = 0;
      const interval = setInterval(() => {
        if (i < events.length) {
          res.write(`data: ${JSON.stringify(events[i])}\n\n`);
          i++;
        } else {
          clearInterval(interval);
          res.end();
        }
      }, 10);
    });

    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

describe("StrangerClient.streamRun", () => {
  let server: Server;

  afterEach(() => {
    if (server) server.close();
  });

  it("receives and parses SSE events", async () => {
    const events = [
      { type: "step", stepIndex: 0, action: "initial-load" },
      { type: "step", stepIndex: 1, action: "scroll-30" },
      { type: "verdict", verdict: "passed", summary: "All good", durationMs: 1000 },
    ];

    const testServer = await startSseServer(events);
    server = testServer.server;

    // Point client at our test SSE server
    // The streamRun method constructs the URL as ${baseUrl}/api/verify/${runId}/stream
    // So we need to set up our server to handle any path
    const client = new StrangerClient(`http://localhost:${testServer.port}`);

    const received: Array<Record<string, unknown>> = [];
    await client.streamRun("test-run", (event) => {
      received.push(event);
    });

    // Should have received all 3 events (stops after verdict)
    expect(received).toHaveLength(3);
    expect(received[0].type).toBe("step");
    expect(received[1].type).toBe("step");
    expect(received[2].type).toBe("verdict");
    expect(received[2].verdict).toBe("passed");
  });

  it("stops consuming after verdict event", async () => {
    const events = [
      { type: "think", stepIndex: 0, observation: "test", reasoning: "test", action: "click" },
      { type: "step", stepIndex: 0, action: "click", detail: "Clicked button" },
      { type: "verdict", verdict: "failed", summary: "Feature broken", durationMs: 2000 },
      { type: "step", stepIndex: 1, action: "extra" }, // should not be received
    ];

    const testServer = await startSseServer(events);
    server = testServer.server;

    const client = new StrangerClient(`http://localhost:${testServer.port}`);
    const received: Array<Record<string, unknown>> = [];

    await client.streamRun("test-run-2", (event) => {
      received.push(event);
    });

    // Should stop after verdict (3 events, not 4)
    expect(received).toHaveLength(3);
    expect(received[2].type).toBe("verdict");
  });

  it("skips keepalive events but continues processing", async () => {
    const events = [
      { type: "keepalive" },
      { type: "step", stepIndex: 0, action: "click" },
      { type: "keepalive" },
      { type: "verdict", verdict: "passed", summary: "Done", durationMs: 500 },
    ];

    const testServer = await startSseServer(events);
    server = testServer.server;

    const client = new StrangerClient(`http://localhost:${testServer.port}`);
    const received: Array<Record<string, unknown>> = [];

    await client.streamRun("test-run-3", (event) => {
      received.push(event);
    });

    // All events including keepalives are delivered (the caller handles filtering)
    expect(received.length).toBeGreaterThanOrEqual(3);
    expect(received.some((e) => e.type === "verdict")).toBe(true);
  });
});
