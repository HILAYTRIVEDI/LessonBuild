import { describe, it, expect, beforeEach, vi } from "vitest";
import { getOrCreateThreadId, loadLessonId, saveLessonId, clearSession } from "./session";

function fakeStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

describe("session persistence", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", fakeStorage());
  });

  it("creates a thread id once and returns the same one afterwards", () => {
    const first = getOrCreateThreadId();
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(getOrCreateThreadId()).toBe(first);
  });

  it("round-trips the lesson id", () => {
    expect(loadLessonId()).toBeNull();
    saveLessonId("lesson-123");
    expect(loadLessonId()).toBe("lesson-123");
  });

  it("clearSession removes both keys so the next visit starts fresh", () => {
    saveLessonId("lesson-123");
    const thread = getOrCreateThreadId();
    clearSession();
    expect(loadLessonId()).toBeNull();
    expect(getOrCreateThreadId()).not.toBe(thread);
  });

  it("is a no-op outside the browser", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadLessonId()).toBeNull();
    saveLessonId("x");
    expect(() => clearSession()).not.toThrow();
  });
});
