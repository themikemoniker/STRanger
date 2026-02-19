import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { createDb, type Db } from "@ranger/db";

const DATA_DIR = join(homedir(), ".ranger", "data");
const DB_PATH = join(DATA_DIR, "ranger.db");

function initDb(): Db {
  mkdirSync(DATA_DIR, { recursive: true });
  return createDb(DB_PATH);
}

// Survive Next.js HMR in dev mode
const g = globalThis as unknown as { __rangerDb?: Db };

export function getDb(): Db {
  if (!g.__rangerDb) {
    g.__rangerDb = initDb();
  }
  return g.__rangerDb;
}
