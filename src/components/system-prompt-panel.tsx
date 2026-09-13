"use client";

import React, { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";
import { KnowledgeEditor } from "@/components/knowledge-editor";
import { OkfBundleImporter } from "@/components/okf-bundle-importer";
import { RawOkfCompiler } from "@/components/raw-okf-compiler";
import { ToolsPanel } from "@/components/tools-panel";

const DEFAULT_PROMPT = `# System Prompt

Você é um agente de atendimento especializado em cobrança e negociação.

## Comportamento

- Converse naturalmente, como uma pessoa, sem linguagem robótica.
- Seja claro, objetivo e respeitoso.
- Não invente políticas, condições, descontos, limites ou exceções.
- Consulte o conhecimento institucional quando a resposta depender de regras, produtos, instituições, procedimentos ou políticas.
- Não consulte conhecimento para saudações ou conversa casual.
- Nunca exponha ao cliente nomes de tools, paths, arquivos, index.md, OKF ou detalhes internos de navegação.
- Quando uma regra não estiver documentada no conhecimento disponível, diga isso de forma natural em vez de presumir a resposta.
`;

type SettingsTab = "prompt" | "knowledge" | "compiler" | "tools";

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    assistantId: params.get("assistantId") || process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent",
    apiKey: getApiKey() || undefined,
  };
}

async function getAssistant(client: Client, assistantId: string): Promise<Assistant> {
  const assistants = await client.assistants.search({ graphId: assistantId, limit: 20, offset: 0 });
  const assistant = assistants.find((item) => item.graph_id === assistantId);
  if (!assistant) throw new Error("Nenhum assistant encontrado para este graph ID.");
  return assistant;
}

export function SystemPromptPanel(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<SettingsTab>("prompt");
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_PROMPT);
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [knowledgeRevision, setKnowledgeRevision] = useState(0);

  useEffect(() => {
    const openSettings = () => setOpen(true);
    window.addEventListener("agent-settings:open", openSettings);
    return () => window.removeEventListener("agent-settings:open", openSettings);
  }, []);

  useEffect(() => {
    if (!open || tab !== "prompt") return;
    void (async () => {
      setLoading(true); setError(null);
      try {
        const { apiUrl, assistantId, apiKey } = getConnection();
        if (!apiUrl) throw new Error("Deployment URL não configurada.");
        const client = new Client({ apiUrl, apiKey });
        const record = await getAssistant(client, assistantId);
        const context = (record.context ?? {}) as Record<string, unknown>;
        const remotePrompt = typeof context.system_prompt === "string" ? context.system_prompt : DEFAULT_PROMPT;
        setAssistant(record); setPrompt(remotePrompt); setSavedPrompt(remotePrompt);
      } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar o prompt."); }
      finally { setLoading(false); }
    })();
  }, [open, tab]);

  const isDirty = prompt !== savedPrompt;
  const savePrompt = async () => {
    if (!assistant) return;
    setSaving(true); setError(null);
    try {
      const { apiUrl, apiKey } = getConnection();
      const client = new Client({ apiUrl, apiKey });
      const currentContext = (assistant.context ?? {}) as Record<string, unknown>;
      const updated = await client.assistants.update(assistant.assistant_id, { context: { ...currentContext, system_prompt: prompt } });
      setAssistant(updated); setSavedPrompt(prompt); setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar o prompt."); }
    finally { setSaving(false); }
  };

  const tabClass = (name: SettingsTab) => `rounded-lg px-3 py-2 text-left text-sm font-medium ${tab === name ? "bg-neutral-100 text-neutral-950 dark:bg-neutral-800 dark:text-white" : "text-neutral-500 hover:bg-neutral-50 dark:hover:bg-neutral-900"}`;

  return <>
    {!open && <button type="button" onClick={() => setOpen(true)} className="fixed right-14 top-3 z-40 flex h-10 w-10 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800" aria-label="Abrir configurações do agente" title="Configurações do agente"><Settings className="h-5 w-5" /></button>}
    {open && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-neutral-950">
        <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800"><div><h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">Configurações do agente</h2><p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Prompt, conhecimento, compiler e tools disponíveis no runtime.</p></div><button type="button" onClick={() => setOpen(false)} className="ml-4 rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">Fechar</button></div>
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          <div className="flex gap-2 border-b border-neutral-200 p-3 sm:w-52 sm:flex-col sm:border-r sm:border-b-0 dark:border-neutral-800">
            <button type="button" onClick={() => setTab("prompt")} className={tabClass("prompt")}>System Prompt</button>
            <button type="button" onClick={() => setTab("knowledge")} className={tabClass("knowledge")}>Knowledge</button>
            <button type="button" onClick={() => setTab("compiler")} className={tabClass("compiler")}>RAW Compiler</button>
            <button type="button" onClick={() => setTab("tools")} className={tabClass("tools")}>Tools</button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "prompt" && <>
              <div className="p-5"><h3 className="font-semibold text-neutral-950 dark:text-neutral-50">System Prompt</h3><p className="mt-1 mb-4 text-sm text-neutral-500 dark:text-neutral-400">Salvo no Assistant do LangGraph e aplicado aos próximos runs.</p>{error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}<textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={loading || saving} spellCheck={false} className="min-h-[48vh] w-full resize-y rounded-xl border border-neutral-300 bg-neutral-50 p-4 font-mono text-sm leading-6 text-neutral-900 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100" /><div className="mt-2 flex items-center justify-between text-xs text-neutral-500"><span>{prompt.length.toLocaleString()} caracteres</span><span>{loading ? "Carregando..." : isDirty ? "Alterações não salvas" : "Sincronizado com o runtime"}</span></div></div>
              <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">{saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Salvo no runtime</span>}<button type="button" onClick={() => void savePrompt()} disabled={!isDirty || loading || saving || !assistant} className="rounded-lg bg-neutral-950 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-950">{saving ? "Salvando..." : "Salvar"}</button></div>
            </>}
            {tab === "knowledge" && <div><div className="px-5 pt-5"><OkfBundleImporter onImported={() => setKnowledgeRevision((value) => value + 1)} /></div><KnowledgeEditor key={knowledgeRevision} /></div>}
            {tab === "compiler" && <RawOkfCompiler />}
            {tab === "tools" && <ToolsPanel />}
          </div>
        </div>
      </div>
    </div>}
  </>;
}
