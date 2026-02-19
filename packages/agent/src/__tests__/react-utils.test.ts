import { describe, it, expect } from "vitest";
import { parseLlmResponse } from "../react-utils.js";

describe("parseLlmResponse", () => {
  it("parses a valid JSON response", () => {
    const input = JSON.stringify({
      observation: "I see a login form",
      reasoning: "I need to click the submit button",
      action: "click",
      actionArgs: { selector: "button[type=submit]" },
    });

    const result = parseLlmResponse(input);
    expect(result.observation).toBe("I see a login form");
    expect(result.reasoning).toBe("I need to click the submit button");
    expect(result.action).toBe("click");
    expect(result.actionArgs.selector).toBe("button[type=submit]");
  });

  it("extracts JSON from markdown code blocks", () => {
    const input = `Here is my analysis:

\`\`\`json
{
  "observation": "Page loaded",
  "reasoning": "Let me scroll down",
  "action": "scroll",
  "actionArgs": { "direction": "down", "amount": 500 }
}
\`\`\``;

    const result = parseLlmResponse(input);
    expect(result.observation).toBe("Page loaded");
    expect(result.action).toBe("scroll");
    expect(result.actionArgs.direction).toBe("down");
  });

  it("extracts JSON from code blocks without language tag", () => {
    const input = "```\n" + JSON.stringify({
      observation: "test",
      reasoning: "test",
      action: "done",
      actionArgs: { verdict: "passed", summary: "All good" },
    }) + "\n```";

    const result = parseLlmResponse(input);
    expect(result.action).toBe("done");
    expect(result.actionArgs.verdict).toBe("passed");
  });

  it("defaults missing fields", () => {
    const input = JSON.stringify({});
    const result = parseLlmResponse(input);
    expect(result.observation).toBe("");
    expect(result.reasoning).toBe("");
    expect(result.action).toBe("done");
    expect(result.actionArgs).toEqual({});
  });

  it("throws on invalid JSON", () => {
    expect(() => parseLlmResponse("not json at all")).toThrow();
  });

  it("handles whitespace around JSON", () => {
    const input = `  \n  ${JSON.stringify({
      observation: "test",
      reasoning: "test",
      action: "click",
      actionArgs: { selector: "#btn" },
    })}  \n  `;

    const result = parseLlmResponse(input);
    expect(result.action).toBe("click");
  });

  it("parses done action with verdict", () => {
    const input = JSON.stringify({
      observation: "The feature works as expected",
      reasoning: "All scenario steps have been verified successfully",
      action: "done",
      actionArgs: {
        verdict: "passed",
        summary: "Login form submits correctly and redirects to dashboard",
      },
    });

    const result = parseLlmResponse(input);
    expect(result.action).toBe("done");
    expect(result.actionArgs.verdict).toBe("passed");
    expect(result.actionArgs.summary).toContain("Login form");
  });

  it("parses type action", () => {
    const input = JSON.stringify({
      observation: "I see an input field",
      reasoning: "I need to type the username",
      action: "type",
      actionArgs: { selector: "input[name=username]", text: "testuser" },
    });

    const result = parseLlmResponse(input);
    expect(result.action).toBe("type");
    expect(result.actionArgs.selector).toBe("input[name=username]");
    expect(result.actionArgs.text).toBe("testuser");
  });

  it("parses navigate action", () => {
    const input = JSON.stringify({
      observation: "I need to go to settings",
      reasoning: "The scenario requires checking the settings page",
      action: "navigate",
      actionArgs: { url: "/settings" },
    });

    const result = parseLlmResponse(input);
    expect(result.action).toBe("navigate");
    expect(result.actionArgs.url).toBe("/settings");
  });
});
