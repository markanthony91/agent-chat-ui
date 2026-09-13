import { Client } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";

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
    | "publish_draft";
  bundle_name?: string;
  bundle_version?: string;
  files?: Record<string, string>;
  path?: string;
  content?: string;
  draft_id?: string;
  from_active?: boolean;
};

type OkfAdminState = {
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

async function getAdminAssistant(client: Client) {
  const assistants = await client.assistants.search({ graphId: "okf_admin", limit: 20, offset: 0 });
  const assistant = assistants.find((item) => item.graph_id === "okf_admin");
  if (!assistant) throw new Error("OKF admin graph não encontrado no runtime.");
  return assistant;
}

export async function runOkfAdmin(input: OkfAdminInput): Promise<Record<string, unknown>> {
  const { apiUrl, apiKey } = getConnection();
  if (!apiUrl) throw new Error("Deployment URL não configurada.");
  const client = new Client({ apiUrl, apiKey });
  const assistant = await getAdminAssistant(client);
  const thread = await client.threads.create();
  try {
    const stream = client.runs.stream(thread.thread_id, assistant.assistant_id, {
      input,
      streamMode: ["values"],
    });
    let state: OkfAdminState = {};
    for await (const event of stream) {
      if (event.data && typeof event.data === "object") state = event.data as OkfAdminState;
    }
    if (state.error) throw new Error(state.error);
    return (state.result ?? {}) as unknown as Record<string, unknown>;
  } finally {
    await client.threads.delete(thread.thread_id);
  }
}
