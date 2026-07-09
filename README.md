# LessonBuild

LessonBuild turns any PDF of learning material into an interactive, AI-guided lesson: it
proposes a learning plan, asks for your approval, quizzes you with generated multiple-choice
questions grounded in the source document, gives immediate feedback (with guardrailed hints
that never reveal the answer), and closes with a personalized progress report.

## Architecture

```
┌─────────────┐      upload PDF       ┌──────────────────┐
│   Browser    │ ───────────────────▶ │  apps/web (Next)  │
│ (CopilotKit  │                       │  /api/upload       │
│  sidebar UI) │ ◀──── lessonId ────── │  /api/copilotkit    │
└─────────────┘                       └─────────┬─────────┘
       ▲                                          │ agent runs (LangGraph)
       │ shared state / HITL interrupts           ▼
       │                                ┌───────────────────┐
       └───────────────────────────────▶│ apps/agent          │
                                         │ plan → approvePlan   │
                                         │ → generateQuestions  │
                                         │ → askQuestion         │
                                         │ → evaluate → advance   │
                                         │ → summarize             │
                                         └─────────┬───────────────┘
                                                    │
                                                    ▼
                                          ┌───────────────────┐
                                          │ Postgres (packages/db)│
                                          │ lessons/objectives/   │
                                          │ questions/attempts    │
                                          └───────────────────────┘
```

- **`apps/web`** — Next.js app. Upload route extracts PDF text, CopilotKit sidebar drives the
  conversational lesson experience, and React components render the plan approval card, MCQ
  widget, and progress report.
- **`apps/agent`** — LangGraph.js agent graph. Each node (`plan`, `approvePlan`,
  `generateQuestions`, `askQuestion`, `evaluate`, `advance`, `summarize`) is a discrete step in
  the lesson loop, with human-in-the-loop interrupts for plan approval and question answering.
- **`packages/db`** — Postgres access layer (lessons, objectives, questions, attempts).
- **`packages/shared`** — Zod schemas shared between the agent and the web app (lesson plan,
  MCQ, etc.).

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for the one-command full stack)
- An AI/ML API key (https://api.aimlapi.com) for the LLM calls

## Setup

```bash
cp .env.example .env
# then fill in AIMLAPI_KEY in .env
```

`.env.example` documents every required variable: `AIMLAPI_KEY`, `LLM_MODEL`, Postgres
credentials, `DATABASE_URL`, and `LANGGRAPH_URL`.

## Running with Docker (recommended)

```bash
docker compose up --build
```

This boots three services in order — `postgres` (with a healthcheck), `agent` (LangGraph
server, runs DB migrations on start), and `web` (Next.js, served on `:3000`) — each waiting on
its dependency's healthcheck before starting.

Once healthy, open http://localhost:3000.

## Running locally without Docker

```bash
pnpm install
docker compose up postgres -d      # Postgres only
pnpm --filter @lessonbuild/db migrate
pnpm --filter agent dev            # LangGraph dev server on :2024
pnpm --filter web dev              # Next.js dev server on :3000
```

## Demo flow

1. **Upload** — drop a PDF (see `samples/`) on the homepage. Its text is extracted and a
   lesson record is created.
2. **Plan proposal** — the agent reads the document and proposes a set of learning objectives.
   Nothing proceeds until you **approve the plan** in the approval card (human-in-the-loop).
3. **Questions** — the agent generates multiple-choice questions per objective, grounded in the
   uploaded document.
4. **Answer** — pick a choice. An incorrect answer shows a **red** highlight, an explanation,
   and a hint, then lets you retry with no penalty. You can also ask the assistant for help —
   it will give conceptual hints but is guardrailed to never reveal the correct choice while a
   question is active.
5. **Correct answer** — shows a **green** highlight and explanation, then advances to the next
   question or objective.
6. **Progress report** — once every objective is complete, the agent produces a report with
   per-objective first-try accuracy and personalized study tips.

## Testing

```bash
pnpm test     # unit tests across all workspaces
pnpm lint     # eslint
```
