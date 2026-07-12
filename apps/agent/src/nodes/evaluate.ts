import { recordAttempt, getQuestionAnswer } from "@lessonbuild/db";
import type { LessonStateType, AttemptRecord } from "../state.js";

/**
 * Compares the learner's selected index with the answer key in Postgres and
 * records the attempt without exposing the key to graph state.
 *
 * @param state Current lesson graph state with the selected answer.
 * @return Partial state with the recorded attempt and routing flags.
 */
export async function evaluateNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const questionId = state.questionIds[state.currentQuestionIdx]!;
  const selectedIndex = state.lastSelectedIndex ?? -1;
  /**
   * The answer key lives only in Postgres — graph state is streamed to the
   * browser by CopilotKit, so it never holds correctIndex.
   */
  const { correctIndex } = await getQuestionAnswer(questionId);
  const isCorrect = selectedIndex === correctIndex;
  const priorForThisQ = state.attempts.filter((a) => a.questionId === questionId).length;
  const attemptNo = priorForThisQ + 1;

  await recordAttempt({ questionId, selectedIndex, isCorrect, attemptNo });

  const record: AttemptRecord = { questionId, selectedIndex, isCorrect, attemptNo };
  return { attempts: [record], readyToAdvance: false };
}

/**
 * Evaluation always re-enters `askQuestion` to show feedback or accept retry.
 *
 * @return Next graph node name.
 */
export function routeAfterEvaluate(): "askQuestion" {
  return "askQuestion";
}
