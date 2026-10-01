import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { json } from "@/lib/portfolio-response";
import {
  assistantFor,
  portfolios,
  sessionIdentity,
  signThread,
  verifyThread,
} from "@/lib/portfolio-playground";

async function runtime(path: string, body: unknown) {
  const base = process.env.LANGGRAPH_API_URL || "";
  if (!/^https?:\/\//.test(base)) throw new Error("runtime_unavailable");
  const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.LANGSMITH_API_KEY
        ? { "X-Api-Key": process.env.LANGSMITH_API_KEY }
        : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) throw new Error("runtime_unavailable");
  return response.json();
}

export async function POST(request: NextRequest) {
  const sessionId = await sessionIdentity();
  if (!sessionId) return json({ error: "unauthorized" }, 401);
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return json({ error: "origin_denied" }, 403);
  let input;
  try {
    input = await request.json();
  } catch {
    input = {};
  }
  if (!input || typeof input !== "object") input = {};
  if (
    !Number.isSafeInteger(input.scope_id) ||
    typeof input.message !== "string" ||
    !input.message.trim() ||
    input.message.length > 4000
  )
    return json({ error: "invalid_message" }, 400);
  try {
    const portfolio = (await portfolios()).find(
      (item) => item.scope_id === input.scope_id,
    );
    if (!portfolio) return json({ error: "portfolio_not_found" }, 404);
    const assistantId = assistantFor(portfolio);
    let threadId: string;
    if (input.thread_token) {
      threadId = verifyThread(
        input.thread_token,
        portfolio.scope_id,
        assistantId,
        sessionId,
      );
    } else {
      const created = await runtime("/threads", {
        metadata: { channel: "portfolio-playground" },
      });
      threadId = created.thread_id;
      if (!/^[a-f0-9-]{36}$/i.test(threadId))
        throw new Error("runtime_unavailable");
    }
    const result = await runtime(`/threads/${threadId}/runs/wait`, {
      assistant_id: assistantId,
      input: {
        messages: [
          { id: randomUUID(), type: "human", content: input.message.trim() },
        ],
      },
      multitask_strategy: "reject",
    });
    const answer = result.messages?.at(-1);
    if (
      answer?.type !== "ai" ||
      typeof answer.content !== "string" ||
      answer.tool_calls?.length ||
      result.__interrupt__?.length
    )
      throw new Error("invalid_agent_response");
    return json({
      reply: answer.content,
      thread_token: signThread(
        threadId,
        portfolio.scope_id,
        assistantId,
        sessionId,
      ),
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : "runtime_unavailable";
    const safe = [
      "portfolio_chat_not_ready",
      "portfolio_assistant_not_ready",
      "invalid_thread",
    ].includes(code);
    return json(
      { error: safe ? code : "runtime_unavailable" },
      code === "portfolio_chat_not_ready" ||
        code === "portfolio_assistant_not_ready"
        ? 409
        : code === "invalid_thread"
          ? 400
          : 503,
    );
  }
}
