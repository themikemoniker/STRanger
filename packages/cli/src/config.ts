import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const CONFIG_DIR = join(homedir(), ".ranger");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export interface RangerConfig {
  serverUrl: string;
}

const DEFAULT_CONFIG: RangerConfig = {
  serverUrl: "http://localhost:4800",
};

export function loadConfig(): RangerConfig {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }
  try {
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: RangerConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}
