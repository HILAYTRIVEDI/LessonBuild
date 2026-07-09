import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { LessonState } from "./state.js";
import { planNode } from "./nodes/plan.js";
import { approvePlanNode } from "./nodes/approvePlan.js";
import { generateQuestionsNode } from "./nodes/generateQuestions.js";
import { askQuestionNode } from "./nodes/askQuestion.js";
import { evaluateNode, routeAfterEvaluate } from "./nodes/evaluate.js";

// The `advance` node is added in a later task; route to END there for now.
export function buildGraph(checkpointer?: BaseCheckpointSaver) {
  const workflow = new StateGraph(LessonState)
    .addNode("plan", (state) => planNode(state))
    .addNode("approvePlan", approvePlanNode)
    .addNode("generateQuestions", (state) => generateQuestionsNode(state))
    .addNode("askQuestion", askQuestionNode)
    .addNode("evaluate", evaluateNode)
    .addEdge(START, "plan")
    .addEdge("plan", "approvePlan")
    .addEdge("approvePlan", "generateQuestions")
    .addEdge("generateQuestions", "askQuestion")
    .addEdge("askQuestion", "evaluate")
    .addConditionalEdges("evaluate", routeAfterEvaluate, { advance: END, askQuestion: "askQuestion" });
  return workflow.compile(checkpointer ? { checkpointer } : undefined);
}

// Exported for langgraph.json / CopilotKit runtime. Uses Postgres checkpointer when available.
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
let _checkpointer: PostgresSaver | undefined;
const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl) {
  _checkpointer = PostgresSaver.fromConnString(databaseUrl);
  await _checkpointer.setup();
}
export const graph = buildGraph(_checkpointer);
