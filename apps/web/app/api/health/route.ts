import { NextResponse } from "next/server";

/** Health checks run in Node to match the deployed web service runtime. */
export const runtime = "nodejs";

/** Lightweight liveness endpoint for Docker and deployment health checks. */
export function GET() {
  return NextResponse.json({ ok: true });
}
