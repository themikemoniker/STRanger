import { join, dirname } from "node:path";
import { mkdirSync, existsSync, unlinkSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";
import { nanoid } from "nanoid";
import { createDb } from "./client.js";
import {
  profiles,
  featureReviews,
  scenarios,
  verificationRuns,
  artifacts,
} from "./schema.js";

function id(prefix: string) {
  return `${prefix}_${nanoid(16)}`;
}

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const DATA_DIR = join(homedir(), ".stranger", "data");
const DB_PATH = join(DATA_DIR, "stranger.db");

mkdirSync(DATA_DIR, { recursive: true });

// Remove existing DB so seed is idempotent
if (existsSync(DB_PATH)) {
  unlinkSync(DB_PATH);
}

const db = createDb(DB_PATH);

// Run the migration SQL
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "drizzle", "0000_low_tana_nile.sql");
const migrationSql = readFileSync(migrationPath, "utf-8");

// Split on Drizzle's statement-breakpoint markers
const statements = migrationSql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

const rawDb = (db as unknown as { $client: { exec: (sql: string) => void } }).$client;
for (const stmt of statements) {
  rawDb.exec(stmt);
}

console.log("Seeding database...");

// ── Profiles ────────────────────────────────────────────────────────────────
const profileLocal = id("prof");
const profileStaging = id("prof");

db.insert(profiles)
  .values([
    {
      id: profileLocal,
      name: "local-dev",
      baseUrl: "http://localhost:3000",
      browser: "chromium",
      viewport: "1280x720",
      isDefault: 1,
      createdAt: ago(60),
      updatedAt: ago(60),
    },
    {
      id: profileStaging,
      name: "staging",
      baseUrl: "https://staging.example.com",
      browser: "chromium",
      viewport: "1920x1080",
      isDefault: 0,
      createdAt: ago(30),
      updatedAt: ago(30),
    },
  ])
  .run();

console.log("  Created 2 profiles");

// ── Feature Reviews ─────────────────────────────────────────────────────────
const review1 = id("rev");
const review2 = id("rev");
const review3 = id("rev");

db.insert(featureReviews)
  .values([
    {
      id: review1,
      title: "Login page redesign",
      description: "New login page with social OAuth buttons and improved form validation",
      status: "passed",
      branch: "feature/login-redesign",
      profileId: profileLocal,
      createdAt: ago(120),
      updatedAt: ago(10),
    },
    {
      id: review2,
      title: "Dashboard charts",
      description: "Add interactive charts to the analytics dashboard",
      status: "in_progress",
      branch: "feature/dashboard-charts",
      profileId: profileLocal,
      createdAt: ago(60),
      updatedAt: ago(5),
    },
    {
      id: review3,
      title: "Settings page",
      description: "User settings page with profile editing and notification preferences",
      status: "draft",
      branch: "feature/settings",
      profileId: profileStaging,
      createdAt: ago(15),
      updatedAt: ago(15),
    },
  ])
  .run();

console.log("  Created 3 reviews");

// ── Scenarios ───────────────────────────────────────────────────────────────
const sc1 = id("sc");
const sc2 = id("sc");
const sc3 = id("sc");
const sc4 = id("sc");
const sc5 = id("sc");

