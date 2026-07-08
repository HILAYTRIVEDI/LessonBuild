import { Annotation, messagesStateReducer } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { LessonPlan, Mcq } from "@lessonbuild/shared";

export type AttemptRecord = {
  questionIdx: number; selectedIndex: number; isCorrect: boolean; attemptNo: number;
};

export const LessonState = Annotation.Root({
  docText: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  lessonId: Annotation<string>({ reducer: (_, n) => n, default: () => "" }),
  lessonPlan: Annotation<LessonPlan | null>({ reducer: (_, n) => n, default: () => null }),
  planApproved: Annotation<boolean>({ reducer: (_, n) => n, default: () => false }),
  objectiveIds: Annotation<string[]>({ reducer: (_, n) => n, default: () => [] }),
  currentObjectiveIdx: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  questions: Annotation<Mcq[]>({ reducer: (_, n) => n, default: () => [] }),
  questionIds: Annotation<string[]>({ reducer: (_, n) => n, default: () => [] }),
  currentQuestionIdx: Annotation<number>({ reducer: (_, n) => n, default: () => 0 }),
  attempts: Annotation<AttemptRecord[]>({
    reducer: (a, b) => a.concat(b), default: () => [],
  }),
  report: Annotation<string | null>({ reducer: (_, n) => n, default: () => null }),
  messages: Annotation<BaseMessage[]>({ reducer: messagesStateReducer, default: () => [] }),
});

export type LessonStateType = typeof LessonState.State;
