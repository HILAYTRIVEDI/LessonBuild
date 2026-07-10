"use client";
import { useCallback, useEffect, useState } from "react";
import { CopilotSidebar } from "@copilotkit/react-ui";
import {
  useLangGraphInterrupt,
  useCopilotReadable,
  useCopilotAdditionalInstructions,
  useCoAgent,
} from "@copilotkit/react-core";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { LessonInterruptEventSchema } from "@lessonbuild/shared";
import type {
  ApprovePlanResponse,
  AskQuestionEvent,
  AskQuestionResponse,
} from "@lessonbuild/shared";
import type { z } from "zod";
import { PlanApprovalCard } from "@/components/PlanApprovalCard";
import { McqWidget } from "@/components/McqWidget";
import { ProgressReport } from "@/components/ProgressReport";
import { HINT_GUARDRAIL_INSTRUCTIONS, toGuardrailReadable } from "@/lib/guardrail";
import { loadLessonId, saveLessonId, clearSession } from "@/lib/session";
import { deriveStage } from "@/lib/stage";
import type { PendingInterrupt } from "@/lib/stage";

type LessonAgentState = {
  lessonId: string | null;
  report: string | null;
};

type LessonInterruptEvent = z.infer<typeof LessonInterruptEventSchema>;

// Rendered into the chat's interrupt slot instead of a visible card: the
// lesson flow lives on the dashboard, so this publishes the interrupt to the
// page in an effect (the interrupt render callback runs during render, where
// calling a parent setState directly is illegal) and shows nothing in chat.
function InterruptPublisher({
  value,
  resolve,
  onInterrupt,
}: {
  value: LessonInterruptEvent;
  resolve: (response: unknown) => void;
  onInterrupt: (value: LessonInterruptEvent, resolve: (response: unknown) => void) => void;
}) {
  useEffect(() => {
    onInterrupt(value, resolve);
  }, [value, resolve, onInterrupt]);
  return null;
}