db.insert(scenarios)
  .values([
    {
      id: sc1,
      reviewId: review1,
      ordinal: 1,
      title: "Login form renders correctly",
      description: "Navigate to /login, verify the form has email and password fields, submit button, and OAuth buttons",
      startPath: "/login",
      status: "passed",
      createdAt: ago(120),
      updatedAt: ago(10),
    },
    {
      id: sc2,
      reviewId: review1,
      ordinal: 2,
      title: "Form validation works",
      description: "Submit empty form and verify validation messages appear for required fields",
      startPath: "/login",
      status: "passed",
      createdAt: ago(120),
      updatedAt: ago(10),
    },
    {
      id: sc3,
      reviewId: review2,
      ordinal: 1,
      title: "Charts render with data",
      description: "Navigate to /dashboard, verify at least 2 charts are visible with data points",
      startPath: "/dashboard",
      status: "running",
      createdAt: ago(60),
      updatedAt: ago(3),
    },
    {
      id: sc4,
      reviewId: review2,
      ordinal: 2,
      title: "Chart tooltips on hover",
      description: "Hover over a chart data point and verify a tooltip with details appears",
      startPath: "/dashboard",
      status: "pending",
      createdAt: ago(60),
      updatedAt: ago(60),
    },
    {
      id: sc5,
      reviewId: review3,
      ordinal: 1,
      title: "Settings form loads",
      description: "Navigate to /settings, verify the form loads with current user data",
      startPath: "/settings",
      status: "pending",
      createdAt: ago(15),
      updatedAt: ago(15),
    },
  ])
  .run();

console.log("  Created 5 scenarios");

// ── Verification Runs ───────────────────────────────────────────────────────
const run1 = id("run");
const run2 = id("run");
const run3 = id("run");

db.insert(verificationRuns)
  .values([
    {
      id: run1,
      scenarioId: sc1,
      profileId: profileLocal,
      verdict: "passed",
      summary: "Login form renders correctly with all expected elements",
      durationMs: 4500,
      startedAt: ago(15),
      finishedAt: ago(14),
    },
    {
      id: run2,
      scenarioId: sc2,
      profileId: profileLocal,
      verdict: "passed",
      summary: "Validation messages appear correctly for empty submission",
      durationMs: 3200,
      startedAt: ago(12),
      finishedAt: ago(11),
    },
    {
      id: run3,
      scenarioId: sc3,
      profileId: profileLocal,
      verdict: "running",
      summary: null,
      durationMs: null,
      startedAt: ago(3),
      finishedAt: null,
    },
  ])
  .run();

console.log("  Created 3 runs");

// ── Artifacts ───────────────────────────────────────────────────────────────
// Create a sample artifacts directory
const artifactsDir = join(DATA_DIR, "artifacts", run1);
mkdirSync(artifactsDir, { recursive: true });

const artifactsDir2 = join(DATA_DIR, "artifacts", run2);
mkdirSync(artifactsDir2, { recursive: true });

db.insert(artifacts)
  .values([
    {
      id: id("art"),
      runId: run1,
      kind: "screenshot",
      filename: "step-001-navigate.png",
      stepIndex: 0,
      caption: "Navigated to /login",
      mimeType: "image/png",
      sizeBytes: 45000,
      createdAt: ago(15),
    },
    {
      id: id("art"),
      runId: run1,
      kind: "screenshot",
      filename: "step-002-form-visible.png",
      stepIndex: 1,
      caption: "Login form with email, password fields and OAuth buttons visible",
      mimeType: "image/png",
      sizeBytes: 52000,
      createdAt: ago(15),
    },
    {
      id: id("art"),
      runId: run1,
      kind: "screenshot",
      filename: "step-003-scroll-down.png",
      stepIndex: 2,
      caption: "Scrolled down to see full page",
      mimeType: "image/png",
      sizeBytes: 48000,
      createdAt: ago(14),
    },
    {
      id: id("art"),
      runId: run2,
      kind: "screenshot",
      filename: "step-001-empty-submit.png",
      stepIndex: 0,
      caption: "Submitted empty form",
      mimeType: "image/png",
      sizeBytes: 41000,
      createdAt: ago(12),
    },
    {
      id: id("art"),
      runId: run2,
      kind: "screenshot",
      filename: "step-002-validation-msgs.png",
      stepIndex: 1,
      caption: "Validation messages visible for required fields",
      mimeType: "image/png",
      sizeBytes: 55000,
      createdAt: ago(11),
    },
  ])
  .run();

console.log("  Created 5 artifacts");
console.log(`\nDatabase seeded at: ${DB_PATH}`);
