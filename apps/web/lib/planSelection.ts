// Pure selection state for the plan approval card: which topics get quizzed
// and how many MCQs each gets. Kept out of the component so it is testable
// (the web package has no component-test harness).

export type TopicSelection = { selected: boolean; count: number };

export const MIN_QUESTIONS = 1;
export const MAX_QUESTIONS = 5;
export const DEFAULT_QUESTIONS = 2;

export function initialSelections(topicCount: number): TopicSelection[] {
  return Array.from({ length: topicCount }, () => ({
    selected: true,
    count: DEFAULT_QUESTIONS,
  }));
}

export function toggleTopic(selections: TopicSelection[], index: number): TopicSelection[] {
  return selections.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s));
}

export function setCount(
  selections: TopicSelection[],
  index: number,
  count: number,
): TopicSelection[] {
  const clamped = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, count));
  return selections.map((s, i) => (i === index ? { ...s, count: clamped } : s));
}

export function totalQuestions(selections: TopicSelection[]): number {
  return selections.reduce((sum, s) => (s.selected ? sum + s.count : sum), 0);
}

export function canApprove(selections: TopicSelection[]): boolean {
  return selections.some((s) => s.selected);
}

/** Wire shape for ApprovePlanResponse.questionCounts: unselected topics send 0. */
export function toQuestionCounts(selections: TopicSelection[]): number[] {
  return selections.map((s) => (s.selected ? s.count : 0));
}
