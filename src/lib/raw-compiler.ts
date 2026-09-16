import { Client } from "@langchain/langgraph-sdk";
import { getRuntimeConnection } from "@/lib/runtime-connection";

type RawCompilerInput = {
  operation:
    | "analyze"
    | "create_draft"
    | "get_agents"
    | "save_agents"
    | "get_agents_versions";
  source_name?: string;
  raw_text?: string;
  ingestion_id?: string;
  agents_content?: string;
  limit?: number;
  offset?: number;
};

type RawCompilerState = {
  result?: Record<string, unknown>;
  error?: string;
};

export async function runRawCompiler(
  input: RawCompilerInput,
): Promise<Record<string, unknown>> {
  const { apiUrl, apiKey } = getRuntimeConnection();
  if (!apiUrl) throw new Error("Deployment URL não configurada.");
  const client = new Client({ apiUrl, apiKey });
  const assistants = await client.assistants.search({
    graphId: "raw_compiler",
    limit: 20,
    offset: 0,
  });
  const assistant = assistants.find((item) => item.graph_id === "raw_compiler");
  if (!assistant)
    throw new Error("RAW compiler graph não encontrado no runtime.");
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
    let state: RawCompilerState = {};
    for await (const event of stream) {
      if (event.event === "error")
        throw new Error("Falha no runtime. Consulte o trace da execução.");
      if (
        event.event === "values" &&
        event.data &&
        typeof event.data === "object"
      )
        state = event.data as RawCompilerState;
    }
    if (state.error) throw new Error(state.error);
    return state.result ?? {};
  } finally {
    await client.threads.delete(thread.thread_id);
  }
}
