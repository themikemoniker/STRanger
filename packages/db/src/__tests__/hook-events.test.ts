import { describe, it, expect, afterEach } from "vitest";
import { unlinkSync, existsSync } from "fs";
import { join } from "path";
import { createDb } from "../client.js";
import { hookEvents, featureReviews } from "../schema.js";
import { eq, and, isNull, ne } from "drizzle-orm";

const TEST_DB = join(import.meta.dirname, "hook-events-test.db");

function freshDb() {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  const db = createDb(TEST_DB);
  db.run(`CREATE TABLE IF NOT EXISTS hook_events (
    id TEXT PRIMARY KEY,
    hook_type TEXT NOT NULL,
    payload TEXT,
    processed_at TEXT,
    created_at TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS feature_reviews (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL,
    branch TEXT,
    profile_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`);
  return db;
}

afterEach(() => {
  if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
});

describe("hookEvents table", () => {
  it("inserts and queries hook events", () => {
    const db = freshDb();
    const now = new Date().toISOString();

    db.insert(hookEvents)
      .values({
        id: "hk_1",
        hookType: "PostToolUse",
        payload: JSON.stringify({ filePath: "/src/test.ts" }),
        createdAt: now,
      })
      .run();

    const row = db.select().from(hookEvents).where(eq(hookEvents.id, "hk_1")).get();
    expect(row).toBeDefined();
    expect(row!.hookType).toBe("PostToolUse");
    expect(JSON.parse(row!.payload!)).toEqual({ filePath: "/src/test.ts" });
    expect(row!.processedAt).toBeNull();
  });
});

describe("branch filter for reviews", () => {
  it("finds reviews by branch, excluding draft and deleted", () => {
    const db = freshDb();
    const now = new Date().toISOString();

    // Active review on feature branch
    db.insert(featureReviews).values({
      id: "rev_1",
      title: "Feature A",
      status: "active",
      branch: "feat/a",
      createdAt: now,
      updatedAt: now,
    }).run();

    // Draft review on same branch — should be excluded
    db.insert(featureReviews).values({
      id: "rev_2",
      title: "Feature A Draft",
      status: "draft",
      branch: "feat/a",
      createdAt: now,
      updatedAt: now,
    }).run();

    // Deleted review on same branch — should be excluded
    db.insert(featureReviews).values({
      id: "rev_3",
      title: "Feature A Deleted",
      status: "active",
      branch: "feat/a",
      createdAt: now,
      updatedAt: now,
      deletedAt: now,
    }).run();

    // Active review on different branch — should be excluded
    db.insert(featureReviews).values({
      id: "rev_4",
      title: "Feature B",
      status: "active",
      branch: "feat/b",
      createdAt: now,
      updatedAt: now,
    }).run();

    const review = db
      .select()
      .from(featureReviews)
      .where(
        and(
          eq(featureReviews.branch, "feat/a"),
          ne(featureReviews.status, "draft"),
          isNull(featureReviews.deletedAt),
        ),
      )
      .get();

    expect(review).toBeDefined();
    expect(review!.id).toBe("rev_1");
    expect(review!.title).toBe("Feature A");
  });

  it("returns undefined when no matching review exists", () => {
    const db = freshDb();

    const review = db
      .select()
      .from(featureReviews)
      .where(
        and(
          eq(featureReviews.branch, "nonexistent"),
          ne(featureReviews.status, "draft"),
          isNull(featureReviews.deletedAt),
        ),
      )
      .get();

    expect(review).toBeUndefined();
  });
});
