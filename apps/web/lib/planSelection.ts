// Pure selection state for the plan approval card: which topics get quizzed
// and how many MCQs each gets. Kept out of the component so it is testable
// (the web package has no component-test harness).

/** Local UI state for one plan objective in the approval card. */
export type TopicSelection = { selected: boolean; count: number };

/** Minimum MCQs allowed for a selected topic. */
export const MIN_QUESTIONS = 1;
/** Maximum MCQs allowed for a selected topic. */
export const MAX_QUESTIONS = 5;
/** Default MCQs per topic before learner customization. */
export const DEFAULT_QUESTIONS = 2;

/** Builds the default approval-card selection state for a generated plan. */
export function initialSelections(topicCount: number): TopicSelection[] {
  return Array.from({ length: topicCount }, () => ({
    selected: true,
    count: DEFAULT_QUESTIONS,
  }));
}

/** Toggles whether a plan topic should receive generated questions. */
export function toggleTopic(selections: TopicSelection[], index: number): TopicSelection[] {
  return selections.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s));
}

/** Updates a topic's MCQ count while enforcing UI-supported bounds. */
export function setCount(
  selections: TopicSelection[],
  index: number,
  count: number,
): TopicSelection[] {
  const clamped = Math.min(MAX_QUESTIONS, Math.max(MIN_QUESTIONS, count));
  return selections.map((s, i) => (i === index ? { ...s, count: clamped } : s));
}

/** Counts the total generated questions implied by the selected topics. */
export function totalQuestions(selections: TopicSelection[]): number {
  return selections.reduce((sum, s) => (s.selected ? sum + s.count : sum), 0);
}

/** A plan can be approved only when at least one topic remains selected. */
export function canApprove(selections: TopicSelection[]): boolean {
  return selections.some((s) => s.selected);
}

/** Wire shape for ApprovePlanResponse.questionCounts: unselected topics send 0. */
export function toQuestionCounts(selections: TopicSelection[]): number[] {
  return selections.map((s) => (s.selected ? s.count : 0));
}
