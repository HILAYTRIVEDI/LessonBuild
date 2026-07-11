import { retrieveLessonContext } from "@lessonbuild/db";
import { NextResponse } from "next/server";
import {
  AiMlChatCompletionSchema,
  COACH_SYSTEM_PROMPT,
  CoachRequestSchema,
  CoachResponseSchema,
  buildCoachUserContext,
} from "@/lib/coach";

export const runtime = "nodejs";

async function parseRequest(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function loadLessonContext(lessonId: string | null, queryText: string): Promise<string> {
  if (!lessonId) return "";
  return retrieveLessonContext({ lessonId, queryText, limit: 4 });
}

export async function POST(req: Request) {
  const parsed = CoachRequestSchema.safeParse(await parseRequest(req));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid coach request." }, { status: 400 });
  }

  const apiKey = process.env["AIMLAPI_KEY"];
  if (!apiKey) {
    return NextResponse.json({ error: "Lesson Coach is missing AIMLAPI_KEY." }, { status: 503 });
  }

  const { message, lessonId, activeQuestion, history } = parsed.data;
  const lessonContext = await loadLessonContext(lessonId, `${activeQuestion?.stem ?? ""}\n${message}`);
  const response = await fetch("https://api.aimlapi.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env["LLM_MODEL"] ?? "claude-sonnet-5",
      messages: [
        { role: "system", content: COACH_SYSTEM_PROMPT },
        ...history,
        {
          role: "user",
          content: buildCoachUserContext({ lessonContext, activeQuestion, message }),
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "Lesson Coach could not respond." }, { status: 502 });
  }

  const completion = AiMlChatCompletionSchema.safeParse(await response.json());
  if (!completion.success) {
    return NextResponse.json({ error: "Lesson Coach response was malformed." }, { status: 502 });
  }

  const reply = completion.data.choices[0]!.message.content.trim();
  const body = CoachResponseSchema.parse({ reply });
  return NextResponse.json(body);
}
