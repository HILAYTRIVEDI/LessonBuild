/**
 * Minimal FIFO concurrency limiter. Used to keep CPU-bound work (PDF text
 * extraction) from monopolizing the event loop when many requests arrive at
 * once; excess tasks wait their turn instead of all running immediately.
 *
 * @param maxConcurrent Maximum number of tasks allowed to run at once.
 * @return A wrapper that schedules promise-returning tasks through the limiter.
 */
export function createLimiter(maxConcurrent: number): <T>(task: () => Promise<T>) => Promise<T> {
  if (maxConcurrent < 1) throw new Error("createLimiter: maxConcurrent must be at least 1");

  let active = 0;
  const waiting: (() => void)[] = [];

  const release = () => {
    active--;
    waiting.shift()?.();
  };

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= maxConcurrent) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active++;
    try {
      return await task();
    } finally {
      release();
    }
  };
}
