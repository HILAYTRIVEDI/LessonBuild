import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const runtimeInstance = new CopilotRuntime({
  agents: {
    lesson: new LangGraphAgent({
      deploymentUrl: process.env["LANGGRAPH_URL"] ?? "http://localhost:2024",
      graphId: "lesson",
    }),
  },
});

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: runtimeInstance,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(req);
};
