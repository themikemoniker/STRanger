"use client";

import { useEffect, useState, useRef } from "react";

interface ThinkEvent {
  type: "think";
  stepIndex: number;
  observation: string;
  reasoning: string;
  action: string;
}

interface StepEvent {
  type: "step";
  stepIndex: number;
  action: string;
  detail?: string;
  screenshotUrl?: string;
}

interface VerdictEvent {
  type: "verdict";
  verdict: string;
  summary: string;
  reasoning?: string;
  durationMs: number;
}

interface ErrorEvent {
  type: "error";
  error: string;
}

type StreamEvent = ThinkEvent | StepEvent | VerdictEvent | ErrorEvent;

export function LiveRunView({ runId }: { runId: string }) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [done, setDone] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/verify/${runId}/stream`);

    es.onopen = () => setConnected(true);

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as StreamEvent | { type: "keepalive" };
        if (event.type === "keepalive") return;

        setEvents((prev) => [...prev, event as StreamEvent]);

        if (event.type === "verdict" || event.type === "error") {
          setDone(true);
          es.close();
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setConnected(false);
      es.close();
      setDone(true);
    };

    return () => {
      es.close();
    };
  }, [runId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const verdict = events.find((e): e is VerdictEvent => e.type === "verdict");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        {!done && (
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-500" />
            </span>
            {connected ? "Live" : "Connecting..."}
          </span>
        )}
        {done && !verdict && (
          <span className="text-gray-500">Stream ended</span>
        )}
      </div>

      {verdict && (
        <div
          className={`rounded-lg border p-4 ${
            verdict.verdict === "passed"
              ? "border-green-200 bg-green-50"
              : verdict.verdict === "failed"
                ? "border-red-200 bg-red-50"
                : "border-yellow-200 bg-yellow-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {verdict.verdict === "passed" ? "PASSED" : verdict.verdict === "failed" ? "FAILED" : "ERROR"}
            </span>
            <span className="text-sm text-gray-500">
              {(verdict.durationMs / 1000).toFixed(1)}s
            </span>
          </div>
          <p className="mt-1 text-sm">{verdict.summary}</p>
          {verdict.reasoning && (
            <p className="mt-2 text-xs text-gray-600">{verdict.reasoning}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        {events
          .filter((e) => e.type !== "verdict")
          .map((event, i) => (
            <div key={i} className="rounded border border-gray-200 bg-white p-3">
              {event.type === "think" && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                      Think
                    </span>
                    <span className="text-xs text-gray-400">
                      Step {event.stepIndex}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">Observation:</span>{" "}
                    {event.observation}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Reasoning:</span>{" "}
                    {event.reasoning}
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Next action:</span>{" "}
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                      {event.action}
                    </code>
                  </p>
                </div>
              )}

              {event.type === "step" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                      Action
                    </span>
                    <span className="text-xs text-gray-400">
                      Step {event.stepIndex}
                    </span>
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
                      {event.action}
                    </code>
                  </div>
                  {event.detail && (
                    <p className="text-sm text-gray-600">{event.detail}</p>
                  )}
                  {event.screenshotUrl && (
                    <div className="mt-2 overflow-hidden rounded border border-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={event.screenshotUrl}
                        alt={`Step ${event.stepIndex}`}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              )}

              {event.type === "error" && (
                <div className="space-y-1">
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
                    Error
                  </span>
                  <p className="text-sm text-red-600">{event.error}</p>
                </div>
              )}
            </div>
          ))}
      </div>

      <div ref={bottomRef} />
    </div>
  );
}
