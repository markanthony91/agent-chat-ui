import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { validate } from "uuid";

// A graph's system-created assistant is recreated by `langgraph dev` on startup.
// The operator-managed default is a regular, persisted LangGraph assistant.
export async function resolveAssistant(
  client: Client,
  id: string,
): Promise<Assistant> {
  if (validate(id)) return client.assistants.get(id);
  const managed = await client.assistants.search({
    graphId: id,
    metadata: { zerai_default: true },
    limit: 2,
  });
  if (managed.length > 1)
    throw new Error("Mais de um assistente padrão configurado.");
  if (managed.length === 1) return managed[0];
  const records = await client.assistants.search({ graphId: id, limit: 20 });
  const record =
    records.find(
      (item) => item.graph_id === id && item.metadata?.created_by === "system",
    ) ?? records.find((item) => item.graph_id === id);
  if (!record) throw new Error("Assistente não encontrado.");
  return record;
}

export async function saveAssistantContext(
  client: Client,
  id: string,
  changes: Record<string, unknown>,
): Promise<Assistant> {
  const current = await client.assistants.get(id);
  if (current.metadata?.created_by === "system") {
    throw new Error(
      "Configure um assistente persistente antes de salvar. O assistente padrão do sistema é recriado ao reiniciar.",
    );
  }
  const context = (current.context ?? {}) as Record<string, unknown>;
  const updated = await client.assistants.update(id, {
    context: { ...context, ...changes },
  });
  const saved = await client.assistants.get(id);
  const savedContext = (saved.context ?? {}) as Record<string, unknown>;
  for (const [key, value] of Object.entries(changes)) {
    if (JSON.stringify(savedContext[key]) !== JSON.stringify(value)) {
      throw new Error(
        "Não foi possível confirmar a gravação. Recarregue antes de tentar novamente.",
      );
    }
  }
  const versions = await client.assistants.getVersions(id, { limit: 1 });
  if (
    !versions.some((item) => item.version === updated.version) ||
    saved.version !== updated.version
  ) {
    throw new Error(
      "Não foi possível confirmar a versão salva. Recarregue o histórico antes de tentar novamente.",
    );
  }
  return saved;
}
