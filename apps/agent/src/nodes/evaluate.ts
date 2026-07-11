import { recordAttempt, getQuestionAnswer } from "@lessonbuild/db";
import type { LessonStateType, AttemptRecord } from "../state.js";

/**
 * Compares the learner's selected index with the answer key in Postgres and
 * records the attempt without exposing the key to graph state.
 */
export async function evaluateNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const questionId = state.questionIds[state.currentQuestionIdx]!;
  const selectedIndex = state.lastSelectedIndex ?? -1;
  // The answer key lives only in Postgres — graph state is streamed to the
  // browser by CopilotKit, so it never holds correctIndex.
  const { correctIndex } = await getQuestionAnswer(questionId);
  const isCorrect = selectedIndex === correctIndex;
  const priorForThisQ = state.attempts.filter((a) => a.questionId === questionId).length;
  const attemptNo = priorForThisQ + 1;

  await recordAttempt({ questionId, selectedIndex, isCorrect, attemptNo });

  const record: AttemptRecord = { questionId, selectedIndex, isCorrect, attemptNo };
  return { attempts: [record], readyToAdvance: false };
}

/** Evaluation always re-enters `askQuestion` to show feedback or accept retry. */
export function routeAfterEvaluate(): "askQuestion" {
  return "askQuestion";
}
