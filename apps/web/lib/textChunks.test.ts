import { describe, expect, it } from "vitest";
import { chunkText } from "./textChunks";

describe("chunkText", () => {
  it("returns one normalized chunk for short text", () => {
    expect(chunkText(" Alpha\n\n beta. ", { chunkChars: 50, overlapChars: 5 })).toEqual([
      { ord: 0, content: "Alpha beta." },
    ]);
  });

  it("splits long text into ordered overlapping chunks", () => {
    const text = "0123456789 ".repeat(8);
    const chunks = chunkText(text, { chunkChars: 25, overlapChars: 5 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.ord)).toEqual(chunks.map((_, index) => index));
    expect(chunks[1]?.content.startsWith(chunks[0]!.content.slice(-5))).toBe(true);
  });

  it("rejects invalid chunk settings", () => {
    expect(() => chunkText("x", { chunkChars: 10, overlapChars: 10 })).toThrow(/smaller/);
  });
});
