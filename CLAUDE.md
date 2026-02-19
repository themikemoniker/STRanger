# STRanger

## WHAT

STRanger is a self-hosted UI feature review automation tool. It uses a Playwright-powered browser agent to verify UI features against human-written scenarios.

### Monorepo structure (pnpm workspace)

```
packages/db      — Drizzle ORM + better-sqlite3 schema, client factory, migrations
packages/web     — Next.js 15 App Router dashboard + API server (port 4800)
packages/cli     — Commander.js CLI ("stranger" binary)
packages/agent   — Browser agent worker process (spawned via child_process.fork)
skills/          — Markdown context files for Claude Code
plugin/          — Claude Code plugin manifest
```

### Package dependency graph

```
packages/db        ← foundation: schema + client factory
  ↑         ↑
packages/web    packages/agent   ← agent imports db types only (IPC, no direct DB)
  ↑                  ↑
packages/cli         ← pure HTTP client to web, no DB connection
  ↑
plugin/              ← invokes CLI commands
skills/              ← static markdown, no code dependencies
```

### Tech stack

- **Runtime**: Node.js 20+, pnpm 9+
- **Language**: TypeScript (strict mode everywhere)
- **Database**: SQLite via better-sqlite3 + Drizzle ORM (WAL mode)
- **Web**: Next.js 15 App Router, Tailwind CSS v4
- **CLI**: Commander.js
- **Browser automation**: Playwright
- **Migrations**: drizzle-kit (plain SQL files)

## WHY

Coding agents (like Claude Code) build features but can't visually verify them. STRanger offloads UI verification to a separate browser agent that navigates the app, takes screenshots, and reports verdicts. The feedback loop: build → verify → read feedback → fix → re-verify.

## HOW

### Key commands

```bash
pnpm install          # Install all workspace dependencies
pnpm build            # Build all packages (tsc for db/cli/agent, next build for web)
pnpm dev              # Start Next.js dev server on port 4800
pnpm typecheck        # Type-check all packages
pnpm lint             # Lint all packages
pnpm test             # Run all tests (vitest)
```

### Running individual packages

```bash
pnpm --filter @stranger/web dev        # Next.js dev server
pnpm --filter @stranger/cli build      # Build CLI
pnpm --filter @stranger/db db:generate # Generate Drizzle migration
pnpm --filter @stranger/db db:migrate  # Run Drizzle migration
```

### Workspace conventions

- All packages use `@stranger/` npm scope
- Cross-package imports use `workspace:*` protocol
- `packages/db` is the shared dependency — schema changes affect all packages
- The web package transpiles `@stranger/db` via `transpilePackages` in next.config.ts
- See sub-package READMEs for package-specific context

## Common Mistakes

- **better-sqlite3 + Next.js bundling**: Must add BOTH `serverExternalPackages: ["better-sqlite3"]` AND `config.externals = [...(config.externals || []), "better-sqlite3"]` in webpack config — one alone is not enough
- **@stranger/db uses .js extensions** in imports (Node16 module resolution): Next.js needs `config.resolve.extensionAlias = { ".js": [".ts", ".tsx", ".js", ".jsx"] }` in webpack config
- **Drizzle relational queries** (`db.query.X.findFirst()`) return a wrapper type that doesn't narrow well with TypeScript — use `db.select().from(X).where(...).get()` for null checks, then query relations separately
- **Agent worker path**: Resolve from monorepo root (`join(process.cwd(), "..", "..")`) not from `packages/web/node_modules` — `@stranger/agent` is not a dependency of `@stranger/web`
- **`.gitignore` artifacts**: Use `/artifacts/` (root-only) not `artifacts/` to avoid ignoring `app/api/artifacts/` route files
- **Drizzle migration SQL**: Uses `--> statement-breakpoint` as delimiter, not semicolons
- **Seed script idempotency**: Delete the DB file before re-seeding

## Verification

After finishing a unit of work (new function, endpoint, component, bug fix):

1. `pnpm --filter <affected-package> typecheck`
2. `pnpm --filter <affected-package> test` (if tests exist for that package)

Before claiming any task is complete:

1. `pnpm typecheck` (all packages)
2. `pnpm test` (all tests pass)
3. `pnpm lint`
