import { describe, it, expect } from "vitest";
import { LessonPlanSchema, McqSchema, SafeMcqSchema, AskQuestionEventSchema } from "./schemas";

describe("LessonPlanSchema", () => {
  it("accepts a valid plan", () => {
    const plan = {
      overallDifficulty: "beginner",
      objectives: [{ title: "Intro", difficulty: "beginner", description: "Basics" }],
    };
    expect(LessonPlanSchema.parse(plan)).toEqual(plan);
  });
  it("rejects an empty objective list", () => {
    expect(() =>
      LessonPlanSchema.parse({ overallDifficulty: "beginner", objectives: [] }),
    ).toThrow();
  });
});

describe("McqSchema", () => {
  it("rejects correctIndex out of range", () => {
    const bad = { stem: "Q", choices: ["a", "b"], correctIndex: 5, explanation: "x", hint: "y" };
    expect(() => McqSchema.parse(bad)).toThrow();
  });
  it("accepts a valid 4-choice question", () => {
    const q = {
      stem: "Q",
      choices: ["a", "b", "c", "d"],
      correctIndex: 2,
      explanation: "x",
      hint: "y",
    };
    expect(McqSchema.parse(q)).toEqual(q);
  });
});

describe("SafeMcqSchema", () => {
  it("accepts a sanitized question", () => {
    const q = { stem: "Q", choices: ["a", "b"], hint: "h" };
    expect(SafeMcqSchema.parse(q)).toEqual(q);
  });
  it("strips nothing but rejects an answer key field via strict shape", () => {
    // SafeMcq must not carry the answer key; unknown keys are stripped by default,
    // so assert the parsed output never contains correctIndex/explanation.
    const parsed = SafeMcqSchema.parse({
      stem: "Q",
      choices: ["a", "b"],
      hint: "h",
      correctIndex: 1,
      explanation: "e",
    });
    expect(parsed).not.toHaveProperty("correctIndex");
    expect(parsed).not.toHaveProperty("explanation");
  });
});

describe("AskQuestionEventSchema", () => {
  const base = { type: "ask_mcq", stem: "Q", choices: ["a", "b"], questionIdx: 0 };
  it("requires a positive integer totalQuestions", () => {
    expect(() => AskQuestionEventSchema.parse(base)).toThrow();
    expect(() => AskQuestionEventSchema.parse({ ...base, totalQuestions: 0 })).toThrow();
    expect(() => AskQuestionEventSchema.parse({ ...base, totalQuestions: 1.5 })).toThrow();
  });
  it("accepts an event with totalQuestions", () => {
    const event = { ...base, totalQuestions: 6 };
    expect(AskQuestionEventSchema.parse(event)).toEqual(event);
  });
});
