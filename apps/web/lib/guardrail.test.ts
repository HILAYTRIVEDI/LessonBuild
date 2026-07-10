import { describe, it, expect } from "vitest";
import { HINT_GUARDRAIL_INSTRUCTIONS, toGuardrailReadable } from "./guardrail";
import type { AskQuestionEvent } from "@lessonbuild/shared";

describe("HINT_GUARDRAIL_INSTRUCTIONS", () => {
  it("instructs the assistant to never reveal the correct choice", () => {
    expect(HINT_GUARDRAIL_INSTRUCTIONS.toLowerCase()).toContain("never reveal");
    expect(HINT_GUARDRAIL_INSTRUCTIONS.toLowerCase()).toContain("hint");
  });
});

describe("toGuardrailReadable", () => {
  it("strips correctIndex out of the feedback before it reaches chat context", () => {
    // The schema no longer carries correctIndex, but a stale/hostile agent
    // payload might — the guardrail must still strip it (defense in depth).
    const event = {
      type: "ask_mcq",
      stem: "What is 2+2?",
      choices: ["3", "4"],
      questionIdx: 0,
      feedback: { correctIndex: 1, selectedIndex: 0, isCorrect: false, text: "Think about it." },
    } as unknown as AskQuestionEvent;
    const readable = toGuardrailReadable(event);
    expect(JSON.stringify(readable)).not.toContain("correctIndex");
    expect(readable.stem).toBe("What is 2+2?");
    expect(readable.choices).toEqual(["3", "4"]);
  });

  it("omits feedback entirely when none is present yet", () => {
    const event: AskQuestionEvent = {
      type: "ask_mcq",
      stem: "What is 2+2?",
      choices: ["3", "4"],
      questionIdx: 0,
    };
    const readable = toGuardrailReadable(event);
    expect(readable.priorHint).toBeUndefined();
  });
});
