import { interrupt } from "@langchain/langgraph";
import { AskQuestionResponseSchema } from "@lessonbuild/shared";
import type { AskQuestionEvent, AskQuestionFeedback } from "@lessonbuild/shared";
import { getQuestionAnswer } from "@lessonbuild/db";
import type { LessonStateType } from "../state.js";

/**
 * Presents the current sanitized MCQ as a LangGraph interrupt and parses the
 * learner's resume payload from CopilotKit.
 *
 * @param state Current lesson graph state containing questions and cursor.
 * @return Partial state with the learner response or advance readiness.
 */
export async function askQuestionNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const idx = state.currentQuestionIdx;
  const question = state.questions[idx]!;
  const questionId = state.questionIds[idx]!;
  const lastAttempt = [...state.attempts].reverse().find((a) => a.questionId === questionId);
  /**
   * The event is streamed to the browser pre-answer, so it must not include
   * the correct index. The post-correct explanation lives only in Postgres —
   * state questions are sanitized — so fetch it by id when it's safe to show.
   */
  let feedback: AskQuestionFeedback | undefined;
  if (lastAttempt) {
    /**
     * The isCorrect branch is defensive: a correct answer advances to the next
     * question, which has no attempts yet, so re-asks normally only follow a
     * wrong answer. It stays as a safeguard against replays/graph re-entry.
     */
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
  const response = AskQuestionResponseSchema.parse(resumed);
  if (response.action === "continue") {
    if (!lastAttempt?.isCorrect) {
      throw new Error("askQuestion: cannot continue before answering correctly.");
    }
    return { readyToAdvance: true, lastSelectedIndex: null };
  }
  return { readyToAdvance: false, lastSelectedIndex: response.selectedIndex };
}

/**
 * Continues only after correct-answer acknowledgement; submissions go evaluate.
 *
 * @param state Current lesson graph state after an MCQ interrupt.
 * @return Next graph node name.
 */
export function routeAfterAskQuestion(state: LessonStateType): "advance" | "evaluate" {
  return state.readyToAdvance ? "advance" : "evaluate";
}
