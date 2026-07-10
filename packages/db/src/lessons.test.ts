// Requires a running Postgres locally (`docker compose up postgres -d`); CI has a postgres service.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runMigrations } from "./migrate";
import { pool } from "./client";
import {
  createLesson,
  getLesson,
  saveObjectives,
  saveQuestion,
  recordAttempt,
  getAttempts,
  getQuestionAnswer,
} from "./lessons";

beforeAll(async () => {
  await runMigrations();
});
afterAll(async () => {
  await pool.end();
});

describe("lesson data access", () => {
  it("round-trips a lesson through objectives, questions, and attempts", async () => {
    const lessonId = await createLesson({ title: "T", sourceFilename: "t.pdf", docText: "hello" });
    const lesson = await getLesson(lessonId);
    expect(lesson?.docText).toBe("hello");

    const [objId] = await saveObjectives(lessonId, [
      { title: "O1", difficulty: "beginner", description: "d" },
    ]);
    const qId = await saveQuestion(objId as string, {
      stem: "Q",
      choices: ["a", "b"],
      correctIndex: 1,
      explanation: "e",
      hint: "h",
    });
    await recordAttempt({ questionId: qId, selectedIndex: 0, isCorrect: false, attemptNo: 1 });
    await recordAttempt({ questionId: qId, selectedIndex: 1, isCorrect: true, attemptNo: 2 });

    const attempts = await getAttempts(lessonId);
    expect(attempts).toHaveLength(2);
    expect(attempts.filter((a) => a.isCorrect)).toHaveLength(1);
  });

  it("returns the answer key for a saved question by id", async () => {
    const lessonId = await createLesson({ title: "T2", sourceFilename: "t.pdf", docText: "x" });
    const [objId] = await saveObjectives(lessonId, [
      { title: "O1", difficulty: "beginner", description: "d" },
    ]);
    const qId = await saveQuestion(objId as string, {
      stem: "Q",
      choices: ["a", "b", "c"],
      correctIndex: 2,
      explanation: "because c",
      hint: "h",
    });
    const answer = await getQuestionAnswer(qId);
    expect(answer).toEqual({ correctIndex: 2, explanation: "because c" });
  });

  it("throws for an unknown question id", async () => {
    await expect(getQuestionAnswer("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      /not found/,
    );
  });
});
