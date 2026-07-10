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
  return {
    planApproved: response.approved,
    planFeedback: response.approved
      ? null
      : (response.feedback ?? "The learner asked for a different plan."),
  };
}

export function routeAfterApprove(state: LessonStateType): "plan" | "generateQuestions" {
  return state.planApproved ? "generateQuestions" : "plan";
}
