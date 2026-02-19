import OpenAI from "openai";
import type { LlmProvider, LlmMessage, LlmResponse, LlmContentPart } from "./types.js";

export class OpenAIProvider implements LlmProvider {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model || "gpt-4o";
  }

  async chat(messages: LlmMessage[], options?: { systemPrompt?: string }): Promise<LlmResponse> {
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [];

    if (options?.systemPrompt) {
      openaiMessages.push({ role: "system", content: options.systemPrompt });
    }

    for (const msg of messages) {
      if (msg.role === "user") {
        if (typeof msg.content === "string") {
          openaiMessages.push({ role: "user", content: msg.content });
        } else {
          const parts = msg.content.map((part) => this.convertPart(part));
          openaiMessages.push({ role: "user", content: parts });
        }
      } else {
        const text = typeof msg.content === "string"
          ? msg.content
          : msg.content.map((p) => p.text || "").join("");
        openaiMessages.push({ role: "assistant", content: text });
      }
    }

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      messages: openaiMessages,
    });

    const text = response.choices[0]?.message?.content || "";

    return {
      text,
      usage: response.usage
        ? { inputTokens: response.usage.prompt_tokens, outputTokens: response.usage.completion_tokens ?? 0 }
        : undefined,
    };
  }

  private convertPart(part: LlmContentPart): OpenAI.ChatCompletionContentPart {
    if (part.type === "image" && part.imageBase64) {
      return {
        type: "image_url",
        image_url: {
          url: `data:${part.mimeType || "image/png"};base64,${part.imageBase64}`,
        },
      };
    }
    return { type: "text", text: part.text || "" };
  }
}
