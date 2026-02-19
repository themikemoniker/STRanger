import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { createDb, type Db } from "@stranger/db";

const DATA_DIR = join(homedir(), ".stranger", "data");
const DB_PATH = join(DATA_DIR, "stranger.db");

function initDb(): Db {
  mkdirSync(DATA_DIR, { recursive: true });
  return createDb(DB_PATH);
}

// Survive Next.js HMR in dev mode
const g = globalThis as unknown as { __strangerDb?: Db };

export function getDb(): Db {
  if (!g.__strangerDb) {
    g.__strangerDb = initDb();
  }
  return g.__strangerDb;
}
