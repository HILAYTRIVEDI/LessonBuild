import { describe, it, expect, vi, beforeEach } from "vitest";
import { saveQuestion } from "@lessonbuild/db";
import { generateQuestionsNode } from "./generateQuestions";

vi.mock("@lessonbuild/db", () => ({
  saveQuestion: vi.fn(async (objectiveId: string) => `q-${objectiveId}`),
}));

beforeEach(() => {
  vi.mocked(saveQuestion).mockClear();
});

const qA = { stem: "QA", choices: ["a", "b", "c"], correctIndex: 1, explanation: "eA", hint: "hA" };
const qB = { stem: "QB", choices: ["a", "b", "c"], correctIndex: 0, explanation: "eB", hint: "hB" };

const baseState = {
  docText: "t",
  lessonId: "L1",
  objectiveIds: ["obj-1", "obj-2"],
  lessonPlan: {
    overallDifficulty: "beginner",
    objectives: [
      { title: "A", difficulty: "beginner", description: "dA" },
      { title: "B", difficulty: "beginner", description: "dB" },
    ],
  },
};

const validBatch = { objectives: [{ questions: [qA, qA] }, { questions: [qB, qB] }] };

function modelReturning(raw: unknown) {
  return {
    withStructuredOutput: () => ({
      invoke: async () => raw,
    }),
  };
}

describe("generateQuestionsNode", () => {
  it("generates all objectives' questions in one call and flattens them in order", async () => {
    const model = modelReturning({ parsed: validBatch, raw: {} });
    const out = await generateQuestionsNode(baseState as never, model as never);
    expect(out.questions).toHaveLength(4);
    expect(out.questions!.map((q) => q.stem)).toEqual(["QA", "QA", "QB", "QB"]);
    expect(out.questionIds).toEqual(["q-obj-1", "q-obj-1", "q-obj-2", "q-obj-2"]);
    expect(out.currentQuestionIdx).toBe(0);
    // Full questions (with the answer key) are persisted per objective…
    expect(vi.mocked(saveQuestion)).toHaveBeenCalledTimes(4);
    expect(vi.mocked(saveQuestion)).toHaveBeenNthCalledWith(1, "obj-1", qA);
    expect(vi.mocked(saveQuestion)).toHaveBeenNthCalledWith(3, "obj-2", qB);
  });

  it("returns sanitized questions — no correctIndex or explanation in state", async () => {
    const model = modelReturning({ parsed: validBatch, raw: {} });
    const out = await generateQuestionsNode(baseState as never, model as never);
    for (const q of out.questions!) {
      expect(q).not.toHaveProperty("correctIndex");
      expect(q).not.toHaveProperty("explanation");
      expect(q).toHaveProperty("hint");
    }
  });

  it("recovers when the model double-wraps the batch (parsed null, raw nested)", async () => {
    const model = modelReturning({
      parsed: null,
      raw: { tool_calls: [{ args: { questions: validBatch } }] },
    });
    const out = await generateQuestionsNode(baseState as never, model as never);
    expect(out.questions).toHaveLength(4);
  });

  it("treats an objective-count mismatch as a parse failure", async () => {
    const short = { objectives: [{ questions: [qA, qA] }] }; // 1 batch for 2 objectives
    const model = modelReturning({ parsed: null, raw: { tool_calls: [{ args: short }] } });
    await expect(generateQuestionsNode(baseState as never, model as never)).rejects.toThrow(
      /did not return a valid set of questions/,
    );
  });

  it("throws a clear error when nothing valid can be recovered", async () => {
    const model = modelReturning({ parsed: null, raw: { tool_calls: [{ args: { junk: 1 } }] } });
    await expect(generateQuestionsNode(baseState as never, model as never)).rejects.toThrow(
      /did not return a valid set of questions/,
    );
  });
});
