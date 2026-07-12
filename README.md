# LessonBuild

LessonBuild turns an uploaded PDF into an interactive, AI-guided lesson. It extracts the
source text, proposes a human-reviewed learning plan, lets the learner choose which topics to
quiz and how many questions to generate, runs a guardrailed MCQ practice loop, provides a
separate Lesson Coach for hints, and closes with a personalized progress report.

The application is intentionally scoped as a demo-ready learning workflow. It prioritizes
source-grounded generation, human-in-the-loop plan approval, answer-key safety, and a clean
local development path.

## Current Capabilities

- PDF upload with file type, header, size, timeout, and empty-text checks.
- Text extraction with `unpdf`, followed by ordered overlapping chunks for retrieval.
- Lesson persistence in Postgres for source text, chunks, objectives, questions, and attempts.
- LangGraph lesson lifecycle:
  `hydrate -> plan -> approvePlan -> generateQuestions -> askQuestion -> evaluate -> advance -> summarize`.
- Human approval before quiz generation.
- Per-topic selection during approval, including skipped topics with `0` generated questions.
- MCQ generation grounded in retrieved PDF context.
- Browser-safe question state that excludes `correctIndex` and answer explanations.
- Retry flow for incorrect answers with hint feedback.
- Correct-answer flow with explanation after the learner answers correctly.
- Lesson Coach panel backed by `/api/coach`, retrieved PDF context, and no-answer guardrails.
- CopilotKit runtime proxy for LangGraph interrupts and checkpointed thread state.
- Docker Compose setup for Postgres, agent, and web services.
- Unit tests for web helpers, shared schemas, and agent graph nodes.

## Architecture

```text
Browser
  |
  | PDF upload, lesson UI, MCQ responses, coach chat
  v
apps/web Next.js
  | /api/upload       Extract PDF text, chunk it, create lesson
  | /api/copilotkit   Proxy CopilotKit requests to LangGraph
  | /api/coach        Guardrailed coach chat with retrieved context
  | /api/health       Web health check
  v
apps/agent LangGraph
  | hydrate           Load lesson text by lessonId
  | plan              Generate learning objectives
  | approvePlan       Human-in-the-loop approval interrupt
  | generateQuestions Generate MCQs for selected topics
  | askQuestion       MCQ interrupt without answer key
  | evaluate          Compare answer against Postgres key
  | advance           Move to next question
  | summarize         Final progress report
  v
Postgres via packages/db
  | lessons
  | lesson_chunks
  | objectives
  | questions
  | attempts

packages/shared
  | Zod contracts for lesson plans, MCQs, interrupts, and responses
```

## Repository Layout

| Path                 | Purpose                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/web`           | Next.js App Router UI, API routes, CopilotKit provider, upload flow, coach panel, plan approval card, MCQ widget, progress report |
| `apps/agent`         | LangGraph graph, graph nodes, AI/ML API model adapter, production LangGraph API server                                            |
| `packages/db`        | Postgres pool, migrations, lesson repository functions, retrieval helpers, attempt persistence                                    |
| `packages/shared`    | Zod schemas and TypeScript types shared across web and agent                                                                      |
| `docker-compose.yml` | Local full-stack orchestration for Postgres, agent, and web                                                                       |
| `.env.example`       | Required environment variable template                                                                                            |

### Key Modules

| Module                                  | Purpose                                                                 |
| ---------------------------------------- | ------------------------------------------------------------------------ |
| `apps/web/components/PlanApprovalCard.tsx` | Renders the human-in-the-loop plan approval interrupt UI                |
| `apps/web/components/McqWidget.tsx`      | Renders the MCQ interrupt, retry/hint flow, and correct-answer explanation |
| `apps/web/components/LessonCoachPanel.tsx` | Chat panel backed by `/api/coach`                                       |
| `apps/web/components/ProgressReport.tsx` | Renders the final `summarize` progress report                          |
| `apps/web/lib/pdf.ts`                    | PDF text extraction via `unpdf`                                        |
| `apps/web/lib/textChunks.ts`             | Ordered overlapping chunking for retrieval                             |
| `apps/web/lib/session.ts`                | LocalStorage/cookie handling for `lessonId`                            |
| `apps/web/lib/stage.ts`                  | Client-side lesson stage state machine                                 |
| `apps/web/lib/planSelection.ts`          | Per-topic selection and question-count logic for plan approval          |
| `apps/web/lib/progress.ts`               | Progress report derivation from attempts                               |
| `apps/web/lib/guardrail.ts`              | Coach no-answer-leak guardrail checks                                  |
| `apps/web/lib/coach.ts`                  | Coach request/response schemas, system prompt, AI/ML API call shape    |

## Technology Stack

- Runtime: Node.js 22+
- Package manager: pnpm 9+
- Web: Next.js 15, React 19, Tailwind CSS 3
- Agent: LangGraph.js, LangChain OpenAI adapter
- AI provider: AI/ML API at `https://api.aimlapi.com/v1`
- Runtime bridge: CopilotKit
- Database: Postgres 16
- Validation: Zod at request, graph, and model-output boundaries
- Tests: Vitest
- Linting and formatting: ESLint and Prettier

