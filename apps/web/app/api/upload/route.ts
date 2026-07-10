import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/pdf";
import { chunkText } from "@/lib/textChunks";
import { createLesson } from "@lessonbuild/db";

export const runtime = "nodejs";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const PARSE_TIMEOUT_MS = 20_000;
const PDF_HEADER = "%PDF-";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function hasPdfHeader(data: Uint8Array): boolean {
  const header = new TextDecoder().decode(data.slice(0, PDF_HEADER.length));
  return header === PDF_HEADER;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error("PDF parsing timed out")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return errorResponse("no file", 400);
    }
    if (!isPdfFile(file)) {
      return errorResponse("file must be a PDF", 415);
    }
    if (file.size <= 0) {
      return errorResponse("file is empty", 400);
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return errorResponse("PDF is too large", 413);
    }

    const data = new Uint8Array(await file.arrayBuffer());
    if (!hasPdfHeader(data)) {
      return errorResponse("file is not a valid PDF", 415);
    }

    const docText = await withTimeout(extractText(data), PARSE_TIMEOUT_MS);
    if (!docText) {
      return errorResponse("could not extract text", 422);
    }

    const title = file.name.replace(/\.pdf$/i, "");
    const lessonId = await createLesson({
      title,
      sourceFilename: file.name,
      docText,
      chunks: chunkText(docText),
    });
    return NextResponse.json({ lessonId, title });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upload failed";
    if (message === "PDF parsing timed out") {
      return errorResponse(message, 408);
    }
    return errorResponse("upload failed", 500);
  }
}
