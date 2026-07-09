import { recordAttempt } from "@lessonbuild/db";
import type { LessonStateType, AttemptRecord } from "../state.js";

export async function evaluateNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const idx = state.currentQuestionIdx;
  const q = state.questions[idx]!;
  const selectedIndex = state.lastSelectedIndex ?? -1;
  const isCorrect = selectedIndex === q.correctIndex;
  const priorForThisQ = state.attempts.filter((a) => a.questionIdx === idx).length;
  const attemptNo = priorForThisQ + 1;

  await recordAttempt({ questionId: state.questionIds[idx]!, selectedIndex, isCorrect, attemptNo });

  const record: AttemptRecord = { questionIdx: idx, selectedIndex, isCorrect, attemptNo };
  return { attempts: [record] };
}

export function routeAfterEvaluate(state: LessonStateType): "advance" | "askQuestion" {
  const idx = state.currentQuestionIdx;
  const last = [...state.attempts].reverse().find((a) => a.questionIdx === idx);
  return last?.isCorrect ? "advance" : "askQuestion";
}
