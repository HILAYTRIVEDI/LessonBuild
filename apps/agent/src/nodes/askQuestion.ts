import { interrupt } from "@langchain/langgraph";
import { AskQuestionResponseSchema } from "@lessonbuild/shared";
import type { AskQuestionEvent, AskQuestionFeedback } from "@lessonbuild/shared";
import { getQuestionAnswer } from "@lessonbuild/db";
import type { LessonStateType } from "../state.js";

export async function askQuestionNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const idx = state.currentQuestionIdx;
  const question = state.questions[idx]!;
  const questionId = state.questionIds[idx]!;
  const lastAttempt = [...state.attempts].reverse().find((a) => a.questionId === questionId);
  // The event is streamed to the browser pre-answer, so it must not include
  // the correct index. The post-correct explanation lives only in Postgres —
  // state questions are sanitized — so fetch it by id when it's safe to show.
  let feedback: AskQuestionFeedback | undefined;
  if (lastAttempt) {
    const text = lastAttempt.isCorrect
      ? (await getQuestionAnswer(questionId)).explanation
      : question.hint;
    feedback = {
      selectedIndex: lastAttempt.selectedIndex,
      isCorrect: lastAttempt.isCorrect,
      text,
    };
  }
  const resumed = interrupt<AskQuestionEvent, unknown>({
    type: "ask_mcq",
    stem: question.stem,
    choices: question.choices,
    questionIdx: idx,
    totalQuestions: state.questions.length,
    ...(feedback ? { feedback } : {}),
  });
  return { lastSelectedIndex: AskQuestionResponseSchema.parse(resumed).selectedIndex };
}
