import { describe, it, expect } from "vitest";
import { buildGraph } from "./graph";

describe("buildGraph", () => {
  it("compiles and runs a trivial pass-through", async () => {
    const graph = buildGraph(); // no checkpointer in unit test
    const out = await graph.invoke({ docText: "hello", lessonId: "L1" });
    expect(out.docText).toBe("hello");
  });
});
