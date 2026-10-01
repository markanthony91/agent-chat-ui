import { initApiPassthrough } from "langgraph-nextjs-api-passthrough";

// This file acts as a proxy for requests to your LangGraph server.
// Read the [Going to Production](https://github.com/langchain-ai/agent-chat-ui?tab=readme-ov-file#going-to-production) section for more information.

const passthrough = initApiPassthrough({
  apiUrl: process.env.LANGGRAPH_API_URL ?? "remove-me", // default, if not defined it will attempt to read process.env.LANGGRAPH_API_URL
  apiKey: process.env.LANGSMITH_API_KEY ?? "remove-me", // default, if not defined it will attempt to read process.env.LANGSMITH_API_KEY
  runtime: "edge", // default
});
const disabled = () =>
  new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
const locked = process.env.PLAYGROUND_ONLY === "true";
export const GET = locked ? disabled : passthrough.GET;
export const POST = locked ? disabled : passthrough.POST;
export const PUT = locked ? disabled : passthrough.PUT;
export const PATCH = locked ? disabled : passthrough.PATCH;
export const DELETE = locked ? disabled : passthrough.DELETE;
export const OPTIONS = locked ? disabled : passthrough.OPTIONS;
export const runtime = "edge";
