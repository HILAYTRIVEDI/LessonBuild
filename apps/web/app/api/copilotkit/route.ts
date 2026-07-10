import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";
import { z } from "zod";
import { LESSON_KEY } from "@/lib/session";

const LessonIdSchema = z.string().uuid();

export const runtime = "nodejs";

const runtimeInstance = new CopilotRuntime({
  agents: {
    lesson: new LangGraphAgent({
      deploymentUrl: process.env["LANGGRAPH_URL"] ?? "http://localhost:2024",
      graphId: "lesson",
    }),
  },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasSelectedLesson(state: Record<string, unknown>): boolean {
  return typeof state["lessonId"] === "string" && state["lessonId"].trim().length > 0;
}

async function withSelectedLesson(req: NextRequest): Promise<Request> {
  // The cookie is attacker-controlled input — only forward it into agent
  // state when it looks like a lesson id we could have minted.
  const cookie = LessonIdSchema.safeParse(req.cookies.get(LESSON_KEY)?.value);
  if (!cookie.success) return req;
  const lessonId = cookie.data;

  let body: unknown;
  try {
    body = await req.clone().json();
  } catch {
    return req;
  }
  if (!isRecord(body)) return req;

  const state = isRecord(body["state"]) ? body["state"] : {};
  if (hasSelectedLesson(state)) return req;

  const headers = new Headers(req.headers);
  headers.delete("content-length");

  return new Request(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify({
      ...body,
      state: {
        ...state,
        lessonId,
      },
    }),
  });
}

export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: runtimeInstance,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(await withSelectedLesson(req));
};
