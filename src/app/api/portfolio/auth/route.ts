import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { json } from "@/lib/portfolio-response";
import {
  allowedEmail,
  allowedOrigin,
  challengeCookie,
  challengeCookieValue,
  checkPassword,
  configured,
  issueSession,
  newChallenge,
  newOtp,
  otpDigest,
  otpMatches,
  otpStore,
  sessionCookie,
} from "@/lib/portfolio-playground";

const challengeKey = (token: string) => `zerai:playground:otp:${token}`;
const attemptsKey = (token: string) => `zerai:playground:otp-attempts:${token}`;

function originAllowed(request: NextRequest) {
  return allowedOrigin(request.headers.get("origin"), request.nextUrl.origin);
}

async function inputFor(request: NextRequest) {
  if (Number(request.headers.get("content-length") || 0) > 4096) return {};
  try {
    const input = await request.json();
    return input && typeof input === "object" ? input : {};
  } catch {
    return {};
  }
}

async function sendOtp(email: string, code: string) {
  const key = process.env.PLAYGROUND_RESEND_API_KEY || "";
  const from = process.env.PLAYGROUND_OTP_FROM || "";
  if (!key || !from) throw new Error("otp_email_not_configured");
  const endpoint =
    process.env.PLAYGROUND_RESEND_API_URL || "https://api.resend.com/emails";
  if (
    endpoint !== "https://api.resend.com/emails" &&
    !/^http:\/\/127\.0\.0\.1:\d+\/emails$/.test(endpoint)
  )
    throw new Error("invalid_otp_email_endpoint");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Código de acesso ao Playground Zerai",
      text: `Seu código de acesso é ${code}. Ele expira em 10 minutos. Se você não solicitou este acesso, ignore esta mensagem.`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error("otp_email_failed");
}

export async function POST(request: NextRequest) {
  if (!configured()) return json({ error: "not_found" }, 404);
  if (!originAllowed(request)) return json({ error: "origin_denied" }, 403);
  const input = await inputFor(request);
  const email =
    typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (!allowedEmail(email)) return json({ error: "unauthorized" }, 401);
  try {
    const store = await otpStore();
    const rateKey = `zerai:playground:otp-requests:${createHash("sha256").update(email).digest("hex")}`;
    const count = await store.incr(rateKey);
    if (count === 1) await store.expire(rateKey, 900);
    if (count > 5) return json({ error: "rate_limited" }, 429);
    if (!checkPassword(input.password))
      return json({ error: "unauthorized" }, 401);

    const token = newChallenge();
    const code = newOtp();
    await store.set(
      challengeKey(token),
      JSON.stringify({ email, digest: otpDigest(token, code) }),
      { EX: 600 },
    );
    try {
      await sendOtp(email, code);
    } catch {
      await store.del(challengeKey(token));
      return json({ error: "email_unavailable" }, 503);
    }
    const response = json({ otp_required: true });
    response.cookies.set({ ...challengeCookie(), value: token });
    return response;
  } catch {
    return json({ error: "authentication_unavailable" }, 503);
  }
}

export async function PUT(request: NextRequest) {
  if (!configured()) return json({ error: "not_found" }, 404);
  if (!originAllowed(request)) return json({ error: "origin_denied" }, 403);
  const input = await inputFor(request);
  const token = await challengeCookieValue();
  if (!/^[a-f0-9]{48}$/.test(token) || !/^\d{6}$/.test(input.code || ""))
    return json({ error: "invalid_code" }, 401);
  try {
    const store = await otpStore();
    const raw = await store.get(challengeKey(token));
    if (!raw) return json({ error: "expired_code" }, 401);
    const challenge = JSON.parse(raw) as { email: string; digest: string };
    if (!allowedEmail(challenge.email))
      return json({ error: "invalid_code" }, 401);
    if (!otpMatches(otpDigest(token, input.code), challenge.digest)) {
      const attempts = await store.incr(attemptsKey(token));
      if (attempts === 1) await store.expire(attemptsKey(token), 600);
      if (attempts >= 5) await store.del(challengeKey(token));
      return json({ error: "invalid_code" }, 401);
    }
    const consumed = await store.getDel(challengeKey(token));
    if (consumed !== raw) return json({ error: "invalid_code" }, 401);
    await store.del(attemptsKey(token));
    const response = json({ ok: true });
    response.cookies.set({
      ...sessionCookie(),
      value: issueSession(challenge.email),
    });
    response.cookies.set({ ...challengeCookie(), value: "", maxAge: 0 });
    return response;
  } catch {
    return json({ error: "authentication_unavailable" }, 503);
  }
}

export async function DELETE(request: NextRequest) {
  if (!originAllowed(request)) return json({ error: "origin_denied" }, 403);
  const response = json({ ok: true });
  response.cookies.set({ ...sessionCookie(), value: "", maxAge: 0 });
  response.cookies.set({ ...challengeCookie(), value: "", maxAge: 0 });
  return response;
}
