import { describe, it, expect } from "vitest";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { LessonState } from "../state.js";
import { askQuestionNode } from "./askQuestion";

function buildTestGraph() {
  const workflow = new StateGraph(LessonState)
    .addNode("askQuestion", askQuestionNode)
    .addEdge(START, "askQuestion")
    .addEdge("askQuestion", END);
  return workflow.compile({ checkpointer: new MemorySaver() });
}

describe("askQuestionNode", () => {
  it("interrupts to ask the current question", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "test-thread" } };

    await graph.invoke(
      {
        questions: [
          { stem: "Q1", choices: ["a", "b"], correctIndex: 0, explanation: "e", hint: "h" },
        ],
        questionIds: ["q-1"],
        currentQuestionIdx: 0,
      },
      config,
    );

    const state = await graph.getState(config);
    expect(state.tasks[0]?.interrupts[0]?.value).toMatchObject({
      type: "ask_mcq",
      stem: "Q1",
      choices: ["a", "b"],
      questionIdx: 0,
    });
  });

  it("does not attach feedback from a different question at the same index", async () => {
    // Regression for the objective-transition deadlock: after objective 1's
    // last question (idx 0 of a new batch), a correct attempt on the *old*
    // question must not surface as feedback — the old code matched on
    // questionIdx and served a fresh question in a locked, feedback state.
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "test-thread-2" } };

    await graph.invoke(
      {
        questions: [
          { stem: "Q-obj2", choices: ["a", "b"], correctIndex: 0, explanation: "e", hint: "h" },
        ],
        questionIds: ["obj2-q1"],
        currentQuestionIdx: 0,
        attempts: [{ questionId: "obj1-q1", selectedIndex: 0, isCorrect: true, attemptNo: 1 }],
      },
      config,
    );

    const state = await graph.getState(config);
    const value = state.tasks[0]?.interrupts[0]?.value as { feedback?: unknown };
    expect(value.feedback).toBeUndefined();
  });

  it("attaches retry feedback without leaking the correct index", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "test-thread-3" } };

    await graph.invoke(
      {
        questions: [
          { stem: "Q1", choices: ["a", "b"], correctIndex: 0, explanation: "e", hint: "h" },
        ],
        questionIds: ["q-1"],
        currentQuestionIdx: 0,
        attempts: [{ questionId: "q-1", selectedIndex: 1, isCorrect: false, attemptNo: 1 }],
      },
      config,
    );

    const state = await graph.getState(config);
    const value = state.tasks[0]?.interrupts[0]?.value as { feedback?: Record<string, unknown> };
    expect(value.feedback).toMatchObject({ selectedIndex: 1, isCorrect: false, text: "h" });
    expect(value.feedback).not.toHaveProperty("correctIndex");
  });
});
