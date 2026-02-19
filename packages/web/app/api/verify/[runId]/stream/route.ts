import { subscribeToRun, isRunActive, type SseEvent } from "@/lib/agent-manager";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(event: SseEvent) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Stream closed
        }
      }

      // If the run is not active, send an immediate close
      if (!isRunActive(runId)) {
        send({ type: "error", error: "Run is not active or already completed" });
        controller.close();
        return;
      }

      // Subscribe to events
      const unsubscribe = subscribeToRun(runId, (event) => {
        send(event);

        // Close stream after verdict or error (non-recoverable)
        if (event.type === "verdict") {
          clearInterval(keepalive);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      });

      // Keepalive every 15 seconds
      const keepalive = setInterval(() => {
        send({ type: "keepalive" });
      }, 15_000);

      // Cleanup when client disconnects
      _request.signal.addEventListener("abort", () => {
        clearInterval(keepalive);
        unsubscribe();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
