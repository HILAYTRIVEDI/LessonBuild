import { describe, it, expect, vi, beforeEach } from "vitest";
import { hydrateNode } from "./hydrate";

const getLesson = vi.fn();
vi.mock("@lessonbuild/db", () => ({
  getLesson: (id: string) => getLesson(id),
}));

describe("hydrateNode", () => {
  beforeEach(() => {
    getLesson.mockReset();
  });

  it("validates the lesson without copying docText into graph state", async () => {
    getLesson.mockResolvedValue({ id: "L1", docText: "the source text", title: "T" });
    const out = await hydrateNode({ lessonId: "L1", lessonPlan: null } as never);
    expect(getLesson).toHaveBeenCalledWith("L1");
    expect(out).toEqual({});
  });

  it("skips the DB once a plan exists — the lesson was already validated", async () => {
    const out = await hydrateNode({
      lessonId: "L1",
      lessonPlan: { overallDifficulty: "beginner", objectives: [] },
    } as never);
    expect(getLesson).not.toHaveBeenCalled();
    expect(out).toEqual({});
  });

  it("throws when lessonId is missing", async () => {
    await expect(hydrateNode({ lessonId: "  ", lessonPlan: null } as never)).rejects.toThrow(
      /missing lessonId/,
    );
    expect(getLesson).not.toHaveBeenCalled();
  });

  it("throws when the lesson is not found", async () => {
    getLesson.mockResolvedValue(null);
    await expect(hydrateNode({ lessonId: "L9", lessonPlan: null } as never)).rejects.toThrow(
      /not found/,
    );
  });

  it("throws when the lesson has no extracted text", async () => {
    getLesson.mockResolvedValue({ id: "L1", docText: "   ", title: "T" });
    await expect(hydrateNode({ lessonId: "L1", lessonPlan: null } as never)).rejects.toThrow(
      /no extracted text/,
    );
  });
});
