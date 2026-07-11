import { interrupt } from "@langchain/langgraph";
import { ApprovePlanResponseSchema } from "@lessonbuild/shared";
import type { ApprovePlanEvent } from "@lessonbuild/shared";
import type { LessonStateType } from "../state.js";

export async function approvePlanNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  // The resume payload crosses the CopilotKit boundary untyped, so the
  // interrupt's response generic is a lie at runtime — parse before trusting.
  const resumed = interrupt<ApprovePlanEvent, unknown>({
    type: "approve_plan",
    plan: state.lessonPlan,
  });
  const response = ApprovePlanResponseSchema.parse(resumed);
  if (!response.approved) {
    return {
      planApproved: false,
      planFeedback: response.feedback ?? "The learner asked for a different plan.",
      questionCounts: [],
    };
  }
  const objectiveCount = state.lessonPlan?.objectives.length ?? 0;
  // The schema cannot see the plan, so the one cross-field rule lives here.
  if (response.questionCounts !== undefined && response.questionCounts.length !== objectiveCount) {
    throw new Error(
      `questionCounts has ${response.questionCounts.length} entries for ${objectiveCount} objectives`,
    );
  }
  return {
    planApproved: true,
    planFeedback: null,
    questionCounts:
      response.questionCounts ?? Array.from({ length: objectiveCount }, () => 2),
  };
}

export function routeAfterApprove(state: LessonStateType): "plan" | "generateQuestions" {
  return state.planApproved ? "generateQuestions" : "plan";
}