export default function Home() {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pending, setPending] = useState<PendingInterrupt | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<AskQuestionEvent | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const {
    state: agentState,
    setState: setAgentState,
    running,
  } = useCoAgent<LessonAgentState>({
    name: "lesson",
    initialState: { lessonId: null, report: null },
  });
  // useCoAgent's `run`/`start` hand back agent.runAgent unbound, which crashes
  // with "Cannot set properties of undefined (setting 'abortController')" when
  // invoked as a plain function. Run through copilotkit.runAgent({ agent })
  // instead — the same path the chat send and interrupt-resolve flows use.
  const { agent } = useAgent({ agentId: "lesson" });
  const { copilotkit } = useCopilotKit();

  useCopilotAdditionalInstructions({ instructions: HINT_GUARDRAIL_INSTRUCTIONS });

  // Restore the lesson after a page refresh; runs once, before any agent run
  // can start, so the graph always sees the persisted lessonId.
  useEffect(() => {
    const saved = loadLessonId();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is browser-only; restore must happen after mount
      setLessonId(saved);
      saveLessonId(saved);
      setAgentState((prev) => ({ lessonId: saved, report: prev?.report ?? null }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only restore
  }, []);

  // Keep Copilot's agent object and the server-readable cookie aligned with
  // the selected lesson. This is keyed only to the lesson id to avoid looping
  // when Copilot emits the same state back to the UI.
  useEffect(() => {
    if (!lessonId) return;
    saveLessonId(lessonId);
    setAgentState((prev) => ({ lessonId, report: prev?.report ?? null }));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed to lessonId only to avoid looping on setAgentState identity
  }, [lessonId]);

  useCopilotReadable({
    description: "The learner's currently active question, with a prior hint if any.",
    value: activeQuestion ? toGuardrailReadable(activeQuestion) : null,
  });

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        setUploadError(`Upload failed (${res.status}). Please try another PDF.`);
        return;
      }
      const json: unknown = await res.json();
      if (
        typeof json === "object" &&
        json !== null &&
        "lessonId" in json &&
        typeof (json as { lessonId: unknown }).lessonId === "string"
      ) {
        const id = (json as { lessonId: string }).lessonId;
        setLessonId(id);
        saveLessonId(id);
        // Thread the lessonId into the agent's state so the graph's hydrate node
        // can load the uploaded document from Postgres on the next run.
        setAgentState((prev) => ({ lessonId: id, report: prev?.report ?? null }));
      } else {
        setUploadError("Upload succeeded but the server response was malformed.");
      }
    } catch {
      setUploadError("Upload failed — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  function onStart() {
    setRunError(null);
    setStarting(true);
    void copilotkit
      .runAgent({ agent })
      .catch(() => {
        setRunError("The lesson could not start — please try again.");
      })
      .finally(() => setStarting(false));
  }

  // Turns a chat-slot interrupt into dashboard state. Identity of the parsed
  // event changes on every chat render, so republishing is guarded by
  // comparing payloads — otherwise the effect->setState->render cycle loops.
  const onInterrupt = useCallback(
    (value: LessonInterruptEvent, resolve: (response: unknown) => void) => {
      if (value.type === "ask_mcq") setActiveQuestion(value);
      setPending((prev) => {
        if (value.type === "approve_plan") {
          if (!value.plan) return prev;
          if (prev?.kind === "plan" && JSON.stringify(prev.plan) === JSON.stringify(value.plan)) {
            return prev;
          }
          const plan = value.plan;
          return {
            kind: "plan",
            plan,
            respond: (r: ApprovePlanResponse) => {
              resolve(r);
              setPending(null);
            },
          };
        }
        if (prev?.kind === "mcq" && JSON.stringify(prev.event) === JSON.stringify(value)) {
          return prev;
        }
        return {
          kind: "mcq",
          event: value,
          respond: (r: AskQuestionResponse) => {
            resolve(r);
            setPending(null);
          },
        };
      });
    },
    [],
  );

  // A single hook must render every interrupt type: CopilotKit publishes the
  // rendered element into one global slot, so a second useLangGraphInterrupt
  // whose render returns "" would blank out the first one's card. The explicit
  // agentId is also required — outside the sidebar's chat config the hook
  // would otherwise subscribe to agent "default" and never see our runs.
  useLangGraphInterrupt({
    agentId: "lesson",
    render: ({ event, resolve }) => {
      // The interrupt payload arrives over the wire untyped — parse it before
      // trusting the discriminator, and render nothing on unknown shapes.
      const parsed = LessonInterruptEventSchema.safeParse(event.value);
      if (!parsed.success) return "";
      // CopilotKit types resolve as (resolution: string) => void, but LangGraph
      // resume payloads are objects at runtime — same cast the chat cards used.
      return (
        <InterruptPublisher
          value={parsed.data}
          resolve={resolve as unknown as (response: unknown) => void}
          onInterrupt={onInterrupt}
        />
      );
    },
  });

  const stage = deriveStage({
    lessonId,
    working: running || starting,
    pending,
    report: agentState.report ?? null,
  });

  return (
    <main className="mx-auto max-w-3xl p-8 lg:p-12">
      <h1 className="text-4xl font-bold">LessonBuild</h1>
      <p className="mt-2 text-text-muted">Upload a PDF to build an interactive lesson.</p>

      {(stage.kind === "upload" || stage.kind === "ready") && (
        <>
          <label className="mt-8 block cursor-pointer rounded-md border border-dashed border-border bg-surface-muted p-10 text-center shadow-card">
            <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
            {busy
              ? "Processing…"
              : lessonId
                ? `Lesson ready: ${lessonId}`
                : "Click to choose a PDF"}
          </label>
          {uploadError ? (
            <p className="mt-3 text-sm font-medium text-error">{uploadError}</p>
          ) : null}
          {stage.kind === "ready" && !busy ? (
            <button
              type="button"
              className="mt-6 w-full rounded-md bg-primary px-6 py-3 text-lg font-semibold text-white shadow-card"
              onClick={onStart}
            >
              Start lesson
            </button>
          ) : null}
          {runError ? <p className="mt-3 text-sm font-medium text-error">{runError}</p> : null}
        </>
      )}

      {stage.kind === "working" && (
        <div className="mt-8 rounded-md border border-border bg-surface p-10 text-center shadow-card">
          <p className="font-medium">Working on your lesson…</p>
          <p className="mt-1 text-sm text-text-muted">
            This can take a moment. Ask the Lesson Coach if you have questions.
          </p>
        </div>
      )}

      {stage.kind === "plan" && (
        <div className="mt-8">
          <PlanApprovalCard plan={stage.interrupt.plan} onRespond={stage.interrupt.respond} />
        </div>
      )}

      {stage.kind === "question" && (
        <div className="mt-8">
          <McqWidget
            stem={stage.interrupt.event.stem}
            choices={stage.interrupt.event.choices}
            questionIdx={stage.interrupt.event.questionIdx}
            totalQuestions={stage.interrupt.event.totalQuestions}
            {...(stage.interrupt.event.feedback
              ? { feedback: stage.interrupt.event.feedback }
              : {})}
            onSubmit={(selectedIndex) => stage.interrupt.respond({ selectedIndex })}
          />
        </div>
      )}

      {stage.kind === "report" && (
        <div className="mt-8">
          <ProgressReport report={stage.report} />
        </div>
      )}

      {lessonId ? (
        <button
          type="button"
          className="mt-3 text-sm text-text-muted underline"
          onClick={() => {
            clearSession();
            window.location.reload();
          }}
        >
          Start a new lesson
        </button>
      ) : null}

      <CopilotSidebar
        labels={{
          title: "Lesson Coach",
          initial:
            "I'm here for hints and support. Upload a PDF and hit Start lesson on the dashboard to begin.",
        }}
      />
    </main>
  );
}
