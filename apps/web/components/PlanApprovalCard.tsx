"use client";
import { useState } from "react";
import type { ApprovePlanResponse, LessonPlan } from "@lessonbuild/shared";

const ACCENTS = ["#FF6FB6", "#0D99FF", "#FEA421", "#14AE5C", "#9747FF", "#0393B5"];

export function PlanApprovalCard({
  plan,
  onRespond,
}: {
  plan: LessonPlan;
  onRespond: (r: ApprovePlanResponse) => void;
}) {
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [feedback, setFeedback] = useState("");
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
      {requestingChanges ? (
        <div className="mt-6 space-y-3">
          <textarea
            className="w-full rounded-md border border-border bg-surface p-3 text-sm"
            rows={3}
            placeholder="What should be different? e.g. fewer objectives, easier level…"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="flex gap-3">
            <button
              className="rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
              disabled={feedback.trim().length === 0}
              onClick={() => onRespond({ approved: false, feedback: feedback.trim() })}
            >
              Send change request
            </button>
            <button
              className="rounded-md border border-border px-4 py-2 font-medium"
              onClick={() => setRequestingChanges(false)}
            >
              Back
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 flex gap-3">
          <button
            className="rounded-md bg-primary px-4 py-2 font-medium text-white"
            onClick={() => onRespond({ approved: true })}
          >
            Approve & start
          </button>
          <button
            className="rounded-md border border-border px-4 py-2 font-medium"
            onClick={() => setRequestingChanges(true)}
          >
            Ask for changes
          </button>
        </div>
      )}
    </div>
  );
}
