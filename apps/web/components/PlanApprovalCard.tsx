"use client";
import { useState } from "react";
import type { ApprovePlanResponse, LessonPlan } from "@lessonbuild/shared";
import {
  MAX_QUESTIONS,
  MIN_QUESTIONS,
  canApprove,
  initialSelections,
  setCount,
  toQuestionCounts,
  toggleTopic,
  totalQuestions,
} from "@/lib/planSelection";

const ACCENTS = ["#FF6FB6", "#0D99FF", "#FEA421", "#14AE5C", "#9747FF", "#0393B5"];

/**
 * Renders the human-in-the-loop plan approval surface, including optional
 * per-topic MCQ counts that become the agent's generation contract.
 */
export function PlanApprovalCard({
  plan,
  onRespond,
}: {
  plan: LessonPlan;
  onRespond: (r: ApprovePlanResponse) => void;
}) {
  const [requestingChanges, setRequestingChanges] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [selections, setSelections] = useState(() => initialSelections(plan.objectives.length));
  const total = totalQuestions(selections);
  return (
    <div className="rounded-md border border-border bg-surface p-6 shadow-card">
      <h3 className="text-lg font-bold">Proposed lesson plan</h3>
      <p className="text-sm text-text-muted">Difficulty: {plan.overallDifficulty}</p>
      <p className="mt-1 text-sm text-text-muted">
        Pick the topics to be quizzed on and how many questions each gets. Unchecked topics stay in
        the lesson without questions.
      </p>
      <ul className="mt-4 space-y-3">
        {plan.objectives.map((o, i) => {
          const sel = selections[i]!;
          return (
            <li key={i} className="flex items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-primary"
                checked={sel.selected}
                aria-label={`Include questions for ${o.title}`}
                onChange={() => setSelections((s) => toggleTopic(s, i))}
              />
              <span
                className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-sm text-xs font-semibold text-white"
                style={{ backgroundColor: ACCENTS[i % ACCENTS.length] }}
              >
                {i + 1}
              </span>
              <div className={sel.selected ? "flex-1" : "flex-1 opacity-50"}>
                <div className="font-medium">{o.title}</div>
                <div className="text-sm text-text-muted">{o.description}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="h-7 w-7 rounded-md border border-border font-medium disabled:opacity-40"
                  disabled={!sel.selected || sel.count <= MIN_QUESTIONS}
                  aria-label={`Fewer questions for ${o.title}`}
                  onClick={() => setSelections((s) => setCount(s, i, sel.count - 1))}
                >
                  −
                </button>
                <span
                  className={`w-4 text-center text-sm font-semibold ${sel.selected ? "" : "opacity-40"}`}
                >
                  {sel.selected ? sel.count : 0}
                </span>
                <button
                  type="button"
                  className="h-7 w-7 rounded-md border border-border font-medium disabled:opacity-40"
                  disabled={!sel.selected || sel.count >= MAX_QUESTIONS}
                  aria-label={`More questions for ${o.title}`}
                  onClick={() => setSelections((s) => setCount(s, i, sel.count + 1))}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-sm font-medium">
        {total} question{total === 1 ? "" : "s"} total
      </p>
      {requestingChanges ? (
        <div className="mt-4 space-y-3">
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
        <div className="mt-4 flex gap-3">
          <button
            className="rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
            disabled={!canApprove(selections)}
            onClick={() =>
              onRespond({ approved: true, questionCounts: toQuestionCounts(selections) })
            }
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
