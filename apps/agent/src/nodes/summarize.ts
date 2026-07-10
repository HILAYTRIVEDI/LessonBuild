import { getModel } from "../model.js";
import type { LessonStateType, AttemptRecord } from "../state.js";

export function computeScore(attempts: AttemptRecord[]) {
  const byQuestion = new Map<string, AttemptRecord[]>();
  for (const a of attempts) {
    byQuestion.set(a.questionId, [...(byQuestion.get(a.questionId) ?? []), a]);
  }
  let firstTryCorrect = 0;
  for (const [, list] of byQuestion) {
    const first = list.find((a) => a.attemptNo === 1);
    if (first?.isCorrect) firstTryCorrect++;
  }
  // The flow guarantees every asked question gets at least one attempt, so the
  // distinct attempted questions are exactly the questions covered — state
  // only holds the *current* objective's batch, so questions.length would
  // undercount a multi-objective lesson.
  return { firstTryCorrect, total: byQuestion.size };
}

export async function summarizeNode(
  state: LessonStateType,
  model = getModel(),
): Promise<Partial<LessonStateType>> {
  const score = computeScore(state.attempts);
  const tips = await model.invoke([
    {
      role: "system",
      content:
        "You are a supportive study coach. Given the learner's per-question attempt history, write 3 short, specific, encouraging study tips. Do not reveal any answer keys.",
    },
    {
      role: "user",
      content: `Objectives: ${JSON.stringify(state.lessonPlan?.objectives)}\nAttempts: ${JSON.stringify(state.attempts)}`,
    },
  ]);
  const tipsText = typeof tips.content === "string" ? tips.content : JSON.stringify(tips.content);
  const report = `You answered ${score.firstTryCorrect}/${score.total} correctly on the first try.\n\n${tipsText}`;
  return { report };
}
