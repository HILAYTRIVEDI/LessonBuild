import { describe, it, expect, vi } from "vitest";
import { generateQuestionsNode } from "./generateQuestions";

vi.mock("@lessonbuild/db", () => ({ saveQuestion: vi.fn(async () => "q-id") }));

describe("generateQuestionsNode", () => {
  it("generates and persists MCQs for the current objective", async () => {
    const q = { stem: "Q", choices: ["a", "b", "c"], correctIndex: 1, explanation: "e", hint: "h" };
    const model = { withStructuredOutput: () => ({ invoke: async () => ({ questions: [q, q] }) }) };
    const state = {
      docText: "t",
      lessonId: "L1",
      currentObjectiveIdx: 0,
      objectiveIds: ["obj-1"],
      lessonPlan: {
        overallDifficulty: "beginner",
        objectives: [{ title: "A", difficulty: "beginner", description: "d" }],
      },
    };
    const out = await generateQuestionsNode(state as never, model as never);
    expect(out.questions).toHaveLength(2);
    expect(out.questionIds).toEqual(["q-id", "q-id"]);
    expect(out.currentQuestionIdx).toBe(0);
  });
});