## Prerequisites

- Node.js `>=22`
- pnpm `9.x`
- Docker and Docker Compose for the recommended full-stack path
- AI/ML API key from `https://api.aimlapi.com`

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

| Variable            | Required       | Used by                | Description                                                    |
| ------------------- | -------------- | ---------------------- | -------------------------------------------------------------- |
| `AIMLAPI_KEY`       | Yes            | web, agent             | API key for AI/ML API model calls                              |
| `LLM_MODEL`         | Yes            | web, agent             | Model name, defaults in code to `claude-sonnet-5` when missing |
| `POSTGRES_USER`     | Yes for Docker | docker-compose         | Postgres user for the local container                          |
| `POSTGRES_PASSWORD` | Yes for Docker | docker-compose         | Postgres password for the local container                      |
| `POSTGRES_DB`       | Yes for Docker | docker-compose         | Postgres database name                                         |
| `DATABASE_URL`      | Yes            | web, agent, db package | Postgres connection string                                     |
| `LANGGRAPH_URL`     | Yes for web    | web                    | LangGraph API URL, usually `http://localhost:2024` locally     |
| `PORT`              | No             | agent                  | Agent server port, defaults in code to `2024`                  |
| `HOST`              | No             | agent                  | Agent server bind host, defaults in code to `0.0.0.0`          |
| `N_WORKERS`         | No             | agent                  | Agent worker count, defaults in code to `10`                   |

Local default:

```bash
DATABASE_URL=postgresql://lessonbuild:lessonbuild@localhost:5432/lessonbuild
LANGGRAPH_URL=http://localhost:2024
```

Docker Compose overrides service-to-service URLs internally so `web` talks to `agent:2024`
and both app services talk to `postgres:5432`.

### Single source of truth for `.env`

There is exactly one `.env` file — the one at the repo root. Docker Compose (`env_file: .env`)
and the agent (`langgraph.json` → `"env": "../../.env"`) both read it directly.

Next.js only loads `.env` from its own app directory, so local `pnpm --filter web dev` needs a
`.env` inside `apps/web`. Rather than keep a second copy that can drift, symlink it to the root file:

```bash
ln -s ../../.env apps/web/.env
```

Do this once after cloning. Now root `.env` is the only file you ever edit, and the web app sees the
same values. (`.env` files are gitignored, so the symlink is a per-clone local setup step.)

## Quick Start With Docker

```bash
pnpm install
cp .env.example .env
# Fill AIMLAPI_KEY in .env
docker compose up --build
```

Open `http://localhost:3000` after the services are healthy.

Services:

| Service    | Port   | Notes                                            |
| ---------- | ------ | ------------------------------------------------ |
| `postgres` | `5432` | Postgres 16 with persistent `pgdata` volume      |
| `agent`    | `2024` | LangGraph API server, runs migrations on startup |
| `web`      | `3000` | Next.js app                                      |

