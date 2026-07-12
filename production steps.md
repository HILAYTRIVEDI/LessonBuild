# LessonBuild Production Readiness Notes

LessonBuild is not meant to pretend to be a finished SaaS platform today. I built it as a production-shaped prototype: enough real architecture to prove the core AI learning loop, while keeping the scope tight enough to finish and explain clearly.

The current product proves the hard part first: a learner uploads a PDF, the system extracts source text, drafts a lesson plan, pauses for human approval, generates grounded MCQs, keeps the answer key out of browser-visible state, gives feedback and retries, and ends with a progress report. That is the right demo slice. The remaining work is the production hardening layer around that core.

This document lays out those intentional gaps and the technical path I would take to make LessonBuild production-ready.

## Current Production Boundary

Right now, LessonBuild is a single-user demo workflow with production-minded internals. It has a Next.js web app, LangGraph agent service, Postgres persistence, shared Zod schemas, Docker Compose, strict TypeScript, and unit coverage around most of the core logic.

The current boundary is deliberate:

- No authentication.
- No multi-tenant authorization.
- No Redis/BullMQ job layer.
- No worker fleet.
- No object storage for uploaded PDFs.
- No enterprise observability stack.
- No compliance posture yet.
- No full E2E production test suite.

That keeps the demo focused on the learning experience and the AI architecture. For production, these are the areas I would harden next.

## 1. Authentication, Authorization, And Tenancy

The demo currently stores the active lesson in browser state and a lesson id cookie. That is fine for a local single-user walkthrough, but it is not a production security model.

For production, I would introduce a real identity and ownership model:

- Add an auth provider such as Clerk, Auth0, Cognito, Supabase Auth, or a custom OIDC flow.
- Add `users`, `organizations`, `memberships`, and roles in Postgres.
- Attach `lessons`, `objectives`, `questions`, `attempts`, agent threads, and background jobs to both a user and a tenant.
- Enforce ownership checks in every API route, DB repository function, and agent entrypoint.
- Replace the current client-set lesson cookie with a server-issued signed session cookie.
- Mark session cookies as `HttpOnly`, `Secure`, and `SameSite`.
- Add role-based access control for learner, instructor, admin, and internal worker roles.
- Add audit logs for upload, plan approval, generation, answer attempts, report access, and admin actions.

The goal is simple: no user should ever be able to guess or reuse another lesson id and access someone else's learning data.

## 2. Redis And BullMQ Background Processing

Redis and BullMQ are the biggest missing infrastructure piece. The current app does expensive operations inline: upload parsing happens in the request path, and AI generation runs as part of the interactive agent flow. That is acceptable for a demo, but production needs queues, retries, backpressure, and worker isolation.

I would add Redis as a first-class service and BullMQ as the job layer.

The first queues I would create:

- `parse-pdf`
- `chunk-document`
- `generate-plan`
- `generate-questions`
- `summarize-report`
- `coach-turn`, if coach responses need async processing or streaming
- `cleanup-expired-data`

The production shape would be:

```text
web
  -> validates request
  -> creates database row
  -> enqueues BullMQ job
  -> returns jobId

worker
  -> consumes queue
  -> parses PDF / calls LLM / persists result
  -> updates job status

Redis
  -> queue, retries, locks, delayed jobs, backoff

Postgres
  -> durable lesson data and user-visible job status
```

Technically, this means adding:

- A dedicated worker service separate from `apps/web` and `apps/agent`.
- BullMQ producers in API routes and agent nodes where work should become asynchronous.
- BullMQ consumers with bounded concurrency per job type.
- Exponential backoff for transient failures.
- Dead-letter handling for permanently failed jobs.
- Job timeouts for PDF parsing and LLM calls.
- Idempotency keys so retries do not duplicate lessons, objectives, questions, or attempts.
- A `jobs` or `lesson_jobs` table in Postgres with `queued`, `running`, `succeeded`, `failed`, `cancelled`, and `retrying` states.
- UI progress via polling, SSE, or websockets.
- Queue dashboards for operational visibility.

This is the layer that turns the app from "works in a demo request cycle" into "can survive real user load and flaky external dependencies."

## 3. Upload And Document Processing Hardening

The current upload route already checks the file type, PDF header, size, parse timeout, and empty extracted text. That is a good demo-level baseline. Production upload handling needs to assume hostile files and unpredictable document quality.

I would move all PDF processing into the BullMQ worker layer and add:

