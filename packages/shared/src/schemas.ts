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

export type Difficulty = z.infer<typeof DifficultySchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type LessonPlan = z.infer<typeof LessonPlanSchema>;
export type Mcq = z.infer<typeof McqSchema>;
