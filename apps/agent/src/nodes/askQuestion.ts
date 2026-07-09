import { interrupt } from "@langchain/langgraph";
import type { AskQuestionEvent, AskQuestionResponse } from "@lessonbuild/shared";
import type { LessonStateType } from "../state.js";

export async function askQuestionNode(state: LessonStateType): Promise<Partial<LessonStateType>> {
  const question = state.questions[state.currentQuestionIdx]!;
  const resumed = interrupt<AskQuestionEvent, AskQuestionResponse>({
    type: "ask_mcq",
    stem: question.stem,
    choices: question.choices,
    questionIdx: state.currentQuestionIdx,
  });
  return { lastSelectedIndex: resumed.selectedIndex };
}
