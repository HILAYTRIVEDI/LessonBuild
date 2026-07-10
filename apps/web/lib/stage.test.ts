import { describe, expect, it } from "vitest";
import type { AskQuestionEvent, LessonPlan } from "@lessonbuild/shared";
import { deriveStage } from "./stage";
import type { PendingInterrupt } from "./stage";

const plan: LessonPlan = {
  overallDifficulty: "beginner",
  objectives: [{ title: "Objective", difficulty: "beginner", description: "Desc" }],
};

const mcqEvent: AskQuestionEvent = {
  type: "ask_mcq",
  stem: "What is 2 + 2?",
  choices: ["3", "4"],
  questionIdx: 0,
};

const planInterrupt: PendingInterrupt = { kind: "plan", plan, respond: () => {} };
const mcqInterrupt: PendingInterrupt = { kind: "mcq", event: mcqEvent, respond: () => {} };

const base = { lessonId: null, working: false, pending: null, report: null };

describe("deriveStage", () => {
  it("shows the upload stage when nothing has happened yet", () => {
    expect(deriveStage(base)).toEqual({ kind: "upload" });
  });

  it("shows the ready stage once a lesson is uploaded", () => {
    expect(deriveStage({ ...base, lessonId: "abc" })).toEqual({ kind: "ready", lessonId: "abc" });
  });

  it("shows the working stage while the agent runs with no pending interrupt", () => {
    expect(deriveStage({ ...base, lessonId: "abc", working: true })).toEqual({ kind: "working" });
  });

  it("surfaces a pending plan interrupt as the plan stage", () => {
    expect(
      deriveStage({ ...base, lessonId: "abc", working: true, pending: planInterrupt }),
    ).toEqual({ kind: "plan", interrupt: planInterrupt });
  });

  it("surfaces a pending MCQ interrupt as the question stage", () => {
    expect(deriveStage({ ...base, lessonId: "abc", working: true, pending: mcqInterrupt })).toEqual(
      { kind: "question", interrupt: mcqInterrupt },
    );
  });

  it("prefers a pending interrupt over the report", () => {
    expect(
      deriveStage({ ...base, lessonId: "abc", pending: mcqInterrupt, report: "done" }),
    ).toEqual({ kind: "question", interrupt: mcqInterrupt });
  });

  it("shows the report as soon as it streams in, even while the run finishes", () => {
    expect(deriveStage({ ...base, lessonId: "abc", working: true, report: "done" })).toEqual({
      kind: "report",
      report: "done",
    });
  });
});
