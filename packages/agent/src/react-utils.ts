/**
 * Shared utilities for the ReAct agent loop — extracted for testability.
 */

export interface AgentAction {
  observation: string;
  reasoning: string;
  action: string;
  actionArgs: Record<string, unknown>;
}

export function parseLlmResponse(text: string): AgentAction {
  // Try to extract JSON from the response
  let jsonStr = text.trim();

  // Handle markdown code blocks
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  const parsed = JSON.parse(jsonStr);
  return {
    observation: parsed.observation || "",
    reasoning: parsed.reasoning || "",
    action: parsed.action || "done",
    actionArgs: parsed.actionArgs || {},
  };
}
