import type { LlmProvider } from "./types.js";
import { AnthropicProvider } from "./anthropic.js";
import { OpenAIProvider } from "./openai.js";

export type { LlmProvider, LlmMessage, LlmContentPart, LlmResponse } from "./types.js";

export function createProvider(name: string, apiKey: string, model?: string): LlmProvider {
  switch (name.toLowerCase()) {
    case "anthropic":
    case "claude":
      return new AnthropicProvider(apiKey, model);
    case "openai":
    case "gpt":
      return new OpenAIProvider(apiKey, model);
    default:
      throw new Error(`Unknown LLM provider: "${name}". Supported: anthropic, openai`);
  }
}
