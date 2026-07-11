"use client";
import { useState } from "react";
import type { CoachMessage, CoachQuestionContext } from "@/lib/coach";
import { CoachResponseSchema } from "@/lib/coach";

/**
 * Separate chat panel for conceptual help. It sends browser-safe active
 * question context to the server, which retrieves PDF evidence and enforces
 * the no-answer guardrail.
 */
export function LessonCoachPanel({
  lessonId,
  activeQuestion,
}: {
  lessonId: string | null;
  activeQuestion: CoachQuestionContext | null;
}) {
  const [messages, setMessages] = useState<CoachMessage[]>([
    {
      role: "assistant",
      content:
        "I can explain ideas, give hints, and help you think through the topic without giving away the answer.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendMessage() {
    const message = draft.trim();
    if (!message || sending) return;

    const nextMessages: CoachMessage[] = [...messages, { role: "user", content: message }];
    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setSending(true);

    try {
      /*
       * Send only the last few turns; the server validates the payload and
       * adds retrieved lesson context before it reaches the model.
       */
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          lessonId,
          activeQuestion,
          history: messages.slice(-10),
        }),
      });
      if (!res.ok) {
        setError("Lesson Coach could not respond. Please try again.");
        return;
      }
      const parsed = CoachResponseSchema.safeParse(await res.json());
      if (!parsed.success) {
        setError("Lesson Coach sent an unexpected response.");
        return;
      }
      setMessages((current) => [...current, { role: "assistant", content: parsed.data.reply }]);
    } catch {
      setError("Lesson Coach could not respond. Please check your connection.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    void sendMessage();
  }

  return (
    <aside className="rounded-md border border-border bg-surface p-4 shadow-card lg:sticky lg:top-8">
      <div>
        <p className="text-lg font-semibold">Lesson Coach</p>
        <p className="mt-1 text-sm text-text-muted">
          Ask for a hint, concept review, or another way to think about the question.
        </p>
      </div>

      <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`rounded-sm border p-3 text-sm ${
              message.role === "user"
                ? "border-primary bg-primary/10"
                : "border-border bg-surface-muted"
            }`}
          >
            <p className="font-medium">{message.role === "user" ? "You" : "Coach"}</p>
            <p className="mt-1 whitespace-pre-wrap leading-6">{message.content}</p>
          </div>
        ))}
      </div>

      {error ? <p className="mt-3 text-sm font-medium text-error">{error}</p> : null}

      <div className="mt-4">
        <textarea
          className="min-h-24 w-full resize-none rounded-sm border border-border bg-surface p-3 text-sm outline-none focus:border-primary"
          value={draft}
          placeholder={
            lessonId
              ? "Ask for a hint without revealing the answer..."
              : "Upload a PDF first, then ask me about the lesson."
          }
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          type="button"
          className="mt-3 w-full rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={!draft.trim() || sending}
          onClick={() => void sendMessage()}
        >
          {sending ? "Thinking..." : "Ask Coach"}
        </button>
      </div>
    </aside>
  );
}
