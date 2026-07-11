import { CopilotRuntime, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import { LangGraphAgent } from "@copilotkit/runtime/langgraph";
import { NextRequest } from "next/server";
import { z } from "zod";
import { LESSON_KEY } from "@/lib/session";

const LessonIdSchema = z.string().uuid();

/** CopilotKit runtime proxy needs Node APIs for LangGraph networking. */
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

function withTopLevelLessonId(
  value: Record<string, unknown>,
  lessonId: string,
): Record<string, unknown> {
  if (hasSelectedLesson(value)) return value;
  return {
    ...value,
    lessonId,
  };
}

function withLessonState(
  value: Record<string, unknown>,
  lessonId: string,
): Record<string, unknown> {
  const withTopLevel = withTopLevelLessonId(value, lessonId);
  const state = isRecord(withTopLevel["state"]) ? withTopLevel["state"] : {};
  if (hasSelectedLesson(state)) return withTopLevel;
  return {
    ...withTopLevel,
    state: {
      ...state,
      lessonId,
    },
  };
}

function withGraphqlLessonState(
  value: Record<string, unknown>,
  lessonId: string,
): Record<string, unknown> {
  let nextValue = value;
  const data = value["data"];
  if (isRecord(data)) {
    nextValue = {
      ...nextValue,
      data: withLessonState(data, lessonId),
    };
  }
  const input = value["input"];
  if (isRecord(input)) {
    nextValue = {
      ...nextValue,
      input: withLessonState(input, lessonId),
    };
  }
  const state = isRecord(value["state"]) ? value["state"] : {};
  if (!hasSelectedLesson(state)) {
    nextValue = {
      ...nextValue,
      state: {
        ...state,
        lessonId,
      },
    };
  }
  return nextValue;
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

  let nextBody = withLessonState(body, lessonId);
  const input = body["input"];
  if (isRecord(input)) {
    nextBody = {
      ...nextBody,
      input: withLessonState(input, lessonId),
    };
  }
  const variables = body["variables"];
  if (isRecord(variables)) {
    nextBody = {
      ...nextBody,
      variables: withGraphqlLessonState(variables, lessonId),
    };
  }

  // Some LangGraph clients merge agent state from top-level `input` and not the
  // nested `state` object. Mirror the lesson id there as well so hydrate never
  // misses it.
  nextBody = withTopLevelLessonId(nextBody, lessonId);

  const headers = new Headers(req.headers);
  headers.delete("content-length");

  return new Request(req.url, {
    method: req.method,
    headers,
    body: JSON.stringify(nextBody),
  });
}

/**
 * Proxies CopilotKit requests to LangGraph after threading the selected lesson
 * id into every request shape the runtime may inspect.
 */
export const POST = async (req: NextRequest) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: runtimeInstance,
    endpoint: "/api/copilotkit",
  });
  return handleRequest(await withSelectedLesson(req));
};
