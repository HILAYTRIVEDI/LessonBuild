import { describe, it, expect } from "vitest";
import { advanceNode, routeAfterAdvance } from "./advance.js";
import type { LessonStateType } from "../state.js";

const plan = {
  overallDifficulty: "beginner" as const,
  objectives: [
    { title: "A", difficulty: "beginner" as const, description: "d" },
    { title: "B", difficulty: "beginner" as const, description: "d" },
  ],
};

describe("advance", () => {
  it("moves to the next question within an objective", async () => {
    const out = await advanceNode({
      currentQuestionIdx: 0,
      questions: [1, 2],
      currentObjectiveIdx: 0,
      lessonPlan: plan,
    } as unknown as LessonStateType);
    expect(out.currentQuestionIdx).toBe(1);
    expect(
      routeAfterAdvance({
        ...out,
        questions: [1, 2],
        lessonPlan: plan,
        currentObjectiveIdx: 0,
      } as unknown as LessonStateType),
    ).toBe("askQuestion");
  });

  it("moves to the next objective when questions are exhausted", async () => {
    const out = await advanceNode({
      currentQuestionIdx: 1,
      questions: [1, 2],
      currentObjectiveIdx: 0,
      lessonPlan: plan,
    } as unknown as LessonStateType);
    expect(out.currentObjectiveIdx).toBe(1);
    expect(
      routeAfterAdvance({
        ...out,
        questions: [1, 2],
        lessonPlan: plan,
      } as unknown as LessonStateType),
    ).toBe("generateQuestions");
  });

  it("finishes after the last objective", async () => {
    const out = await advanceNode({
      currentQuestionIdx: 1,
      questions: [1, 2],
      currentObjectiveIdx: 1,
      lessonPlan: plan,
    } as unknown as LessonStateType);
    expect(
      routeAfterAdvance({
        ...out,
        questions: [1, 2],
        lessonPlan: plan,
      } as unknown as LessonStateType),
    ).toBe("summarize");
  });
});
