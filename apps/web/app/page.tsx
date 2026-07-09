"use client";
import { useState } from "react";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useLangGraphInterrupt } from "@copilotkit/react-core";
import type { ApprovePlanEvent, ApprovePlanResponse } from "@lessonbuild/shared";
import { PlanApprovalCard } from "@/components/PlanApprovalCard";

export default function Home() {
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const json: unknown = await res.json();
    if (
      typeof json === "object" &&
      json !== null &&
      "lessonId" in json &&
      typeof (json as { lessonId: unknown }).lessonId === "string"
    ) {
      setLessonId((json as { lessonId: string }).lessonId);
    }
    setBusy(false);
  }

  useLangGraphInterrupt<ApprovePlanEvent>({
    render: ({ event, resolve }) => {
      if (event.value.type !== "approve_plan" || !event.value.plan) return "";
      // CopilotKit types `resolve` as (resolution: string) => void, but for this
      // legacy `interrupt()`-based flow the payload is forwarded untouched as the
      // LangGraph `Command({ resume })` value, so we pass the structured response.
      const respond = resolve as unknown as (response: ApprovePlanResponse) => void;
      return <PlanApprovalCard plan={event.value.plan} onRespond={respond} />;
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
      <CopilotSidebar
        defaultOpen
        labels={{ title: "Lesson Coach", initial: "Upload a PDF, then say 'start'." }}
      />
    </main>
  );
}
