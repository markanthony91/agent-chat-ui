"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { CheckCircle2, Plus, Save, Trash2 } from "lucide-react";
import { getApiKey } from "@/lib/api-key";

type WorkflowMap = Record<string, string>;

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

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "workflow";
}

export function WorkflowsPanel(): React.ReactNode {
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [workflows, setWorkflows] = useState<WorkflowMap>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedSaved = selectedId ? workflows[selectedId] ?? "" : "";
  const ids = useMemo(() => Object.keys(workflows).sort(), [workflows]);

  const load = async () => {
    setBusy(true); setError(null);
    try {
      const { apiUrl, assistantId, apiKey } = getConnection();
      if (!apiUrl) throw new Error("Deployment URL não configurada.");
      const client = new Client({ apiUrl, apiKey });
      const record = await getAssistant(client, assistantId);
      const context = (record.context ?? {}) as Record<string, unknown>;
      const remote = context.workflows && typeof context.workflows === "object" ? context.workflows as WorkflowMap : {};
      const active = typeof context.active_workflow_id === "string" ? context.active_workflow_id : null;
      setAssistant(record); setWorkflows(remote); setActiveId(active);
      const first = active && remote[active] ? active : Object.keys(remote)[0] ?? null;
      setSelectedId(first); setDraft(first ? remote[first] ?? "" : "");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar workflows.");
    } finally { setBusy(false); }
  };

  useEffect(() => { void load(); }, []);

  const updateContext = async (nextWorkflows: WorkflowMap, nextActiveId: string | null) => {
    if (!assistant) return;
    const { apiUrl, apiKey } = getConnection();
    const client = new Client({ apiUrl, apiKey });
    const current = (assistant.context ?? {}) as Record<string, unknown>;
    const activeWorkflow = nextActiveId ? nextWorkflows[nextActiveId] ?? "" : "";
    const updated = await client.assistants.update(assistant.assistant_id, {
      context: {
        ...current,
        workflows: nextWorkflows,
        active_workflow_id: nextActiveId,
        active_workflow: activeWorkflow,
      },
    });
    setAssistant(updated); setWorkflows(nextWorkflows); setActiveId(nextActiveId);
  };

  const create = async () => {
    const id = slug(newName);
    if (!newName.trim()) return;
    if (workflows[id]) { setError("Já existe um workflow com esse identificador."); return; }
    const template = `# ${newName.trim()}\n\n## Objetivo\n\nDescreva o objetivo do processo.\n\n## Etapas\n\n1. Defina a primeira etapa.\n2. Defina a próxima etapa.\n\n## Gates obrigatórios\n\n- Registre aqui validações que não podem ser puladas.\n`;
    const next = { ...workflows, [id]: template };
    setBusy(true); setError(null); setMessage(null);
    try {
      await updateContext(next, activeId);
      setSelectedId(id); setDraft(template); setNewName(""); setMessage("Workflow criado.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao criar workflow."); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!selectedId || !draft.trim()) return;
    const next = { ...workflows, [selectedId]: draft };
    setBusy(true); setError(null); setMessage(null);
    try {
      await updateContext(next, activeId);
      setMessage("Workflow salvo.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar workflow."); }
    finally { setBusy(false); }
  };

  const activate = async (id: string | null) => {
    setBusy(true); setError(null); setMessage(null);
    try {
      await updateContext(workflows, id);
      setMessage(id ? `Workflow ${id} ativado.` : "Workflow ativo removido.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao ativar workflow."); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!selectedId) return;
    const next = { ...workflows };
    delete next[selectedId];
    const nextActive = activeId === selectedId ? null : activeId;
    setBusy(true); setError(null); setMessage(null);
    try {
      await updateContext(next, nextActive);
      const first = Object.keys(next)[0] ?? null;
      setSelectedId(first); setDraft(first ? next[first] ?? "" : ""); setMessage("Workflow removido.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao remover workflow."); }
    finally { setBusy(false); }
  };

  return <div className="p-5">
    <div><h3 className="font-semibold">Workflows</h3><p className="mt-1 text-sm text-neutral-500">Guias processuais agentic. O workflow ativo entra no prompt do runtime sem criar router determinístico.</p></div>
    {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">{error}</div>}
    {message && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">{message}</div>}
    <div className="mt-4 flex flex-wrap gap-2"><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nome do novo workflow" className="min-w-[220px] flex-1 rounded-lg border bg-transparent px-3 py-2 text-sm outline-none" /><button onClick={() => void create()} disabled={busy || !newName.trim()} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-40"><Plus className="h-4 w-4" />Novo</button></div>
    <div className="mt-5 grid gap-4 md:grid-cols-[240px_1fr]">
      <div className="rounded-xl border p-2">{ids.map((id) => <button key={id} onClick={() => { setSelectedId(id); setDraft(workflows[id] ?? ""); setMessage(null); }} className={`mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${selectedId === id ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}><span className="truncate">{id}</span>{activeId === id && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</button>)}{ids.length === 0 && <p className="p-3 text-sm text-neutral-500">Nenhum workflow criado.</p>}</div>
      <div className="rounded-xl border">{selectedId ? <><div className="flex flex-wrap items-center justify-between gap-2 border-b p-3"><div><p className="font-mono text-sm font-semibold">{selectedId}</p><p className="text-xs text-neutral-500">{activeId === selectedId ? "Ativo no runtime" : "Inativo"}</p></div><div className="flex gap-2">{activeId === selectedId ? <button onClick={() => void activate(null)} disabled={busy} className="rounded-lg border px-3 py-1.5 text-sm">Desativar</button> : <button onClick={() => void activate(selectedId)} disabled={busy} className="rounded-lg border px-3 py-1.5 text-sm">Ativar</button>}<button onClick={() => void remove()} disabled={busy} className="rounded-lg border px-3 py-1.5 text-sm"><Trash2 className="h-4 w-4" /></button></div></div><textarea value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} className="min-h-[48vh] w-full resize-y bg-transparent p-4 font-mono text-sm leading-6 outline-none" /><div className="flex justify-end border-t p-3"><button onClick={() => void save()} disabled={busy || !draft.trim() || draft === selectedSaved} className="flex items-center gap-2 rounded-lg bg-neutral-950 px-4 py-2 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"><Save className="h-4 w-4" />Salvar</button></div></> : <p className="p-5 text-sm text-neutral-500">Crie ou selecione um workflow.</p>}</div>
    </div>
  </div>;
}
