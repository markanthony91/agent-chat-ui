import { hostname } from "node:os";
import { NextResponse } from "next/server";

export function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json({ ...body, hostname: hostname() }, { status });
}
