import { describe, it, expect, afterEach } from "vitest";
import { createServer, type Server } from "node:http";
import { RangerClient } from "../client.js";

function startJsonServer(
  handler: (body: unknown) => { status: number; json: unknown },
): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let data = "";
      req.on("data", (chunk) => { data += chunk; });
      req.on("end", () => {
        const body = data ? JSON.parse(data) : {};
        const result = handler(body);
        res.writeHead(result.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result.json));
      });
    });

    server.listen(0, () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 0;
      resolve({ server, port });
    });
  });
}

describe("RangerClient hook methods", () => {
  let server: Server;

  afterEach(() => {
    if (server) server.close();
  });

  describe("hookNotify", () => {
    it("sends hookType and filePath to server", async () => {
      let receivedBody: unknown;
      const testServer = await startJsonServer((body) => {
        receivedBody = body;
        return { status: 200, json: { ok: true } };
      });
      server = testServer.server;

      const client = new RangerClient(`http://localhost:${testServer.port}`);
      const result = await client.hookNotify({
        hookType: "PostToolUse",
        filePath: "/src/test.ts",
        sessionId: "sess_123",
      });

      expect(result).toEqual({ ok: true });
      expect(receivedBody).toEqual({
        hookType: "PostToolUse",
        filePath: "/src/test.ts",
        sessionId: "sess_123",
      });
    });

    it("works without optional fields", async () => {
      const testServer = await startJsonServer(() => {
        return { status: 200, json: { ok: true } };
      });
      server = testServer.server;

      const client = new RangerClient(`http://localhost:${testServer.port}`);
      const result = await client.hookNotify({ hookType: "PostToolUse" });
      expect(result.ok).toBe(true);
    });
  });

  describe("hookSuggest", () => {
    it("returns review when one exists for branch", async () => {
      const testServer = await startJsonServer(() => {
        return {
          status: 200,
          json: {
            review: { id: "rev_abc", title: "Test Review", status: "active" },
            shouldVerify: true,
            message: 'Review "Test Review" (rev_abc) is active.',
          },
        };
      });
      server = testServer.server;

      const client = new RangerClient(`http://localhost:${testServer.port}`);
      const result = await client.hookSuggest({ branch: "feat/login" });

      expect(result.shouldVerify).toBe(true);
      expect(result.review).toBeDefined();
      expect(result.review!.id).toBe("rev_abc");
      expect(result.message).toContain("Test Review");
    });

    it("returns shouldVerify false when no review exists", async () => {
      const testServer = await startJsonServer(() => {
        return {
          status: 200,
          json: {
            shouldVerify: false,
            message: 'No active review found for branch "main".',
          },
        };
      });
      server = testServer.server;

      const client = new RangerClient(`http://localhost:${testServer.port}`);
      const result = await client.hookSuggest({ branch: "main" });

      expect(result.shouldVerify).toBe(false);
      expect(result.review).toBeUndefined();
    });
  });
});
