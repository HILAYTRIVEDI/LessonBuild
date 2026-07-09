import type { Objective, Mcq } from "@lessonbuild/shared";
import { query } from "./client";

export async function createLesson(input: {
  title: string;
  sourceFilename: string;
  docText: string;
}): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO lessons (title, source_filename, doc_text) VALUES ($1, $2, $3) RETURNING id`,
    [input.title, input.sourceFilename, input.docText],
  );
  return rows[0]!.id;
}

export async function getLesson(
  id: string,
): Promise<{ id: string; docText: string; title: string } | null> {
  const { rows } = await query<{ id: string; doc_text: string; title: string }>(
    `SELECT id, doc_text, title FROM lessons WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) return null;
  return { id: rows[0]!.id, docText: rows[0]!.doc_text, title: rows[0]!.title };
}

export async function saveObjectives(lessonId: string, objectives: Objective[]): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < objectives.length; i++) {
    const o = objectives[i]!;
    const { rows } = await query<{ id: string }>(
      `INSERT INTO objectives (lesson_id, ord, title, difficulty, description)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [lessonId, i, o.title, o.difficulty, o.description],
    );
    ids.push(rows[0]!.id);
  }
  return ids;
}

export async function saveQuestion(objectiveId: string, q: Mcq): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO questions (objective_id, stem, choices, correct_index, explanation, hint)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [objectiveId, q.stem, JSON.stringify(q.choices), q.correctIndex, q.explanation, q.hint],
  );
  return rows[0]!.id;
}

export async function recordAttempt(input: {
  questionId: string;
  selectedIndex: number;
  isCorrect: boolean;
  attemptNo: number;
}): Promise<void> {
  await query(
    `INSERT INTO attempts (question_id, selected_index, is_correct, attempt_no)
     VALUES ($1, $2, $3, $4)`,
    [input.questionId, input.selectedIndex, input.isCorrect, input.attemptNo],
  );
}

export async function getAttempts(
  lessonId: string,
): Promise<{ objectiveTitle: string; isCorrect: boolean; attemptNo: number }[]> {
  const { rows } = await query<{
    objective_title: string;
    is_correct: boolean;
    attempt_no: number;
  }>(
    `SELECT o.title AS objective_title, a.is_correct, a.attempt_no
     FROM attempts a
     JOIN questions q ON q.id = a.question_id
     JOIN objectives o ON o.id = q.objective_id
     WHERE o.lesson_id = $1
     ORDER BY o.ord, a.attempt_no`,
    [lessonId],
  );
  return rows.map((r) => ({
    objectiveTitle: r.objective_title,
    isCorrect: r.is_correct,
    attemptNo: r.attempt_no,
  }));
}
