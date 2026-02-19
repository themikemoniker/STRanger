import { describe, it, expect, afterEach } from "vitest";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { createDb } from "../client.js";
import { profiles, featureReviews, scenarios } from "../schema.js";
import { eq } from "drizzle-orm";

const TEST_DB = join(import.meta.dirname, "test.db");

function freshDb() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  const db = createDb(TEST_DB);
  // Run migrations inline — create tables directly for test isolation
  db.run(`CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    base_url TEXT NOT NULL,
    browser TEXT DEFAULT 'chromium',
    viewport TEXT,
    auth_state TEXT,
    env_vars TEXT,
    llm_provider TEXT,
    llm_model TEXT,
    is_default INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS feature_reviews (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    branch TEXT,
    profile_id TEXT REFERENCES profiles(id),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL REFERENCES feature_reviews(id) ON DELETE CASCADE,
    ordinal INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    start_path TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  return db;
}

afterEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

describe("createDb", () => {
  it("creates a database with WAL journal mode", () => {
    const db = freshDb();
    const result = db.get<{ journal_mode: string }>(
      `PRAGMA journal_mode`,
    );
    expect(result?.journal_mode).toBe("wal");
  });

  it("returns a drizzle instance that can insert and query profiles", () => {
    const db = freshDb();
    const now = new Date().toISOString();

    db.insert(profiles).values({
      id: "prof_1",
      name: "test-profile",
      baseUrl: "http://localhost:3000",
      createdAt: now,
      updatedAt: now,
    }).run();

    const row = db.select().from(profiles).where(eq(profiles.id, "prof_1")).get();
    expect(row).toBeDefined();
    expect(row!.name).toBe("test-profile");
    expect(row!.baseUrl).toBe("http://localhost:3000");
    expect(row!.browser).toBe("chromium");
  });

  it("enforces unique constraint on profile name", () => {
    const db = freshDb();
    const now = new Date().toISOString();
    const values = {
      name: "duplicate",
      baseUrl: "http://localhost:3000",
      createdAt: now,
      updatedAt: now,
    };

    db.insert(profiles).values({ id: "prof_1", ...values }).run();
    expect(() =>
      db.insert(profiles).values({ id: "prof_2", ...values }).run(),
    ).toThrow();
  });
});

describe("schema relationships", () => {
  it("cascades scenario deletes when review is deleted", () => {
    const db = freshDb();
    const now = new Date().toISOString();

    db.insert(profiles).values({
      id: "prof_1",
      name: "default",
      baseUrl: "http://localhost:3000",
      createdAt: now,
      updatedAt: now,
    }).run();

    db.insert(featureReviews).values({
      id: "rev_1",
      title: "Test Review",
      status: "draft",
      profileId: "prof_1",
      createdAt: now,
      updatedAt: now,
    }).run();

    db.insert(scenarios).values({
      id: "sc_1",
      reviewId: "rev_1",
      ordinal: 1,
      title: "Scenario 1",
      description: "Test scenario",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    }).run();

    // Delete the review
    db.delete(featureReviews).where(eq(featureReviews.id, "rev_1")).run();

    // Scenario should be cascade-deleted
    const remaining = db.select().from(scenarios).where(eq(scenarios.reviewId, "rev_1")).all();
    expect(remaining).toHaveLength(0);
  });

  it("enforces foreign key from scenario to review", () => {
    const db = freshDb();
    // Enable foreign keys (SQLite has them off by default)
    db.run(`PRAGMA foreign_keys = ON`);
    const now = new Date().toISOString();

    expect(() =>
      db.insert(scenarios).values({
        id: "sc_1",
        reviewId: "nonexistent",
        ordinal: 1,
        title: "Orphan",
        description: "No parent review",
        status: "pending",
        createdAt: now,
        updatedAt: now,
      }).run(),
    ).toThrow();
  });
});
