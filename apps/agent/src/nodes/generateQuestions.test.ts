import { describe, it, expect, vi, beforeEach } from "vitest";
import { retrieveLessonContext, saveQuestion, getLesson } from "@lessonbuild/db";
import { generateQuestionsNode } from "./generateQuestions";

vi.mock("@lessonbuild/db", () => ({
  retrieveLessonContext: vi.fn(async () => "retrieved context"),
  saveQuestion: vi.fn(async (objectiveId: string) => `q-${objectiveId}`),
  getLesson: vi.fn(async () => ({ id: "L1", docText: "full doc from db", title: "T" })),
}));

beforeEach(() => {
  vi.mocked(retrieveLessonContext).mockClear();
  vi.mocked(retrieveLessonContext).mockResolvedValue("retrieved context");
  vi.mocked(saveQuestion).mockClear();
  vi.mocked(getLesson).mockClear();
});

const qA = { stem: "QA", choices: ["a", "b", "c"], correctIndex: 1, explanation: "eA", hint: "hA" };
const qB = { stem: "QB", choices: ["a", "b", "c"], correctIndex: 0, explanation: "eB", hint: "hB" };

const baseState = {
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

  it("retrieves document context for each objective", async () => {
    const invoke = vi.fn(async () => ({ parsed: validBatch, raw: {} }));
    const model = { withStructuredOutput: () => ({ invoke }) };
    await generateQuestionsNode(baseState as never, model as never);

    expect(vi.mocked(retrieveLessonContext)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(retrieveLessonContext)).toHaveBeenNthCalledWith(1, {
      lessonId: "L1",
      queryText: "A dA",
    });
    expect(invoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("Retrieved document context:\nObjective 1: A"),
        }),
      ]),
    );
  });

  it("falls back to the DB document when no chunks are available, loading it once", async () => {
    vi.mocked(retrieveLessonContext).mockResolvedValue("");
    const invoke = vi.fn(async () => ({ parsed: validBatch, raw: {} }));
    const model = { withStructuredOutput: () => ({ invoke }) };
    await generateQuestionsNode(baseState as never, model as never);

    expect(invoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining("Objective 1: A\nfull doc from db"),
        }),
      ]),
    );
    // One fetch covers every objective that needed the fallback.
    expect(vi.mocked(getLesson)).toHaveBeenCalledTimes(1);
  });

  it("never touches the DB document when retrieval finds chunks", async () => {
    const model = modelReturning({ parsed: validBatch, raw: {} });
    await generateQuestionsNode(baseState as never, model as never);
    expect(vi.mocked(getLesson)).not.toHaveBeenCalled();
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

  it("generates the configured number of questions per topic", async () => {
    const batch = { objectives: [{ questions: [qA, qA, qA] }, { questions: [qB] }] };
    const model = modelReturning({ parsed: batch, raw: {} });
    const out = await generateQuestionsNode(
      { ...baseState, questionCounts: [3, 1] } as never,
      model as never,
    );
    expect(out.questions!.map((q) => q.stem)).toEqual(["QA", "QA", "QA", "QB"]);
    expect(out.questionIds).toEqual(["q-obj-1", "q-obj-1", "q-obj-1", "q-obj-2"]);
  });

  it("rejects a batch whose per-topic sizes do not match the configured counts", async () => {
    const wrong = { objectives: [{ questions: [qA, qA] }, { questions: [qB] }] }; // wants [3, 1]
    const model = modelReturning({ parsed: null, raw: { tool_calls: [{ args: wrong }] } });
    await expect(
      generateQuestionsNode({ ...baseState, questionCounts: [3, 1] } as never, model as never),
    ).rejects.toThrow(/did not return a valid set of questions/);
  });

  it("skips zero-count topics entirely — no retrieval, no prompt entry, correct id mapping", async () => {
    const invoke = vi.fn<(messages: { content: string }[]) => Promise<unknown>>(async () => ({
      parsed: { objectives: [{ questions: [qB, qB] }] },
      raw: {},
    }));
    const model = { withStructuredOutput: () => ({ invoke }) };
    const out = await generateQuestionsNode(
      { ...baseState, questionCounts: [0, 2] } as never,
      model as never,
    );

    expect(out.questions!.map((q) => q.stem)).toEqual(["QB", "QB"]);
    expect(out.questionIds).toEqual(["q-obj-2", "q-obj-2"]);
    expect(vi.mocked(saveQuestion)).toHaveBeenCalledTimes(2);
    expect(vi.mocked(saveQuestion)).toHaveBeenNthCalledWith(1, "obj-2", qB);
    // Only the selected topic is retrieved and prompted.
    expect(vi.mocked(retrieveLessonContext)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(retrieveLessonContext)).toHaveBeenCalledWith({
      lessonId: "L1",
      queryText: "B dB",
    });
    const userMsg = (invoke.mock.calls[0]![0] as { content: string }[]).find((m) =>
      m.content.startsWith("Objectives:"),
    )!;
    expect(userMsg.content).not.toContain("A — dA");
    expect(userMsg.content).toContain("B — dB");
  });

  it("throws when every topic is skipped", async () => {
    const model = modelReturning({ parsed: null, raw: {} });
    await expect(
      generateQuestionsNode({ ...baseState, questionCounts: [0, 0] } as never, model as never),
    ).rejects.toThrow(/at least one topic/i);
  });
});
