import { describe, it, expect } from "vitest";
import { computeScore, summarizeNode } from "./summarize";

describe("computeScore", () => {
  it("computes first-try accuracy over distinct questions", () => {
    const attempts = [
      { questionId: "q-1", isCorrect: true, attemptNo: 1, selectedIndex: 1 },
      { questionId: "q-2", isCorrect: false, attemptNo: 1, selectedIndex: 0 },
      { questionId: "q-2", isCorrect: true, attemptNo: 2, selectedIndex: 1 },
    ];
    const score = computeScore(attempts as never);
    expect(score.firstTryCorrect).toBe(1);
    expect(score.total).toBe(2);
  });

  it("counts questions across objectives, not just the current batch", () => {
    // Two objectives × two questions each; state.questions would only hold the
    // last batch (2), but the score must cover all four attempted questions.
    const attempts = [
      { questionId: "o1-q1", isCorrect: true, attemptNo: 1, selectedIndex: 0 },
      { questionId: "o1-q2", isCorrect: true, attemptNo: 1, selectedIndex: 1 },
      { questionId: "o2-q1", isCorrect: false, attemptNo: 1, selectedIndex: 0 },
      { questionId: "o2-q1", isCorrect: true, attemptNo: 2, selectedIndex: 1 },
      { questionId: "o2-q2", isCorrect: true, attemptNo: 1, selectedIndex: 0 },
    ];
    const score = computeScore(attempts as never);
    expect(score.total).toBe(4);
    expect(score.firstTryCorrect).toBe(3);
  });
});

describe("summarizeNode", () => {
  it("produces a report string with study tips", async () => {
    const model = { invoke: async () => ({ content: "Tip: review objective 2." }) };
    const out = await summarizeNode(
      {
        attempts: [{ questionId: "q-1", isCorrect: true, attemptNo: 1, selectedIndex: 1 }],
        questions: [{ stem: "Q", choices: ["a"], correctIndex: 0, explanation: "", hint: "" }],
        lessonPlan: {
          overallDifficulty: "beginner",
          objectives: [{ title: "A", difficulty: "beginner", description: "d" }],
        },
      } as never,
      model as never,
    );
    expect(out.report).toContain("Tip");
    expect(out.report).toContain("1/1");
  });
});
