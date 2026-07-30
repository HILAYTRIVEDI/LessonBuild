import { z } from "zod";
import type { UploadLessonResult } from "@/lib/workflow";

const UploadLessonResponseSchema = z.object({
  lessonId: z.string(),
  title: z.string().optional(),
  workflow: z
    .object({
      filename: z.string(),
      title: z.string(),
      sizeBytes: z.number(),
      mimeType: z.string(),
      extractedCharacters: z.number(),
      chunkCount: z.number(),
      database: z.object({
        lessonTable: z.string(),
        chunkTable: z.string(),
        lessonId: z.string(),
      }),
      functions: z.object({
        uploadHandler: z.string(),
        pdfExtractor: z.string(),
        chunker: z.string(),
        persistence: z.string(),
      }),
    })
    .optional(),
});

export class UploadLessonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadLessonError";
  }
}

/** Uploads a PDF and returns the created lesson id. */
export async function uploadLessonPdf(file: File): Promise<UploadLessonResult> {
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

  return parsed.data;
}
