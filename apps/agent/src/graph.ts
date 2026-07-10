import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { LessonState } from "./state.js";
import { hydrateNode } from "./nodes/hydrate.js";
import { planNode } from "./nodes/plan.js";
import { approvePlanNode, routeAfterApprove } from "./nodes/approvePlan.js";
import { generateQuestionsNode } from "./nodes/generateQuestions.js";
import { askQuestionNode, routeAfterAskQuestion } from "./nodes/askQuestion.js";
import { evaluateNode, routeAfterEvaluate } from "./nodes/evaluate.js";
import { advanceNode, routeAfterAdvance } from "./nodes/advance.js";
import { summarizeNode } from "./nodes/summarize.js";

export function buildGraph(checkpointer?: BaseCheckpointSaver) {
  const workflow = new StateGraph(LessonState)
    .addNode("hydrate", (state) => hydrateNode(state))
    .addNode("plan", (state) => planNode(state))
    .addNode("approvePlan", approvePlanNode)
    .addNode("generateQuestions", (state) => generateQuestionsNode(state))
    .addNode("askQuestion", askQuestionNode)
    .addNode("evaluate", evaluateNode)
    .addNode("advance", advanceNode)
    .addNode("summarize", (state) => summarizeNode(state))
    .addEdge(START, "hydrate")
    .addEdge("hydrate", "plan")
    .addEdge("plan", "approvePlan")
    .addConditionalEdges("approvePlan", routeAfterApprove, {
      plan: "plan",
      generateQuestions: "generateQuestions",
    })
    .addEdge("generateQuestions", "askQuestion")
    .addConditionalEdges("askQuestion", routeAfterAskQuestion, {
      advance: "advance",
      evaluate: "evaluate",
    })
    .addConditionalEdges("evaluate", routeAfterEvaluate, {
      askQuestion: "askQuestion",
    })
    // Generation runs exactly once, right after plan approval — advance only
    // walks the pre-generated global question list.
    .addConditionalEdges("advance", routeAfterAdvance, {
      askQuestion: "askQuestion",
      summarize: "summarize",
    })
    .addEdge("summarize", END);
  return workflow.compile(checkpointer ? { checkpointer } : undefined);
}

// Exported for langgraph.json / CopilotKit runtime. Uses Postgres checkpointer when available.
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
let _checkpointer: PostgresSaver | undefined;
const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl) {
  _checkpointer = PostgresSaver.fromConnString(databaseUrl);
}
export const graph = buildGraph(_checkpointer);
