# Ranger Clone — Architecture & Design
## Recommendation: Drizzle over Prisma
**Drizzle ORM** is the right choice here. Reasons: - **SQLite-native**: 
Drizzle's SQLite driver (`better-sqlite3`) is synchronous and 
zero-dependency — perfect for a local-first tool. Prisma's SQLite 
support works but drags in a Rust query engine binary, which complicates 
cross-platform packaging. - **Lightweight**: No code generation step, no 
binary engine. The CLI and agent can import the schema directly from a 
shared package. - **Type-safe without codegen**: Schema-as-code means 
the monorepo shares one source of truth without a `prisma generate` 
build step. - **Migration story**: `drizzle-kit` handles migrations as 
plain SQL files, easy to bundle and ship. ---
## 1. Data Model / Schema
### Shared package: `packages/db/`
Add a `db` package to the monorepo that exports the Drizzle schema, 
client factory, and migrations. All other packages depend on it. ``` 
packages/db/
  src/ schema.ts # All table definitions client.ts # createDb(path) 
    factory migrations/ # SQL migration files
  drizzle.config.ts ```
### Entity Relationship Diagram
``` Profile 1──∞ FeatureReview 1──∞ Scenario 1──∞ VerificationRun 1──∞ 
Artifact
                    │ │ └──∞ Comment ──────────────────────┘ │ 1──∞ 
                                              CommentPin (x,y on 
                                              artifact)
```
### Tables
```ts
// ---------- profiles ----------
export const profiles = sqliteTable('profiles', { id: 
  text('id').primaryKey(), // nanoid name: 
  text('name').notNull().unique(), // human slug, e.g. "staging" 
  baseUrl: text('base_url').notNull(), // http://localhost:3000 browser: 
  text('browser').default('chromium'),// chromium | firefox | webkit 
  viewport: text('viewport'), // JSON: { width, height } authState: 
  text('auth_state'), // Playwright storageState JSON (encrypted at rest 
  for CI) envVars: text('env_vars'), // JSON: key-value pairs injected 
  into agent env llmProvider: text('llm_provider'), // claude | openai | 
  custom llmModel: text('llm_model'), // model string isDefault: 
  integer('is_default').default(0), createdAt: 
  text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
});
// ---------- feature_reviews ----------
export const featureReviews = sqliteTable('feature_reviews', { id: 
  text('id').primaryKey(), title: text('title').notNull(), description: 
  text('description'), // markdown status: text('status').notNull(), // 
  draft | in_progress | verified | failed | archived branch: 
  text('branch'), // git branch, for context profileId: 
  text('profile_id').references(() => profiles.id), createdAt: 
  text('created_at').notNull(), updatedAt: text('updated_at').notNull(), 
  deletedAt: text('deleted_at'), // soft delete for `restore`
});
// ---------- scenarios ----------
export const scenarios = sqliteTable('scenarios', { id: 
  text('id').primaryKey(), reviewId: 
  text('review_id').notNull().references(() => featureReviews.id, { 
  onDelete: 'cascade' }), ordinal: integer('ordinal').notNull(), // 
  display/execution order title: text('title').notNull(), // short label 
  description: text('description').notNull(), // natural-language user 
  flow steps startPath: text('start_path'), // override starting URL 
  path status: text('status').notNull(), // pending | running | verified 
  | partial | blocked | failed
  createdAt: text('created_at').notNull(), updatedAt: 
  text('updated_at').notNull(),
});
// ---------- verification_runs ----------
export const verificationRuns = sqliteTable('verification_runs', { id: 
  text('id').primaryKey(), scenarioId: 
  text('scenario_id').notNull().references(() => scenarios.id, { 
  onDelete: 'cascade' }), profileId: 
  text('profile_id').notNull().references(() => profiles.id), verdict: 
  text('verdict').notNull(), // verified | partial | blocked | failed | 
  error summary: text('summary'), // LLM-generated plain-english summary 
  reasoning: text('reasoning'), // LLM chain-of-thought / step log 
  (JSON) durationMs: integer('duration_ms'), notes: text('notes'), // 
  user-supplied context passed via --notes errorMsg: text('error_msg'), 
  // if verdict = error
  startedAt: text('started_at').notNull(), finishedAt: 
  text('finished_at'),
});
// ---------- artifacts ----------
export const artifacts = sqliteTable('artifacts', { id: 
  text('id').primaryKey(), runId: text('run_id').notNull().references(() 
  => verificationRuns.id, { onDelete: 'cascade' }), kind: 
  text('kind').notNull(), // screenshot | video | trace | log filename: 
  text('filename').notNull(), // relative to artifacts dir stepIndex: 
  integer('step_index'), // which agent step produced this caption: 
  text('caption'), // LLM-generated description of what's shown 
  mimeType: text('mime_type').notNull(), sizeBytes: 
  integer('size_bytes'), createdAt: text('created_at').notNull(),
});
// ---------- comments ----------
export const comments = sqliteTable('comments', { id: 
  text('id').primaryKey(), reviewId: 
  text('review_id').notNull().references(() => featureReviews.id, { 
  onDelete: 'cascade' }), runId: text('run_id').references(() => 
  verificationRuns.id), // optional — can comment on review or run 
  artifactId: text('artifact_id').references(() => artifacts.id), // 
  optional — pinned to artifact pinX: real('pin_x'), // 0-1 normalized 
  coords on the artifact pinY: real('pin_y'), author: 
  text('author').notNull(), // "human" | "agent" | agent name body: 
  text('body').notNull(), // markdown resolvedAt: text('resolved_at'), 
  // null = open
  createdAt: text('created_at').notNull(),
});
// ---------- hook_events (audit log) ----------
export const hookEvents = sqliteTable('hook_events', { id: 
  text('id').primaryKey(), hookType: text('hook_type').notNull(), // 
  session-start, post-edit, etc. payload: text('payload'), // JSON blob 
  from the hook processedAt: text('processed_at'), createdAt: 
  text('created_at').notNull(),
});
```
### Indexes
```ts
// Composite indexes for common queries
createIndex('idx_scenarios_review').on(scenarios.reviewId, 
scenarios.ordinal); 
createIndex('idx_runs_scenario').on(verificationRuns.scenarioId); 
createIndex('idx_artifacts_run').on(artifacts.runId); 
createIndex('idx_comments_review').on(comments.reviewId); 
createIndex('idx_reviews_status').on(featureReviews.status, 
featureReviews.deletedAt); ``` ---
## 2. API Route Structure
All routes live in `packages/web/app/api/`. Auth via bearer token (see 
§7). ``` POST /api/auth/token # Exchange shared secret → short-lived JWT 
GET /api/status # Health check + version
# Profiles
GET /api/profiles # List POST /api/profiles # Create GET 
/api/profiles/:id # Get PATCH /api/profiles/:id # Update DELETE 
/api/profiles/:id # Delete
# Feature Reviews
GET /api/reviews # List (filterable by status, branch) POST /api/reviews 
# Create (accepts title + scenarios in one call)
GET /api/reviews/:id # Get with scenarios + latest runs PATCH 
/api/reviews/:id # Update DELETE /api/reviews/:id # Soft delete POST 
/api/reviews/:id/restore # Restore soft-deleted
# Scenarios
POST /api/reviews/:id/scenarios # Add scenario PATCH 
/api/reviews/:id/scenarios/:sid # Update DELETE 
/api/reviews/:id/scenarios/:sid # Remove POST 
/api/reviews/:id/scenarios/reorder # Bulk reorder
# Verification
POST /api/verify # Trigger verification run (body: { reviewId, 
scenarioIds?, profileId?, notes?, startPath? }) GET /api/verify/:runId # 
Poll run status GET /api/verify/:runId/stream # SSE stream of live 
progress POST /api/verify/:runId/cancel # Abort a running verification
# Runs & Artifacts
GET /api/runs?scenarioId=&reviewId= # List runs with filters GET 
/api/runs/:id # Run detail with artifacts GET /api/artifacts/:id/file # 
Serve artifact file (proxied from disk)
# Comments
GET /api/reviews/:id/comments # List for review POST 
/api/reviews/:id/comments # Create (with optional pin coords) PATCH 
/api/comments/:id # Edit / resolve DELETE /api/comments/:id # Delete
# Hooks (called by Claude Code plugin)
POST /api/hooks/:hookType # Ingest hook event
# Agent feedback (for coding agent to poll)
GET /api/reviews/:id/feedback # Unresolved comments + latest verdicts 
```
### SSE for live verification
`GET /api/verify/:runId/stream` returns Server-Sent Events: ``` event: 
step data: {"index": 3, "action": "click", "selector": "#submit", 
"screenshotId": "abc123"} event: verdict data: {"verdict": "partial", 
"summary": "..."} event: done data: {} ``` The dashboard subscribes to 
this for live progress. The CLI uses it for `ranger go --watch`. ---
## 3. Agent Worker Architecture
### Why a separate process
The browser agent is CPU/memory intensive and long-running. It must 
**not** run inside Next.js API routes (which have execution time limits, 
cold starts, and would block the event loop).
### Process model
``` ┌──────────────┐ ┌───────────────────┐ ┌──────────────┐ │ Next.js 
API │──POST──▶│ Agent Manager │──fork──▶│ Agent Worker│ │ /api/verify │ 
│ (singleton in │ │ (child proc)│ │ │◀──SSE───│ web server proc) 
│◀──IPC───│ │ └──────────────┘ └───────────────────┘ └──────────────┘ 
``` **Recommendation: `child_process.fork()` with JSON IPC** over 
alternatives like a Redis queue or separate HTTP service. Rationale: - 
Zero infrastructure — no Redis/RabbitMQ needed for a self-hosted local 
tool - `fork()` gives a dedicated V8 isolate with structured-clone IPC 
for free - The agent manager lives in the Next.js server process as a 
singleton module - Simple enough that a small team can debug it
### Agent Manager (singleton)
```ts
// packages/web/lib/agent-manager.ts
class AgentManager { private workers: Map<string, ChildProcess> = new 
  Map(); private maxConcurrent = os.cpus().length; // or configurable 
  async startRun(runId: string, config: RunConfig): Promise<void> {
    if (this.workers.size >= this.maxConcurrent) { throw new Error('Max 
      concurrent verifications reached');
    }
    const child = fork(resolve(__dirname, '../../agent/dist/worker.js'), 
    [], {
      env: { ...process.env, ...config.envVars }, serialization: 'json',
    });
    this.workers.set(runId, child); child.on('message', (msg: 
    WorkerMessage) => {
      // Write to DB + broadcast to SSE subscribers
      this.handleMessage(runId, msg);
    });
    child.on('exit', (code) => { this.workers.delete(runId); if (code 
      !== 0) this.markRunError(runId, `Worker exited with code 
      ${code}`);
    });
    child.send({ type: 'start', config });
  }
  cancelRun(runId: string): void { 
    this.workers.get(runId)?.kill('SIGTERM');
  }
}
```
### Worker Process (packages/agent/)
```ts
// packages/agent/src/worker.ts
process.on('message', async (msg: { type: 'start', config: RunConfig }) 
=> {
  const browser = await playwright[config.browser].launch(); const 
  context = await browser.newContext({
    storageState: config.authState ? JSON.parse(config.authState) : 
    undefined, viewport: config.viewport, recordVideo: { dir: 
    config.artifactsDir },
  });
  const page = await context.newPage(); const agent = new BrowserAgent({ 
    page, llmProvider: config.llmProvider, llmModel: config.llmModel, 
    apiKey: config.apiKey, scenario: config.scenario,
  });
  agent.on('step', (step) => { process.send!({ type: 'step', ...step });
  });
  const result = await agent.run(); process.send!({ type: 'verdict', 
  ...result }); await browser.close(); process.exit(0);
});
```
### LLM Browser Agent loop
The agent uses a simple ReAct-style loop: 1. **Observe**: Screenshot 
current page → send to LLM with scenario description 2. **Think**: LLM 
decides next action (click, type, navigate, scroll, assert, done) 3. 
**Act**: Execute via Playwright 4. **Repeat** until LLM returns a 
verdict or max steps exceeded Each step saves a screenshot artifact. 
Video recording captures the full session.
### Parallelism
- Per-scenario parallelism: `ranger go` on a review with 5 scenarios can 
run them concurrently (each gets its own browser context) - 
`maxConcurrent` is configurable, defaults to CPU count - Scenarios 
within a single review run are executed in parallel up to the limit, 
then queued ---
## 4. CLI Architecture
### Package: `packages/cli/`
Built with **Commander.js** (lightweight, well-maintained). Published as 
`ranger-cli` on npm.
### Config storage
``` ~/.ranger/ config.json # Global config: { serverUrl, token, 
  defaultProfile } profiles/
    staging.json # Per-profile overrides & encrypted auth state keys/ 
    ci.key # Encryption key for CI profiles (see §8)
``` Scoped project config (optional, committed to repo): ``` .ranger/ 
  project.json # { defaultProfile: "local", serverUrl: 
  "http://localhost:4800" }
``` Resolution order: CLI flag → project config → global config → 
defaults.
### How the CLI talks to the server
Every CLI command is a thin HTTP client wrapper: ```ts
// packages/cli/src/client.ts
class RangerClient { constructor(private baseUrl: string, private token: 
  string) {} async createReview(data: CreateReviewInput) {
    return this.post('/api/reviews', data);
  }
  async triggerVerification(data: VerifyInput) { return 
    this.post('/api/verify', data);
  }
  async streamVerification(runId: string): 
  AsyncIterable<VerificationEvent> {
    // Consumes SSE from /api/verify/:runId/stream
  }
}
```
### Key CLI flows
**`ranger setup`**: Starts the Next.js server if not running, 
initializes SQLite DB, creates `~/.ranger/config.json`, generates a 
shared secret. **`ranger go`**: The primary verification command. ``` 1. 
Resolve profile (--profile flag or default) 2. POST /api/verify { 
reviewId, scenarioIds, profileId, notes } 3. Server spawns agent 
worker(s) 4. CLI subscribes to SSE stream, renders live progress with 
ora/chalk 5. On completion, prints verdict table + artifact links ``` 
**`ranger create`**: Interactive or accepts JSON/YAML. Calls `POST 
/api/reviews`. ---
## 5. File Storage Layout
``` ~/.ranger/ data/ ranger.db # SQLite database artifacts/ {run_id}/ 
        screenshot-001.png screenshot-002.png video.webm trace.zip # 
        Playwright trace agent-log.json # Full LLM conversation log
``` Next.js serves artifacts via `GET /api/artifacts/:id/file`, which 
reads `filename` from the DB and streams from disk. This avoids exposing 
raw filesystem paths. **Cleanup policy**: `ranger clean` deletes 
artifacts older than N days (configurable). Soft-deleted reviews are 
purged after 30 days. ---
## 6. Hook System + Skills Integration
### Claude Code Plugin (`plugin/`)
The plugin registers hooks via the Claude Code plugin manifest: ```json 
{
  "name": "ranger", "description": "UI feature review automation", 
  "hooks": {
    "session-start": "npx ranger hook session-start", "session-end": 
    "npx ranger hook session-end", "post-edit": "npx ranger hook 
    post-edit --files $CHANGED_FILES", "pre-compact": "npx ranger hook 
    pre-compact", "plan-start": "npx ranger hook plan-start", 
    "exit-plan-mode": "npx ranger hook exit-plan-mode"
  },
  "slash_commands": { "/ranger:enable": "npx ranger hook enable", 
    "/ranger:disable": "npx ranger hook disable", "/ranger": "npx ranger 
    hook status"
  }
}
```
### Hook CLI handler
```ts
// packages/cli/src/commands/hook.ts Each hook: 1. POSTs to 
// /api/hooks/:hookType with context payload 2. Server processes & 
// persists to hook_events table 3. Returns instructions for Claude Code 
// to inject into context
```
### Key hook behaviors
| Hook | Behavior | ------|----------| `session-start` | Inject active 
| review context + unresolved comments into Claude Code's context. Load 
| relevant skill files. | `post-edit` | If edited files overlap with an 
| active review's scope, suggest running verification. | `pre-compact` | 
| Summarize verification status before context compaction so agent 
| retains awareness. | `plan-start` | Inject current review requirements 
| so the agent plans with verification in mind. | `session-end` | Record 
| session summary, update review metadata. | `enable/disable` | Toggle a 
| `.ranger-enabled` flag in project config; controls whether other hooks 
| fire. |
### Skills (`skills/`)
Markdown files that Claude Code loads into context: ``` skills/ 
  ranger-overview.md # What Ranger is, how it works creating-reviews.md 
  # How to structure good scenarios
  interpreting-results.md # What verdicts mean, how to fix failures 
  verification-workflow.md # Recommended dev loop with Ranger
``` The `session-start` hook tells Claude Code to read the relevant 
skill file based on the current task.
### Feedback loop
The critical integration: after verification runs, the coding agent can 
poll `GET /api/reviews/:id/feedback` to get: - Unresolved human comments 
(including pin coordinates on screenshots) - Latest verdict + summary 
for each scenario - Agent-authored reasoning for failures This lets the 
agent autonomously iterate: build → verify → read feedback → fix → 
re-verify. ---
## 7. Auth Model (Self-Hosted)
For a self-hosted local tool, the auth model should be **minimal but 
secure enough to prevent accidental exposure**.
### Mechanism: Shared secret + short-lived JWTs
``` ┌─────────┐ ┌────────────┐ │ CLI │──POST /api/auth/token──▶│ Next.js 
│ │ │ { secret: "abc..." } │ Server │ │ │◀── { jwt: "eyJ..." } ───│ │ │ 
│ │ │ │ │──GET /api/reviews ──────│ │ │ │ Authorization: Bearer │ │ │ │ 
eyJ...  │ │ └─────────┘ └────────────┘ ``` 1. **`ranger setup`** 
generates a random 256-bit secret, stores it in `~/.ranger/config.json` 
and in the server's env/config. 2. CLI exchanges the secret for a JWT 
(1-hour expiry) via `POST /api/auth/token`. 3. All subsequent API calls 
use the JWT as a Bearer token. 4. The plugin/hooks inherit the same 
secret from the CLI config.
### Why not just the raw secret?
JWTs let you revoke/rotate without restarting the server, and they carry 
claims (e.g., `{ role: "cli" }` vs `{ role: "hook" }`) for future 
multi-user support.
### Dashboard auth
The Next.js dashboard runs locally — for v1, it's accessible without 
login on `localhost`. If the user binds to `0.0.0.0`, they can 
optionally enable a simple passphrase gate (stored hashed in SQLite). 
---
## 8. CI Profile Flow
CI environments need to run verification headlessly without interactive 
login.
### Setup
```bash
# On dev machine: capture auth state, encrypt it
ranger profile add ci --base-url https://staging.example.com ranger 
login --profile ci # Opens browser, captures storageState ranger profile 
encrypt-auth ci # Encrypts authState with a generated key
# Output: ✓ Auth state encrypted. Set RANGER_CI_KEY=<key> in your CI 
# environment. ✓ Encrypted auth saved to ~/.ranger/profiles/ci.json
```
### Encryption
- **Algorithm**: AES-256-GCM (via Node.js `crypto`) - **Key**: Random 
256-bit key, displayed once for the user to store as a CI secret - 
**Storage**: The encrypted blob replaces the plaintext `authState` in 
the profile JSON - At runtime, the agent decrypts using `RANGER_CI_KEY` 
env var
### CI usage
```yaml
# GitHub Actions example
- name: Run Ranger verification env: RANGER_CI_KEY: ${{ 
    secrets.RANGER_CI_KEY }} RANGER_LLM_API_KEY: ${{ 
    secrets.ANTHROPIC_API_KEY }}
  run: | npx ranger setup --ci --profile ci npx ranger go --review ${{ 
    github.event.pull_request.number }}
``` `--ci` flag: starts the server in background, skips interactive 
prompts, outputs JSON for machine parsing, sets exit code based on 
verdict (0=verified, 1=failed).
### Auth state refresh
Encrypted auth state will expire (cookies/tokens). Options: - 
**Programmatic login**: Profile can store credentials (encrypted) and 
re-authenticate via Playwright before each run - **Service account**: 
For staging envs, use long-lived API tokens instead of browser cookies - 
**Manual refresh**: `ranger profile refresh-auth ci && ranger profile 
encrypt-auth ci` ---
## 9. Technical Risks & Design Tradeoffs
### ⚠️ Risk: LLM browser agent reliability
The biggest risk in the entire system. LLM-driven browser automation is 
non-deterministic. Mitigations: - **Max step limit** per scenario 
(default 25) to prevent infinite loops - **Screenshot diffing**: Compare 
final state against previous successful runs to detect regressions even 
when the LLM is uncertain - **Structured action space**: Don't let the 
LLM emit arbitrary Playwright code. Constrain to a fixed set of actions 
(click, type, navigate, scroll, select, assert_text, assert_visible, 
done). This dramatically improves reliability. - **Retry with backoff**: 
Failed scenarios can auto-retry once with a fresh context - 
**Human-in-the-loop**: The "partial" verdict exists precisely for 
ambiguous cases
### ⚠️ Risk: SQLite concurrency under parallel verification
SQLite handles concurrent reads well but only one writer at a time. With 
multiple agent workers writing artifacts and status updates 
simultaneously: - **Use WAL mode** (write-ahead logging) — enables 
concurrent reads during writes - **Use a single DB connection pool** in 
the Next.js server process (via `better-sqlite3`), not in worker 
processes - Workers send results via IPC → server process writes to DB. 
This serializes writes through one process, avoiding `SQLITE_BUSY` 
errors.
### ⚠️ Risk: Large artifact storage
Video files can be large. Mitigations: - Record at 720p, 15fps by 
default - Auto-cleanup policy in `ranger clean` - Future: optional 
S3-compatible upload for teams
### Tradeoff: Monolithic Next.js vs separate API server
Keeping API routes in Next.js simplifies deployment (one process) but 
means: - The agent manager singleton lives in the Next.js server 
process, which could restart during development (HMR). Mitigation: in 
dev mode, the agent manager detaches workers and reconnects on restart. 
- No horizontal scaling — but this is a local tool, so that's fine.
### Tradeoff: fork() vs message queue
`fork()` is simpler but limits you to one machine. For a self-hosted 
local tool, this is the right call. If someone later wants distributed 
workers (e.g., a team server), you'd swap the agent manager's `fork()` 
call for a BullMQ producer, with workers consuming from Redis. The 
worker code itself doesn't change — only the transport layer.
### Tradeoff: Bringing your own LLM key
Good for FOSS (no vendor lock-in, no API billing) but creates UX 
friction. Mitigate with: - Clear setup wizard in `ranger setup` - 
Support for `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env vars 
(auto-detected) - Validate the key works before saving the profile
### Design principle: The CLI is the source of truth for the coding 
### agent
The coding agent (Claude Code) should **never** talk to the Next.js 
server directly. All interaction flows through CLI commands invoked by 
hooks. This keeps the integration surface small and testable: ``` Claude 
Code → hook/slash command → CLI → HTTP → Server → DB/Agent ``` ---
## Summary: Monorepo Package Dependency Graph
``` packages/db ← shared schema, client factory, migrations ↑ ↑ 
packages/web packages/agent ← agent imports db types only (not client)
    ↑ ↑ packages/cli ← HTTP client to web, spawns no DB connection 
itself
    ↑ plugin/ ← invokes CLI commands skills/ ← static markdown, no code 
dependencies ```
`db` is the foundation. `web` owns the database connection. `agent` runs in a child process and communicates via IPC. `cli` is a pure HTTP client. `plugin` is a thin shell that invokes `cli`.
