import type { AskQuestionEvent } from "@lessonbuild/shared";

/**
 * Canonical never-reveal rule for chat help during an active MCQ. Composed into
 * COACH_SYSTEM_PROMPT (see lib/coach.ts) so the runtime prompt and this helper
 * share one source of truth.
 */
export const HINT_GUARDRAIL_INSTRUCTIONS =
  "While a question is active, you may offer conceptual hints or explain related concepts, " +
  "but you must NEVER reveal which choice is correct or its index. Always steer the learner " +
  "back to answering the question themselves.";

/** Browser-safe question context exposed to the Lesson Coach. */
export interface GuardrailReadable {
  stem: string;
  choices: string[];
  priorHint?: string;
}

/**
 * Converts an active MCQ interrupt into coach context without answer keys or
 * correct-answer explanations.
 */
export function toGuardrailReadable(event: AskQuestionEvent): GuardrailReadable {
  return {
    stem: event.stem,
    choices: event.choices,
    ...(event.feedback && !event.feedback.isCorrect ? { priorHint: event.feedback.text } : {}),
  };
}
