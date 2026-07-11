import { z } from "zod";

export const DifficultySchema = z.enum(["beginner", "intermediate", "advanced"]);

export const ObjectiveSchema = z.object({
  title: z.string().min(1),
  difficulty: DifficultySchema,
  description: z.string().min(1),
});

export const LessonPlanSchema = z.object({
  overallDifficulty: DifficultySchema,
  objectives: z.array(ObjectiveSchema).min(1).max(8),
});

export const McqSchema = z
  .object({
    stem: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2).max(6),
    correctIndex: z.number().int().nonnegative(),
    explanation: z.string().min(1),
    hint: z.string().min(1),
  })
  .refine((q) => q.correctIndex < q.choices.length, {
    message: "correctIndex must reference an existing choice",
    path: ["correctIndex"],
  });

// Browser-visible question shape: CopilotKit streams the full graph state to
// the client, so state (and anything derived from it) must never carry the
// answer key. The hint is written to not reveal the answer, so it is safe.
export const SafeMcqSchema = z.object({
  stem: z.string().min(1),
  choices: z.array(z.string().min(1)).min(2).max(6),
  hint: z.string().min(1),
});

export const ApprovePlanEventSchema = z.object({
  type: z.literal("approve_plan"),
  plan: LessonPlanSchema.nullable(),
});

export const ApprovePlanResponseSchema = z.object({
  approved: z.boolean(),
  // Learner's change request when approved is false; fed back into the planner.
  feedback: z.string().optional(),
  // One entry per plan objective: how many MCQs to generate (0 = topic skipped).
  // Optional so "ask for changes" responses and legacy payloads stay valid;
  // length-vs-plan validation happens in the agent, which can see the plan.
  questionCounts: z.array(z.number().int().min(0).max(5)).optional(),
});

// Deliberately excludes correctIndex: this payload reaches the browser while
// the question is still answerable, so it must never carry the answer key.
export const AskQuestionFeedbackSchema = z.object({
  selectedIndex: z.number().int().nonnegative(),
  isCorrect: z.boolean(),
  text: z.string(),
});

export const AskQuestionEventSchema = z.object({
  type: z.literal("ask_mcq"),
  stem: z.string(),
  choices: z.array(z.string()),
  questionIdx: z.number().int().nonnegative(),
  totalQuestions: z.number().int().positive(),
  feedback: AskQuestionFeedbackSchema.optional(),
});

export const SubmitAnswerResponseSchema = z.object({
  action: z.literal("submit"),
  selectedIndex: z.number().int().nonnegative(),
});

export const ContinueQuestionResponseSchema = z.object({
  action: z.literal("continue"),
});

export const AskQuestionResponseSchema = z.discriminatedUnion("action", [
  SubmitAnswerResponseSchema,
  ContinueQuestionResponseSchema,
]);

export const LessonInterruptEventSchema = z.discriminatedUnion("type", [
  ApprovePlanEventSchema,
  AskQuestionEventSchema,
]);

export type Difficulty = z.infer<typeof DifficultySchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type LessonPlan = z.infer<typeof LessonPlanSchema>;
export type Mcq = z.infer<typeof McqSchema>;
export type SafeMcq = z.infer<typeof SafeMcqSchema>;
export type ApprovePlanEvent = z.infer<typeof ApprovePlanEventSchema>;
export type ApprovePlanResponse = z.infer<typeof ApprovePlanResponseSchema>;
export type AskQuestionFeedback = z.infer<typeof AskQuestionFeedbackSchema>;
export type AskQuestionEvent = z.infer<typeof AskQuestionEventSchema>;
export type AskQuestionResponse = z.infer<typeof AskQuestionResponseSchema>;
