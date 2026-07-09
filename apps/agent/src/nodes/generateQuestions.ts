import { z } from "zod";
import { McqSchema } from "@lessonbuild/shared";
import { saveQuestion } from "@lessonbuild/db";
import { getModel } from "../model.js";
import type { LessonStateType } from "../state.js";

const BatchSchema = z.object({ questions: z.array(McqSchema).length(2) });

const SYSTEM = `Write 2 multiple-choice questions (4 choices each) that test the given
objective, based strictly on the document. Provide the correct index, a short explanation of
why it is correct, and a conceptual hint that does NOT reveal the answer.`;

export async function generateQuestionsNode(
  state: LessonStateType,
  model = getModel(),
): Promise<Partial<LessonStateType>> {
  const objective = state.lessonPlan!.objectives[state.currentObjectiveIdx]!;
  const objectiveId = state.objectiveIds[state.currentObjectiveIdx]!;
  const structured = model.withStructuredOutput(BatchSchema);
  const { questions } = await structured.invoke([
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Objective: ${objective.title} — ${objective.description}\n\nDocument:\n${state.docText}`,
    },
  ]);
  const questionIds: string[] = [];
  for (const q of questions) questionIds.push(await saveQuestion(objectiveId, q));
  return { questions, questionIds, currentQuestionIdx: 0 };
}
