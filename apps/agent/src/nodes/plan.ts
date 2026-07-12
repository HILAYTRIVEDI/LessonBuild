import { LessonPlanSchema, type LessonPlan } from "@lessonbuild/shared";
import { saveObjectives, getLesson } from "@lessonbuild/db";
import { getModel } from "../model.js";
import { PLAN_SYSTEM } from "../prompts.js";
import type { LessonStateType } from "../state.js";

/**
 * Accepts the plan either at the top level or nested one key deep; some models
 * wrap the tool arguments in an extra object (e.g. `{ "objectives": { ...plan } }`).
 *
 * @param value Raw model output or tool arguments.
 * @return Parsed lesson plan, or null when the shape is invalid.
 */
function coerceLessonPlan(value: unknown): LessonPlan | null {
  const direct = LessonPlanSchema.safeParse(value);
  if (direct.success) return direct.data;
  if (typeof value === "object" && value !== null) {
    for (const nested of Object.values(value)) {
      const parsed = LessonPlanSchema.safeParse(nested);
      if (parsed.success) return parsed.data;
    }
  }
  return null;
}

function rawToolArgs(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null || !("tool_calls" in raw)) return null;
  const calls = (raw as { tool_calls: unknown }).tool_calls;
  if (!Array.isArray(calls) || calls.length === 0) return null;
  const first: unknown = calls[0];
  if (typeof first !== "object" || first === null || !("args" in first)) return null;
  return (first as { args: unknown }).args;
}

/**
 * Generates or revises the lesson plan from the source document.
 *
 * @param state Current lesson graph state with lesson id and optional feedback.
 * @param model Chat model used for structured plan generation.
 * @return Partial state containing the lesson plan and objective ids.
 */
export async function planNode(
  state: LessonStateType,
  model = getModel(),
): Promise<Partial<LessonStateType>> {
  if (!state.lessonId) {
    throw new Error("No lesson selected yet — upload a PDF before starting the lesson.");
  }

  const lesson = await getLesson(state.lessonId);
  if (!lesson) throw new Error(`Lesson ${state.lessonId} not found.`);
  const docText = lesson.docText;
  const structured = model.withStructuredOutput(LessonPlanSchema, {
    name: "lesson_plan",
    includeRaw: true,
  });
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: PLAN_SYSTEM },
    { role: "user", content: `Document:\n\n${docText}` },
  ];
  if (state.planFeedback && state.lessonPlan) {
    messages.push({
      role: "user",
      content: `You previously proposed this plan:\n${JSON.stringify(state.lessonPlan, null, 2)}\n\nThe learner asked for changes: ${state.planFeedback}\n\nPropose a revised plan.`,
    });
  }
  let lessonPlan: LessonPlan | null = null;
  for (let attempt = 0; attempt < 2 && lessonPlan === null; attempt++) {
    const result = await structured.invoke(messages);
    lessonPlan = result.parsed ?? coerceLessonPlan(rawToolArgs(result.raw));
  }
  if (lessonPlan === null) {
    throw new Error("The model did not return a valid lesson plan. Please try again.");
  }
  const objectiveIds = await saveObjectives(state.lessonId, lessonPlan.objectives);
  return { lessonPlan, objectiveIds, planFeedback: null };
}
