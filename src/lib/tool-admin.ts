import { Client } from "@langchain/langgraph-sdk";
import { getRuntimeConnection } from "@/lib/runtime-connection";

type ToolAdminInput = {
  operation: "list_tools" | "set_tool_enabled" | "reset_tools";
  tool_name?: string;
  enabled?: boolean;
};

type AdminState = {
  result?: Record<string, unknown> | Array<Record<string, unknown>>;
  error?: string;
};

export async function runToolAdmin(input: ToolAdminInput): Promise<unknown> {
  const { apiUrl, apiKey } = getRuntimeConnection();
  if (!apiUrl) throw new Error("Deployment URL não configurada.");
  const client = new Client({ apiUrl, apiKey });
  const assistants = await client.assistants.search({
    graphId: "okf_admin",
    limit: 20,
    offset: 0,
  });
  const assistant = assistants.find((item) => item.graph_id === "okf_admin");
  if (!assistant) throw new Error("Admin graph não encontrado no runtime.");
  const thread = await client.threads.create();
  try {
    const stream = client.runs.stream(
      thread.thread_id,
      assistant.assistant_id,
      {
        input,
        streamMode: ["values"],
      },
    );
    let state: AdminState = {};
    for await (const event of stream) {
      if (event.event === "error")
        throw new Error("Falha no runtime. Consulte o trace da execução.");
      if (
        event.event === "values" &&
        event.data &&
        typeof event.data === "object"
      )
        state = event.data as AdminState;
    }
    if (state.error) throw new Error(state.error);
    return state.result ?? {};
  } finally {
    await client.threads.delete(thread.thread_id);
  }
}
