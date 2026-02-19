export interface LlmProvider {
  chat(messages: LlmMessage[], options?: { systemPrompt?: string }): Promise<LlmResponse>;
}

export interface LlmMessage {
  role: "user" | "assistant";
  content: string | LlmContentPart[];
}

export interface LlmContentPart {
  type: "text" | "image";
  text?: string;
  imageBase64?: string;
  mimeType?: string;
}

export interface LlmResponse {
  text: string;
  usage?: { inputTokens: number; outputTokens: number };
}
