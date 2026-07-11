const THREAD_KEY = "lessonbuild.threadId";

/** Storage and cookie key for the currently selected lesson id. */
export const LESSON_KEY = "lessonbuild.lessonId";

function storage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

function setCookie(value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LESSON_KEY}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`;
}

function clearCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LESSON_KEY}=; Path=/; SameSite=Lax; Max-Age=0`;
}

/**
 * CopilotKit mints a brand-new thread id on every page load unless one is
 * passed to the provider, which silently discards the whole conversation on
 * refresh. Persisting the id here lets a reload resume the same LangGraph
 * thread (and its checkpointed lesson state).
 */
export function getOrCreateThreadId(): string {
  const store = storage();
  if (!store) return crypto.randomUUID();
  const existing = store.getItem(THREAD_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  store.setItem(THREAD_KEY, created);
  return created;
}

/** Loads the browser-persisted lesson id, if one exists. */
export function loadLessonId(): string | null {
  return storage()?.getItem(LESSON_KEY) ?? null;
}

/** Persists the lesson id in localStorage and a server-readable cookie. */
export function saveLessonId(lessonId: string): void {
  storage()?.setItem(LESSON_KEY, lessonId);
  setCookie(lessonId);
}

/** Clears local lesson and Copilot thread state before starting over. */
export function clearSession(): void {
  const store = storage();
  store?.removeItem(THREAD_KEY);
  store?.removeItem(LESSON_KEY);
  clearCookie();
}
