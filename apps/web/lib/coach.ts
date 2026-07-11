import { z } from "zod";

export const CoachQuestionContextSchema = z.object({
  stem: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2),
  priorHint: z.string().min(1).optional(),
});

export const CoachMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

export const CoachRequestSchema = z.object({
  message: z.string().min(1).max(4000),
  lessonId: z.string().uuid().nullable(),
  activeQuestion: CoachQuestionContextSchema.nullable(),
  history: z.array(CoachMessageSchema).max(12).default([]),
});

export const CoachResponseSchema = z.object({
  reply: z.string().min(1),
});

export const AiMlChatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      }),
    )
    .min(1),
});

export type CoachMessage = z.infer<typeof CoachMessageSchema>;
export type CoachRequest = z.infer<typeof CoachRequestSchema>;
export type CoachQuestionContext = z.infer<typeof CoachQuestionContextSchema>;

export const COACH_SYSTEM_PROMPT =
  "You are Lesson Coach, a supportive tutor for a PDF-based lesson. " +
  "Use the provided lesson context and active multiple-choice question to explain concepts, " +
  "give hints, ask guiding questions, or clarify vocabulary. " +
  "When an active question is present, never reveal the correct choice, the correct index, " +
  "or wording that identifies the answer. Do not eliminate choices one by one. " +
  "If the learner asks for the answer, refuse briefly and give a conceptual hint instead. " +
  "Do not evaluate a selected option in chat; tell the learner to submit it in the quiz widget. " +
  "Keep responses concise and grounded in the source material.";

function formatQuestion(question: CoachQuestionContext | null): string {
  if (!question) return "No active question.";
  const choices = question.choices.map((choice, index) => `${index + 1}. ${choice}`).join("\n");
  return [
    `Stem: ${question.stem}`,
    "Choices:",
    choices,
    question.priorHint ? `Prior hint: ${question.priorHint}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function buildCoachUserContext(input: {
  lessonContext: string;
  activeQuestion: CoachQuestionContext | null;
  message: string;
}): string {
  const context = input.lessonContext.trim() || "No lesson source context is available yet.";
  return [
    "Lesson source context:",
    context,
    "",
    "Active quiz context:",
    formatQuestion(input.activeQuestion),
    "",
    "Learner message:",
    input.message,
  ].join("\n");
}
