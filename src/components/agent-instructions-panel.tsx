"use client";

import { toast } from "sonner";
import { InstructionHistory } from "@/components/instruction-history";

import React, { useEffect, useState } from "react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { RefreshCw, Save } from "lucide-react";
import { getApiKey } from "@/lib/api-key";
import { resolveAssistant, saveAssistantContext } from "@/lib/assistant-config";

const DEFAULT_AGENTS_URL =
  "https://raw.githubusercontent.com/markanthony91/simple-agent-template/main/config/AGENTS.md";

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    assistantId: params.get("assistantId") || process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent",
    apiKey: getApiKey() || undefined,
  };
}

async function loadDefaultAgents(): Promise<string> {
  const response = await fetch(DEFAULT_AGENTS_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Falha ao carregar AGENTS.md padrão (${response.status}).`);
  return (await response.text()).trim();
}

export function AgentInstructionsPanel(): React.ReactNode {
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [value, setValue] = useState("");
  const [savedValue, setSavedValue] = useState("");
  const [source, setSource] = useState<"default" | "override">("default");
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
        const record = await resolveAssistant(client, assistantId);
        const context = (record.context ?? {}) as Record<string, unknown>;
        const override = typeof context.agent_instructions === "string" ? context.agent_instructions.trim() : "";
        const content = override || await loadDefaultAgents();
        setAssistant(record);
        setValue(content);
        setSavedValue(content);
        setSource(override ? "override" : "default");
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao carregar AGENTS.md.");
      } finally { setLoading(false); }
    })();
  }, []);

  const reloadDefault = async () => {
    setLoading(true); setError(null); setMessage(null);
    try {
      const content = await loadDefaultAgents();
      setValue(content);
      setSource("default");
      setMessage("AGENTS.md padrão carregado no editor. Salve somente se quiser criar um override para este Assistant.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar AGENTS.md padrão.");
    } finally { setLoading(false); }
  };

  const save = async () => {
    if (!assistant || !value.trim()) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const { apiUrl, apiKey } = getConnection();
      const client = new Client({ apiUrl, apiKey });
      const updated = await saveAssistantContext(client, assistant.assistant_id, { agent_instructions: value });
      toast.success("Salvo com sucesso", { description: `AGENTS.md · versão ${updated.version}` });
      setAssistant(updated); setSavedValue(value); setSource("override");
      setMessage("Agent Instructions salvas como override deste Assistant.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar Agent Instructions.");
    } finally { setSaving(false); }
  };

  return <div className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold">Agent Instructions</h3>
        <p className="mt-1 text-sm text-neutral-500">Camada operacional equivalente ao AGENTS.md: uso de tools, navegação, grounding e regras gerais do agente.</p>
        <p className="mt-1 text-xs text-neutral-400">Fonte atual: {source === "default" ? "config/AGENTS.md padrão do repositório" : "override salvo no Assistant"}.</p>
      </div>
      <button onClick={() => void reloadDefault()} disabled={loading || saving} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Ver AGENTS.md padrão</button>
    </div>
    {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div>}
    {assistant && <InstructionHistory key={`${assistant.assistant_id}:${assistant.version}`} assistantId={assistant.assistant_id} field="agent_instructions" version={assistant.version} disabled={loading || saving} onSelect={setValue} />}
    <textarea value={value} onChange={(event) => setValue(event.target.value)} disabled={loading || saving} spellCheck={false} className="mt-4 min-h-[55vh] w-full resize-y rounded-xl border bg-neutral-50 p-4 font-mono text-sm leading-6 outline-none dark:bg-neutral-900" placeholder={loading ? "Carregando..." : "Defina as instruções operacionais do agente..."} />
    <div className="mt-3 flex items-center justify-between"><span className="text-xs text-neutral-500">{value === savedValue ? "Sincronizado" : "Alterações não salvas"}</span><button onClick={() => void save()} disabled={loading || saving || !value.trim() || value === savedValue} className="flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar override"}</button></div>
  </div>;
}
