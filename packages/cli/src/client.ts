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
}
