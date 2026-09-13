import { Client } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";

type RawCompilerInput = {
  operation: "analyze" | "create_draft";
  source_name?: string;
  raw_text?: string;
  ingestion_id?: string;
};

type RawCompilerState = {
  result?: Record<string, unknown>;
  error?: string;
};

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    apiKey: getApiKey() || undefined,
  };
}

export async function runRawCompiler(input: RawCompilerInput): Promise<Record<string, unknown>> {
  const { apiUrl, apiKey } = getConnection();
  if (!apiUrl) throw new Error("Deployment URL não configurada.");
  const client = new Client({ apiUrl, apiKey });
  const assistants = await client.assistants.search({ graphId: "raw_compiler", limit: 20, offset: 0 });
  const assistant = assistants.find((item) => item.graph_id === "raw_compiler");
  if (!assistant) throw new Error("RAW compiler graph não encontrado no runtime.");
  const thread = await client.threads.create();
  try {
    const stream = client.runs.stream(thread.thread_id, assistant.assistant_id, {
      input,
      streamMode: ["values"],
    });
    let state: RawCompilerState = {};
    for await (const event of stream) {
      if (event.data && typeof event.data === "object") state = event.data as RawCompilerState;
    }
    if (state.error) throw new Error(state.error);
    return state.result ?? {};
  } finally {
    await client.threads.delete(thread.thread_id);
  }
}
