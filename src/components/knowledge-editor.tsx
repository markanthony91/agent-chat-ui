"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Pencil,
  RefreshCw,
  Save,
  Search,
  X,
} from "lucide-react";
import { Client, type Assistant } from "@langchain/langgraph-sdk";
import { getApiKey } from "@/lib/api-key";
import { validateOkfEdit } from "@/lib/okf-edit";

type KnowledgeFile = { path: string; content?: string };

type AssistantContext = Record<string, unknown> & {
  okf_overrides?: Record<string, string>;
  okf_bundle_files?: string[];
  okf_bundle_name?: string;
  okf_bundle_version?: string;
};

function getConnection() {
  const params = new URLSearchParams(window.location.search);
  return {
    apiUrl: params.get("apiUrl") || process.env.NEXT_PUBLIC_API_URL || "",
    assistantId:
      params.get("assistantId") ||
      process.env.NEXT_PUBLIC_ASSISTANT_ID ||
      "agent",
    apiKey: getApiKey() || undefined,
  };
}

async function getAssistant(
  client: Client,
  assistantId: string,
): Promise<Assistant> {
  try {
    return await client.assistants.get(assistantId);
  } catch {
    const assistants = await client.assistants.search({
      graphId: assistantId,
      limit: 20,
      offset: 0,
    });
    const assistant = assistants.find((item) => item.graph_id === assistantId);
    if (!assistant) {
      throw new Error("Nenhum assistant encontrado para este graph ID.");
    }
    return assistant;
  }
}

function parseToolResult(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.content === "string") return record.content;
    if (Array.isArray(record.content)) {
      return record.content
        .map((item) =>
          typeof item === "string" ? item : JSON.stringify(item),
        )
        .join("\n");
    }
  }
  return String(value ?? "");
}

async function readThroughAgent(
  client: Client,
  assistantId: string,
  path: string,
): Promise<string> {
  const thread = await client.threads.create();
  try {
    const stream = client.runs.stream(thread.thread_id, assistantId, {
      input: {
        messages: [
          {
            type: "human",
            content: `Use somente a tool okf_read com estes argumentos: ${JSON.stringify({ path })}. Retorne o resultado sem resumir.`,
          },
        ],
      },
      streamMode: ["values"],
    });
    let result = "";
    for await (const event of stream) {
      const data = event.data as
        | { messages?: Array<Record<string, unknown>> }
        | undefined;
      for (const message of data?.messages ?? []) {
        if (message.type === "tool" && message.name === "okf_read") {
          result = parseToolResult(message.content);
        }
      }
    }
    if (!result) throw new Error("A tool okf_read não retornou conteúdo.");
    return result;
  } finally {
    await client.threads.delete(thread.thread_id);
  }
}

function normalizeFiles(context: AssistantContext): string[] {
  const bundleFiles = Array.isArray(context.okf_bundle_files)
    ? context.okf_bundle_files.filter(
        (path): path is string =>
          typeof path === "string" && path.toLowerCase().endsWith(".md"),
      )
    : [];
  if (bundleFiles.length) return Array.from(new Set(bundleFiles)).sort();

  const overrides =
    context.okf_overrides && typeof context.okf_overrides === "object"
      ? context.okf_overrides
      : {};
  return Object.keys(overrides)
    .filter((path) => path.toLowerCase().endsWith(".md"))
    .sort();
}

function topFolder(path: string): string {
  return path.includes("/") ? path.split("/")[0] : "root";
}

