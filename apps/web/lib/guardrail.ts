import type { AskQuestionEvent } from "@lessonbuild/shared";

export const HINT_GUARDRAIL_INSTRUCTIONS =
  "While a question is active, you may offer conceptual hints or explain related concepts, " +
  "but you must NEVER reveal which choice is correct or its index. Always steer the learner " +
  "back to answering the question themselves.";

export interface GuardrailReadable {
  stem: string;
  choices: string[];
  priorHint?: string;
}

export function toGuardrailReadable(event: AskQuestionEvent): GuardrailReadable {
  return {
    stem: event.stem,
    choices: event.choices,
    ...(event.feedback && !event.feedback.isCorrect ? { priorHint: event.feedback.text } : {}),
  };
}
