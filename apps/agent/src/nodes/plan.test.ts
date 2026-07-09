import { describe, it, expect, vi } from "vitest";
import { planNode } from "./plan";

vi.mock("@lessonbuild/db", () => ({
  saveObjectives: vi.fn(async () => ["obj-1", "obj-2"]),
}));

describe("planNode", () => {
  it("produces a validated lesson plan and persists objectives", async () => {
    const fakePlan = {
      overallDifficulty: "beginner",
      objectives: [
        { title: "A", difficulty: "beginner", description: "a" },
        { title: "B", difficulty: "intermediate", description: "b" },
      ],
    };
    const model = { withStructuredOutput: () => ({ invoke: async () => fakePlan }) };
    const out = await planNode({ docText: "some text", lessonId: "L1" } as never, model as never);
    expect(out.lessonPlan).toEqual(fakePlan);
    expect(out.objectiveIds).toEqual(["obj-1", "obj-2"]);
  });
});
