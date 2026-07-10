"use client";
import { useEffect, useState } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { getOrCreateThreadId } from "@/lib/session";

/**
 * Client-side CopilotKit provider. The thread id must come from localStorage
 * (browser-only), so it is resolved after mount; until then CopilotKit runs
 * on its internal id, and no agent run can start before the user interacts.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [threadId, setThreadId] = useState<string | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is browser-only; resolving before mount would break hydration
    setThreadId(getOrCreateThreadId());
  }, []);

  if (!threadId) return null;

  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="lesson" threadId={threadId}>
      {children}
    </CopilotKit>
  );
}
