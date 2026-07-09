import { interrupt } from "@langchain/langgraph";
import type { ApprovePlanEvent, ApprovePlanResponse } from "@lessonbuild/shared";
import type { LessonStateType } from "../state.js";

export async function approvePlanNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const resumed = interrupt<ApprovePlanEvent, ApprovePlanResponse>({
    type: "approve_plan",
    plan: state.lessonPlan,
  });
  return { planApproved: resumed.approved, lessonPlan: resumed.plan ?? state.lessonPlan };
}
