// Requires a running Postgres locally (`docker compose up postgres -d`); CI has a postgres service.
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { runMigrations } from "./migrate";
import { getPool } from "./client";
import * as client from "./client";
import {
  createLesson,
  getLessonChunks,
  getLesson,
  saveObjectives,
  saveQuestion,
  recordAttempt,
  getAttempts,
  getQuestionAnswer,
  retrieveLessonContext,
} from "./lessons";

beforeAll(async () => {
  await runMigrations();
});
afterAll(async () => {
  await getPool().end();
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

  it("stores lesson chunks and retrieves relevant context", async () => {
    const lessonId = await createLesson({
      title: "Chunked",
      sourceFilename: "chunked.pdf",
      docText: "photosynthesis text respiration text",
      chunks: [
        { ord: 0, content: "Photosynthesis uses light to make glucose." },
        { ord: 1, content: "Cellular respiration releases stored energy." },
      ],
    });

    const chunks = await getLessonChunks(lessonId);
    expect(chunks).toEqual([
      { ord: 0, content: "Photosynthesis uses light to make glucose." },
      { ord: 1, content: "Cellular respiration releases stored energy." },
    ]);

    await expect(
      retrieveLessonContext({ lessonId, queryText: "stored energy", limit: 1 }),
    ).resolves.toBe("Cellular respiration releases stored energy.");
  });

  it("falls back to leading chunks when retrieval has no lexical match", async () => {
    const lessonId = await createLesson({
      title: "Fallback",
      sourceFilename: "fallback.pdf",
      docText: "alpha beta",
      chunks: [
        { ord: 0, content: "Alpha opening context." },
        { ord: 1, content: "Beta later context." },
      ],
    });

    await expect(retrieveLessonContext({ lessonId, queryText: "zzzzzz", limit: 1 })).resolves.toBe(
      "Alpha opening context.",
    );
  });

  it("caches retrieval results and skips the DB on a repeated query", async () => {
    const lessonId = await createLesson({
      title: "Cached",
      sourceFilename: "cached.pdf",
      docText: "mitochondria text",
      chunks: [{ ord: 0, content: "The mitochondria is the powerhouse of the cell." }],
    });

    const first = await retrieveLessonContext({ lessonId, queryText: "powerhouse", limit: 1 });
    const querySpy = vi.spyOn(client, "query");
    const second = await retrieveLessonContext({ lessonId, queryText: "powerhouse", limit: 1 });

    expect(second).toBe(first);
    expect(querySpy).not.toHaveBeenCalled();

    querySpy.mockRestore();
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

  it("caches the answer key and skips the DB on a repeated lookup", async () => {
    const lessonId = await createLesson({ title: "T3", sourceFilename: "t.pdf", docText: "x" });
    const [objId] = await saveObjectives(lessonId, [
      { title: "O1", difficulty: "beginner", description: "d" },
    ]);
    const qId = await saveQuestion(objId as string, {
      stem: "Q",
      choices: ["a", "b"],
      correctIndex: 0,
      explanation: "because a",
      hint: "h",
    });

    const first = await getQuestionAnswer(qId);
    const querySpy = vi.spyOn(client, "query");
    const second = await getQuestionAnswer(qId);

    expect(second).toEqual(first);
    expect(querySpy).not.toHaveBeenCalled();

    querySpy.mockRestore();
  });

  it("throws for an unknown question id", async () => {
    await expect(getQuestionAnswer("00000000-0000-0000-0000-000000000000")).rejects.toThrow(
      /not found/,
    );
  });
});
