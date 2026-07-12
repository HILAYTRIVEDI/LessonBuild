import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { LessonPlan, SafeMcq } from "@lessonbuild/shared";

/** Append-only attempt record mirrored from Postgres for routing and scoring. */
export type AttemptRecord = {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  attemptNo: number;
};

/**
 * LangGraph state contract for the lesson lifecycle. Anything stored here may
 * be streamed to the browser, so answer keys and explanations remain in DB.
 */
export const LessonState = Annotation.Root({
  lessonId: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  lessonPlan: Annotation<LessonPlan | null>({ reducer: (_, n) => n, default: () => null }),
  planApproved: Annotation<boolean>({ reducer: (_, n) => n, default: () => false }),
  planFeedback: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),
  objectiveIds: Annotation<string[]>({ reducer: (_, n) => n, default: () => [] }),
  questionCounts: Annotation<number[]>({ reducer: (_, n) => n, default: () => [] }),
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

/** Inferred state shape passed to every graph node. */
export type LessonStateType = typeof LessonState.State;
