import { NextRequest } from "next/server";
import { json } from "@/lib/portfolio-response";
import {
  allowedOrigin,
  checkPassword,
  configured,
  issueSession,
  sessionCookie,
} from "@/lib/portfolio-playground";

// ponytail: one-process throttle for the internal demo; use shared storage if replicated.
let attempts = 0;
let windowEnd = 0;

export async function POST(request: NextRequest) {
  if (!configured()) return json({ error: "not_found" }, 404);
  if (!allowedOrigin(request.headers.get("origin"), request.nextUrl.origin))
    return json({ error: "origin_denied" }, 403);
  if (Date.now() > windowEnd) {
    attempts = 0;
    windowEnd = Date.now() + 60_000;
  }
  if (++attempts > 10) return json({ error: "rate_limited" }, 429);
  let input;
  try {
    input = await request.json();
  } catch {
    input = {};
  }
  if (!input || typeof input !== "object") input = {};
  if (!checkPassword(input.password))
    return json({ error: "unauthorized" }, 401);
  attempts = 0;
  const response = json({ ok: true });
  response.cookies.set({ ...sessionCookie(), value: issueSession() });
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!allowedOrigin(request.headers.get("origin"), request.nextUrl.origin))
    return json({ error: "origin_denied" }, 403);
  const response = json({ ok: true });
  response.cookies.set({ ...sessionCookie(), value: "", maxAge: 0 });
  return response;
}
