import { loadConfig } from "./config.js";

export class RangerClient {
  private baseUrl: string;

  constructor(serverUrl?: string) {
    this.baseUrl = serverUrl || loadConfig().serverUrl;
  }

  private async request<T>(path: string, opts?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        ...opts?.headers,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    return res.json() as Promise<T>;
  }

  // Status
  async status() {
    return this.request<{ ok: boolean; version: string }>("/api/status");
  }

  // Profiles
  async listProfiles() {
    return this.request<unknown[]>("/api/profiles");
  }

  async createProfile(data: { name: string; baseUrl: string; browser?: string; viewport?: string; isDefault?: boolean }) {
    return this.request<unknown>("/api/profiles", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Reviews
  async listReviews(status?: string) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request<unknown[]>(`/api/reviews${qs}`);
  }

  async getReview(id: string) {
    return this.request<Record<string, unknown>>(`/api/reviews/${id}`);
  }

  async createReview(data: {
    title: string;
    description?: string;
    branch?: string;
    profileId?: string;
    scenarios?: { title: string; description: string; startPath?: string }[];
  }) {
    return this.request<Record<string, unknown>>("/api/reviews", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Verify
  async triggerVerify(data: {
    reviewId: string;
    profileId?: string;
    scenarioIds?: string[];
    notes?: string;
    apiKey?: string;
    llmProvider?: string;
    llmModel?: string;
  }) {
    return this.request<{ reviewId: string; runIds: string[]; scenarioCount: number }>(
      "/api/verify",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async pollRun(runId: string) {
    return this.request<Record<string, unknown>>(`/api/verify/${runId}`);
  }

  // Hooks
  async hookNotify(data: { hookType: string; filePath?: string; sessionId?: string }) {
    return this.request<{ ok: boolean }>("/api/hooks/notify", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async hookSuggest(data: { branch: string }) {
    return this.request<{
      review?: { id: string; title: string; status: string };
      shouldVerify: boolean;
      message: string;
    }>("/api/hooks/suggest", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async streamRun(
    runId: string,
    onEvent: (event: { type: string; [key: string]: unknown }) => void,
  ): Promise<void> {
    const url = `${this.baseUrl}/api/verify/${runId}/stream`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`SSE connection failed: HTTP ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Parse SSE events from buffer
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const event = JSON.parse(line.slice(6));
            onEvent(event);
            if (event.type === "verdict") return;
          } catch {
            // ignore parse errors
          }
        }
      }
    }
  }
}
