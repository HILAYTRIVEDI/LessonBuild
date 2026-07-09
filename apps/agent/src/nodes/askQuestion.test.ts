import { describe, it, expect } from "vitest";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { LessonState } from "../state.js";
import { askQuestionNode } from "./askQuestion";

describe("askQuestionNode", () => {
  it("interrupts to ask the current question", async () => {
    const workflow = new StateGraph(LessonState)
      .addNode("askQuestion", askQuestionNode)
      .addEdge(START, "askQuestion")
      .addEdge("askQuestion", END);
    const graph = workflow.compile({ checkpointer: new MemorySaver() });
    const config = { configurable: { thread_id: "test-thread" } };

    await graph.invoke(
      {
        questions: [{ stem: "Q1", choices: ["a", "b"], correctIndex: 0, explanation: "e", hint: "h" }],
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
});
