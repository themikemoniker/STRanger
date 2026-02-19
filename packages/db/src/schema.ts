import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ── Profiles ────────────────────────────────────────────────────────────────
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").unique().notNull(),
  baseUrl: text("base_url").notNull(),
  browser: text("browser").default("chromium"),
  viewport: text("viewport"),
  authState: text("auth_state"),
  envVars: text("env_vars"),
  llmProvider: text("llm_provider"),
  llmModel: text("llm_model"),
  isDefault: integer("is_default").default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// ── Feature Reviews ─────────────────────────────────────────────────────────
export const featureReviews = sqliteTable(
  "feature_reviews",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull(),
    branch: text("branch"),
    profileId: text("profile_id").references(() => profiles.id),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("idx_reviews_status").on(table.status, table.deletedAt),
  ],
);

// ── Scenarios ───────────────────────────────────────────────────────────────
export const scenarios = sqliteTable(
  "scenarios",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => featureReviews.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    startPath: text("start_path"),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_scenarios_review").on(table.reviewId, table.ordinal),
  ],
);

// ── Verification Runs ───────────────────────────────────────────────────────
export const verificationRuns = sqliteTable(
  "verification_runs",
  {
    id: text("id").primaryKey(),
    scenarioId: text("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id),
    verdict: text("verdict").notNull(),
    summary: text("summary"),
    reasoning: text("reasoning"),
    durationMs: integer("duration_ms"),
    notes: text("notes"),
    errorMsg: text("error_msg"),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at"),
  },
  (table) => [
    index("idx_runs_scenario").on(table.scenarioId),
  ],
);

// ── Artifacts ───────────────────────────────────────────────────────────────
export const artifacts = sqliteTable(
  "artifacts",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => verificationRuns.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    filename: text("filename").notNull(),
    stepIndex: integer("step_index"),
    caption: text("caption"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_artifacts_run").on(table.runId),
  ],
);

// ── Comments ────────────────────────────────────────────────────────────────
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    reviewId: text("review_id")
      .notNull()
      .references(() => featureReviews.id, { onDelete: "cascade" }),
    runId: text("run_id").references(() => verificationRuns.id),
    artifactId: text("artifact_id").references(() => artifacts.id),
    pinX: real("pin_x"),
    pinY: real("pin_y"),
    author: text("author").notNull(),
    body: text("body").notNull(),
    resolvedAt: text("resolved_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_comments_review").on(table.reviewId),
  ],
);

// ── Hook Events ─────────────────────────────────────────────────────────────
export const hookEvents = sqliteTable("hook_events", {
  id: text("id").primaryKey(),
  hookType: text("hook_type").notNull(),
  payload: text("payload"),
  processedAt: text("processed_at"),
  createdAt: text("created_at").notNull(),
});

// ── Relations ───────────────────────────────────────────────────────────────
export const profilesRelations = relations(profiles, ({ many }) => ({
  reviews: many(featureReviews),
  runs: many(verificationRuns),
}));

export const featureReviewsRelations = relations(featureReviews, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [featureReviews.profileId],
    references: [profiles.id],
  }),
  scenarios: many(scenarios),
  comments: many(comments),
}));

export const scenariosRelations = relations(scenarios, ({ one, many }) => ({
  review: one(featureReviews, {
    fields: [scenarios.reviewId],
    references: [featureReviews.id],
  }),
  runs: many(verificationRuns),
}));

export const verificationRunsRelations = relations(verificationRuns, ({ one, many }) => ({
  scenario: one(scenarios, {
    fields: [verificationRuns.scenarioId],
    references: [scenarios.id],
  }),
  profile: one(profiles, {
    fields: [verificationRuns.profileId],
    references: [profiles.id],
  }),
  artifacts: many(artifacts),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  run: one(verificationRuns, {
    fields: [artifacts.runId],
    references: [verificationRuns.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  review: one(featureReviews, {
    fields: [comments.reviewId],
    references: [featureReviews.id],
  }),
  run: one(verificationRuns, {
    fields: [comments.runId],
    references: [verificationRuns.id],
  }),
  artifact: one(artifacts, {
    fields: [comments.artifactId],
    references: [artifacts.id],
  }),
}));
