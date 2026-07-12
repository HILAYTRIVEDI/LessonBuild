import { getLesson } from "@lessonbuild/db";
import type { LessonStateType } from "../state.js";

/**
 * Entry node: the web app writes the uploaded PDF's text to Postgres and hands
 * the agent only the `lessonId`. Hydrate validates that the lesson exists and
 * has extracted text, but never copies the document into graph state — state is
 * checkpointed per thread and streamed to the browser, so nodes that need the
 * text (plan, generateQuestions fallback) read it from the DB instead.
 *
 * @param state Current lesson graph state.
 * @return Empty partial state; this node only validates.
 */
export async function hydrateNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  // Once a plan exists the lesson was already validated on a prior turn.
  if (state.lessonPlan) return {};

  const lessonId = typeof state.lessonId === "string" ? state.lessonId.trim() : "";
  if (!lessonId) {
    throw new Error("hydrate: missing lessonId — upload a PDF before starting the lesson.");
  }

  const lesson = await getLesson(lessonId);
  if (!lesson) {
    throw new Error(`hydrate: lesson "${lessonId}" not found.`);
  }
  if (lesson.docText.trim().length === 0) {
    throw new Error(`hydrate: lesson "${lessonId}" has no extracted text.`);
  }

  return {};
}
