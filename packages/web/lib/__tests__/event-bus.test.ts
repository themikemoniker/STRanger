import { describe, it, expect, vi } from "vitest";
import { subscribeToRun, broadcastToRun, type SseEvent } from "../event-bus";

describe("SSE event bus", () => {
  describe("subscribeToRun", () => {
    it("returns an unsubscribe function", () => {
      const unsubscribe = subscribeToRun("run_test1", () => {});
      expect(unsubscribe).toBeTypeOf("function");
      unsubscribe();
    });

    it("unsubscribe is idempotent", () => {
      const cb = vi.fn();
      const unsub = subscribeToRun("run_test3", cb);
      unsub();
      unsub(); // should not throw
    });
  });

  describe("broadcastToRun", () => {
    it("delivers events to all subscribers", () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const unsub1 = subscribeToRun("run_bc1", cb1);
      const unsub2 = subscribeToRun("run_bc1", cb2);

      const event: SseEvent = { type: "keepalive" };
      broadcastToRun("run_bc1", event);

      expect(cb1).toHaveBeenCalledTimes(1);
      expect(cb1).toHaveBeenCalledWith(event);
      expect(cb2).toHaveBeenCalledTimes(1);
      expect(cb2).toHaveBeenCalledWith(event);

      unsub1();
      unsub2();
    });

    it("does not deliver to unsubscribed callbacks", () => {
      const cb = vi.fn();
      const unsub = subscribeToRun("run_bc2", cb);
      unsub();

      broadcastToRun("run_bc2", { type: "keepalive" });
      expect(cb).not.toHaveBeenCalled();
    });

    it("does nothing for runs with no subscribers", () => {
      // Should not throw
      broadcastToRun("run_nonexistent", { type: "keepalive" });
    });

    it("delivers think events correctly", () => {
      const cb = vi.fn();
      const unsub = subscribeToRun("run_bc3", cb);

      const event: SseEvent = {
        type: "think",
        stepIndex: 0,
        observation: "I see a login form",
        reasoning: "Need to enter credentials",
        action: "type",
      };
      broadcastToRun("run_bc3", event);

      expect(cb).toHaveBeenCalledWith(event);
      const received = cb.mock.calls[0][0] as SseEvent;
      expect(received.type).toBe("think");
      if (received.type === "think") {
        expect(received.observation).toBe("I see a login form");
        expect(received.action).toBe("type");
      }

      unsub();
    });

    it("delivers step events with screenshot URL", () => {
      const cb = vi.fn();
      const unsub = subscribeToRun("run_bc4", cb);

      const event: SseEvent = {
        type: "step",
        stepIndex: 1,
        action: "click",
        detail: "Clicked button 'Submit'",
        screenshotUrl: "/api/artifacts/art_123/file",
      };
      broadcastToRun("run_bc4", event);

      expect(cb).toHaveBeenCalledWith(event);
      unsub();
    });

    it("delivers verdict events", () => {
      const cb = vi.fn();
      const unsub = subscribeToRun("run_bc5", cb);

      const event: SseEvent = {
        type: "verdict",
        verdict: "passed",
        summary: "Feature works correctly",
        reasoning: "All steps verified",
        durationMs: 5000,
      };
      broadcastToRun("run_bc5", event);

      expect(cb).toHaveBeenCalledWith(event);
      unsub();
    });

    it("delivers error events", () => {
      const cb = vi.fn();
      const unsub = subscribeToRun("run_bc6", cb);

      const event: SseEvent = { type: "error", error: "Worker crashed" };
      broadcastToRun("run_bc6", event);

      expect(cb).toHaveBeenCalledWith(event);
      unsub();
    });

    it("isolates events between different runs", () => {
      const cbA = vi.fn();
      const cbB = vi.fn();
      const unsubA = subscribeToRun("run_iso_a", cbA);
      const unsubB = subscribeToRun("run_iso_b", cbB);

      broadcastToRun("run_iso_a", { type: "keepalive" });

      expect(cbA).toHaveBeenCalledTimes(1);
      expect(cbB).not.toHaveBeenCalled();

      unsubA();
      unsubB();
    });
  });
});
