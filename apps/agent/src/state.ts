import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { LessonPlan, SafeMcq } from "@lessonbuild/shared";

export type AttemptRecord = {
  // DB id of the question, unique across objectives. currentQuestionIdx resets
  // to 0 per objective, so an index-keyed record would collide across batches.
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
  report: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
});

export type LessonStateType = typeof LessonState.State;
