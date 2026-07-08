import { NextRequest, NextResponse } from "next/server";
import { extractText } from "@/lib/pdf";
import { createLesson } from "@lessonbuild/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file" }, { status: 400 });
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const docText = await extractText(data);
  if (!docText) {
    return NextResponse.json({ error: "could not extract text" }, { status: 422 });
  }
  const title = file.name.replace(/\.pdf$/i, "");
  const lessonId = await createLesson({ title, sourceFilename: file.name, docText });
  return NextResponse.json({ lessonId, title });
}
