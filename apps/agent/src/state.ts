import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { LessonPlan, SafeMcq } from "@lessonbuild/shared";

export type AttemptRecord = {
  // DB id of the question — a stable key independent of the learner's
  // position, unlike currentQuestionIdx which moves as the quiz advances.
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  attemptNo: number;
};

export const LessonState = Annotation.Root({
  docText: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  lessonId: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  lessonPlan: Annotation<LessonPlan | null>({ reducer: (_, n) => n, default: () => null }),
  planApproved: Annotation<boolean>({ reducer: (_, n) => n, default: () => false }),
  planFeedback: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),
  objectiveIds: Annotation<string[]>({ reducer: (_, n) => n, default: () => [] }),
  // Per-objective MCQ counts from the approved plan (0 = topic skipped).
  // Same length as lessonPlan.objectives once the plan is approved.
  questionCounts: Annotation<number[]>({ reducer: (_, n) => n, default: () => [] }),
  // Sanitized on purpose: CopilotKit streams this state to the browser, so it
  // must never contain correctIndex/explanation. Full rows live in Postgres.
  questions: Annotation<SafeMcq[]>({ reducer: (_, n) => n, default: () => [] }),
  questionIds: Annotation<string[]>({ reducer: (_, n) => n, default: () => [] }),
  currentQuestionIdx: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  attempts: Annotation<AttemptRecord[]>({
    reducer: (a, b) => a.concat(b),
    default: () => [],
  }),
  lastSelectedIndex: Annotation<number | null>({ reducer: (_, n) => n, default: () => null }),
  readyToAdvance: Annotation<boolean>({ reducer: (_, n) => n, default: () => false }),
  report: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
});

export type LessonStateType = typeof LessonState.State;
