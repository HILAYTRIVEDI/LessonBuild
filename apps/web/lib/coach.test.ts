import { describe, expect, it } from "vitest";
import { COACH_SYSTEM_PROMPT, buildCoachUserContext } from "./coach";

describe("COACH_SYSTEM_PROMPT", () => {
  it("keeps the coach in a hint-only role for active questions", () => {
    const prompt = COACH_SYSTEM_PROMPT.toLowerCase();
    expect(prompt).toContain("never reveal");
    expect(prompt).toContain("correct choice");
    expect(prompt).toContain("quiz widget");
  });
});

describe("buildCoachUserContext", () => {
  it("shares active question context without answer-key fields", () => {
    const context = buildCoachUserContext({
      lessonContext: "Photosynthesis uses light energy to make glucose.",
      activeQuestion: {
        stem: "What does photosynthesis use?",
        choices: ["Light energy", "Sound energy"],
        priorHint: "Think about what plants capture from the sun.",
      },
      message: "Can you help me think about this?",
    });

    expect(context).toContain("What does photosynthesis use?");
    expect(context).toContain("Light energy");
    expect(context).toContain("Think about what plants capture");
    expect(context).not.toContain("correctIndex");
    expect(context).not.toContain("correct index");
  });
});
