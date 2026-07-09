import { describe, it, expect } from "vitest";
import { computeScore, summarizeNode } from "./summarize";

describe("computeScore", () => {
  it("computes first-try accuracy per objective", () => {
    const attempts = [
      { questionIdx: 0, isCorrect: true, attemptNo: 1, selectedIndex: 1 },
      { questionIdx: 1, isCorrect: false, attemptNo: 1, selectedIndex: 0 },
      { questionIdx: 1, isCorrect: true, attemptNo: 2, selectedIndex: 1 },
    ];
    const score = computeScore(attempts as never, 2);
    expect(score.firstTryCorrect).toBe(1);
    expect(score.total).toBe(2);
  });
});

describe("summarizeNode", () => {
  it("produces a report string with study tips", async () => {
    const model = { invoke: async () => ({ content: "Tip: review objective 2." }) };
    const out = await summarizeNode(
      {
        attempts: [{ questionIdx: 0, isCorrect: true, attemptNo: 1, selectedIndex: 1 }],
        questions: [{ stem: "Q", choices: ["a"], correctIndex: 0, explanation: "", hint: "" }],
        lessonPlan: {
          overallDifficulty: "beginner",
          objectives: [{ title: "A", difficulty: "beginner", description: "d" }],
        },
      } as never,
      model as never,
    );
    expect(out.report).toContain("Tip");
  });
});
