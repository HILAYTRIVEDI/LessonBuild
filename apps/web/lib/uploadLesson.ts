import { z } from "zod";

const UploadLessonResponseSchema = z.object({
  lessonId: z.string(),
});

export class UploadLessonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadLessonError";
  }
}

/** Uploads a PDF and returns the created lesson id. */
export async function uploadLessonPdf(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);

  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    throw new UploadLessonError(`Upload failed (${res.status}). Please try another PDF.`);
  }

  const parsed = UploadLessonResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new UploadLessonError("Upload succeeded but the server response was malformed.");
  }

  return parsed.data.lessonId;
}
