import { recordAttempt } from "@lessonbuild/db";
import type { LessonStateType, AttemptRecord } from "../state.js";

export async function evaluateNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const idx = state.currentQuestionIdx;
  const q = state.questions[idx]!;
  const questionId = state.questionIds[idx]!;
  const selectedIndex = state.lastSelectedIndex ?? -1;
  const isCorrect = selectedIndex === q.correctIndex;
  const priorForThisQ = state.attempts.filter((a) => a.questionId === questionId).length;
  const attemptNo = priorForThisQ + 1;

  await recordAttempt({ questionId, selectedIndex, isCorrect, attemptNo });

  const record: AttemptRecord = { questionId, selectedIndex, isCorrect, attemptNo };
  return { attempts: [record] };
}

export function routeAfterEvaluate(state: LessonStateType): "advance" | "askQuestion" {
  const questionId = state.questionIds[state.currentQuestionIdx]!;
  const last = [...state.attempts].reverse().find((a) => a.questionId === questionId);
  return last?.isCorrect ? "advance" : "askQuestion";
}
