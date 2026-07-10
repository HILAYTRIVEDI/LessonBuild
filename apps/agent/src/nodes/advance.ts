import type { LessonStateType } from "../state.js";

export async function advanceNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  return { currentQuestionIdx: state.currentQuestionIdx + 1, readyToAdvance: false };
}

export function routeAfterAdvance(state: LessonStateType): "askQuestion" | "summarize" {
  return state.currentQuestionIdx < state.questions.length ? "askQuestion" : "summarize";
}
