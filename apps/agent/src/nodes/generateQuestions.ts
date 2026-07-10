import { z } from "zod";
import { McqSchema, type Mcq, type SafeMcq } from "@lessonbuild/shared";
import { retrieveLessonContext, saveQuestion } from "@lessonbuild/db";
import { getModel } from "../model.js";
import type { LessonStateType } from "../state.js";

const ObjectiveBatchSchema = z.object({ questions: z.array(McqSchema).length(2) });

/** The single-call output: one 2-question batch per plan objective, in order. */
function buildBatchSchema(objectiveCount: number) {
  return z.object({
    objectives: z.array(ObjectiveBatchSchema).length(objectiveCount),
  });
}

type BatchOutput = { objectives: { questions: Mcq[] }[] };

/**
 * Accepts the batch at the top level, as a bare objectives array, or nested
 * one key deep — some models wrap the tool arguments in an extra object
 * (e.g. `{ "questions": { "objectives": [...] } }`), which makes the strict
 * parser reject an otherwise valid output.
 */
function coerceBatch(
  value: unknown,
  schema: ReturnType<typeof buildBatchSchema>,
): BatchOutput | null {
  const direct = schema.safeParse(value);
  if (direct.success) return direct.data;
  const bareArray = schema.shape.objectives.safeParse(value);
  if (bareArray.success) return { objectives: bareArray.data };
  if (typeof value === "object" && value !== null) {
    for (const nested of Object.values(value)) {
      const wrapped = schema.safeParse(nested);
      if (wrapped.success) return wrapped.data;
      const array = schema.shape.objectives.safeParse(nested);
      if (array.success) return { objectives: array.data };
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

/** State is streamed to the browser by CopilotKit — strip the answer key. */
function toSafeMcq(q: Mcq): SafeMcq {
  return { stem: q.stem, choices: q.choices, hint: q.hint };
}

const SYSTEM = `For EACH learning objective listed, write 2 multiple-choice questions
(4 choices each) that test that objective, based strictly on the document. Return one
entry per objective, in the same order as listed. For every question provide the correct
index, a short explanation of why it is correct, and a conceptual hint that does NOT
reveal the answer.`;

export async function generateQuestionsNode(
  state: LessonStateType,
  model = getModel(),
): Promise<Partial<LessonStateType>> {
  const objectives = state.lessonPlan!.objectives;
  const schema = buildBatchSchema(objectives.length);
  const structured = model.withStructuredOutput(schema, {
    name: "questions",
    includeRaw: true,
  });
  const objectiveList = objectives
    .map((o, i) => `${i + 1}. ${o.title} — ${o.description}`)
    .join("\n");
  const retrievedContexts = await Promise.all(
    objectives.map((objective) =>
      retrieveLessonContext({
        lessonId: state.lessonId,
        queryText: `${objective.title} ${objective.description}`,
      }),
    ),
  );
  const retrievedContext = retrievedContexts
    .map((context, index) => {
      const objective = objectives[index]!;
      return context
        ? `Objective ${index + 1}: ${objective.title}\n${context}`
        : `Objective ${index + 1}: ${objective.title}\n${state.docText}`;
    })
    .join("\n\n");
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: SYSTEM },
    {
      role: "user",
      content: `Objectives:\n${objectiveList}\n\nRetrieved document context:\n${retrievedContext}`,
    },
  ];

  let batch: BatchOutput | null = null;
  for (let attempt = 0; attempt < 2 && batch === null; attempt++) {
    const result = await structured.invoke(messages);
    batch = coerceBatch(result.parsed, schema) ?? coerceBatch(rawToolArgs(result.raw), schema);
  }
  if (batch === null) {
    throw new Error(
      "The model did not return a valid set of questions for every objective. Please try again.",
    );
  }

  const questions: SafeMcq[] = [];
  const questionIds: string[] = [];
  for (let i = 0; i < batch.objectives.length; i++) {
    // Safe: the schema pins batch.objectives.length to objectives.length,
    // and objectiveIds is saved 1:1 from the same approved plan's objectives.
    const objectiveId = state.objectiveIds[i]!;
    for (const q of batch.objectives[i]!.questions) {
      questionIds.push(await saveQuestion(objectiveId, q));
      questions.push(toSafeMcq(q));
    }
  }
  return { questions, questionIds, currentQuestionIdx: 0 };
}
