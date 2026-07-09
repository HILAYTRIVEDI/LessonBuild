import { interrupt } from "@langchain/langgraph";
import type { AskQuestionEvent, AskQuestionResponse } from "@lessonbuild/shared";
import type { LessonStateType } from "../state.js";

export async function askQuestionNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const idx = state.currentQuestionIdx;
  const question = state.questions[idx]!;
  const lastAttempt = [...state.attempts].reverse().find((a) => a.questionIdx === idx);
  const feedback = lastAttempt
    ? {
        correctIndex: question.correctIndex,
        selectedIndex: lastAttempt.selectedIndex,
        isCorrect: lastAttempt.isCorrect,
        text: lastAttempt.isCorrect ? question.explanation : question.hint,
      }
    : undefined;
  const resumed = interrupt<AskQuestionEvent, AskQuestionResponse>({
    type: "ask_mcq",
    stem: question.stem,
    choices: question.choices,
    questionIdx: idx,
    feedback,
  });
  return { lastSelectedIndex: resumed.selectedIndex };
}