## Local Development Without Full Docker

Run Postgres only:

```bash
pnpm install
cp .env.example .env
# Fill AIMLAPI_KEY in .env
docker compose up postgres -d
pnpm --filter @lessonbuild/db migrate
```

Start the agent and web app in separate terminals:

```bash
pnpm --filter agent dev
```

```bash
pnpm --filter web dev
```

Open `http://localhost:3000`.

The agent dev server runs on `http://localhost:2024` with `--no-browser`.

## Root Scripts

| Command             | Description                                                                       |
| ------------------- | --------------------------------------------------------------------------------- |
| `pnpm dev`          | Runs web and agent dev servers in parallel                                        |
| `pnpm test`         | Runs all Vitest suites, including DB integration tests when Postgres is reachable |
| `pnpm lint`         | Runs ESLint across the monorepo                                                   |
| `pnpm format`       | Formats the repo with Prettier                                                    |
| `pnpm format:check` | Checks formatting without writing                                                 |

## Package Scripts

| Command                                  | Description                                  |
| ---------------------------------------- | -------------------------------------------- |
| `pnpm --filter web dev`                  | Starts Next.js on port `3000`                |
| `pnpm --filter web build`                | Builds the web app                           |
| `pnpm --filter web start`                | Starts the built web app on port `3000`      |
| `pnpm --filter web test`                 | Runs web package tests                       |
| `pnpm --filter agent dev`                | Starts LangGraph dev server on port `2024`   |
| `pnpm --filter agent build`              | Builds the production agent bundle with tsup |
| `pnpm --filter agent start`              | Starts the compiled LangGraph API server     |
| `pnpm --filter agent typecheck`          | Runs TypeScript type checking for the agent  |
| `pnpm --filter agent test`               | Runs agent tests                             |
| `pnpm --filter @lessonbuild/db migrate`  | Applies the Postgres schema                  |
| `pnpm --filter @lessonbuild/shared test` | Runs shared schema tests                     |

## User Workflow

1. Upload a PDF from the homepage.
2. `/api/upload` validates the file, extracts text, chunks it, and creates a lesson record.
3. The browser stores the returned `lessonId` in localStorage and a SameSite cookie.
4. The learner starts the lesson.
5. `/api/copilotkit` forwards the selected `lessonId` into the LangGraph run state.
6. `hydrate` loads the canonical document text from Postgres.
7. `plan` generates a learning plan from the source document.
8. `approvePlan` interrupts for human approval.
9. The learner can approve, request changes, skip topics, or set question counts.
10. `generateQuestions` retrieves source context per selected topic and creates MCQs.
11. `askQuestion` sends a sanitized MCQ interrupt to the UI.
12. `evaluate` reads the answer key from Postgres and records the attempt.
13. Incorrect answers show hint feedback and allow retry.
14. Correct answers show explanation and allow continuing.
15. `summarize` creates a final progress report after all generated questions are complete.

## API Routes

| Route             | Method | Runtime | Purpose                                                                                        |
| ----------------- | ------ | ------- | ---------------------------------------------------------------------------------------------- |
| `/api/upload`     | `POST` | Node.js | Accepts one PDF file, extracts text, stores lesson and chunks, returns `lessonId`              |
| `/api/copilotkit` | `POST` | Node.js | Proxies CopilotKit traffic to LangGraph and injects selected lesson state                      |
| `/api/coach`      | `POST` | Node.js | Validates coach chat input, retrieves lesson context, calls AI/ML API, returns a checked reply |
| `/api/health`     | `GET`  | Node.js | Returns `{ "ok": true }` for health checks                                                     |

Upload constraints:

- Max PDF size: 20 MB.
- Parse timeout: 20 seconds.
- Requires a `.pdf` filename or `application/pdf` content type.
- Requires a `%PDF-` file header.
- Returns `422` when no text can be extracted.

