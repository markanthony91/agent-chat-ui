import { Client } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";

const DEFAULT_OKF_API_URL = "https://langgraph-simple-agent-clean-production.up.railway.app";

type OkfAdminInput = {
  operation:
    | "status"
    | "list"
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
    | "save_simulator_fixture";
  bundle_name?: string;
  bundle_version?: string;
  bundle_id?: string;
  files?: Record<string, string>;
  path?: string;
  content?: string;
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

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("okfApiUrl") || process.env.NEXT_PUBLIC_OKF_API_URL || DEFAULT_OKF_API_URL,
    apiKey: getApiKey() || undefined,
  };
}

async function getAdminAssistant(client: Client) {
  const assistants = await client.assistants.search({ graphId: "okf_admin", limit: 20, offset: 0 });
  const assistant = assistants.find((item) => item.graph_id === "okf_admin");
  if (!assistant) throw new Error("OKF admin graph não encontrado no runtime canônico.");
  return assistant;
}

export async function runOkfAdmin(input: OkfAdminInput): Promise<Record<string, unknown>> {
  const { apiUrl, apiKey } = getConnection();
  if (!apiUrl) throw new Error("Deployment URL do OKF não configurada.");
  const client = new Client({ apiUrl, apiKey });
  const assistant = await getAdminAssistant(client);
  const thread = await client.threads.create();
  try {
    const stream = client.runs.stream(thread.thread_id, assistant.assistant_id, {
      input,
      streamMode: "values",
    });
    let state: OkfAdminState = {};
    for await (const event of stream) {
      if (event.data && typeof event.data === "object" && !Array.isArray(event.data)) state = event.data as OkfAdminState;
    }
    if (state.error) throw new Error(state.error);
    return (state.result ?? {}) as unknown as Record<string, unknown>;
  } finally {
    await client.threads.delete(thread.thread_id);
  }
}
