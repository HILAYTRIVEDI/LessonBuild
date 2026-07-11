import { describe, it, expect } from "vitest";
import { StateGraph, START, END, MemorySaver, Command } from "@langchain/langgraph";
import { LessonState, type LessonStateType } from "../state.js";
import { approvePlanNode, routeAfterApprove } from "./approvePlan";

const plan = {
  overallDifficulty: "beginner" as const,
  objectives: [{ title: "A", difficulty: "beginner" as const, description: "d" }],
};

const twoTopicPlan = {
  overallDifficulty: "beginner" as const,
  objectives: [
    { title: "A", difficulty: "beginner" as const, description: "dA" },
    { title: "B", difficulty: "beginner" as const, description: "dB" },
  ],
};

function buildTestGraph() {
  const workflow = new StateGraph(LessonState)
    .addNode("approvePlan", approvePlanNode)
    .addEdge(START, "approvePlan")
    .addEdge("approvePlan", END);
  return workflow.compile({ checkpointer: new MemorySaver() });
}

describe("approvePlanNode", () => {
  it("interrupts to request human approval", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "t-1" } };

    await graph.invoke({ lessonPlan: plan }, config);

    const state = await graph.getState(config);
    expect(state.tasks[0]?.interrupts[0]?.value).toMatchObject({ type: "approve_plan" });
  });

  it("marks the plan approved on an approve resume", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "t-2" } };

    await graph.invoke({ lessonPlan: plan }, config);
    const out = await graph.invoke(new Command({ resume: { approved: true } }), config);

    expect(out.planApproved).toBe(true);
    expect(out.planFeedback).toBeNull();
  });

  it("stores the learner's change request on a rejection resume", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "t-3" } };

    await graph.invoke({ lessonPlan: plan }, config);
    const out = await graph.invoke(
      new Command({ resume: { approved: false, feedback: "fewer objectives" } }),
      config,
    );

    expect(out.planApproved).toBe(false);
    expect(out.planFeedback).toBe("fewer objectives");
  });

  it("rejects a malformed resume payload instead of trusting it", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "t-4" } };

    await graph.invoke({ lessonPlan: plan }, config);

    await expect(
      graph.invoke(new Command({ resume: { approved: "yes" } }), config),
    ).rejects.toThrow();
  });

  it("stores per-topic question counts from the approval", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "t-5" } };

    await graph.invoke({ lessonPlan: twoTopicPlan }, config);
    const out = await graph.invoke(
      new Command({ resume: { approved: true, questionCounts: [3, 0] } }),
      config,
    );

    expect(out.planApproved).toBe(true);
    expect(out.questionCounts).toEqual([3, 0]);
  });

  it("defaults to 2 questions per topic when the approval omits counts", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "t-6" } };

    await graph.invoke({ lessonPlan: twoTopicPlan }, config);
    const out = await graph.invoke(new Command({ resume: { approved: true } }), config);

    expect(out.questionCounts).toEqual([2, 2]);
  });

  it("rejects counts whose length does not match the plan", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "t-7" } };

    await graph.invoke({ lessonPlan: twoTopicPlan }, config);

    await expect(
      graph.invoke(new Command({ resume: { approved: true, questionCounts: [2] } }), config),
    ).rejects.toThrow(/questionCounts/);
  });

  it("ignores counts on a rejection resume", async () => {
    const graph = buildTestGraph();
    const config = { configurable: { thread_id: "t-8" } };

    await graph.invoke({ lessonPlan: twoTopicPlan }, config);
    const out = await graph.invoke(
      new Command({ resume: { approved: false, feedback: "redo", questionCounts: [5, 5] } }),
      config,
    );

    expect(out.questionCounts).toEqual([]);
  });
});

describe("routeAfterApprove", () => {
  it("routes back to plan on rejection and forward on approval", () => {
    expect(routeAfterApprove({ planApproved: false } as LessonStateType)).toBe("plan");
    expect(routeAfterApprove({ planApproved: true } as LessonStateType)).toBe("generateQuestions");
  });
});
