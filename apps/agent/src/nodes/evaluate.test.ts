import { describe, it, expect, vi } from "vitest";
import { evaluateNode, routeAfterEvaluate } from "./evaluate";

vi.mock("@lessonbuild/db", () => ({ recordAttempt: vi.fn(async () => {}) }));

const baseState = {
  questions: [{ stem: "Q", choices: ["a", "b"], correctIndex: 1, explanation: "e", hint: "h" }],
  questionIds: ["q-1"],
  currentQuestionIdx: 0,
  attempts: [] as { questionIdx: number }[],
};

describe("evaluateNode", () => {
  it("marks a correct answer and increments attempt number", async () => {
    const out = await evaluateNode({ ...baseState, lastSelectedIndex: 1 } as never);
    expect(out.attempts![0]).toMatchObject({ isCorrect: true, attemptNo: 1, selectedIndex: 1 });
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
});
