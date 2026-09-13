"use client";

import React, { useEffect, useState } from "react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { Save } from "lucide-react";
import { getApiKey } from "@/lib/api-key";

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    assistantId: params.get("assistantId") || process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent",
    apiKey: getApiKey() || undefined,
  };
}

async function getAssistant(client: Client, graphId: string): Promise<Assistant> {
  const assistants = await client.assistants.search({ graphId, limit: 20, offset: 0 });
  const assistant = assistants.find((item) => item.graph_id === graphId);
  if (!assistant) throw new Error("Assistant não encontrado.");
  return assistant;
}

export function AgentInstructionsPanel(): React.ReactNode {
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [value, setValue] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true); setError(null);
      try {
        const { apiUrl, assistantId, apiKey } = getConnection();
        if (!apiUrl) throw new Error("Deployment URL não configurada.");
        const client = new Client({ apiUrl, apiKey });
        const record = await getAssistant(client, assistantId);
        const context = (record.context ?? {}) as Record<string, unknown>;
        const content = typeof context.agent_instructions === "string" ? context.agent_instructions : "";
        setAssistant(record); setValue(content); setSavedValue(content);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao carregar AGENTS.md.");
      } finally { setLoading(false); }
    })();
  }, []);

  const save = async () => {
    if (!assistant || !value.trim()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const { apiUrl, apiKey } = getConnection();
      const client = new Client({ apiUrl, apiKey });
      const currentContext = (assistant.context ?? {}) as Record<string, unknown>;
      const updated = await client.assistants.update(assistant.assistant_id, {
        context: { ...currentContext, agent_instructions: value },
      });
      setAssistant(updated); setSavedValue(value); setMessage("Agent Instructions salvas no runtime.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar Agent Instructions.");
    } finally { setSaving(false); }
  };

  return <div className="p-5">
    <h3 className="font-semibold">Agent Instructions</h3>
    <p className="mt-1 text-sm text-neutral-500">Camada operacional equivalente ao AGENTS.md: uso de tools, navegação, grounding e regras gerais do agente.</p>
    {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div>}
    <textarea value={value} onChange={(event) => setValue(event.target.value)} disabled={loading || saving} spellCheck={false} className="mt-4 min-h-[55vh] w-full resize-y rounded-xl border bg-neutral-50 p-4 font-mono text-sm leading-6 outline-none dark:bg-neutral-900" placeholder={loading ? "Carregando..." : "Defina as instruções operacionais do agente..."} />
    <div className="mt-3 flex items-center justify-between"><span className="text-xs text-neutral-500">{value === savedValue ? "Sincronizado" : "Alterações não salvas"}</span><button onClick={() => void save()} disabled={loading || saving || !value.trim() || value === savedValue} className="flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar"}</button></div>
  </div>;
}
