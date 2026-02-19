import type { InferSelectModel } from "drizzle-orm";
import type {
  profiles,
  featureReviews,
  scenarios,
  verificationRuns,
  artifacts,
  comments,
  hookEvents,
} from "./schema.js";

// ── Row types (inferred from schema) ────────────────────────────────────────
export type Profile = InferSelectModel<typeof profiles>;
export type FeatureReview = InferSelectModel<typeof featureReviews>;
export type Scenario = InferSelectModel<typeof scenarios>;
export type VerificationRun = InferSelectModel<typeof verificationRuns>;
export type Artifact = InferSelectModel<typeof artifacts>;
export type Comment = InferSelectModel<typeof comments>;
export type HookEvent = InferSelectModel<typeof hookEvents>;

// ── Status enums ────────────────────────────────────────────────────────────
export type ReviewStatus = "draft" | "in_progress" | "passed" | "failed" | "mixed";
export type ScenarioStatus = "pending" | "running" | "passed" | "failed" | "error" | "skipped";
export type Verdict = "pending" | "running" | "passed" | "failed" | "error";
export type ArtifactKind = "screenshot" | "video" | "trace" | "log";

// ── IPC messages (parent ↔ worker) ──────────────────────────────────────────
export interface RunConfig {
  runId: string;
  browser: string;
  baseUrl: string;
  viewport?: { width: number; height: number };
  authState?: string;
  artifactsDir: string;
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
  scenario: {
    id: string;
    title: string;
    description: string;
    startPath?: string;
  };
  envVars?: Record<string, string>;
}

export interface IpcStartMessage {
  type: "start";
  config: RunConfig;
}

export interface IpcStepMessage {
  type: "step";
  stepIndex: number;
  action: string;
  screenshot?: {
    filename: string;
    caption: string;
    sizeBytes: number;
  };
}

export interface IpcVerdictMessage {
  type: "verdict";
  verdict: Verdict;
  summary: string;
  reasoning?: string;
  durationMs: number;
}

export interface IpcErrorMessage {
  type: "error";
  error: string;
}

export type IpcWorkerMessage = IpcStepMessage | IpcVerdictMessage | IpcErrorMessage;

// ── API input types ─────────────────────────────────────────────────────────
export interface CreateProfileInput {
  name: string;
  baseUrl: string;
  browser?: string;
  viewport?: string;
  isDefault?: boolean;
}

export interface UpdateProfileInput {
  name?: string;
  baseUrl?: string;
  browser?: string;
  viewport?: string;
  isDefault?: boolean;
}

export interface CreateReviewInput {
  title: string;
  description?: string;
  branch?: string;
  profileId?: string;
  scenarios?: CreateScenarioInput[];
}

export interface UpdateReviewInput {
  title?: string;
  description?: string;
  status?: ReviewStatus;
  branch?: string;
  profileId?: string;
}

export interface CreateScenarioInput {
  title: string;
  description: string;
  startPath?: string;
}

export interface UpdateScenarioInput {
  title?: string;
  description?: string;
  startPath?: string;
  ordinal?: number;
}

export interface TriggerVerifyInput {
  reviewId: string;
  profileId?: string;
  scenarioIds?: string[];
  notes?: string;
}
