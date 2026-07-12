import type { Objective, Mcq } from "@lessonbuild/shared";
import { LRUCache } from "lru-cache";
import { getPool, query } from "./client";

/** Persistable chunk of extracted lesson text, ordered for deterministic retrieval. */
export interface LessonChunkInput {
  ord: number;
  content: string;
}

/** Stored lesson chunk returned to retrieval and coaching callers. */
export interface LessonChunk {
  ord: number;
  content: string;
}

/**
 * Creates the lesson record and its searchable chunks in one transaction.
 * The full document stays in `lessons.doc_text`; chunks support smaller
 * retrieval windows for coach and generation prompts.
 */
export async function createLesson(input: {
  title: string;
  sourceFilename: string;
  docText: string;
  chunks?: LessonChunkInput[];
}): Promise<string> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO lessons (title, source_filename, doc_text) VALUES ($1, $2, $3) RETURNING id`,
      [input.title, input.sourceFilename, input.docText],
    );
    const lessonId = rows[0]!.id;
    for (const chunk of input.chunks ?? []) {
      await client.query(
        `INSERT INTO lesson_chunks (lesson_id, ord, content) VALUES ($1, $2, $3)`,
        [lessonId, chunk.ord, chunk.content],
      );
    }
    await client.query("COMMIT");
    return lessonId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** Loads the canonical document text for an uploaded lesson. */
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

/** Returns lesson chunks in their source order for deterministic prompt assembly. */
export async function getLessonChunks(lessonId: string): Promise<LessonChunk[]> {
  const { rows } = await query<{ ord: number; content: string }>(
    `SELECT ord, content FROM lesson_chunks WHERE lesson_id = $1 ORDER BY ord`,
    [lessonId],
  );
  return rows.map((row) => ({ ord: row.ord, content: row.content }));
}

/**
 * Lesson chunks are immutable once created, so retrieval results for a given
 * lesson/query/limit never go stale. TTL is a safety net, not a correctness
 * requirement.
 */
const retrievalCache = new LRUCache<string, string>({ max: 500, ttl: 10 * 60 * 1000 });

/**
 * Retrieves a small context window for a lesson using Postgres full-text rank.
 * If no chunk matches the query, it falls back to the first chunks so callers
 * still get source-grounded context instead of an empty prompt. Results are
 * cached since coach turns repeatedly query the same lesson/question context.
 */
export async function retrieveLessonContext(input: {
  lessonId: string;
  queryText: string;
  limit?: number;
}): Promise<string> {
  const limit = input.limit ?? 4;
  if (limit <= 0) throw new Error("retrieveLessonContext: limit must be positive");

  const cacheKey = `${input.lessonId}::${input.queryText}::${limit}`;
  const cached = retrievalCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const { rows } = await query<{ content: string }>(
    `WITH ranked AS (
       SELECT content,
              row_number() OVER (
                ORDER BY ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', $2)) DESC,
                         ord ASC
              ) AS result_ord,
              ts_rank_cd(to_tsvector('english', content), plainto_tsquery('english', $2)) AS rank
       FROM lesson_chunks
       WHERE lesson_id = $1
         AND plainto_tsquery('english', $2) @@ to_tsvector('english', content)
       ORDER BY rank DESC, ord ASC
       LIMIT $3
     ), fallback AS (
       SELECT content, row_number() OVER (ORDER BY ord ASC) AS result_ord
       FROM lesson_chunks
       WHERE lesson_id = $1
         AND NOT EXISTS (SELECT 1 FROM ranked)
       ORDER BY ord ASC
       LIMIT $3
     )
     SELECT content FROM (
       SELECT content, result_ord FROM ranked
       UNION ALL
       SELECT content, result_ord FROM fallback
     ) contexts
     ORDER BY result_ord`,
    [input.lessonId, input.queryText, limit],
  );
  const context = rows.map((row) => row.content).join("\n\n");
  retrievalCache.set(cacheKey, context);
  return context;
}

/** Saves approved objectives in display order and returns their database ids. */
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

/**
 * Persists a full MCQ, including answer key and explanation. Browser-visible
 * graph state only receives the sanitized shape from the agent.
 */
export async function saveQuestion(objectiveId: string, q: Mcq): Promise<string> {
  const { rows } = await query<{ id: string }>(
    `INSERT INTO questions (objective_id, stem, choices, correct_index, explanation, hint)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [objectiveId, q.stem, JSON.stringify(q.choices), q.correctIndex, q.explanation, q.hint],
  );
  return rows[0]!.id;
}

/** Records one learner attempt for a question, preserving retry order. */
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

/** Returns attempts joined to objective titles for progress-report scoring. */
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

/**
 * Questions are immutable once saved, so the answer key for a question id
 * never goes stale. Evaluate and feedback both look up the same question in
 * one turn, and retries repeat the lookup — cache like retrieval context.
 */
const answerCache = new LRUCache<string, { correctIndex: number; explanation: string }>({
  max: 500,
  ttl: 10 * 60 * 1000,
});

/**
 * Answer-key lookup for the agent's deterministic evaluate/feedback path.
 * The key lives only in Postgres — never in graph state, which CopilotKit
 * streams to the browser.
 */
export async function getQuestionAnswer(
  questionId: string,
): Promise<{ correctIndex: number; explanation: string }> {
  const cached = answerCache.get(questionId);
  if (cached !== undefined) return cached;

  const { rows } = await query<{ correct_index: number; explanation: string }>(
    `SELECT correct_index, explanation FROM questions WHERE id = $1`,
    [questionId],
  );
  if (rows.length === 0) {
    throw new Error(`getQuestionAnswer: question "${questionId}" not found`);
  }
  const answer = { correctIndex: rows[0]!.correct_index, explanation: rows[0]!.explanation };
  answerCache.set(questionId, answer);
  return answer;
}
