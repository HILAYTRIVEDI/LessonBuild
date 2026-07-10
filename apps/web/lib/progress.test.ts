import { describe, expect, it } from "vitest";
import { formatProgress } from "./progress";

describe("formatProgress", () => {
  it("shows position and remaining count", () => {
    expect(formatProgress(1, 6)).toBe("Question 2 of 6 · 4 remaining");
  });
  it("shows zero remaining on the last question", () => {
    expect(formatProgress(5, 6)).toBe("Question 6 of 6 · 0 remaining");
  });
  it("handles a single-question lesson", () => {
    expect(formatProgress(0, 1)).toBe("Question 1 of 1 · 0 remaining");
  });
});
