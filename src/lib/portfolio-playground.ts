import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const cookieName = "zerai_playground_session";

function secret() {
  const value = process.env.PLAYGROUND_COOKIE_SECRET || "";
  if (value.length < 32) throw new Error("playground_not_configured");
  return value;
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function equal(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function configured() {
  return process.env.PLAYGROUND_ONLY === "true";
}

export function checkPassword(candidate: unknown) {
  const expected = process.env.PLAYGROUND_PASSWORD || "";
  return (
    expected.length >= 20 &&
    typeof candidate === "string" &&
    equal(candidate, expected)
  );
}

export function issueSession() {
  const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
  const nonce = randomBytes(16).toString("hex");
  const payload = `${expiry}.${nonce}`;
  return `${payload}.${signature(payload)}`;
}

export async function sessionIdentity() {
  if (!configured()) return false;
  const raw = (await cookies()).get(cookieName)?.value || "";
  const [expiry, nonce, mac] = raw.split(".");
  if (!/^\d+$/.test(expiry || "") || !/^[a-f0-9]{32}$/.test(nonce || ""))
    return false;
  if (Number(expiry) <= Date.now() || !/^[a-f0-9]{64}$/.test(mac || ""))
    return false;
  return equal(mac, signature(`${expiry}.${nonce}`)) ? nonce : false;
}

export async function sessionValid() {
  return Boolean(await sessionIdentity());
}

export function sessionCookie() {
  return {
    name: cookieName,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: 8 * 60 * 60,
  };
}

export type Portfolio = {
  scope_id: number;
  tenant_name: string;
  portfolio_name: string;
  assistant_name: string;
  runtime_assistant_id: string | null;
};

export async function portfolios(): Promise<Portfolio[]> {
  const base = process.env.CHANNEL_CONSOLE_URL || "";
  const token = process.env.PLAYGROUND_API_TOKEN || "";
  if (!/^https?:\/\//.test(base) || !/^[a-f0-9]{64}$/.test(token)) {
    throw new Error("portfolio_catalog_unavailable");
  }
  const response = await fetch(
    `${base.replace(/\/$/, "")}/api/playground/v1/portfolios`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    },
  );
  if (!response.ok) throw new Error("portfolio_catalog_unavailable");
  const body = await response.json();
  if (!Array.isArray(body.portfolios))
    throw new Error("portfolio_catalog_unavailable");
  return body.portfolios;
}

export function assistantFor(portfolio: Portfolio) {
  const allowed = (process.env.PLAYGROUND_CHAT_SCOPE_IDS || "1")
    .split(",")
    .map((id) => Number(id.trim()));
  if (!allowed.includes(portfolio.scope_id))
    throw new Error("portfolio_chat_not_ready");
  const assistant =
    portfolio.runtime_assistant_id ||
    (portfolio.scope_id === 1
      ? process.env.PLAYGROUND_LEGACY_ASSISTANT_ID
      : "");
  if (
    !assistant ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(assistant)
  )
    throw new Error("portfolio_assistant_not_ready");
  return assistant;
}

export function signThread(
  threadId: string,
  scopeId: number,
  assistantId: string,
  sessionId: string,
) {
  const payload = `${threadId}.${scopeId}.${assistantId}.${sessionId}`;
  return `${threadId}.${signature(payload)}`;
}

export function verifyThread(
  token: unknown,
  scopeId: number,
  assistantId: string,
  sessionId: string,
) {
  if (typeof token !== "string") throw new Error("invalid_thread");
  const [threadId, mac] = token.split(".");
  if (
    !/^[a-f0-9-]{36}$/i.test(threadId || "") ||
    !/^[a-f0-9]{64}$/.test(mac || "")
  )
    throw new Error("invalid_thread");
  if (
    !equal(mac, signature(`${threadId}.${scopeId}.${assistantId}.${sessionId}`))
  )
    throw new Error("invalid_thread");
  return threadId;
}
