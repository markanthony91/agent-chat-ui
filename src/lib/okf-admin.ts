import { Client } from "@langchain/langgraph-sdk";
import { getRuntimeConnection } from "@/lib/runtime-connection";

type OkfAdminInput = {
  operation:
    | "status"
    | "list"
    | "catalog"
    | "read"
    | "write"
    | "import_bundle"
    | "create_draft"
    | "list_drafts"
    | "draft_list"
    | "draft_read"
    | "draft_write"
    | "validate_draft"
    | "publish_draft"
    | "list_versions"
    | "activate_bundle"
    | "list_tools"
    | "set_tool_enabled"
    | "reset_tools"
    | "get_simulator_fixture"
    | "save_simulator_fixture"
    | "get_llm_config"
    | "validate_runtime_settings";
  settings?: Record<string, unknown>;
  approved?: boolean;
  bundle_name?: string;
  bundle_version?: string;
  bundle_id?: string;
  files?: Record<string, string>;
  path?: string;
  content?: string;
  query?: string;
  draft_id?: string;
  from_active?: boolean;
  tool_name?: string;
  enabled?: boolean;
  fixture?: Record<string, unknown>;
};

type OkfAdminState = {
  result?: Record<string, unknown> | Array<Record<string, unknown>>;
  error?: string;
};

async function getAdminAssistant(client: Client) {
  const assistants = await client.assistants.search({
    graphId: "okf_admin",
    limit: 20,
    offset: 0,
  });
  const assistant = assistants.find((item) => item.graph_id === "okf_admin");
  if (!assistant)
    throw new Error("OKF admin graph não encontrado no runtime canônico.");
  return assistant;
}

export async function runOkfAdmin(
  input: OkfAdminInput,
): Promise<Record<string, unknown>> {
  const { apiUrl, apiKey } = getRuntimeConnection();
  if (!apiUrl) throw new Error("Deployment URL do OKF não configurada.");
  const client = new Client({ apiUrl, apiKey });
  const assistant = await getAdminAssistant(client);
  const thread = await client.threads.create();
  try {
    const stream = client.runs.stream(
      thread.thread_id,
      assistant.assistant_id,
      {
        input,
        streamMode: "values",
      },
    );
    let state: OkfAdminState = {};
    for await (const event of stream) {
      if (event.event === "error")
        throw new Error("Falha no runtime. Consulte o trace da execução.");
      if (
        event.event === "values" &&
        event.data &&
        typeof event.data === "object" &&
        !Array.isArray(event.data)
      )
        state = event.data as OkfAdminState;
    }
    if (state.error) throw new Error(state.error);
    return (state.result ?? {}) as unknown as Record<string, unknown>;
  } finally {
    await client.threads.delete(thread.thread_id);
  }
}
