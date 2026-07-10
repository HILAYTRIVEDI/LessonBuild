import { describe, it, expect, vi } from "vitest";
import { evaluateNode, routeAfterEvaluate } from "./evaluate";

vi.mock("@lessonbuild/db", () => ({ recordAttempt: vi.fn(async () => {}) }));

const baseState = {
  questions: [{ stem: "Q", choices: ["a", "b"], correctIndex: 1, explanation: "e", hint: "h" }],
  questionIds: ["q-1"],
  currentQuestionIdx: 0,
  attempts: [] as { questionId: string }[],
};

describe("evaluateNode", () => {
  it("marks a correct answer and increments attempt number", async () => {
    const out = await evaluateNode({ ...baseState, lastSelectedIndex: 1 } as never);
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
  it("keys attempt counts by questionId, not the per-objective index", async () => {
    // A prior attempt on a *different* question that happened to sit at the
    // same index (previous objective's batch) must not inflate attemptNo.
    const out = await evaluateNode({
      ...baseState,
      attempts: [{ questionId: "other-q", selectedIndex: 0, isCorrect: false, attemptNo: 1 }],
      lastSelectedIndex: 1,
    } as never);
    expect(out.attempts![0]!.attemptNo).toBe(1);
  });
});
