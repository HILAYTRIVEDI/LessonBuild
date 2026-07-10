import { describe, it, expect, vi } from "vitest";
import { generateQuestionsNode } from "./generateQuestions";

vi.mock("@lessonbuild/db", () => ({ saveQuestion: vi.fn(async () => "q-id") }));

const q = { stem: "Q", choices: ["a", "b", "c"], correctIndex: 1, explanation: "e", hint: "h" };

const baseState = {
  docText: "t",
  lessonId: "L1",
  currentObjectiveIdx: 0,
  objectiveIds: ["obj-1"],
  lessonPlan: {
    overallDifficulty: "beginner",
    objectives: [{ title: "A", difficulty: "beginner", description: "d" }],
  },
};

function modelReturning(raw: unknown) {
  return {
    withStructuredOutput: () => ({
      invoke: async () => raw,
    }),
  };
}

describe("generateQuestionsNode", () => {
  it("generates and persists MCQs for the current objective", async () => {
    const model = modelReturning({ parsed: { questions: [q, q] }, raw: {} });
    const out = await generateQuestionsNode(baseState as never, model as never);
    expect(out.questions).toHaveLength(2);
    expect(out.questionIds).toEqual(["q-id", "q-id"]);
    expect(out.currentQuestionIdx).toBe(0);
  });

  it("recovers when the model double-wraps the batch (parsed is null, raw is nested)", async () => {
    // Reproduces the observed failure: the model emitted
    // { questions: { questions: [...] } }, so structured parsing yields
    // parsed=null and the valid pair is nested one key deep in the tool args.
    const model = modelReturning({
      parsed: null,
      raw: { tool_calls: [{ args: { questions: { questions: [q, q] } } }] },
    });
    const out = await generateQuestionsNode(baseState as never, model as never);
    expect(out.questions).toHaveLength(2);
    expect(out.questionIds).toEqual(["q-id", "q-id"]);
  });

  it("throws a clear error when no valid questions can be recovered", async () => {
    const model = modelReturning({ parsed: null, raw: { tool_calls: [{ args: { junk: true } }] } });
    await expect(generateQuestionsNode(baseState as never, model as never)).rejects.toThrow(
      /did not return a valid pair of questions/,
    );
  });
});
