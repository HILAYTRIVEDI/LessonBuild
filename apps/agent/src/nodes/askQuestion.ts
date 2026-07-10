import { interrupt } from "@langchain/langgraph";
import { AskQuestionResponseSchema } from "@lessonbuild/shared";
import type { AskQuestionEvent } from "@lessonbuild/shared";
import type { LessonStateType } from "../state.js";

export async function askQuestionNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const idx = state.currentQuestionIdx;
  const question = state.questions[idx]!;
  const questionId = state.questionIds[idx]!;
  const lastAttempt = [...state.attempts].reverse().find((a) => a.questionId === questionId);
  // The event is streamed to the browser pre-answer, so it must not include
  // the correct index — only whether the last attempt was right and a hint.
  const feedback = lastAttempt
    ? {
        selectedIndex: lastAttempt.selectedIndex,
        isCorrect: lastAttempt.isCorrect,
        text: lastAttempt.isCorrect ? question.explanation : question.hint,
      }
    : undefined;
  const resumed = interrupt<AskQuestionEvent, unknown>({
    type: "ask_mcq",
    stem: question.stem,
    choices: question.choices,
    questionIdx: idx,
    feedback,
  });
  return { lastSelectedIndex: AskQuestionResponseSchema.parse(resumed).selectedIndex };
}
