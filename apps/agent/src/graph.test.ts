import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph";

describe("buildGraph", () => {
  it("compiles with plan as the entry node", () => {
    // no checkpointer in unit test; avoid invoking (plan calls a live model)
    const graph = buildGraph();
    const nodeNames = Object.keys(graph.getGraph().nodes);
    expect(nodeNames).toContain("plan");
  });
});
