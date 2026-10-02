import {
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { createClient } from "redis";

const cookieName = "zerai_playground_session";
const challengeCookieName = "zerai_playground_challenge";
let redisPromise: Promise<ReturnType<typeof createClient>> | undefined;

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

export function allowedOrigin(origin: string | null, fallback: string) {
  const publicDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  return origin === (publicDomain ? `https://${publicDomain}` : fallback);
}

export function allowedEmail(candidate: unknown): candidate is string {
  if (typeof candidate !== "string") return false;
  const emails = (process.env.PLAYGROUND_ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return (
    emails.length === 2 &&
    new Set(emails).size === 2 &&
    emails.includes(candidate.trim().toLowerCase())
  );
}

export function issueSession(email: string) {
  const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
  const nonce = randomBytes(16).toString("hex");
  const payload = `${expiry}.${nonce}.${Buffer.from(email).toString("base64url")}`;
  return `${payload}.${signature(payload)}`;
}

export async function sessionIdentity() {
  if (!configured()) return false;
  const raw = (await cookies()).get(cookieName)?.value || "";
  const parts = raw.split(".");
  if (parts.length !== 4) return false;
  const [expiry, nonce, encodedEmail, mac] = parts;
  if (!/^\d+$/.test(expiry || "") || !/^[a-f0-9]{32}$/.test(nonce || ""))
    return false;
  if (
    Number(expiry) <= Date.now() ||
    !/^[A-Za-z0-9_-]+$/.test(encodedEmail || "") ||
    !/^[a-f0-9]{64}$/.test(mac || "")
  )
    return false;
  const email = Buffer.from(encodedEmail, "base64url").toString();
  return allowedEmail(email) &&
    equal(mac, signature(`${expiry}.${nonce}.${encodedEmail}`))
    ? email
    : false;
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

export function challengeCookie() {
  return { ...sessionCookie(), name: challengeCookieName, maxAge: 600 };
}

export function challengeCookieValue() {
  return cookies().then((store) => store.get(challengeCookieName)?.value || "");
}

export async function otpStore() {
  const url = process.env.PLAYGROUND_REDIS_URL || "";
  if (!/^rediss?:\/\//.test(url)) throw new Error("otp_store_not_configured");
  if (redisPromise) {
    const client = await redisPromise;
    if (!client.isReady) {
      client.destroy();
      redisPromise = undefined;
    }
  }
  if (!redisPromise) {
    redisPromise = (async () => {
      const client = createClient({
        url,
        socket: { connectTimeout: 3000, reconnectStrategy: false },
      });
      client.on("error", () => {});
      await client.connect();
      return client;
    })().catch(() => {
      redisPromise = undefined;
      throw new Error("otp_store_unavailable");
    });
  }
  return redisPromise;
}

export function otpDigest(token: string, code: string) {
  return createHmac("sha256", secret())
    .update(`${token}:${code}`)
    .digest("hex");
}

export function otpMatches(actual: string, expected: string) {
  return equal(actual, expected);
}

export function newChallenge() {
  return randomBytes(24).toString("hex");
}

export function newOtp() {
  return String(randomInt(100000, 1000000));
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

function simulatorEndpoint(scopeId: number) {
  if (!Number.isSafeInteger(scopeId) || scopeId <= 0)
    throw new Error("invalid_portfolio_scope");
  const base = process.env.CHANNEL_CONSOLE_URL || "";
  const token = process.env.PLAYGROUND_API_TOKEN || "";
  if (!/^https?:\/\//.test(base) || !/^[a-f0-9]{64}$/.test(token))
    throw new Error("portfolio_simulator_unavailable");
  return {
    url: `${base.replace(/\/$/, "")}/api/playground/v1/portfolios/${scopeId}/simulator`,
    token,
  };
}

export async function portfolioSimulator(scopeId: number) {
  const { url, token } = simulatorEndpoint(scopeId);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("portfolio_simulator_unavailable");
  return response.json();
}

export async function savePortfolioSimulator(
  scopeId: number,
  fixture: Record<string, unknown>,
) {
  const { url, token } = simulatorEndpoint(scopeId);
  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fixture }),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("portfolio_simulator_save_failed");
  return response.json();
}

export function assistantFor(portfolio: Portfolio) {
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