export function KnowledgeEditor(): React.ReactNode {
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [context, setContext] = useState<AssistantContext>({});
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [selected, setSelected] = useState<KnowledgeFile | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());
  const [cache, setCache] = useState<Record<string, string>>({});

  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return files;
    return files.filter((file) => file.path.toLowerCase().includes(needle));
  }, [files, query]);

  const folders = useMemo(
    () => Array.from(new Set(filteredFiles.map((file) => topFolder(file.path)))),
    [filteredFiles],
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { apiUrl, assistantId, apiKey } = getConnection();
      if (!apiUrl) throw new Error("Deployment URL não configurada.");
      const client = new Client({ apiUrl, apiKey });
      const record = await getAssistant(client, assistantId);
      const nextContext = (record.context ?? {}) as AssistantContext;
      const paths = normalizeFiles(nextContext);
      setAssistant(record);
      setContext(nextContext);
      setFiles(paths.map((path) => ({ path })));
      setSelected(null);
      setEditing(false);
      setDraft("");
      setOpenFolders(new Set());

      const overrides = nextContext.okf_overrides ?? {};
      setCache((current) => ({ ...current, ...overrides }));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao carregar OKF.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openFile = async (file: KnowledgeFile) => {
    setError(null);
    setEditing(false);

    const direct = cache[file.path] ?? context.okf_overrides?.[file.path];
    if (typeof direct === "string") {
      setSelected({ path: file.path, content: direct });
      setDraft(direct);
      return;
    }

    setLoading(true);
    try {
      const { apiUrl, assistantId, apiKey } = getConnection();
      const client = new Client({ apiUrl, apiKey });
      const content = await readThroughAgent(client, assistantId, file.path);
      setCache((current) => ({ ...current, [file.path]: content }));
      setSelected({ path: file.path, content });
      setDraft(content);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao abrir arquivo OKF.",
      );
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!selected || !assistant) return;
    const validation = validateOkfEdit(selected.path, draft);
    if (validation) {
      setError(validation);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const { apiUrl, apiKey } = getConnection();
      const client = new Client({ apiUrl, apiKey });
      const overrides = { ...(context.okf_overrides ?? {}) };
      overrides[selected.path] = draft;
      const nextContext: AssistantContext = {
        ...context,
        okf_overrides: overrides,
      };
      const updated = await client.assistants.update(assistant.assistant_id, {
        context: nextContext,
      });
      setAssistant(updated);
      setContext(nextContext);
      setCache((current) => ({ ...current, [selected.path]: draft }));
      setSelected({ ...selected, content: draft });
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao salvar o conhecimento.",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleFolder = (folder: string) => {
    setOpenFolders((current) => {
      const next = new Set(current);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return next;
    });
  };

  const searchActive = query.trim().length > 0;
  const bundleName =
    typeof context.okf_bundle_name === "string"
      ? context.okf_bundle_name
      : "OKF ativo";
  const bundleVersion =
    typeof context.okf_bundle_version === "string"
      ? context.okf_bundle_version
      : "0.2";

  return (
    <div className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Knowledge</h3>
          <p className="mt-1 text-sm text-neutral-500">
            OKF {bundleVersion} usado pelo agente. Navegação direta, sem LLM.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading || editing}
          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}
      {saved && (
        <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
          Conhecimento salvo no runtime.
        </div>
      )}

      <div className="mt-4 flex items-center gap-2 rounded-lg border px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-neutral-400" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar arquivo por nome ou path..."
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
        {query && (
          <button onClick={() => setQuery("")} aria-label="Limpar busca">
            <X className="h-4 w-4 text-neutral-400" />
          </button>
        )}
      </div>

      <div className="mt-5 grid min-h-[52vh] grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        <div className="max-h-[58vh] overflow-auto rounded-xl border p-3">
          <div className="mb-3 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            <span>knowledge/okf</span>
            <span>{filteredFiles.length}</span>
          </div>

          {loading && files.length === 0 && (
            <p className="px-2 py-3 text-sm text-neutral-500">Carregando metadados...</p>
          )}

          {!loading && files.length === 0 && (
            <p className="px-2 py-3 text-sm text-neutral-500">
              Nenhum arquivo OKF encontrado no contexto do Assistant.
            </p>
          )}

          {folders.map((folder) => {
            const children = filteredFiles.filter(
              (file) => topFolder(file.path) === folder,
            );
            const expanded = searchActive || openFolders.has(folder);
            return (
              <div key={folder} className="mb-2">
                <button
                  type="button"
                  onClick={() => toggleFolder(folder)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  {expanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  <Folder className="h-4 w-4" />
                  <span className="min-w-0 flex-1 truncate">{folder}</span>
                  <span className="text-xs text-neutral-400">{children.length}</span>
                </button>

                {expanded &&
                  children.map((file) => (
                    <button
                      key={file.path}
                      disabled={editing}
                      onClick={() => void openFile(file)}
                      className={`mt-1 flex w-full items-center gap-2 rounded-lg py-2 pr-2 pl-8 text-left text-sm disabled:opacity-50 ${
                        selected?.path === file.path
                          ? "bg-neutral-100 dark:bg-neutral-800"
                          : "hover:bg-neutral-50 dark:hover:bg-neutral-900"
                      }`}
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate" title={file.path}>
                        {folder === "root" ? file.path : file.path.slice(folder.length + 1)}
                      </span>
                    </button>
                  ))}
              </div>
            );
          })}
        </div>

        <div className="min-w-0 rounded-xl border">
          <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
            <p className="truncate text-sm font-medium">
              {selected?.path ?? "Selecione um arquivo"}
            </p>
            {selected && !editing && (
              <button
                onClick={() => {
                  setDraft(selected.content ?? "");
                  setEditing(true);
                }}
                className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
              >
                <Pencil className="h-4 w-4" /> Editar
              </button>
            )}
            {selected && editing && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setDraft(selected.content ?? "");
                    setError(null);
                    setEditing(false);
                  }}
                  className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
                >
                  <X className="h-4 w-4" /> Cancelar
                </button>
                <button
                  onClick={() => void save()}
                  disabled={saving || draft === (selected.content ?? "")}
                  className="flex items-center gap-2 rounded-lg bg-neutral-950 px-3 py-1.5 text-sm text-white disabled:opacity-40 dark:bg-white dark:text-neutral-950"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            )}
          </div>

          {editing ? (
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
              className="min-h-[55vh] w-full resize-none bg-transparent p-4 font-mono text-xs leading-6 outline-none"
            />
          ) : (
            <pre className="max-h-[55vh] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs leading-6 text-neutral-700 dark:text-neutral-300">
              {loading && selected
                ? "Carregando arquivo..."
                : selected?.content ??
                  "Selecione um arquivo OKF para visualizar seu conteúdo."}
            </pre>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-neutral-500">
        <span>{files.length} arquivos Markdown</span>
        <span>Bundle: {bundleName}</span>
        <span>OKF {bundleVersion}</span>
        <span>{editing ? "Editando" : "Pronto"}</span>
        <span>Listagem: Assistant context</span>
      </div>
    </div>
  );
}