- Object storage for original files, using S3, GCS, R2, or Azure Blob.
- Malware scanning with ClamAV or a managed scanning service.
- Page-count limits.
- Decompression-bomb protection.
- Per-user and per-tenant upload quotas.
- Stronger MIME sniffing beyond filename and browser-provided `Content-Type`.
- Encrypted storage for original files and extracted text.
- Content hashing for deduplication and retry idempotency.
- Lifecycle policies for deleting original files when they are no longer needed.
- OCR fallback for scanned PDFs.
- Parse quality metrics such as extracted character count, page count, empty-page ratio, OCR confidence, and detected language.

This makes document ingestion safe enough to expose to real users.

## 4. Database And Migration Maturity

The current schema is intentionally compact. It is good for proving the data model, but production needs stronger migration discipline and more constraints.

I would move from a single idempotent SQL file to a versioned migration system such as Drizzle Kit, Prisma Migrate, node-pg-migrate, or Sqitch.

Production database work should include:

- Forward-only migrations checked in CI.
- Migration dry-runs against staging.
- A documented repair path for failed migrations.
- Tenant ownership foreign keys.
- Unique ordering constraints for objectives and questions.
- Stronger validity checks for statuses, attempts, and selected indices.
- Indexes for tenant lesson listing, active job lookup, report retrieval, and queue history.
- Backup and restore procedures.
- Point-in-time recovery.
- Data retention and deletion workflows.
- Separate demo/seed data from production data.

The database should become the durable source of truth for both the learning product and the operational state around it.

## 5. AI Reliability, Evaluation, And Safety

The current AI layer has good fundamentals: Zod schemas, source-grounded prompts, prompt-injection language, no-answer guardrails, and answer-key isolation. That is exactly where I wanted the prototype to be.

For production, I would add a real AI evaluation loop:

- Fixed eval PDFs that represent the target customer content.
- Automated checks for lesson-plan grounding.
- Automated checks for question correctness.
- Automated checks for answer-key correctness.
- Distractor-quality checks.
- Hint-quality checks.
- Explanation-quality checks.
- Prompt-injection tests.
- Answer-leakage tests for the coach.
- Hallucination checks against source material.
- Regression tests across model upgrades.

I would also persist generation metadata:

- Prompt version.
- Model name.
- Temperature.
- Token usage.
- Latency.
- Provider response id.
- Structured validation result.
- Failure reason, if generation fails.

For a production AI product, "the model usually behaves" is not enough. I would treat prompts, model versions, and evaluations as part of the release process.

## 6. API Security And Abuse Controls

The current routes validate request bodies and avoid exposing answer keys, but production APIs also need abuse prevention and network-level hardening.

I would add:

- Rate limits per IP, user, tenant, and route.
- Request body limits at both proxy and app level.
- CSRF protection if cookie auth is used.
- Explicit CORS policy.
- Bot protection on public endpoints if needed.
- Stable API error codes.
- Request correlation ids.
- Sensitive error redaction.
- Ownership validation for every server-trusted id.
- Security headers: CSP, HSTS, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- Dependency vulnerability scanning.
- Secret scanning in CI.

The highest-risk endpoints are upload, coach, and CopilotKit/LangGraph proxying, so I would harden those first.

## 7. Observability And Operations

The demo has health checks, but production needs visibility into what is happening across the web app, agent, worker, Redis, Postgres, and LLM provider.

I would add structured JSON logging everywhere and OpenTelemetry tracing across:

- Upload request.
- Job enqueue.
- Worker execution.
- PDF parsing.
- LLM calls.
- Database queries.
- LangGraph runs.
- Coach responses.

The main metrics I would track:

- Request latency.
- Upload parse time.
- Queue wait time.
- Worker execution time.
- LLM latency.
- Token usage.
- Generation failure rate.
- Job retry count.
- Queue backlog.
- Answer-leakage eval failures.
- Database connection pool saturation.

I would wire these into Grafana, Datadog, New Relic, Honeycomb, or another observability platform, then add alerts for queue backlog, failed jobs, LLM provider errors, high latency, high token spend, and service health failures.

## 8. CI/CD And Release Engineering

The current CI is a good start, but it needs to provision the dependencies the app actually uses. In particular, the database tests require Postgres, and once BullMQ is added, CI should also run Redis.

Production CI should include:

- Postgres service in CI.
- Redis service in CI.
- `pnpm lint`.
- `pnpm format:check`.
- Full test suite.
- Typecheck for all packages.
- Web production build.
- Agent production build.
- Worker production build.
- Docker image build validation.
- Migration validation.
- Integration tests against Postgres and Redis.
- Playwright E2E tests.

