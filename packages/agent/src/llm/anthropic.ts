import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, LlmMessage, LlmResponse, LlmContentPart } from "./types.js";

export class AnthropicProvider implements LlmProvider {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || "claude-sonnet-4-20250514";
  }

  async chat(messages: LlmMessage[], options?: { systemPrompt?: string }): Promise<LlmResponse> {
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: typeof msg.content === "string"
        ? msg.content
        : msg.content.map((part) => this.convertPart(part)),
    }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: options?.systemPrompt || "",
      messages: anthropicMessages,
    });

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => ("text" in block ? block.text : ""))
      .join("");

    return {
      text,
      usage: response.usage
        ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
        : undefined,
    };
  }

  private convertPart(part: LlmContentPart): Anthropic.TextBlockParam | Anthropic.ImageBlockParam {
    if (part.type === "image" && part.imageBase64) {
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: (part.mimeType || "image/png") as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: part.imageBase64,
        },
      };
    }
    return { type: "text", text: part.text || "" };
  }
}
