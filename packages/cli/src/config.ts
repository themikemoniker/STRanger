import { join } from "node:path";
import { homedir } from "node:os";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const CONFIG_DIR = join(homedir(), ".stranger");
const CONFIG_PATH = join(CONFIG_DIR, "config.json");

export interface StrangerConfig {
  serverUrl: string;
}

const DEFAULT_CONFIG: StrangerConfig = {
  serverUrl: "http://localhost:4800",
};

export function loadConfig(): StrangerConfig {
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

export function saveConfig(config: StrangerConfig): void {
  mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n");
}
