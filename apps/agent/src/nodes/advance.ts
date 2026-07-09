import type { LessonStateType } from "../state.js";

export async function advanceNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const moreInObjective = state.currentQuestionIdx + 1 < state.questions.length;
  if (moreInObjective) {
    return { currentQuestionIdx: state.currentQuestionIdx + 1 };
  }
  return { currentObjectiveIdx: state.currentObjectiveIdx + 1, currentQuestionIdx: 0 };
}

export function routeAfterAdvance(
  state: LessonStateType,
): "askQuestion" | "generateQuestions" | "summarize" {
  const objectiveCount = state.lessonPlan?.objectives.length ?? 0;
  if (state.currentObjectiveIdx >= objectiveCount) {
    return "summarize";
  }
  return state.currentQuestionIdx === 0 ? "generateQuestions" : "askQuestion";
}
