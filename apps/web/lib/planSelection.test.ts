import { describe, it, expect } from "vitest";
import {
  initialSelections,
  toggleTopic,
  setCount,
  totalQuestions,
  canApprove,
  toQuestionCounts,
} from "./planSelection";

describe("planSelection", () => {
  it("starts with every topic selected at 2 questions", () => {
    expect(initialSelections(3)).toEqual([
      { selected: true, count: 2 },
      { selected: true, count: 2 },
      { selected: true, count: 2 },
    ]);
  });

  it("toggles a topic without mutating the input", () => {
    const before = initialSelections(2);
    const after = toggleTopic(before, 1);
    expect(after[1]).toEqual({ selected: false, count: 2 });
    expect(before[1]).toEqual({ selected: true, count: 2 });
    expect(toggleTopic(after, 1)[1]).toEqual({ selected: true, count: 2 });
  });

  it("clamps counts to the 1-5 stepper range", () => {
    const sel = initialSelections(1);
    expect(setCount(sel, 0, 9)[0]!.count).toBe(5);
    expect(setCount(sel, 0, 0)[0]!.count).toBe(1);
    expect(setCount(sel, 0, 4)[0]!.count).toBe(4);
  });

  it("totals only selected topics", () => {
    const sel = setCount(toggleTopic(initialSelections(3), 2), 0, 3);
    expect(totalQuestions(sel)).toBe(5); // 3 + 2 + skipped
  });

  it("blocks approval when nothing is selected", () => {
    const none = toggleTopic(initialSelections(1), 0);
    expect(canApprove(initialSelections(1))).toBe(true);
    expect(canApprove(none)).toBe(false);
  });

  it("maps unselected topics to a count of 0", () => {
    const sel = setCount(toggleTopic(initialSelections(3), 1), 2, 5);
    expect(toQuestionCounts(sel)).toEqual([2, 0, 5]);
  });
});
