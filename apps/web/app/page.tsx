"use client";
import { LessonCoachPanel } from "@/components/LessonCoachPanel";
import { PlanApprovalCard } from "@/components/PlanApprovalCard";
import { McqWidget } from "@/components/McqWidget";
import { ProgressReport } from "@/components/ProgressReport";
import { WorkflowInspector } from "@/components/WorkflowInspector";
import { toGuardrailReadable } from "@/lib/guardrail";
import { useLessonDashboard } from "@/lib/useLessonDashboard";

export default function Home() {
  const {
    activeQuestion,
    busy,
    interruptSlot,
    lessonId,
    reset,
    runError,
    stage,
    start,
    upload,
    uploadError,
    workflowEvents,
  } = useLessonDashboard();

  return (
    <main className="mx-auto grid max-w-6xl gap-8 p-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:p-12">
      <section>
        <h1 className="text-4xl font-bold">LessonBuild</h1>
        <p className="mt-2 text-text-muted">Upload a PDF to build an interactive lesson.</p>

        {(stage.kind === "upload" || stage.kind === "ready") && (
          <>
            <label className="mt-8 block cursor-pointer rounded-md border border-dashed border-border bg-surface-muted p-10 text-center shadow-card">
              <input type="file" accept="application/pdf" className="hidden" onChange={upload} />
              {busy
                ? "Processing..."
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
                onClick={start}
              >
                Start lesson
              </button>
            ) : null}
            {runError ? <p className="mt-3 text-sm font-medium text-error">{runError}</p> : null}
          </>
        )}

        {stage.kind === "working" && (
          <div className="mt-8 rounded-md border border-border bg-surface p-10 text-center shadow-card">
            <p className="font-medium">Working on your lesson...</p>
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
              onSubmit={(selectedIndex) =>
                stage.interrupt.respond({ action: "submit", selectedIndex })
              }
              onContinue={() => stage.interrupt.respond({ action: "continue" })}
            />
          </div>
        )}

        {stage.kind === "report" && (
          <div className="mt-8">
            <ProgressReport report={stage.report} />
          </div>
        )}

        {lessonId ? (
          <button type="button" className="mt-3 text-sm text-text-muted underline" onClick={reset}>
            Start a new lesson
          </button>
        ) : null}

        <WorkflowInspector events={workflowEvents} />
      </section>

      <LessonCoachPanel
        lessonId={lessonId}
        activeQuestion={activeQuestion ? toGuardrailReadable(activeQuestion) : null}
      />
      {interruptSlot}
    </main>
  );
}
