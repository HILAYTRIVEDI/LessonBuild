import { describe, it, expect, vi } from "vitest";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { LessonState } from "../state.js";
import { askQuestionNode, routeAfterAskQuestion } from "./askQuestion";

vi.mock("@lessonbuild/db", () => ({
  getQuestionAnswer: vi.fn(async () => ({ correctIndex: 0, explanation: "db-explanation" })),
}));

function buildTestGraph() {
  const workflow = new StateGraph(LessonState)
    .addNode("askQuestion", askQuestionNode)
    .addEdge(START, "askQuestion")
    .addEdge("askQuestion", END);
  return workflow.compile({ checkpointer: new MemorySaver() });
}

// Sanitized state shape: no correctIndex/explanation on state questions.
const q1 = { stem: "Q1", choices: ["a", "b"], hint: "h" };
const q2 = { stem: "Q2", choices: ["c", "d"], hint: "h2" };

describe("askQuestionNode", () => {
  it("interrupts with the current question and total count", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "test-thread" } };

    await graph.invoke(
      { questions: [q1, q2], questionIds: ["q-1", "q-2"], currentQuestionIdx: 0 } as never,
      config,
    );

    const state = await graph.getState(config);
    expect(state.tasks[0]?.interrupts[0]?.value).toMatchObject({
      type: "ask_mcq",
      stem: "Q1",
      choices: ["a", "b"],
      questionIdx: 0,
      totalQuestions: 2,
    });
  });

  it("does not attach feedback from a different question", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "test-thread-2" } };

    await graph.invoke(
      {
        questions: [q1],
        questionIds: ["q-1"],
        currentQuestionIdx: 0,
        attempts: [{ questionId: "other-q", selectedIndex: 0, isCorrect: true, attemptNo: 1 }],
      } as never,
      config,
    );

    const state = await graph.getState(config);
    const value = state.tasks[0]?.interrupts[0]?.value as { feedback?: unknown };
    expect(value.feedback).toBeUndefined();
  });

  it("attaches retry feedback from the state hint without leaking the correct index", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "test-thread-3" } };

    await graph.invoke(
      {
        questions: [q1],
        questionIds: ["q-1"],
        currentQuestionIdx: 0,
        attempts: [{ questionId: "q-1", selectedIndex: 1, isCorrect: false, attemptNo: 1 }],
      } as never,
      config,
    );

    const state = await graph.getState(config);
    const value = state.tasks[0]?.interrupts[0]?.value as { feedback?: Record<string, unknown> };
    expect(value.feedback).toMatchObject({ selectedIndex: 1, isCorrect: false, text: "h" });
    expect(value.feedback).not.toHaveProperty("correctIndex");
  });

  it("fetches the post-correct explanation from the DB (it is not in state)", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "test-thread-4" } };

    await graph.invoke(
      {
        questions: [q1],
        questionIds: ["q-1"],
        currentQuestionIdx: 0,
        attempts: [{ questionId: "q-1", selectedIndex: 0, isCorrect: true, attemptNo: 1 }],
      } as never,
      config,
    );

    const state = await graph.getState(config);
    const value = state.tasks[0]?.interrupts[0]?.value as { feedback?: Record<string, unknown> };
    expect(value.feedback).toMatchObject({ isCorrect: true, text: "db-explanation" });
  });

  it("routes to advance only after the learner continues from correct feedback", () => {
    expect(routeAfterAskQuestion({ readyToAdvance: true } as never)).toBe("advance");
    expect(routeAfterAskQuestion({ readyToAdvance: false } as never)).toBe("evaluate");
  });
});
