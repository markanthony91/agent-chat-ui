import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { chromium } from "@playwright/test";

const token = "a".repeat(64);
const assistantId = "00000000-0000-4000-8000-000000000001";
const usedigiAssistantId = "00000000-0000-4000-8000-000000000002";
const searches = [];
const send = (res, status, body) => {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Api-Key",
  });
  res.end(JSON.stringify(body));
};
const wallet = createServer((req, res) => {
  if (
    req.url !== "/api/playground/v1/portfolios" ||
    req.headers.authorization !== `Bearer ${token}`
  )
    return send(res, 401, { error: "unauthorized" });
  send(res, 200, {
    portfolios: [
      {
        scope_id: 1,
        tenant_name: "Fastpay",
        portfolio_name: "Will Bank",
        assistant_name: "Sophia",
        runtime_assistant_id: null,
      },
      {
        scope_id: 2,
        tenant_name: "Usedig",
        portfolio_name: "Demo",
        assistant_name: "Larissa",
        runtime_assistant_id: usedigiAssistantId,
      },
    ],
  });
});
const runtime = createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.url === "/info") return send(res, 200, {});
  if (req.url === "/threads/search") {
    let raw = "";
    for await (const part of req) raw += part;
    searches.push(JSON.parse(raw).metadata);
    return send(res, 200, []);
  }
  send(res, 404, { error: "missing" });
});
const listen = (server) =>
  new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
await listen(wallet);
await listen(runtime);
const app = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", "0"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PLAYGROUND_ONLY: "true",
      PLAYGROUND_PASSWORD: "synthetic-playground-password",
      PLAYGROUND_COOKIE_SECRET: "synthetic-cookie-secret-0123456789abcdef",
      PLAYGROUND_API_TOKEN: token,
      CHANNEL_CONSOLE_URL: `http://127.0.0.1:${wallet.address().port}`,
      LANGGRAPH_API_URL: `http://127.0.0.1:${runtime.address().port}`,
      PLAYGROUND_LEGACY_ASSISTANT_ID: assistantId,
      PLAYGROUND_CHAT_SCOPE_IDS: "1,2",
      RAILWAY_PUBLIC_DOMAIN: "playground.example.test",
    },
  },
);
try {
  const base = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("next_start_timeout")),
      15000,
    );
    let output = "";
    app.once("exit", () => {
      clearTimeout(timer);
      reject(new Error("next_start_failed"));
    });
    app.stdout.on("data", (chunk) => {
      output += String(chunk);
      const port = /http:\/\/localhost:(\d+)/.exec(output)?.[1];
      if (port) {
        clearTimeout(timer);
        resolve(`http://localhost:${port}`);
      }
    });
  });
  const origin = { Origin: "https://playground.example.test" };
  assert.equal((await fetch(`${base}/api/portfolio/list`)).status, 401);
  assert.equal(
    (
      await fetch(`${base}/api/portfolio/auth`, {
        method: "POST",
        headers: { Origin: base, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "synthetic-playground-password" }),
      })
    ).status,
    403,
  );
  const login = await fetch(`${base}/api/portfolio/auth`, {
    method: "POST",
    headers: { ...origin, "Content-Type": "application/json" },
    body: JSON.stringify({ password: "synthetic-playground-password" }),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const headers = {
    ...origin,
    Cookie: cookie,
    "Content-Type": "application/json",
  };
  const list = await fetch(`${base}/api/portfolio/list`, { headers });
  assert.equal(list.status, 200);
  const portfolios = (await list.json()).portfolios;
  assert.equal(portfolios.length, 2);
  assert.equal(portfolios[0].chat_ready, true);
  assert.equal(portfolios[1].chat_ready, true);
  assert.equal(
    (await fetch(`${base}/api/portfolio/chat`, { method: "POST", headers }))
      .status,
    404,
  );
  assert.equal(
    (
      await fetch(`${base}/api/assistants/search`, {
        method: "POST",
        headers,
        body: "{}",
      })
    ).status,
    404,
  );
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const [name, value] = cookie.split("=");
    await context.addCookies([{ name, value, url: base }]);
    const page = await context.newPage();
    await page.goto(base);
    await page.getByLabel("Carteira").selectOption("1");
    await page.getByPlaceholder("Type your message...").waitFor();
    await page.getByText("Hide Tool Calls").waitFor();
    await page.waitForFunction(() =>
      document.body.textContent.includes("Thread History"),
    );
    await page.getByLabel("Carteira").selectOption("2");
    await page.getByPlaceholder("Type your message...").waitFor();
    await page.getByText("Larissa").waitFor();
    await page.waitForTimeout(200);
    assert.ok(
      searches.some((metadata) => metadata.assistant_id === assistantId),
    );
    assert.ok(
      searches.some((metadata) => metadata.assistant_id === usedigiAssistantId),
    );
  } finally {
    await browser.close();
  }
  console.log("portfolio playground smoke passed");
} finally {
  app.kill("SIGTERM");
  await Promise.all([
    new Promise((resolve) => wallet.close(resolve)),
    new Promise((resolve) => runtime.close(resolve)),
  ]);
}
