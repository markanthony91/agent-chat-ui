import { Client } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";

type ToolAdminInput = {
  operation: "list_tools" | "set_tool_enabled" | "reset_tools";
  tool_name?: string;
  enabled?: boolean;
};

type AdminState = {
  result?: Record<string, unknown> | Array<Record<string, unknown>>;
  error?: string;
};

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    apiKey: getApiKey() || undefined,
  };
}

export async function runToolAdmin(input: ToolAdminInput): Promise<unknown> {
  const { apiUrl, apiKey } = getConnection();
  if (!apiUrl) throw new Error("Deployment URL não configurada.");
  const client = new Client({ apiUrl, apiKey });
  const assistants = await client.assistants.search({ graphId: "okf_admin", limit: 20, offset: 0 });
  const assistant = assistants.find((item) => item.graph_id === "okf_admin");
  if (!assistant) throw new Error("Admin graph não encontrado no runtime.");
  const thread = await client.threads.create();
  try {
    const stream = client.runs.stream(thread.thread_id, assistant.assistant_id, {
      input,
      streamMode: ["values"],
    });
    let state: AdminState = {};
    for await (const event of stream) {
      if (event.data && typeof event.data === "object") state = event.data as AdminState;
    }
    if (state.error) throw new Error(state.error);
    return state.result ?? {};
  } finally {
    await client.threads.delete(thread.thread_id);
  }
}
