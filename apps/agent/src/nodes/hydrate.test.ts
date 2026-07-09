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

  it("loads docText from the DB for the given lessonId", async () => {
    getLesson.mockResolvedValue({ id: "L1", docText: "the source text", title: "T" });
    const out = await hydrateNode({ docText: "", lessonId: "L1" } as never);
    expect(getLesson).toHaveBeenCalledWith("L1");
    expect(out.docText).toBe("the source text");
  });

  it("is idempotent — skips the DB when docText is already loaded", async () => {
    const out = await hydrateNode({ docText: "already here", lessonId: "L1" } as never);
    expect(getLesson).not.toHaveBeenCalled();
    expect(out).toEqual({});
  });

  it("throws when lessonId is missing", async () => {
    await expect(hydrateNode({ docText: "", lessonId: "  " } as never)).rejects.toThrow(
      /missing lessonId/,
    );
    expect(getLesson).not.toHaveBeenCalled();
  });

  it("throws when the lesson is not found", async () => {
    getLesson.mockResolvedValue(null);
    await expect(hydrateNode({ docText: "", lessonId: "L9" } as never)).rejects.toThrow(
      /not found/,
    );
  });

  it("throws when the lesson has no extracted text", async () => {
    getLesson.mockResolvedValue({ id: "L1", docText: "   ", title: "T" });
    await expect(hydrateNode({ docText: "", lessonId: "L1" } as never)).rejects.toThrow(
      /no extracted text/,
    );
  });
});
