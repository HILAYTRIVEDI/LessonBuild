import { z } from "zod";
import { McqSchema, type Mcq, type SafeMcq } from "@lessonbuild/shared";
import { retrieveLessonContext, saveQuestion } from "@lessonbuild/db";
import { getModel } from "../model.js";
import { QUESTIONS_SYSTEM } from "../prompts.js";
import type { LessonStateType } from "../state.js";

/** The single-call output: one batch per *selected* objective, sized per its count. */
function buildBatchSchema(counts: number[]) {
  return z.object({
    objectives: z
      .array(z.object({ questions: z.array(McqSchema).min(1).max(5) }))
      .length(counts.length)
      .superRefine((batches, ctx) => {
        batches.forEach((batch, i) => {
          if (batch.questions.length !== counts[i]) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `objective ${i + 1} must have exactly ${counts[i]} questions`,
              path: [i, "questions"],
            });
          }
        });
      }),
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

export async function generateQuestionsNode(
  state: LessonStateType,
  model = getModel(),
): Promise<Partial<LessonStateType>> {
  const objectives = state.lessonPlan!.objectives;
  // Old checkpoints (and direct runs) may predate questionCounts — keep the
  // historical 2-per-topic behavior for them.
  const questionCounts = state.questionCounts ?? [];
  const counts =
    questionCounts.length === objectives.length ? questionCounts : objectives.map(() => 2);
  // Zero-count topics stay in the plan but are excluded from generation;
  // carrying objectiveId here keeps saved questions mapped to the right topic.
  const selected = objectives
    .map((objective, i) => ({ objective, objectiveId: state.objectiveIds[i]!, count: counts[i]! }))
    .filter((entry) => entry.count > 0);
  if (selected.length === 0) {
    throw new Error("Select at least one topic to generate questions for.");
  }
  const schema = buildBatchSchema(selected.map((entry) => entry.count));
  const structured = model.withStructuredOutput(schema, {
    name: "questions",
    includeRaw: true,
  });
  const objectiveList = selected
    .map(
      (entry, i) =>
        `${i + 1}. ${entry.objective.title} — ${entry.objective.description} (write ${entry.count} questions)`,
    )
    .join("\n");
  const retrievedContexts = await Promise.all(
    selected.map((entry) =>
      retrieveLessonContext({
        lessonId: state.lessonId,
        queryText: `${entry.objective.title} ${entry.objective.description}`,
      }),
    ),
  );
  const retrievedContext = retrievedContexts
    .map((context, index) => {
      const { objective } = selected[index]!;
      return context
        ? `Objective ${index + 1}: ${objective.title}\n${context}`
        : `Objective ${index + 1}: ${objective.title}\n${state.docText}`;
    })
    .join("\n\n");
  const messages: { role: "system" | "user"; content: string }[] = [
    { role: "system", content: QUESTIONS_SYSTEM },
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
    // Safe: buildBatchSchema pins batch.objectives.length to selected.length.
    const { objectiveId } = selected[i]!;
    for (const q of batch.objectives[i]!.questions) {
      questionIds.push(await saveQuestion(objectiveId, q));
      questions.push(toSafeMcq(q));
    }
  }
  return { questions, questionIds, currentQuestionIdx: 0 };
}
