import { describe, it, expect } from "vitest";
import { StateGraph, START, END, MemorySaver } from "@langchain/langgraph";
import { LessonState } from "../state.js";
import { approvePlanNode } from "./approvePlan";

describe("approvePlanNode", () => {
  it("interrupts to request human approval", async () => {
    const workflow = new StateGraph(LessonState)
      .addNode("approvePlan", approvePlanNode)
      .addEdge(START, "approvePlan")
      .addEdge("approvePlan", END);
    const graph = workflow.compile({ checkpointer: new MemorySaver() });
    const config = { configurable: { thread_id: "test-thread" } };

    await graph.invoke({ lessonPlan: { overallDifficulty: "beginner", objectives: [] } }, config);

    const state = await graph.getState(config);
    expect(state.tasks[0]?.interrupts[0]?.value).toMatchObject({ type: "approve_plan" });
  });
});
