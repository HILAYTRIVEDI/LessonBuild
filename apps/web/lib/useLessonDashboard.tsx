"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import type { UploadWorkflowDebug, WorkflowEvent } from "@/lib/workflow";

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

function now(): string {
  return new Date().toISOString();
}

function workflowId(step: string): string {
  return `${step}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useLessonDashboard() {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pending, setPending] = useState<PendingInterrupt | null>(null);
  const [activeQuestion, setActiveQuestion] = useState<AskQuestionEvent | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [workflowEvents, setWorkflowEvents] = useState<WorkflowEvent[]>([]);
  const lastInterruptLogRef = useRef<string | null>(null);
  const lastReportLogRef = useRef<string | null>(null);
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

  const addWorkflowEvent = useCallback((event: Omit<WorkflowEvent, "id" | "timestamp">) => {
    setWorkflowEvents((current) => [
      ...current,
      {
        ...event,
        id: workflowId(event.step),
        timestamp: now(),
      },
    ]);
  }, []);

  const addUploadDebugEvents = useCallback(
    (workflow: UploadWorkflowDebug) => {
      addWorkflowEvent({
        step: "pdf_extract",
        title: "PDF text extracted and chunked",
        status: "success",
        source: {
          function: `${workflow.functions.pdfExtractor} -> ${workflow.functions.chunker}`,
        },
        data: {
          extractedCharacters: workflow.extractedCharacters,
          chunkCount: workflow.chunkCount,
          title: workflow.title,
        },
        reason: "The server converted the PDF into text and smaller ordered chunks for retrieval.",
      });
      addWorkflowEvent({
        step: "database",
        title: "Lesson stored in Postgres",
        status: "success",
        source: {
          function: workflow.functions.persistence,
          database: `${workflow.database.lessonTable}, ${workflow.database.chunkTable}`,
        },
        data: {
          lessonId: workflow.database.lessonId,
          lessonTable: workflow.database.lessonTable,
          chunkTable: workflow.database.chunkTable,
          chunkCount: workflow.chunkCount,
        },
        reason: "The full extracted text is stored with the lesson, while chunks power retrieval.",
      });
    },
    [addWorkflowEvent],
  );

  // Restore the lesson after a page refresh; runs once, before any agent run
  // can start, so the graph always sees the persisted lessonId.
  useEffect(() => {
    const saved = loadLessonId();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is browser-only; restore must happen after mount
      syncLesson(saved);
      addWorkflowEvent({
        step: "session",
        title: "Restored existing lesson session",
        status: "success",
        source: {
          hook: "useLessonDashboard()",
          function: "loadLessonId() -> syncLesson(saved)",
        },
        data: { lessonId: saved, storage: "localStorage + cookie + Copilot agent state" },
        reason: "A refresh can resume the same uploaded lesson instead of losing context.",
      });
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
    setWorkflowEvents([]);
    addWorkflowEvent({
      step: "upload",
      title: "PDF selected for upload",
      status: "pending",
      source: {
        component: "apps/web/app/page.tsx",
        hook: "useLessonDashboard.upload()",
      },
      data: {
        filename: file.name,
        sizeBytes: file.size,
        mimeType: file.type || "application/pdf",
      },
      reason: "The learner's file is captured in the browser and passed to the upload helper.",
    });

    try {
      const result = await uploadLessonPdf(file);
      addWorkflowEvent({
        step: "upload",
        title: "Upload API returned a lesson id",
        status: "success",
        source: {
          function: "uploadLessonPdf(file)",
          endpoint: "POST /api/upload",
        },
        data: { lessonId: result.lessonId, title: result.title },
        reason: "The client receives only lesson metadata, not the raw extracted document text.",
      });
      if (result.workflow) {
        addUploadDebugEvents(result.workflow);
      }
      syncLesson(result.lessonId);
      addWorkflowEvent({
        step: "session",
        title: "Lesson id synced to browser and agent state",
        status: "success",
        source: {
          hook: "useLessonDashboard.syncLesson()",
          function: "saveLessonId(), setAgentState()",
        },
        data: {
          lessonId: result.lessonId,
          destinations: "localStorage, cookie, Copilot agent state",
        },
        reason: "The UI, server cookie, and Copilot agent all need the same lesson identity.",
      });
    } catch (error) {
      setUploadError(
        error instanceof UploadLessonError
          ? error.message
          : "Upload failed — check your connection and try again.",
      );
      addWorkflowEvent({
        step: "upload",
        title: "PDF upload failed",
        status: "error",
        source: {
          function: "uploadLessonPdf(file)",
          endpoint: "POST /api/upload",
        },
        data: {
          error:
            error instanceof UploadLessonError
              ? error.message
              : "Upload failed — check your connection and try again.",
        },
        reason: "The workflow stops until a valid PDF can be processed and stored.",
      });
    } finally {
      setBusy(false);
    }
  }

  function start() {
    if (!lessonId) return;
    setRunError(null);
    setStarting(true);
    addWorkflowEvent({
      step: "agent_start",
      title: "Lesson agent run started",
      status: "pending",
      source: {
        hook: "useLessonDashboard.start()",
        function: "agent.setState(), copilotkit.runAgent({ agent })",
      },
      data: { lessonId, passedState: "{ lessonId, report }" },
      reason: "The graph starts with a lesson id and hydrates trusted document data server-side.",
    });
    // runAgent reads agent.state directly, not the useCoAgent hook copy, so
    // sync explicitly to avoid sending a stale/null lessonId to the server.
    agent.setState({ ...agent.state, lessonId, report: agentState.report ?? null });
    void copilotkit
      .runAgent({ agent })
      .catch(() => {
        setRunError("The lesson could not start — please try again.");
        addWorkflowEvent({
          step: "agent_start",
          title: "Lesson agent run failed to start",
          status: "error",
          source: {
            function: "copilotkit.runAgent({ agent })",
          },
          data: { lessonId },
          reason: "The run did not reach the graph, so no plan or report can be generated yet.",
        });
      })
      .finally(() => setStarting(false));
  }

  // Turns a chat-slot interrupt into dashboard state. Identity of the parsed
  // event changes on every chat render, so republishing is guarded by comparing
  // payloads; otherwise the effect->setState->render cycle loops.
  const onInterrupt = useCallback(
    (value: LessonInterruptEvent, resolve: (response: unknown) => void) => {
      if (value.type === "approve_plan") {
        setActiveQuestion(null);
        const signature = `plan:${JSON.stringify(value.plan)}`;
        if (value.plan && lastInterruptLogRef.current !== signature) {
          lastInterruptLogRef.current = signature;
          addWorkflowEvent({
            step: "agent_interrupt",
            title: "Plan approval interrupt received",
            status: "success",
            source: {
              hook: "useLessonDashboard.onInterrupt()",
              agentNode: "plan -> approvePlan",
              component: "PlanApprovalCard",
            },
            data: {
              objectiveCount: value.plan.objectives.length,
              difficulty: value.plan.overallDifficulty,
            },
            reason:
              "The graph pauses before question generation so the learner can approve or revise the plan.",
          });
        }
      } else {
        setActiveQuestion(value);
        const signature = `mcq:${JSON.stringify(value)}`;
        if (lastInterruptLogRef.current !== signature) {
          lastInterruptLogRef.current = signature;
          addWorkflowEvent({
            step: "question",
            title: value.feedback ? "Question feedback received" : "MCQ interrupt received",
            status: "success",
            source: {
              hook: "useLessonDashboard.onInterrupt()",
              agentNode: "askQuestion / evaluate",
              component: "McqWidget",
            },
            data: {
              questionIdx: value.questionIdx,
              totalQuestions: value.totalQuestions,
              hasFeedback: Boolean(value.feedback),
              isCorrect: value.feedback?.isCorrect,
            },
            reason: value.feedback
              ? "The graph evaluated the submitted answer and returned safe feedback."
              : "The graph paused so the learner can answer a browser-safe MCQ.",
          });
        }
      }
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
              addWorkflowEvent({
                step: "agent_interrupt",
                title: r.approved ? "Plan approved" : "Plan change requested",
                status: "success",
                source: {
                  component: "PlanApprovalCard",
                  function: "stage.interrupt.respond(response)",
                  agentNode: "approvePlan",
                },
                data: r.approved
                  ? { approved: true, questionCounts: r.questionCounts }
                  : { approved: false, feedback: r.feedback },
                reason: r.approved
                  ? "The graph can continue into question generation with the selected counts."
                  : "The graph routes back to the planner with learner feedback.",
              });
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
            addWorkflowEvent({
              step: "question",
              title: r.action === "submit" ? "Learner answer submitted" : "Learner continued",
              status: "success",
              source: {
                component: "McqWidget",
                function: "stage.interrupt.respond(response)",
                agentNode: r.action === "submit" ? "evaluate" : "advance",
              },
              data:
                r.action === "submit"
                  ? { action: r.action, selectedIndex: r.selectedIndex }
                  : { action: r.action },
              reason:
                r.action === "submit"
                  ? "The selected option is sent back to the graph for evaluation."
                  : "The graph advances after correct-answer feedback is acknowledged.",
            });
            resolve(r);
            setPending(null);
          },
        };
      });
    },
    [addWorkflowEvent],
  );

  useEffect(() => {
    if (!agentState.report) return;
    if (lastReportLogRef.current === agentState.report) return;
    lastReportLogRef.current = agentState.report;
    addWorkflowEvent({
      step: "report",
      title: "Final report available",
      status: "success",
      source: {
        agentNode: "summarize",
        component: "ProgressReport",
      },
      data: {
        reportCharacters: agentState.report.length,
      },
      reason: "The graph summarized attempts and study guidance into the final learner report.",
    });
  }, [agentState.report, addWorkflowEvent]);

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
    workflowEvents,
    reset: () => {
      clearSession();
      window.location.reload();
    },
  };
}
