import { describe, it, expect, vi } from "vitest";
import { planNode } from "./plan";

const getLessonMock = vi.fn();
vi.mock("@lessonbuild/db", () => ({
  saveObjectives: vi.fn(async () => ["obj-1", "obj-2"]),
  getLesson: (id: string) => getLessonMock(id),
}));

const fakePlan = {
  overallDifficulty: "beginner",
  objectives: [
    { title: "A", difficulty: "beginner", description: "a" },
    { title: "B", difficulty: "intermediate", description: "b" },
  ],
};
const model = {
  withStructuredOutput: () => ({ invoke: async () => ({ raw: {}, parsed: fakePlan }) }),
};

describe("planNode", () => {
  it("produces a validated lesson plan and persists objectives", async () => {
    const out = await planNode({ docText: "some text", lessonId: "L1" } as never, model as never);
    expect(out.lessonPlan).toEqual(fakePlan);
    expect(out.objectiveIds).toEqual(["obj-1", "obj-2"]);
  });

  it("loads docText from the database when state has only a lessonId", async () => {
    getLessonMock.mockResolvedValueOnce({ id: "L1", docText: "db text", title: "T" });
    const out = await planNode({ docText: "", lessonId: "L1" } as never, model as never);
    expect(getLessonMock).toHaveBeenCalledWith("L1");
    expect(out.lessonPlan).toEqual(fakePlan);
    expect(out.docText).toBe("db text");
  });

  it("throws a clear error when no lesson has been uploaded", async () => {
    await expect(planNode({ docText: "", lessonId: "" } as never, model as never)).rejects.toThrow(
      /upload a PDF/i,
    );
  });

  it("unwraps a plan the model nested under an extra key", async () => {
    const wrapped = {
      withStructuredOutput: () => ({
        invoke: async () => ({
          raw: { tool_calls: [{ args: { objectives: fakePlan } }] },
          parsed: null,
        }),
      }),
    };
    const out = await planNode({ docText: "t", lessonId: "L1" } as never, wrapped as never);
    expect(out.lessonPlan).toEqual(fakePlan);
  });

  it("retries once and throws when the model never returns a valid plan", async () => {
    const invoke = vi.fn(async () => ({ raw: { tool_calls: [{ args: { bad: true } }] }, parsed: null }));
    const broken = { withStructuredOutput: () => ({ invoke }) };
    await expect(
      planNode({ docText: "t", lessonId: "L1" } as never, broken as never),
    ).rejects.toThrow(/valid lesson plan/i);
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("throws when the lessonId does not exist", async () => {
    getLessonMock.mockResolvedValueOnce(null);
    await expect(
      planNode({ docText: "", lessonId: "missing" } as never, model as never),
    ).rejects.toThrow(/not found/i);
  });
});
