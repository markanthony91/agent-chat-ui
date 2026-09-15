"use client";

import React, { useEffect, useState } from "react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";
import { KnowledgeEditor } from "@/components/knowledge-editor";
import { OkfBundleImporter } from "@/components/okf-bundle-importer";
import { RawOkfCompiler } from "@/components/raw-okf-compiler";
import { ToolsPanel } from "@/components/tools-panel";
import { AgentInstructionsPanel } from "@/components/agent-instructions-panel";
import { WorkflowsPanel } from "@/components/workflows-panel";
import { SimulatorPanel } from "@/components/simulator-panel";

const DEFAULT_PROMPT = `# System Prompt\n\nVocê é um agente de atendimento especializado em cobrança e negociação.\n\n## Comportamento\n\n- Converse naturalmente, como uma pessoa.\n- Seja claro, objetivo e respeitoso.\n- Não invente políticas, condições, descontos, limites ou exceções.\n- Consulte o conhecimento institucional quando necessário.\n`;

type Tab = "prompt" | "instructions" | "workflows" | "knowledge" | "compiler" | "tools" | "simulator";

function connection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    assistantId: params.get("assistantId") || process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent",
    apiKey: getApiKey() || undefined,
  };
}

async function findAssistant(client: Client, graphId: string): Promise<Assistant> {
  const records = await client.assistants.search({ graphId, limit: 20, offset: 0 });
  const record = records.find((item) => item.graph_id === graphId);
  if (!record) throw new Error("Assistant não encontrado.");
  return record;
}

export function AgentSettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }): React.ReactNode {
  const [tab, setTab] = useState<Tab>("prompt");
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_PROMPT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knowledgeRevision, setKnowledgeRevision] = useState(0);

  useEffect(() => {
    if (!open || tab !== "prompt") return;
    void (async () => {
      setLoading(true); setError(null);
      try {
        const cfg = connection();
        if (!cfg.apiUrl) throw new Error("Deployment URL não configurada.");
        const client = new Client({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey });
        const record = await findAssistant(client, cfg.assistantId);
        const context = (record.context ?? {}) as Record<string, unknown>;
        const value = typeof context.system_prompt === "string" ? context.system_prompt : DEFAULT_PROMPT;
        setAssistant(record); setPrompt(value); setSavedPrompt(value);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao carregar configurações.");
      } finally { setLoading(false); }
    })();
  }, [open, tab]);

  const savePrompt = async () => {
    if (!assistant) return;
    setLoading(true); setError(null);
    try {
      const cfg = connection();
      const client = new Client({ apiUrl: cfg.apiUrl, apiKey: cfg.apiKey });
      const context = (assistant.context ?? {}) as Record<string, unknown>;
      const updated = await client.assistants.update(assistant.assistant_id, { context: { ...context, system_prompt: prompt } });
      setAssistant(updated); setSavedPrompt(prompt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar o prompt.");
    } finally { setLoading(false); }
  };

  const tabButton = (name: Tab, label: string) => <button type="button" onClick={() => setTab(name)} className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium sm:w-full sm:whitespace-normal ${tab === name ? "bg-neutral-100 text-neutral-950 dark:bg-neutral-800 dark:text-white" : "text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>{label}</button>;

  return <>
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-neutral-950">
        <div className="flex items-start justify-between border-b px-5 py-4 dark:border-neutral-800"><div><h2 className="text-lg font-semibold">Configurações do agente</h2><p className="mt-1 text-sm text-neutral-500">Identidade, operação, processos, conhecimento e recursos.</p></div><button onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">Fechar</button></div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="flex w-full flex-none gap-2 overflow-x-auto overscroll-x-contain border-b p-3 touch-pan-x sm:w-52 sm:flex-col sm:overflow-x-visible sm:border-r sm:border-b-0 dark:border-neutral-800">
            {tabButton("prompt", "System Prompt")}
            {tabButton("instructions", "Agent Instructions")}
            {tabButton("workflows", "Workflows")}
            {tabButton("knowledge", "Knowledge")}
            {tabButton("compiler", "RAW Compiler")}
            {tabButton("tools", "Tools")}
            {tabButton("simulator", "Simulator")}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "prompt" && <div className="p-5"><h3 className="font-semibold">System Prompt</h3><p className="mt-1 text-sm text-neutral-500">Identidade e regras superiores do agente.</p>{error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</div>}<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={loading} spellCheck={false} className="mt-4 min-h-[52vh] w-full resize-y rounded-xl border bg-neutral-50 p-4 font-mono text-sm leading-6 outline-none dark:bg-neutral-900" /><div className="mt-3 flex items-center justify-between"><span className="text-xs text-neutral-500">{prompt === savedPrompt ? "Sincronizado" : "Alterações não salvas"}</span><button onClick={() => void savePrompt()} disabled={loading || prompt === savedPrompt} className="rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950">Salvar</button></div></div>}
            {tab === "instructions" && <AgentInstructionsPanel />}
            {tab === "workflows" && <WorkflowsPanel />}
            {tab === "knowledge" && <div><div className="px-5 pt-5"><OkfBundleImporter onImported={() => setKnowledgeRevision((value) => value + 1)} /></div><KnowledgeEditor key={knowledgeRevision} /></div>}
            {tab === "compiler" && <RawOkfCompiler />}
            {tab === "tools" && <ToolsPanel />}
            {tab === "simulator" && <SimulatorPanel />}
          </div>
        </div>
      </div>
    </div>}
  </>;
}
