"use client";
export function ProgressReport({ report }: { report: string }) {
  const [headline, ...rest] = report.split("\n\n");
  return (
    <div className="rounded-md border border-border bg-surface p-6 shadow-card">
      <div className="inline-flex items-center rounded-full bg-accent/10 px-3 py-1 text-sm font-semibold text-accent">
        Lesson complete
      </div>
      <h3 className="mt-3 text-lg font-bold">{headline}</h3>
      <div className="mt-3 space-y-2 text-sm text-text-muted">
        {rest
          .join("\n\n")
          .split("\n")
          .filter(Boolean)
          .map((line, i) => (
            <p key={i}>{line}</p>
          ))}
      </div>
    </div>
  );
}
