import { describe, it, expect } from "vitest";
import { LessonPlanSchema, McqSchema } from "./schemas";

describe("LessonPlanSchema", () => {
  it("accepts a valid plan", () => {
    const plan = {
      overallDifficulty: "beginner",
      objectives: [{ title: "Intro", difficulty: "beginner", description: "Basics" }],
    };
    expect(LessonPlanSchema.parse(plan)).toEqual(plan);
  });
  it("rejects an empty objective list", () => {
    expect(() => LessonPlanSchema.parse({ overallDifficulty: "beginner", objectives: [] })).toThrow();
  });
});

describe("McqSchema", () => {
  it("rejects correctIndex out of range", () => {
    const bad = { stem: "Q", choices: ["a", "b"], correctIndex: 5, explanation: "x", hint: "y" };
    expect(() => McqSchema.parse(bad)).toThrow();
  });
  it("accepts a valid 4-choice question", () => {
    const q = { stem: "Q", choices: ["a", "b", "c", "d"], correctIndex: 2, explanation: "x", hint: "y" };
    expect(McqSchema.parse(q)).toEqual(q);
  });
});
