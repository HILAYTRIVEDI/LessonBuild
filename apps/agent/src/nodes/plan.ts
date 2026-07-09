import { LessonPlanSchema } from "@lessonbuild/shared";
import { saveObjectives } from "@lessonbuild/db";
import { getModel } from "../model.js";
import type { LessonStateType } from "../state.js";

const SYSTEM = `You are an expert instructional designer. Read the document and propose a
concise learning plan: 3-6 objectives ordered from foundational to advanced, each with a
title, difficulty, and one-sentence description. Base everything strictly on the document.`;

export async function planNode(
  state: LessonStateType,
  model = getModel(),
): Promise<Partial<LessonStateType>> {
  const structured = model.withStructuredOutput(LessonPlanSchema);
  const lessonPlan = await structured.invoke([
    { role: "system", content: SYSTEM },
    { role: "user", content: `Document:\n\n${state.docText}` },
  ]);
  const objectiveIds = await saveObjectives(state.lessonId, lessonPlan.objectives);
  return { lessonPlan, objectiveIds };
}
