import { getLesson } from "@lessonbuild/db";
import type { LessonStateType } from "../state.js";

/**
 * Entry node: the web app writes the uploaded PDF's text to Postgres and hands
 * the agent only the `lessonId`. Hydrate loads the source document from the DB
 * so `plan` (and every downstream node) works over the real text rather than the
 * empty-string default. DB is the single source of truth for the document.
 */
export async function hydrateNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  // Idempotent: if a prior turn already loaded the text, don't re-fetch.
  if (state.docText.length > 0) return {};

  const lessonId = state.lessonId.trim();
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

  return { docText: lesson.docText };
}
