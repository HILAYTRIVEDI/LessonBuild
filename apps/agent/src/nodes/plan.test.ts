import { describe, it, expect, vi, beforeEach } from "vitest";
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

beforeEach(() => {
  getLessonMock.mockReset();
  getLessonMock.mockResolvedValue({ id: "L1", docText: "db text", title: "T" });
});

describe("planNode", () => {
  it("produces a validated lesson plan and persists objectives", async () => {
    const out = await planNode({ lessonId: "L1" } as never, model as never);
    expect(out.lessonPlan).toEqual(fakePlan);
    expect(out.objectiveIds).toEqual(["obj-1", "obj-2"]);
  });

  it("reads the document from the DB and keeps docText out of graph state", async () => {
    const invoke = vi.fn(async () => ({ raw: {}, parsed: fakePlan }));
    const spied = { withStructuredOutput: () => ({ invoke }) };
    const out = await planNode({ lessonId: "L1" } as never, spied as never);
    expect(getLessonMock).toHaveBeenCalledWith("L1");
    expect(invoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ content: expect.stringContaining("db text") }),
      ]),
    );
    expect(out).not.toHaveProperty("docText");
  });

  it("throws a clear error when no lesson has been uploaded", async () => {
    await expect(planNode({ lessonId: "" } as never, model as never)).rejects.toThrow(
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
    const out = await planNode({ lessonId: "L1" } as never, wrapped as never);
    expect(out.lessonPlan).toEqual(fakePlan);
  });

  it("retries once and throws when the model never returns a valid plan", async () => {
    const invoke = vi.fn(async () => ({
      raw: { tool_calls: [{ args: { bad: true } }] },
      parsed: null,
    }));
    const broken = { withStructuredOutput: () => ({ invoke }) };
    await expect(planNode({ lessonId: "L1" } as never, broken as never)).rejects.toThrow(
      /valid lesson plan/i,
    );
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("throws when the lessonId does not exist", async () => {
    getLessonMock.mockResolvedValueOnce(null);
    await expect(planNode({ lessonId: "missing" } as never, model as never)).rejects.toThrow(
      /not found/i,
    );
  });
});
