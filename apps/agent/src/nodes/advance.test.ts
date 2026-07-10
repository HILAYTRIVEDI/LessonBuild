import { describe, it, expect } from "vitest";
import { advanceNode, routeAfterAdvance } from "./advance.js";
import type { LessonStateType } from "../state.js";

const questions = [
  { stem: "Q1", choices: ["a", "b"], hint: "h" },
  { stem: "Q2", choices: ["a", "b"], hint: "h" },
  { stem: "Q3", choices: ["a", "b"], hint: "h" },
];

describe("advance", () => {
  it("moves to the next question", async () => {
    const out = await advanceNode({
      currentQuestionIdx: 0,
      questions,
    } as unknown as LessonStateType);
    expect(out.currentQuestionIdx).toBe(1);
    expect(routeAfterAdvance({ ...out, questions } as unknown as LessonStateType)).toBe(
      "askQuestion",
    );
  });

  it("keeps asking until the last question", async () => {
    const out = await advanceNode({
      currentQuestionIdx: 1,
      questions,
    } as unknown as LessonStateType);
    expect(out.currentQuestionIdx).toBe(2);
    expect(routeAfterAdvance({ ...out, questions } as unknown as LessonStateType)).toBe(
      "askQuestion",
    );
  });

  it("summarizes after the last question", async () => {
    const out = await advanceNode({
      currentQuestionIdx: 2,
      questions,
    } as unknown as LessonStateType);
    expect(out.currentQuestionIdx).toBe(3);
    expect(routeAfterAdvance({ ...out, questions } as unknown as LessonStateType)).toBe(
      "summarize",
    );
  });
});
