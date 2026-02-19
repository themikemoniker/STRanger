import { describe, it, expect } from "vitest";
import { createProvider } from "../llm/index.js";

describe("createProvider", () => {
  it("creates an AnthropicProvider for 'anthropic'", () => {
    const provider = createProvider("anthropic", "sk-test-key");
    expect(provider).toBeDefined();
    expect(provider.chat).toBeTypeOf("function");
  });

  it("creates an AnthropicProvider for 'claude' alias", () => {
    const provider = createProvider("claude", "sk-test-key");
    expect(provider).toBeDefined();
    expect(provider.chat).toBeTypeOf("function");
  });

  it("creates an OpenAIProvider for 'openai'", () => {
    const provider = createProvider("openai", "sk-test-key");
    expect(provider).toBeDefined();
    expect(provider.chat).toBeTypeOf("function");
  });

  it("creates an OpenAIProvider for 'gpt' alias", () => {
    const provider = createProvider("gpt", "sk-test-key");
    expect(provider).toBeDefined();
    expect(provider.chat).toBeTypeOf("function");
  });

  it("is case-insensitive", () => {
    const provider = createProvider("Anthropic", "sk-test-key");
    expect(provider).toBeDefined();
  });

  it("throws for unknown provider", () => {
    expect(() => createProvider("unknown", "sk-test-key")).toThrow(
      'Unknown LLM provider: "unknown"',
    );
  });

  it("passes custom model to provider", () => {
    // Should not throw
    const provider = createProvider("anthropic", "sk-test-key", "claude-opus-4-20250514");
    expect(provider).toBeDefined();
  });
});
