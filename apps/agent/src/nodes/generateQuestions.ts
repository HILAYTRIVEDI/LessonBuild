import { z } from "zod";
import { McqSchema, type Mcq } from "@lessonbuild/shared";
import { saveQuestion } from "@lessonbuild/db";
import { getModel } from "../model.js";
import type { LessonStateType } from "../state.js";

const BatchSchema = z.object({ questions: z.array(McqSchema).length(2) });

/**
 * Accepts the batch either at the top level or nested one key deep — some models
 * wrap the tool arguments in an extra object (e.g. `{ "questions": { "questions": [...] } }`),
 * which makes the strict parser reject an otherwise valid pair of MCQs.
 */
function coerceQuestions(value: unknown): Mcq[] | null {
  const direct = BatchSchema.safeParse(value);
  if (direct.success) return direct.data.questions;
  const bareArray = z.array(McqSchema).safeParse(value);
  if (bareArray.success) return bareArray.data;
  if (typeof value === "object" && value !== null) {
    for (const nested of Object.values(value)) {
      const wrapped = BatchSchema.safeParse(nested);
      if (wrapped.success) return wrapped.data.questions;
      const array = z.array(McqSchema).safeParse(nested);
      if (array.success) return array.data;
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

const SYSTEM = `Write 2 multiple-choice questions (4 choices each) that test the given
objective, based strictly on the document. Provide the correct index, a short explanation of
why it is correct, and a conceptual hint that does NOT reveal the answer.`;

export async function generateQuestionsNode(
  state: LessonStateType,
  model = getModel(),
): Promise<Partial<LessonStateType>> {
  const objective = state.lessonPlan!.objectives[state.currentObjectiveIdx]!;
  const objectiveId = state.objectiveIds[state.currentObjectiveIdx]!;
  const structured = model.withStructuredOutput(BatchSchema, {
    name: "questions",
    includeRaw: true,
  });
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Objective: ${objective.title} — ${objective.description}\n\nDocument:\n${state.docText}`,
    },
  ];

  let questions: Mcq[] | null = null;
  for (let attempt = 0; attempt < 2 && questions === null; attempt++) {
    const result = await structured.invoke(messages);
    questions =
      coerceQuestions(result.parsed) ?? coerceQuestions(rawToolArgs(result.raw));
  }
  if (questions === null) {
    throw new Error("The model did not return a valid pair of questions. Please try again.");
  }

  const questionIds: string[] = [];
  for (const q of questions) questionIds.push(await saveQuestion(objectiveId, q));
  return { questions, questionIds, currentQuestionIdx: 0 };
}
