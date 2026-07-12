import { describe, expect, it } from "vitest";
import { COACH_SYSTEM_PROMPT, buildCoachUserContext, buildRetrievalQuery } from "./coach";

describe("COACH_SYSTEM_PROMPT", () => {
  it("keeps the coach in a hint-only role for active questions", () => {
    const prompt = COACH_SYSTEM_PROMPT.toLowerCase();
    expect(prompt).toContain("never reveal");
    expect(prompt).toContain("correct choice");
    expect(prompt).toContain("quiz widget");
  });
});

describe("buildRetrievalQuery", () => {
  const activeQuestion = {
    stem: "What does photosynthesis use?",
    choices: ["Light energy", "Sound energy"],
  };

  it("uses only the stable question stem so repeat turns hit the retrieval cache", () => {
    const first = buildRetrievalQuery({ activeQuestion, message: "give me a hint" });
    const second = buildRetrievalQuery({ activeQuestion, message: "explain choice two" });
    expect(first).toBe("What does photosynthesis use?");
    expect(second).toBe(first);
  });

  it("falls back to the learner message when no question is active", () => {
    expect(buildRetrievalQuery({ activeQuestion: null, message: "what is glucose?" })).toBe(
      "what is glucose?",
    );
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
