import { StateGraph, START, END } from "@langchain/langgraph";
import type { BaseCheckpointSaver } from "@langchain/langgraph";
import { LessonState } from "./state.js";

// Nodes are added in later tasks; start with a pass-through so wiring is testable.
export function buildGraph(checkpointer?: BaseCheckpointSaver) {
  const workflow = new StateGraph(LessonState)
    .addNode("noop", async (state) => ({ docText: state.docText }))
    .addEdge(START, "noop")
    .addEdge("noop", END);
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
