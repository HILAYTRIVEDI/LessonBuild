"use client";

import { useCallback, useEffect, useState } from "react";
import { useLangGraphInterrupt, useCoAgent, useCopilotChatInternal } from "@copilotkit/react-core";
import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { LessonInterruptEventSchema } from "@lessonbuild/shared";
import type {
  ApprovePlanResponse,
  AskQuestionEvent,
  AskQuestionResponse,
} from "@lessonbuild/shared";
import type { z } from "zod";
import { clearSession, loadLessonId, saveLessonId } from "@/lib/session";
import { deriveStage } from "@/lib/stage";
import type { PendingInterrupt } from "@/lib/stage";
import { UploadLessonError, uploadLessonPdf } from "@/lib/uploadLesson";

type LessonAgentState = {
  lessonId: string | null;
  report: string | null;
};

type LessonInterruptEvent = z.infer<typeof LessonInterruptEventSchema>;

type InterruptPublisherProps = {
  value: LessonInterruptEvent;
  resolve: (response: unknown) => void;
  onInterrupt: (value: LessonInterruptEvent, resolve: (response: unknown) => void) => void;
};

// Rendered into the chat's interrupt slot instead of a visible card. The
// dashboard owns the visible controls, so this effect only publishes the event.
function InterruptPublisher({ value, resolve, onInterrupt }: InterruptPublisherProps) {
  useEffect(() => {
    onInterrupt(value, resolve);
  }, [value, resolve, onInterrupt]);
  return null;
}

function samePayload(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useLessonDashboard() {
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
  // invoked as a plain function. Run through copilotkit.runAgent({ agent }).
  const { agent } = useAgent({ agentId: "lesson" });
  const { copilotkit } = useCopilotKit();
  const { interrupt: interruptSlot } = useCopilotChatInternal();

  const syncLesson = useCallback(
    (id: string) => {
      setLessonId(id);
      saveLessonId(id);
      setAgentState((prev) => ({ lessonId: id, report: prev?.report ?? null }));
    },
    [setAgentState],
  );

  // Restore the lesson after a page refresh; runs once, before any agent run
  // can start, so the graph always sees the persisted lessonId.
  useEffect(() => {
    const saved = loadLessonId();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is browser-only; restore must happen after mount
      syncLesson(saved);
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

  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setUploadError(null);

    try {
      syncLesson(await uploadLessonPdf(file));
    } catch (error) {
      setUploadError(
        error instanceof UploadLessonError
          ? error.message
          : "Upload failed — check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (!lessonId) return;
    setRunError(null);
    setStarting(true);
    // runAgent reads agent.state directly, not the useCoAgent hook copy, so
    // sync explicitly to avoid sending a stale/null lessonId to the server.
    agent.setState({ ...agent.state, lessonId, report: agentState.report ?? null });
    void copilotkit
      .runAgent({ agent })
      .catch(() => {
        setRunError("The lesson could not start — please try again.");
      })
      .finally(() => setStarting(false));
  }

  // Turns a chat-slot interrupt into dashboard state. Identity of the parsed
  // event changes on every chat render, so republishing is guarded by comparing
  // payloads; otherwise the effect->setState->render cycle loops.
  const onInterrupt = useCallback(
    (value: LessonInterruptEvent, resolve: (response: unknown) => void) => {
      if (value.type === "ask_mcq") setActiveQuestion(value);
      if (value.type === "approve_plan") setActiveQuestion(null);
      setPending((prev) => {
        if (value.type === "approve_plan") {
          if (!value.plan) return prev;
          if (prev?.kind === "plan" && samePayload(prev.plan, value.plan)) {
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
        if (prev?.kind === "mcq" && samePayload(prev.event, value)) {
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
  // whose render returns "" would blank out the first one's card.
  useLangGraphInterrupt({
    agentId: "lesson",
    render: ({ event, resolve }) => {
      const parsed = LessonInterruptEventSchema.safeParse(event.value);
      if (!parsed.success) return "";
      return (
        <InterruptPublisher
          value={parsed.data}
          resolve={resolve as unknown as (response: unknown) => void}
          onInterrupt={onInterrupt}
        />
      );
    },
  });

  return {
    activeQuestion,
    busy,
    interruptSlot,
    lessonId,
    runError,
    stage: deriveStage({
      lessonId,
      working: running || starting,
      pending,
      report: agentState.report ?? null,
    }),
    start,
    upload,
    uploadError,
    reset: () => {
      clearSession();
      window.location.reload();
    },
  };
}
