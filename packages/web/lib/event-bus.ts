/**
 * In-memory SSE event bus for streaming verification run events.
 * Extracted from agent-manager for testability.
 */

export type SseEvent =
  | { type: "think"; stepIndex: number; observation: string; reasoning: string; action: string }
  | { type: "step"; stepIndex: number; action: string; detail?: string; screenshotUrl?: string }
  | { type: "verdict"; verdict: string; summary: string; reasoning?: string; durationMs: number }
  | { type: "error"; error: string }
  | { type: "keepalive" };

const runSubscribers = new Map<string, Set<(event: SseEvent) => void>>();

export function subscribeToRun(runId: string, callback: (event: SseEvent) => void): () => void {
  if (!runSubscribers.has(runId)) {
    runSubscribers.set(runId, new Set());
  }
  const subs = runSubscribers.get(runId)!;
  subs.add(callback);

  return () => {
    subs.delete(callback);
    if (subs.size === 0) {
      runSubscribers.delete(runId);
    }
  };
}

export function broadcastToRun(runId: string, event: SseEvent): void {
  const subs = runSubscribers.get(runId);
  if (subs) {
    for (const cb of subs) {
      cb(event);
    }
  }
}
