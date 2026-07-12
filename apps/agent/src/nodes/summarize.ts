import { getModel } from "../model.js";
import { SUMMARY_SYSTEM } from "../prompts.js";
import type { LessonStateType, AttemptRecord } from "../state.js";

/**
 * Computes first-try correctness from recorded attempts.
 *
 * @param attempts Attempt records accumulated during the quiz.
 * @return First-try score and attempted-question total.
 */
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

  return { firstTryCorrect, total: byQuestion.size };
}

/**
 * Builds the final learner progress report.
 *
 * @param state Current lesson graph state with objectives and attempts.
 * @param model Chat model used to generate study tips.
 * @return Partial state containing the final report.
 */
export async function summarizeNode(
  state: LessonStateType,
  model = getModel(),
): Promise<Partial<LessonStateType>> {
  const score = computeScore(state.attempts);
  const tips = await model.invoke([
    {
      role: "system",
      content: SUMMARY_SYSTEM,
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
