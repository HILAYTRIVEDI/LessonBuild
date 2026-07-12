import type {
  ApprovePlanResponse,
  AskQuestionEvent,
  AskQuestionResponse,
  LessonPlan,
} from "@lessonbuild/shared";

/**
 * An agent interrupt lifted out of the chat slot and awaiting a learner
 * response on the dashboard. `respond` resumes the LangGraph run.
 */
export type PendingInterrupt =
  | { kind: "plan"; plan: LessonPlan; respond: (r: ApprovePlanResponse) => void }
  | { kind: "mcq"; event: AskQuestionEvent; respond: (r: AskQuestionResponse) => void };

export type DashboardStage =
  | { kind: "upload" }
  | { kind: "ready"; lessonId: string }
  | { kind: "working" }
  | { kind: "plan"; interrupt: Extract<PendingInterrupt, { kind: "plan" }> }
  | { kind: "question"; interrupt: Extract<PendingInterrupt, { kind: "mcq" }> }
  | { kind: "report"; report: string };

/**
 * Maps the page's raw signals onto the single stage the dashboard renders.
 * Priority: a pending interrupt always needs the learner's input first; the
 * report is shown as soon as it streams in (the run may still be finalizing);
 * otherwise working > ready > upload.
 *
 * @param input Raw dashboard state signals from React and CopilotKit.
 * @return The single dashboard stage to render.
 */
export function deriveStage(input: {
  lessonId: string | null;
  working: boolean;
  pending: PendingInterrupt | null;
  report: string | null;
}): DashboardStage {
  const { lessonId, working, pending, report } = input;
  if (pending) {
    return pending.kind === "plan"
      ? { kind: "plan", interrupt: pending }
      : { kind: "question", interrupt: pending };
  }
  if (report) return { kind: "report", report };
  if (working) return { kind: "working" };
  if (lessonId) return { kind: "ready", lessonId };
  return { kind: "upload" };
}