The E2E path should cover the real business workflow:

- Upload PDF.
- Wait for parsing job.
- Start lesson.
- Approve or edit plan.
- Generate questions.
- Answer incorrectly.
- Receive hint.
- Retry.
- Answer correctly.
- See explanation.
- Finish lesson.
- See report.
- Verify that `correctIndex` never appears in browser-visible state.

For deployments, I would add preview, staging, and production environments with separate secrets, migration gates, release notes, and rollback procedures.

## 9. Deployment Architecture

Docker Compose is the right local demo surface. Production should split the system into independently deployable services.

The production service layout should be:

- `web`: Next.js app and API routes.
- `agent`: LangGraph runtime.
- `worker`: BullMQ processors.
- `postgres`: managed database.
- `redis`: managed Redis for BullMQ.
- `object-storage`: uploaded file storage.

Infrastructure hardening should include:

- CDN and WAF in front of the web app.
- Private networking for agent, worker, Postgres, and Redis.
- Managed Postgres with backups and PITR.
- Managed Redis configured for queue durability requirements.
- Container image scanning.
- Least-privilege service credentials.
- Autoscaling by request load for web.
- Autoscaling by queue depth for workers.
- Graceful shutdown for workers so active jobs are not lost.
- Rolling or blue/green deployments.

## 10. Frontend Production Polish

The current UI is designed for a clear walkthrough. Production needs more state coverage and accessibility verification.

I would add:

- Loading, queued, retrying, failed, and cancelled states for background jobs.
- Server-backed lesson resume instead of relying only on localStorage.
- Error boundaries.
- Client-side telemetry for UI failures.
- Keyboard navigation tests.
- Screen-reader checks for plan approval, MCQ interactions, coach chat, and report.
- Responsive QA across mobile, tablet, and desktop.
- Browser compatibility testing.
- More explicit empty states for missing files, expired lessons, failed generations, and unavailable services.

The goal is to make the app feel calm even when the backend is doing slow or unreliable work.

## 11. Product Features Needed For A Real SaaS

The demo is one session. A commercial product needs management surfaces around that session.

I would add:

- Lesson library and history.
- Editable generated objectives.
- Editable generated questions.
- Instructor review workflow.
- Learner progress history.
- Organization dashboards.
- Question bank reuse.
- Content versioning.
- Exports for reports, attempts, and question sets.
- LMS-compatible export or integration if the target market needs it.
- Billing, plan limits, and usage quotas if commercialized.

These features are intentionally outside the demo because they are product expansion, not proof of the core AI loop.

## 12. Compliance And Data Governance

The current app does not claim compliance readiness. If this becomes a real edtech product, data governance becomes a first-class workstream.

I would define policies for:

- Uploaded PDFs.
- Extracted text.
- Prompts.
- Model outputs.
- Attempts.
- Reports.
- User profiles.
- Organization data.

Production work should include:

- Privacy policy.
- Terms of service.
- Data processing agreement for B2B.
- Subprocessor list.
- FERPA/COPPA/GDPR review depending on customer segment.
- Data export.
- Data deletion.
- Tenant-specific retention.
- Encryption at rest and in transit.
- Access logs for sensitive data.
- Internal least-privilege access.
- Incident response plan.

## 13. What I Would Preserve

These parts of the prototype are worth keeping as production principles:

- Keep answer keys out of browser-visible graph state.
- Validate external boundaries with Zod.
- Keep human approval before question generation.
- Ground AI output in source material.
- Treat uploaded documents and learner messages as untrusted content.
- Keep generated learning content inspectable.
- Keep LangGraph state explicit and resumable.
- Keep strict TypeScript.
- Keep Docker images non-root and reproducible.
- Keep the product focused on learning, not generic chat.

## 14. Recommended Production Sequence

If I were taking this from demo to production, I would sequence the work like this:

1. Add authentication, tenancy, and ownership checks.
2. Add Redis and BullMQ.
3. Add a dedicated worker service.
4. Move PDF parsing and AI generation into jobs.
5. Add durable job status and UI progress states.
6. Add object storage and upload scanning.
7. Add CI Postgres and Redis services.
8. Add full E2E tests for the learning flow.
9. Add versioned migrations and stronger database constraints.
10. Add observability, tracing, metrics, and alerts.
11. Add AI evals for grounding, correctness, and answer leakage.
12. Add staging and production deployment environments.
13. Add compliance and data-governance workflows.
14. Add SaaS product surfaces such as lesson library, admin review, and organization dashboards.