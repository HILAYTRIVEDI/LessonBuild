"use client";
import type { ApprovePlanResponse, LessonPlan } from "@lessonbuild/shared";

const ACCENTS = ["#FF6FB6", "#0D99FF", "#FEA421", "#14AE5C", "#9747FF", "#0393B5"];

export function PlanApprovalCard({
  plan,
  onRespond,
}: {
  plan: LessonPlan;
  onRespond: (r: ApprovePlanResponse) => void;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-6 shadow-card">
      <h3 className="text-lg font-bold">Proposed lesson plan</h3>
      <p className="text-sm text-text-muted">Difficulty: {plan.overallDifficulty}</p>
      <ul className="mt-4 space-y-3">
        {plan.objectives.map((o, i) => (
          <li key={i} className="flex items-start gap-3">
            <span
              className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-sm text-xs font-semibold text-white"
              style={{ backgroundColor: ACCENTS[i % ACCENTS.length] }}
            >
              {i + 1}
            </span>
            <div>
              <div className="font-medium">{o.title}</div>
              <div className="text-sm text-text-muted">{o.description}</div>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex gap-3">
        <button
          className="rounded-md bg-primary px-4 py-2 font-medium text-white"
          onClick={() => onRespond({ approved: true })}
        >
          Approve & start
        </button>
        <button
          className="rounded-md border border-border px-4 py-2 font-medium"
          onClick={() => onRespond({ approved: false })}
        >
          Ask for changes
        </button>
      </div>
    </div>
  );
}
