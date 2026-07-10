import { describe, it, expect, vi } from "vitest";
import { getQuestionAnswer } from "@lessonbuild/db";
import { evaluateNode, routeAfterEvaluate } from "./evaluate";

vi.mock("@lessonbuild/db", () => ({
  recordAttempt: vi.fn(async () => {}),
  getQuestionAnswer: vi.fn(async () => ({ correctIndex: 1, explanation: "e" })),
}));

const baseState = {
  // Sanitized shape: state questions carry no correctIndex — the key comes
  // from the mocked DB lookup.
  questions: [{ stem: "Q", choices: ["a", "b"], hint: "h" }],
  questionIds: ["q-1"],
  currentQuestionIdx: 0,
  attempts: [] as { questionId: string }[],
};

describe("evaluateNode", () => {
  it("marks a correct answer using the DB answer key", async () => {
    const out = await evaluateNode({ ...baseState, lastSelectedIndex: 1 } as never);
    expect(vi.mocked(getQuestionAnswer)).toHaveBeenCalledWith("q-1");
    expect(out.attempts![0]).toMatchObject({
      questionId: "q-1",
      isCorrect: true,
      attemptNo: 1,
      selectedIndex: 1,
    });
  });
  it("marks an incorrect answer without penalty (retry allowed)", async () => {
    const out = await evaluateNode({ ...baseState, lastSelectedIndex: 0 } as never);
    expect(out.attempts![0]!.isCorrect).toBe(false);
    expect(routeAfterEvaluate({ ...baseState, attempts: out.attempts } as never)).toBe(
      "askQuestion",
    );
  });
  it("routes to advance after a correct answer", async () => {
    const out = await evaluateNode({ ...baseState, lastSelectedIndex: 1 } as never);
    expect(routeAfterEvaluate({ ...baseState, attempts: out.attempts } as never)).toBe("advance");
  });
  it("keys attempt counts by questionId, not the index", async () => {
    const out = await evaluateNode({
      ...baseState,
      attempts: [{ questionId: "other-q", selectedIndex: 0, isCorrect: false, attemptNo: 1 }],
      lastSelectedIndex: 1,
    } as never);
    expect(out.attempts![0]!.attemptNo).toBe(1);
  });
});
