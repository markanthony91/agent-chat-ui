import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";

const token = "a".repeat(64);
const assistantId = "00000000-0000-4000-8000-000000000001";
const threadId = "00000000-0000-4000-8000-000000000010";
const send = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
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
        assistant_name: "Sophia",
        runtime_assistant_id: "00000000-0000-4000-8000-000000000002",
      },
    ],
  });
});
const runtime = createServer(async (req, res) => {
  if (req.url === "/threads") return send(res, 200, { thread_id: threadId });
  if (req.url === `/threads/${threadId}/runs/wait`) {
    let raw = "";
    for await (const part of req) raw += part;
    if (JSON.parse(raw).assistant_id !== assistantId)
      return send(res, 403, { error: "scope" });
    return send(res, 200, {
      messages: [{ type: "ai", content: "Resposta simulada de teste." }],
    });
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
  const origin = { Origin: base };
  assert.equal((await fetch(`${base}/api/portfolio/list`)).status, 401);
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
  assert.equal(portfolios[1].chat_ready, false);
  const chat = (scope_id, message, thread_token = null) =>
    fetch(`${base}/api/portfolio/chat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ scope_id, message, thread_token }),
    });
  assert.equal((await chat(2, "Tenho dívida?")).status, 409);
  const first = await chat(1, "Olá");
  assert.equal(first.status, 200);
  const answer = await first.json();
  assert.equal(answer.reply, "Resposta simulada de teste.");
  assert.equal((await chat(1, "Tudo bem?", answer.thread_token)).status, 200);
  assert.equal((await chat(1, "Olá", answer.thread_token + "x")).status, 400);
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
  console.log("portfolio playground smoke passed");
} finally {
  app.kill("SIGTERM");
  await Promise.all([
    new Promise((resolve) => wallet.close(resolve)),
    new Promise((resolve) => runtime.close(resolve)),
  ]);
}
