import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractText } from "./pdf";

describe("extractText", () => {
  it("extracts text from a PDF buffer", async () => {
    const data = new Uint8Array(readFileSync(new URL("./__fixtures__/sample.pdf", import.meta.url)));
    const text = await extractText(data);
    expect(text.toLowerCase()).toContain("lessonbuild");
  });
});