Coach constraints:

- User message length: 1 to 4000 characters.
- History length: maximum 12 messages by schema.
- Active question context excludes answer keys.
- Coach responses are instructed not to reveal the correct choice or index.

## Data Model

The initial migration creates:

| Table           | Purpose                                                           |
| --------------- | ----------------------------------------------------------------- |
| `lessons`       | Source file metadata, full extracted text, status, and difficulty |
| `lesson_chunks` | Ordered chunks for Postgres full-text retrieval                   |
| `objectives`    | Approved learning objectives for a lesson                         |
| `questions`     | Full MCQs, including answer key and explanation                   |
| `attempts`      | Learner selections, correctness, retry number, and timestamp      |

Important safety boundary:

- Full MCQs in `questions` include `correct_index` and `explanation`.
- Graph state uses `SafeMcq` and never stores `correctIndex`.
- Browser-visible interrupts never include the answer key.
- The explanation is fetched only after a correct answer is recorded.

## Security And Guardrails

- Secrets are read from environment variables only.
- `AIMLAPI_KEY` must not be committed.
- Runtime inputs are validated with Zod at API and graph boundaries.
- The CopilotKit route treats the lesson cookie as attacker-controlled and only accepts UUIDs.
- The active answer key is never sent to the browser.
- Lesson Coach may provide conceptual help, hints, and vocabulary explanations.
- Lesson Coach must not reveal the correct option, correct index, or eliminate choices one by one.
- LLM outputs are parsed through structured Zod schemas before use.

## Testing And Verification

Fast validation for most development changes:

```bash
pnpm lint
pnpm --filter web test
pnpm --filter agent test
pnpm --filter @lessonbuild/shared test
```

Full validation:

```bash
docker compose up postgres -d
pnpm --filter @lessonbuild/db migrate
pnpm test
```

`pnpm test` includes DB integration coverage in `packages/db/src/lessons.test.ts`. That suite
requires a reachable Postgres instance at the configured `DATABASE_URL`.

### Continuous Integration

`.github/workflows/ci.yml` runs on every push and pull request to `main`: install with a frozen
lockfile, `pnpm lint`, `pnpm format:check`, then `pnpm test`.

## Troubleshooting

### `pnpm test` fails with `ECONNREFUSED 127.0.0.1:5432`

Postgres is not running or `DATABASE_URL` points to the wrong host.

```bash
docker compose up postgres -d
pnpm --filter @lessonbuild/db migrate
pnpm test
```

### Lesson starts but the agent cannot find a lesson

Check that:

- Upload completed successfully.
- Browser localStorage contains `lessonbuild.lessonId`.
- The `lessonbuild.lessonId` cookie contains a UUID.
- `LANGGRAPH_URL` points to the running agent.
- The agent can connect to the same Postgres database as the web app.

### Lesson Coach returns a 503

`AIMLAPI_KEY` is missing in the environment used by the web service.

### Lesson Coach returns a 502

The AI/ML API request failed or returned a response that did not match the expected schema.
Check `AIMLAPI_KEY`, `LLM_MODEL`, and network access from the web runtime.

### Upload returns `422`

The PDF parsed successfully but did not yield text. Try a text-based PDF instead of a scanned
image-only document.

## Development Standards

- Keep TypeScript strict.
- Prefer `unknown` plus runtime narrowing over `any`.
- Parse untrusted inputs with Zod.
- Keep cross-package imports through package entrypoints.
- Keep answer keys out of browser-visible state.
- Do not introduce gradients in the UI.
- Keep comments focused on contracts, non-obvious behavior, and safety boundaries.

## Known Scope

- Authentication and multi-user tenancy are not implemented.
- Uploaded documents are stored in the local configured Postgres database.
- Vector embeddings are not used. Retrieval currently uses Postgres full-text ranking with a
  deterministic first-chunk fallback.
- The UI is optimized for the demo learning flow, not for a full content-management product.
- DB integration tests require local Postgres. They are not pure unit tests.
