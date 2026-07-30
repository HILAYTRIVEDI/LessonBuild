"use client";

import { useState } from "react";
import { WORKFLOW_BLUEPRINT } from "@/lib/workflow";
import type { WorkflowEvent, WorkflowEventStep } from "@/lib/workflow";

const STEP_LABELS: Record<WorkflowEventStep, string> = {
  upload: "Upload",
  pdf_extract: "PDF",
  database: "Database",
  session: "Session",
  agent_start: "Agent",
  agent_interrupt: "Interrupt",
  question: "Question",
  report: "Report",
};

const STATUS_CLASS: Record<WorkflowEvent["status"], string> = {
  pending: "border-warning bg-warning/10 text-warning",
  success: "border-success bg-success/10 text-success",
  error: "border-error bg-error/10 text-error",
  info: "border-border bg-surface-muted text-text-muted",
};

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return JSON.stringify(value);
}

function EventDetails({ event }: { event: WorkflowEvent }) {
  const sourceEntries = Object.entries(event.source).filter(([, value]) => value);
  const dataEntries = Object.entries(event.data ?? {});

  return (
    <div className="mt-3 grid gap-3 text-xs md:grid-cols-2">
      <div>
        <p className="font-semibold text-text">Source</p>
        <dl className="mt-2 space-y-1">
          {sourceEntries.map(([key, value]) => (
            <div key={key} className="flex gap-2">
              <dt className="min-w-20 text-text-muted">{key}</dt>
              <dd className="break-all font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <p className="font-semibold text-text">Data</p>
        {dataEntries.length > 0 ? (
          <dl className="mt-2 space-y-1">
            {dataEntries.map(([key, value]) => (
              <div key={key} className="flex gap-2">
                <dt className="min-w-20 text-text-muted">{key}</dt>
                <dd className="break-all font-mono">{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-text-muted">No runtime payload captured for this step.</p>
        )}
      </div>
    </div>
  );
}

function EventRow({ event, blueprint }: { event: WorkflowEvent; blueprint?: boolean }) {
  return (
    <li className="rounded-md border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-sm border border-border bg-surface-muted px-2 py-1 text-xs font-semibold">
          {STEP_LABELS[event.step]}
        </span>
        <span
          className={`rounded-sm border px-2 py-1 text-xs font-semibold ${STATUS_CLASS[event.status]}`}
        >
          {event.status}
        </span>
        {event.timestamp ? (
          <time className="text-xs text-text-muted">
            {new Date(event.timestamp).toLocaleTimeString()}
          </time>
        ) : null}
      </div>
      <p className="mt-3 font-semibold">{event.title}</p>
      <p className="mt-1 text-sm leading-6 text-text-muted">{event.reason}</p>
      <EventDetails event={event} />
      {blueprint ? (
        <p className="mt-3 text-xs text-text-muted">
          Blueprint step: this explains the intended app flow.
        </p>
      ) : null}
    </li>
  );
}

export function WorkflowInspector({ events }: { events: WorkflowEvent[] }) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"live" | "blueprint">("live");
  const visibleEvents = tab === "live" ? events : WORKFLOW_BLUEPRINT;

  return (
    <section className="mt-8 rounded-md border border-border bg-surface-muted shadow-card">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
      >
        <span>
          <span className="block font-semibold">Workflow Inspector</span>
          <span className="mt-1 block text-sm text-text-muted">
            {events.length} live event{events.length === 1 ? "" : "s"} captured from PDF upload to
            report.
          </span>
        </span>
        <span className="rounded-sm border border-border bg-surface px-3 py-1 text-sm font-medium">
          {expanded ? "Hide" : "Show"}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-border p-4">
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-sm border px-3 py-2 text-sm font-medium ${
                tab === "live" ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
              onClick={() => setTab("live")}
            >
              Live Run
            </button>
            <button
              type="button"
              className={`rounded-sm border px-3 py-2 text-sm font-medium ${
                tab === "blueprint" ? "border-primary bg-primary/10" : "border-border bg-surface"
              }`}
              onClick={() => setTab("blueprint")}
            >
              Blueprint
            </button>
          </div>

          {visibleEvents.length > 0 ? (
            <ol className="mt-4 space-y-3">
              {visibleEvents.map((event) => (
                <EventRow key={event.id} event={event} blueprint={tab === "blueprint"} />
              ))}
            </ol>
          ) : (
            <div className="mt-4 rounded-md border border-border bg-surface p-5 text-sm text-text-muted">
              Upload a PDF to start capturing live workflow events. Open Blueprint for the full app
              map.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
