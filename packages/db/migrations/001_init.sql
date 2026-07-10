CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  source_filename text NOT NULL,
  doc_text text NOT NULL,
  overall_difficulty text,
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lesson_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  ord int NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lesson_chunks_ord_nonnegative CHECK (ord >= 0),
  CONSTRAINT lesson_chunks_content_nonempty CHECK (length(btrim(content)) > 0),
  CONSTRAINT lesson_chunks_lesson_ord_unique UNIQUE (lesson_id, ord)
);

CREATE INDEX IF NOT EXISTS lesson_chunks_lesson_id_idx ON lesson_chunks (lesson_id);
CREATE INDEX IF NOT EXISTS lesson_chunks_search_idx ON lesson_chunks
  USING gin (to_tsvector('english', content));

CREATE TABLE IF NOT EXISTS objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  ord int NOT NULL,
  title text NOT NULL,
  difficulty text NOT NULL,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  stem text NOT NULL,
  choices jsonb NOT NULL,
  correct_index int NOT NULL,
  explanation text NOT NULL,
  hint text NOT NULL
);

CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_index int NOT NULL,
  is_correct boolean NOT NULL,
  attempt_no int NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
