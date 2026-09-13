"use client";

import React, { useEffect, useState } from "react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";

const DEFAULT_PROMPT = `# System Prompt\n\nVocê é um agente de atendimento especializado.\n\n## Behavior\n\n- Converse naturalmente.\n- Não invente informações.\n- Consulte o conhecimento institucional quando a resposta depender de regras ou políticas.\n- Use as tools disponíveis quando necessário.\n`;

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  const apiUrl = params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "";
  const assistantId = params.get("assistantId") || process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent";
  const apiKey = getApiKey() || undefined;
  return { apiUrl, assistantId, apiKey };
}

async function getAssistant(client: Client, assistantId: string): Promise<Assistant> {
  try {
    return await client.assistants.get(assistantId);
  } catch {
    const assistants = await client.assistants.search({
      graphId: assistantId,
      limit: 20,
      offset: 0,
    });
    const assistant = assistants.find((item) => item.graph_id === assistantId);
    if (!assistant) throw new Error("Nenhum assistant encontrado para este graph ID.");
    return assistant;
  }
}

export function SystemPromptPanel(): React.ReactNode {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_PROMPT);
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { apiUrl, assistantId, apiKey } = getConnection();
        if (!apiUrl) throw new Error("Deployment URL não configurada.");
        const client = new Client({ apiUrl, apiKey });
        const record = await getAssistant(client, assistantId);
        const context = (record.context ?? {}) as Record<string, unknown>;
        const remotePrompt = typeof context.system_prompt === "string" ? context.system_prompt : DEFAULT_PROMPT;
        setAssistant(record);
        setPrompt(remotePrompt);
        setSavedPrompt(remotePrompt);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Falha ao carregar o prompt.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [open]);

  const isDirty = prompt !== savedPrompt;

  const save = async () => {
    if (!assistant) return;
    setSaving(true);
    setError(null);
    try {
      const { apiUrl, apiKey } = getConnection();
      const client = new Client({ apiUrl, apiKey });
      const currentContext = (assistant.context ?? {}) as Record<string, unknown>;
      const updated = await client.assistants.update(assistant.assistant_id, {
        context: { ...currentContext, system_prompt: prompt },
      });
      setAssistant(updated);
      setSavedPrompt(prompt);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar o prompt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 top-4 z-40 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-800 shadow-sm transition hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:hover:bg-neutral-800"
      >
        System Prompt
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div className="flex max-h-[92vh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl dark:bg-neutral-950">
            <div className="flex items-start justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
              <div>
                <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">System Prompt</h2>
                <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Salvo no Assistant do LangGraph e aplicado aos próximos runs.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="ml-4 rounded-lg px-3 py-1.5 text-sm text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">Fechar</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div>}
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300" htmlFor="system-prompt-editor">Prompt em Markdown</label>
              <textarea
                id="system-prompt-editor"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                disabled={loading || saving}
                spellCheck={false}
                className="min-h-[52vh] w-full resize-y rounded-xl border border-neutral-300 bg-neutral-50 p-4 font-mono text-sm leading-6 text-neutral-900 outline-none focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-neutral-500">
                <span>{prompt.length.toLocaleString()} caracteres</span>
                <span>{loading ? "Carregando..." : isDirty ? "Alterações não salvas" : "Sincronizado com o runtime"}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-neutral-200 px-5 py-4 dark:border-neutral-800">
              {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Salvo no runtime</span>}
              <button
                type="button"
                onClick={() => void save()}
                disabled={!isDirty || loading || saving || !assistant}
                className="rounded-lg bg-neutral-950 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-neutral-950"
              >
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
