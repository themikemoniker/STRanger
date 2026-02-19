/**
 * Agent worker process — spawned by the AgentManager in the web server.
 * Communicates with the parent process via Node.js IPC (JSON messages).
 */

interface RunConfig {
  browser: string;
  viewport?: { width: number; height: number };
  authState?: string;
  artifactsDir: string;
  llmProvider: string;
  llmModel: string;
  apiKey: string;
  scenario: {
    id: string;
    title: string;
    description: string;
    startPath?: string;
  };
  envVars?: Record<string, string>;
}

interface StartMessage {
  type: "start";
  config: RunConfig;
}

process.on("message", async (msg: StartMessage) => {
  if (msg.type !== "start") return;

  const { config } = msg;

  // TODO: Launch Playwright browser with config
  // TODO: Initialize BrowserAgent with LLM provider
  // TODO: Execute ReAct loop (observe → think → act → repeat)
  // TODO: Send step events via process.send()
  // TODO: Send final verdict via process.send()

  process.send!({
    type: "verdict",
    verdict: "error",
    summary: "Agent worker not yet implemented",
  });

  process.exit(0);
});
