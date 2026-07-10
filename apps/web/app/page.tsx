"use client";
import { useEffect, useState } from "react";
import { CopilotSidebar } from "@copilotkit/react-ui";
import {
  useLangGraphInterrupt,
  useCopilotReadable,
  useCopilotAdditionalInstructions,
  useCoAgent,
} from "@copilotkit/react-core";
import { LessonInterruptEventSchema } from "@lessonbuild/shared";
import type {
  ApprovePlanResponse,
  AskQuestionEvent,
  AskQuestionResponse,
} from "@lessonbuild/shared";
import { PlanApprovalCard } from "@/components/PlanApprovalCard";
import { McqWidget } from "@/components/McqWidget";
import { ProgressReport } from "@/components/ProgressReport";
import { HINT_GUARDRAIL_INSTRUCTIONS, toGuardrailReadable } from "@/lib/guardrail";
import { loadLessonId, saveLessonId, clearSession } from "@/lib/session";

type LessonAgentState = {
  lessonId: string | null;
  report: string | null;
};

// Wraps McqWidget so publishing the active question happens in an effect —
// the interrupt render callback runs during render, where calling a parent
// setState directly is illegal.
function McqInterrupt({
  value,
  onActive,
  onSubmit,
}: {
  value: AskQuestionEvent;
  onActive: (q: AskQuestionEvent) => void;
  onSubmit: (selectedIndex: number) => void;
}) {
  useEffect(() => {
    onActive(value);
  }, [value, onActive]);
  return (
    <McqWidget
      stem={value.stem}
      choices={value.choices}
      {...(value.feedback ? { feedback: value.feedback } : {})}
      onSubmit={onSubmit}
    />
  );
}

export default function Home() {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<AskQuestionEvent | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const { state: agentState, setState: setAgentState } = useCoAgent<LessonAgentState>({
    name: "lesson",
    initialState: { lessonId: null, report: null },
  });

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
      const value = parsed.data;
      switch (value.type) {
        case "approve_plan": {
          if (!value.plan) return "";
          // CopilotKit types `resolve` as (resolution: string) => void, but for
          // this legacy `interrupt()`-based flow the payload is forwarded
          // untouched as the LangGraph `Command({ resume })` value, so we pass
          // the structured response.
          const respond = resolve as unknown as (response: ApprovePlanResponse) => void;
          return <PlanApprovalCard plan={value.plan} onRespond={respond} />;
        }
        case "ask_mcq": {
          // Same untyped-resolve situation as the approve_plan interrupt above.
          const respond = resolve as unknown as (response: AskQuestionResponse) => void;
          return (
            <McqInterrupt
              value={value}
              onActive={setActiveQuestion}
              onSubmit={(selectedIndex) => respond({ selectedIndex })}
            />
          );
        }
        default: {
          const unhandled: never = value;
          return `Unsupported interrupt: ${JSON.stringify(unhandled)}`;
        }
      }
    },
  });

  return (
    <main className="mx-auto max-w-2xl p-12">
      <h1 className="text-4xl font-bold">LessonBuild</h1>
      <p className="mt-2 text-text-muted">Upload a PDF to build an interactive lesson.</p>
      <label className="mt-8 block cursor-pointer rounded-md border border-dashed border-border bg-surface-muted p-10 text-center shadow-card">
        <input type="file" accept="application/pdf" className="hidden" onChange={onUpload} />
        {busy ? "Processing…" : lessonId ? `Lesson ready: ${lessonId}` : "Click to choose a PDF"}
      </label>
      {uploadError ? <p className="mt-3 text-sm font-medium text-error">{uploadError}</p> : null}
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
      {agentState.report ? (
        <div className="mt-8">
          <ProgressReport report={agentState.report} />
        </div>
      ) : null}
      <CopilotSidebar
        defaultOpen
        labels={{ title: "Lesson Coach", initial: "Upload a PDF, then say 'start'." }}
      />
    </main>
  );
}
