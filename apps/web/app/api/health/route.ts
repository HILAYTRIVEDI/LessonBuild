import { NextResponse } from "next/server";

/** Health checks run in Node to match the deployed web service runtime. */
export const runtime = "nodejs";

/**
 * Lightweight liveness endpoint for Docker and deployment health checks.
 *
 * @return JSON liveness response.
 */
export function GET() {
  return NextResponse.json({ ok: true });
}
