import type { LessonStateType } from "../state.js";

/**
 * Moves the quiz cursor after a correct answer has been acknowledged.
 *
 * @param state Current lesson graph state.
 * @return Partial state with the advanced question cursor.
 */
export async function advanceNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  return { currentQuestionIdx: state.currentQuestionIdx + 1, readyToAdvance: false };
}

/**
 * Routes to the next sanitized question or the final summary when complete.
 *
 * @param state Current lesson graph state after advancing the cursor.
 * @return Next graph node name.
 */
export function routeAfterAdvance(state: LessonStateType): "askQuestion" | "summarize" {
  return state.currentQuestionIdx < state.questions.length ? "askQuestion" : "summarize";
}
