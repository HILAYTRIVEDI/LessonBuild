// Requires a running Postgres locally (`docker compose up postgres -d`); CI has a postgres service.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { runMigrations } from "./migrate.js";
import { pool } from "./client.js";
import {
  createLesson,
  getLesson,
  saveObjectives,
  saveQuestion,
  recordAttempt,
  getAttempts,
} from "./lessons.js";

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
});
