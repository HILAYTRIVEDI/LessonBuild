"use client";
import { useState } from "react";
import type { AskQuestionFeedback } from "@lessonbuild/shared";
import { formatProgress } from "@/lib/progress";

/** Displays one active MCQ interrupt and emits submit/continue actions. */
export function McqWidget({
  stem,
  choices,
  questionIdx,
  totalQuestions,
  feedback,
  onSubmit,
  onContinue,
}: {
  stem: string;
  choices: string[];
  questionIdx: number;
  totalQuestions: number;
  feedback?: AskQuestionFeedback;
  onSubmit: (selectedIndex: number) => void;
  onContinue: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const hasRetry = !!feedback && !feedback.isCorrect;
  const canContinue = !!feedback?.isCorrect;

  function handleSubmit() {
    if (selected === null) return;
    onSubmit(selected);
  }

  function choiceClassName(i: number): string {
    if (feedback && i === feedback.selectedIndex) {
      return feedback.isCorrect ? "border-success bg-success/10" : "border-error bg-error/10";
    }
    return selected === i ? "border-primary bg-primary/10" : "border-border";
  }

  return (
    <div className="rounded-md border border-border bg-surface p-6 shadow-card">
      <p className="text-sm font-medium text-text-muted">
        {formatProgress(questionIdx, totalQuestions)}
      </p>
      <p className="mt-2 font-medium">{stem}</p>
      {feedback && (
        <p className={`mt-2 font-medium ${feedback.isCorrect ? "text-success" : "text-error"}`}>
          {feedback.isCorrect ? "Correct! " : "Not quite. "}
          {feedback.text}
        </p>
      )}
      <div className="mt-4 space-y-2">
        {choices.map((c, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 ${choiceClassName(i)}`}
          >
            <input
              type="radio"
              name="mcq"
              disabled={!!feedback && !hasRetry}
              checked={selected === i || (!!feedback && i === feedback.selectedIndex)}
              onChange={() => setSelected(i)}
            />
            <span>{c}</span>
          </label>
        ))}
      </div>
      {(!feedback || hasRetry) && (
        <button
          className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={selected === null}
          onClick={handleSubmit}
        >
          {hasRetry ? "Try again" : "Submit"}
        </button>
      )}
      {canContinue && (
        <button
          className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-white"
          onClick={onContinue}
        >
          Continue
        </button>
      )}
    </div>
  );
}
