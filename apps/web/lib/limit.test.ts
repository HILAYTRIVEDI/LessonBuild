import { describe, it, expect } from "vitest";
import { createLimiter } from "./limit";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 10));

describe("createLimiter", () => {
  it("runs at most the configured number of tasks concurrently", async () => {
    const limit = createLimiter(2);
    let active = 0;
    let peak = 0;

    const task = () =>
      limit(async () => {
        active++;
        peak = Math.max(peak, active);
        await tick();
        active--;
        return "done";
      });

    const results = await Promise.all([task(), task(), task(), task(), task()]);
    expect(results).toEqual(["done", "done", "done", "done", "done"]);
    expect(peak).toBe(2);
  });

  it("releases the slot when a task rejects so later tasks still run", async () => {
    const limit = createLimiter(1);
    await expect(limit(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(limit(async () => "recovered")).resolves.toBe("recovered");
  });
});
