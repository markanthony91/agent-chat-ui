"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, Folder, Pencil, RefreshCw, Save, X } from "lucide-react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";
import { validateOkfEdit } from "@/lib/okf-edit";

type KnowledgeFile = { path: string; content?: string };

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    assistantId: params.get("assistantId") || process.env.NEXT_PUBLIC_ASSISTANT_ID || "agent",
    apiKey: getApiKey() || undefined,
  };
}

async function getAssistant(client: Client, assistantId: string): Promise<Assistant> {
  try {
    return await client.assistants.get(assistantId);
  } catch {
    const assistants = await client.assistants.search({ graphId: assistantId, limit: 20, offset: 0 });
    const assistant = assistants.find((item) => item.graph_id === assistantId);
    if (!assistant) throw new Error("Nenhum assistant encontrado para este graph ID.");
    return assistant;
  }
}

function parseToolResult(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.content === "string") return record.content;
    if (Array.isArray(record.content)) return record.content.map((item) => typeof item === "string" ? item : JSON.stringify(item)).join("\n");
  }
  return String(value ?? "");
}

async function callKnowledgeTool(client: Client, assistantId: string, toolName: string, args: Record<string, unknown>): Promise<string> {
  const thread = await client.threads.create();
  try {
    const stream = client.runs.stream(thread.thread_id, assistantId, {
      input: { messages: [{ type: "human", content: `Use somente a tool ${toolName} com estes argumentos: ${JSON.stringify(args)}. Retorne o resultado sem resumir.` }] },
      streamMode: ["values"],
    });
    let result = "";
    for await (const event of stream) {
      const data = event.data as { messages?: Array<Record<string, unknown>> } | undefined;
      for (const message of data?.messages ?? []) {
        if (message.type === "tool" && message.name === toolName) result = parseToolResult(message.content);
      }
    }
    if (!result) throw new Error(`A tool ${toolName} não retornou conteúdo.`);
    return result;
  } finally {
    await client.threads.delete(thread.thread_id);
  }
}

export function KnowledgeEditor(): React.ReactNode {
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [selected, setSelected] = useState<KnowledgeFile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const folders = useMemo(
    () => Array.from(new Set(files.map((file) => file.path.includes("/") ? file.path.split("/")[0] : "root"))),
    [files],
  );

  const openFile = async (file: KnowledgeFile, client?: Client, assistantId?: string) => {
    setLoading(true);
    setError(null);
    setEditing(false);
    try {
      const connection = getConnection();
      const sdk = client ?? new Client({ apiUrl: connection.apiUrl, apiKey: connection.apiKey });
      const agentId = assistantId ?? connection.assistantId;
      const content = await callKnowledgeTool(sdk, agentId, "okf_read", { path: file.path });
      setSelected({ path: file.path, content });
      setDraft(content);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao abrir arquivo OKF.");
    } finally {
      setLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { apiUrl, assistantId, apiKey } = getConnection();
      if (!apiUrl) throw new Error("Deployment URL não configurada.");
      const client = new Client({ apiUrl, apiKey });
      const result = await callKnowledgeTool(client, assistantId, "okf_list", {});
      const nextFiles = result.split("\n").map((path) => path.trim()).filter((path) => path.endsWith(".md")).map((path) => ({ path }));
      setFiles(nextFiles);
      if (!selected && nextFiles.length) await openFile(nextFiles[0], client, assistantId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar OKF.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const save = async () => {
    if (!selected) return;
    const validation = validateOkfEdit(selected.path, draft);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { apiUrl, assistantId, apiKey } = getConnection();
      const client = new Client({ apiUrl, apiKey });
      const assistant = await getAssistant(client, assistantId);
      const context = (assistant.context ?? {}) as Record<string, unknown>;
      const raw = context.okf_overrides;
      const overrides = raw && typeof raw === "object" ? { ...(raw as Record<string, string>) } : {};
      overrides[selected.path] = draft;
      await client.assistants.update(assistant.assistant_id, { context: { ...context, okf_overrides: overrides } });
      setSelected({ ...selected, content: draft });
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao salvar o conhecimento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Knowledge</h3>
          <p className="mt-1 text-sm text-neutral-500">OKF 0.2 usado pelo agente. Alterações são aplicadas sem redeploy.</p>
        </div>
        <button onClick={() => void load()} disabled={loading || editing} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      {error && <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {saved && <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Conhecimento salvo no runtime.</div>}

      <div className="mt-5 grid min-h-[52vh] grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
        <div className="rounded-xl border p-3">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-400">knowledge/okf</div>
          {folders.map((folder) => (
            <div key={folder} className="mb-3">
              <div className="flex items-center gap-2 px-2 py-1 text-sm font-medium"><Folder className="h-4 w-4" />{folder}</div>
              {files.filter((file) => (file.path.includes("/") ? file.path.split("/")[0] : "root") === folder).map((file) => (
                <button key={file.path} disabled={editing} onClick={() => void openFile(file)} className={`mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm disabled:opacity-50 ${selected?.path === file.path ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-50 dark:hover:bg-neutral-900"}`}>
                  <FileText className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{file.path.split("/").pop()}</span><ChevronRight className="h-3 w-3" />
                </button>
              ))}
            </div>
          ))}
        </div>

        <div className="min-w-0 rounded-xl border">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <p className="truncate text-sm font-medium">{selected?.path ?? "Selecione um arquivo"}</p>
            {selected && !editing && (
              <button onClick={() => { setDraft(selected.content ?? ""); setEditing(true); }} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"><Pencil className="h-4 w-4" />Editar</button>
            )}
            {selected && editing && (
              <div className="flex gap-2">
                <button onClick={() => { setDraft(selected.content ?? ""); setError(null); setEditing(false); }} className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"><X className="h-4 w-4" />Cancelar</button>
                <button onClick={() => void save()} disabled={saving || draft === (selected.content ?? "")} className="flex items-center gap-2 rounded-lg bg-neutral-950 px-3 py-1.5 text-sm text-white disabled:opacity-40"><Save className="h-4 w-4" />{saving ? "Salvando..." : "Salvar"}</button>
              </div>
            )}
          </div>

          {editing ? (
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} spellCheck={false} className="min-h-[55vh] w-full resize-none bg-transparent p-4 font-mono text-xs leading-6 outline-none" />
          ) : (
            <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-neutral-700 dark:text-neutral-300">{loading && !selected ? "Carregando..." : selected?.content ?? "Selecione um arquivo OKF para visualizar seu conteúdo."}</pre>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-500"><span>{files.length} arquivos Markdown</span><span>OKF 0.2</span><span>{editing ? "Editando" : "Pronto"}</span><span>Persistência: Assistant context</span></div>
    </div>
  );
}
