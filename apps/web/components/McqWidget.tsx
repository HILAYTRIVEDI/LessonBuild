"use client";
import { useState } from "react";

export function McqWidget({
  stem,
  choices,
  onSubmit,
}: {
  stem: string;
  choices: string[];
  onSubmit: (selectedIndex: number) => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  function handleSubmit() {
    if (selected === null) return;
    setLocked(true);
    onSubmit(selected);
  }

  return (
    <div className="rounded-md border border-border bg-surface p-6 shadow-card">
      <p className="font-medium">{stem}</p>
      <div className="mt-4 space-y-2">
        {choices.map((c, i) => (
          <label
            key={i}
            className={`flex cursor-pointer items-center gap-3 rounded-sm border p-3 ${
              selected === i ? "border-primary bg-primary/10" : "border-border"
            }`}
          >
            <input
              type="radio"
              name="mcq"
              disabled={locked}
              checked={selected === i}
              onChange={() => setSelected(i)}
            />
            <span>{c}</span>
          </label>
        ))}
      </div>
      {!locked && (
        <button
          className="mt-4 rounded-md bg-primary px-4 py-2 font-medium text-white disabled:opacity-50"
          disabled={selected === null}
          onClick={handleSubmit}
        >
          Submit
        </button>
      )}
    </div>
  );
}
