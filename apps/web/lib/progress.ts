/** Progress line for the MCQ widget header, e.g. "Question 2 of 6 · 4 remaining". */
export function formatProgress(questionIdx: number, totalQuestions: number): string {
  const remaining = Math.max(totalQuestions - questionIdx - 1, 0);
  return `Question ${questionIdx + 1} of ${totalQuestions} · ${remaining} remaining`;
}
